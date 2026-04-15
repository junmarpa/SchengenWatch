#!/usr/bin/env python3
"""
Perimeter Sentinel — Log Processor
====================================
Tails /var/log/perimeter/traffic.jsonl (produced by syslog-ng) and writes
de-duplicated connection records to SQLite.

Schema (traffic table):
  id           TEXT  — UUID v4, primary key
  src_ip       TEXT
  dst_ip       TEXT
  dst_port     INTEGER
  protocol     TEXT  — "TCP" | "UDP"
  first_seen   TEXT  — ISO-8601 UTC
  last_seen    TEXT  — ISO-8601 UTC
  count        INTEGER — total communications since first_seen

Uniqueness key: (src_ip, dst_ip, dst_port, protocol)
On collision: update last_seen + increment count.
"""

import json
import logging
import os
import re
import signal
import sqlite3
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

# ── Configuration (overridable via env vars) ───────────────────────────────
LOG_FILE   = os.getenv("SENTINEL_LOG_FILE",  "/var/log/perimeter/traffic.jsonl")
DB_PATH    = os.getenv("SENTINEL_DB_PATH",   "/data/sentinel.db")
BATCH_SIZE = int(os.getenv("SENTINEL_BATCH", "50"))   # rows before commit
POLL_SEC   = float(os.getenv("SENTINEL_POLL", "0.5")) # tail poll interval

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s [processor] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("sentinel")

# ── Valid IPv4 pattern ─────────────────────────────────────────────────────
_IPV4 = re.compile(
    r"^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$"
)
_VALID_PROTO = {"tcp", "udp"}


def normalise(record: dict) -> dict | None:
    """Validate and normalise a parsed JSON record.  Return None to discard."""
    src = (record.get("src_ip") or "").strip()
    dst = (record.get("dst_ip") or "").strip()
    port_raw = str(record.get("dst_port") or "").strip()
    proto = (record.get("protocol") or "").strip().upper()

    if not (_IPV4.match(src) and _IPV4.match(dst)):
        return None
    if src == dst:
        return None  # loopback noise
    try:
        port = int(port_raw)
        if not (1 <= port <= 65535):
            return None
    except (ValueError, TypeError):
        return None
    if proto not in ("TCP", "UDP"):
        return None

    return {"src_ip": src, "dst_ip": dst, "dst_port": port, "protocol": proto}


# ── SQLite init ────────────────────────────────────────────────────────────
def init_db(path: str) -> sqlite3.Connection:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS traffic (
            id         TEXT    PRIMARY KEY,
            src_ip     TEXT    NOT NULL,
            dst_ip     TEXT    NOT NULL,
            dst_port   INTEGER NOT NULL,
            protocol   TEXT    NOT NULL,
            first_seen TEXT    NOT NULL,
            last_seen  TEXT    NOT NULL,
            count      INTEGER NOT NULL DEFAULT 1
        )
    """)
    conn.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS ux_traffic_tuple
        ON traffic (src_ip, dst_ip, dst_port, protocol)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS ix_dst_ip  ON traffic (dst_ip)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS ix_dst_port ON traffic (dst_port)
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS ix_first_seen ON traffic (first_seen)
    """)
    conn.commit()
    log.info("Database ready at %s", path)
    return conn


# ── Upsert ─────────────────────────────────────────────────────────────────
UPSERT_SQL = """
    INSERT INTO traffic (id, src_ip, dst_ip, dst_port, protocol, first_seen, last_seen, count)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT (src_ip, dst_ip, dst_port, protocol) DO UPDATE SET
        last_seen = excluded.last_seen,
        count     = count + 1
"""

def upsert_batch(conn: sqlite3.Connection, batch: list[dict]) -> int:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = [
        (
            str(uuid.uuid4()),
            r["src_ip"],
            r["dst_ip"],
            r["dst_port"],
            r["protocol"],
            now,   # first_seen — ignored on conflict
            now,   # last_seen  — always updated
        )
        for r in batch
    ]
    with conn:
        conn.executemany(UPSERT_SQL, rows)
    return len(rows)


# ── Tail log file ──────────────────────────────────────────────────────────
def tail_file(path: str):
    """Generator that yields new lines from a growing file (log-rotate aware)."""
    fp = None
    inode = None

    while True:
        try:
            stat = os.stat(path)
        except FileNotFoundError:
            time.sleep(POLL_SEC)
            continue

        if fp is None or stat.st_ino != inode:
            # File appeared or was rotated — open fresh
            if fp:
                fp.close()
            fp    = open(path, "r", encoding="utf-8", errors="replace")
            inode = stat.st_ino
            log.info("Opened %s (inode %d)", path, inode)

        line = fp.readline()
        if line:
            yield line.rstrip("\n")
        else:
            time.sleep(POLL_SEC)


# ── Main ───────────────────────────────────────────────────────────────────
def main():
    conn  = init_db(DB_PATH)
    batch: list[dict] = []
    total = 0

    def flush():
        nonlocal total
        if not batch:
            return
        n     = upsert_batch(conn, batch)
        total += n
        log.info("Committed %d records (total: %d)", n, total)
        batch.clear()

    def _shutdown(sig, _frame):
        log.info("Signal %d — flushing and exiting", sig)
        flush()
        conn.close()
        sys.exit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT,  _shutdown)

    log.info("Tailing %s  (batch=%d  poll=%.1fs)", LOG_FILE, BATCH_SIZE, POLL_SEC)

    for raw in tail_file(LOG_FILE):
        if not raw:
            continue
        try:
            record = json.loads(raw)
        except json.JSONDecodeError:
            continue

        clean = normalise(record)
        if clean is None:
            continue

        batch.append(clean)
        if len(batch) >= BATCH_SIZE:
            flush()


if __name__ == "__main__":
    main()
