#!/usr/bin/env python3
"""
Perimeter Sentinel — NetFlow / IPFIX Collector
================================================
Listens on UDP 2055 (standard NetFlow port) and accepts:

  - NetFlow v5   (fixed 20-byte records, single template)
  - NetFlow v9   (template-based, RFC 3954)
  - IPFIX        (template-based, RFC 7011)

For each flow record, extracts:
  src_ip, dst_ip, dst_port, protocol

Then upserts into the same SQLite database as the syslog processor
using the identical schema and uniqueness key:
  (src_ip, dst_ip, dst_port, protocol)

No third-party libraries required — pure stdlib struct parsing.
"""

import ipaddress
import logging
import os
import signal
import socket
import sqlite3
import struct
import sys
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# ── Configuration ─────────────────────────────────────────────────────────
LISTEN_HOST = os.getenv("NETFLOW_HOST",  "0.0.0.0")
LISTEN_PORT = int(os.getenv("NETFLOW_PORT", "2055"))
DB_PATH     = os.getenv("SENTINEL_DB_PATH", "/data/sentinel.db")
BATCH_SIZE  = int(os.getenv("SENTINEL_BATCH", "50"))
BUF_SIZE    = 65535

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s [netflow] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("netflow")

# ── Protocol number → name ────────────────────────────────────────────────
PROTO_MAP = {6: "TCP", 17: "UDP", 1: "ICMP", 132: "SCTP"}

# ── IPFIX / NFv9 field type IDs we care about ─────────────────────────────
# https://www.iana.org/assignments/ipfix/ipfix.xhtml
F_SRC_ADDR4   = 8    # sourceIPv4Address
F_DST_ADDR4   = 12   # destinationIPv4Address
F_SRC_ADDR6   = 27   # sourceIPv6Address
F_DST_ADDR6   = 28   # destinationIPv6Address
F_SRC_PORT    = 7    # sourceTransportPort
F_DST_PORT    = 11   # destinationTransportPort
F_PROTO       = 4    # protocolIdentifier
F_BYTES       = 1    # octetDeltaCount  (ignored but noted)
F_PACKETS     = 2    # packetDeltaCount (ignored but noted)


# ── SQLite ─────────────────────────────────────────────────────────────────
def init_db(path: str) -> sqlite3.Connection:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False, timeout=30)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
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
    conn.execute("CREATE INDEX IF NOT EXISTS ix_dst_ip   ON traffic (dst_ip)")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_dst_port ON traffic (dst_port)")
    conn.execute("CREATE INDEX IF NOT EXISTS ix_first_seen ON traffic (first_seen)")
    conn.commit()
    log.info("Database ready at %s", path)
    return conn


UPSERT_SQL = """
    INSERT INTO traffic (id, src_ip, dst_ip, dst_port, protocol, first_seen, last_seen, count)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT (src_ip, dst_ip, dst_port, protocol) DO UPDATE SET
        last_seen = excluded.last_seen,
        count     = count + 1
"""

def upsert_batch(conn: sqlite3.Connection, batch: list[dict]) -> int:
    now  = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = [
        (str(uuid.uuid4()), r["src_ip"], r["dst_ip"], r["dst_port"], r["protocol"], now, now)
        for r in batch
    ]
    with conn:
        conn.executemany(UPSERT_SQL, rows)
    return len(rows)


# ── IP helpers ────────────────────────────────────────────────────────────
def int_to_ipv4(n: int) -> str:
    return str(ipaddress.IPv4Address(n))

def bytes_to_ipv4(b: bytes) -> str:
    return str(ipaddress.IPv4Address(b))

def bytes_to_ipv6(b: bytes) -> str:
    return str(ipaddress.IPv6Address(b))

def is_private(ip: str) -> bool:
    try:
        return ipaddress.ip_address(ip).is_private
    except ValueError:
        return True

def normalise_flow(src: str, dst: str, dport: int, proto_num: int) -> dict | None:
    proto = PROTO_MAP.get(proto_num)
    if proto not in ("TCP", "UDP"):
        return None  # drop ICMP, SCTP, etc. — no port semantics
    if not (1 <= dport <= 65535):
        return None
    # Require at least one public IP (filter pure internal flows)
    if is_private(src) and is_private(dst):
        return None
    return {"src_ip": src, "dst_ip": dst, "dst_port": dport, "protocol": proto}


# ══════════════════════════════════════════════════════════════════════════
#  NetFlow v5 Parser
#  Header: 24 bytes  |  Each record: 48 bytes
# ══════════════════════════════════════════════════════════════════════════
NFV5_HEADER  = struct.Struct("!HHIIIIBBH")   # 24 bytes
NFV5_RECORD  = struct.Struct("!IIIHHIIIIHHBBBBHHBBH")  # 48 bytes

def parse_v5(data: bytes) -> list[dict]:
    if len(data) < 24:
        return []
    hdr    = NFV5_HEADER.unpack_from(data, 0)
    count  = hdr[1]
    flows  = []
    offset = 24
    for _ in range(count):
        if offset + 48 > len(data):
            break
        r = NFV5_RECORD.unpack_from(data, offset)
        offset += 48
        src_ip  = int_to_ipv4(r[0])
        dst_ip  = int_to_ipv4(r[1])
        dst_port = r[9]   # dstport
        proto_num = r[14]  # prot
        flow = normalise_flow(src_ip, dst_ip, dst_port, proto_num)
        if flow:
            flows.append(flow)
    return flows


# ══════════════════════════════════════════════════════════════════════════
#  NetFlow v9 / IPFIX Parser
#  Both use the same template mechanism; IPFIX uses version=10
# ══════════════════════════════════════════════════════════════════════════

# Template store: keyed by (exporter_ip, observation_domain_id, template_id)
# Value: list of (field_type, field_length) tuples
_templates: dict[tuple, list] = {}

# IPFIX enterprise bit
_ENTERPRISE_BIT = 0x8000


def _decode_field(field_type: int, data: bytes) -> int | bytes:
    """Decode a field value as an integer (for IPs and ports) or raw bytes."""
    length = len(data)
    if length == 1:
        return data[0]
    if length == 2:
        return struct.unpack("!H", data)[0]
    if length == 4:
        return struct.unpack("!I", data)[0]
    if length == 8:
        return struct.unpack("!Q", data)[0]
    return data  # IPv6, variable-length, etc.


def _parse_template_records(payload: bytes, version: int) -> list[tuple]:
    """Parse template flowset / template set. Returns list of (template_id, fields)."""
    templates = []
    offset    = 0
    ipfix     = (version == 10)

    while offset + 4 <= len(payload):
        tmpl_id  = struct.unpack_from("!H", payload, offset)[0]
        field_count = struct.unpack_from("!H", payload, offset + 2)[0]
        offset  += 4

        if tmpl_id < 256:   # withdrawal record — skip
            continue

        fields = []
        for _ in range(field_count):
            if offset + 4 > len(payload):
                break
            ftype  = struct.unpack_from("!H", payload, offset)[0]
            flength = struct.unpack_from("!H", payload, offset + 2)[0]
            offset += 4

            if ipfix and (ftype & _ENTERPRISE_BIT):
                # Enterprise field — skip enterprise number (4 bytes)
                ftype &= ~_ENTERPRISE_BIT
                offset += 4

            fields.append((ftype, flength))

        templates.append((tmpl_id, fields))

    return templates


def _extract_flows_from_data_record(
    payload: bytes, fields: list[tuple]
) -> list[dict]:
    """Given a data record payload and its template fields, extract flows."""
    # Calculate record length
    rec_len = sum(fl for _, fl in fields)
    if rec_len == 0:
        return []

    flows   = []
    offset  = 0

    while offset + rec_len <= len(payload):
        src_ip = dst_ip = None
        src_port = dst_port = proto_num = None
        foffset = offset

        for ftype, flength in fields:
            raw = payload[foffset: foffset + flength]
            foffset += flength

            if ftype == F_SRC_ADDR4 and flength == 4:
                src_ip = bytes_to_ipv4(raw)
            elif ftype == F_DST_ADDR4 and flength == 4:
                dst_ip = bytes_to_ipv4(raw)
            elif ftype == F_SRC_ADDR6 and flength == 16:
                src_ip = bytes_to_ipv6(raw)
            elif ftype == F_DST_ADDR6 and flength == 16:
                dst_ip = bytes_to_ipv6(raw)
            elif ftype == F_SRC_PORT:
                src_port = _decode_field(ftype, raw)
            elif ftype == F_DST_PORT:
                dst_port = _decode_field(ftype, raw)
            elif ftype == F_PROTO:
                proto_num = _decode_field(ftype, raw)

        offset += rec_len

        if src_ip and dst_ip and dst_port is not None and proto_num is not None:
            flow = normalise_flow(src_ip, dst_ip, int(dst_port), int(proto_num))
            if flow:
                flows.append(flow)

    return flows


def parse_v9_ipfix(data: bytes, exporter_ip: str) -> list[dict]:
    """Parse a NetFlow v9 (version=9) or IPFIX (version=10) UDP datagram."""
    if len(data) < 20:
        return []

    version = struct.unpack_from("!H", data, 0)[0]
    if version == 9:
        # NFv9 header: version(2) count(2) uptime(4) unix_secs(4) seq(4) src_id(4) = 20 bytes
        _ver, count, _up, _secs, _seq, source_id = struct.unpack_from("!HHIIII", data, 0)
        obs_domain = source_id
        offset = 20
    else:
        # IPFIX header: version(2) length(2) export_time(4) seq(4) obs_domain_id(4)
        _ver, _length, _etime, _seq, obs_domain = struct.unpack_from("!HHIII", data, 0)
        offset = 16

    flows = []

    while offset + 4 <= len(data):
        flowset_id  = struct.unpack_from("!H", data, offset)[0]
        flowset_len = struct.unpack_from("!H", data, offset + 2)[0]

        if flowset_len < 4 or offset + flowset_len > len(data):
            break

        payload = data[offset + 4: offset + flowset_len]
        offset += flowset_len

        if flowset_id == 0 or flowset_id == 2:
            # Template flowset (NFv9=0, IPFIX=2)
            tmpl_records = _parse_template_records(payload, version)
            for tmpl_id, fields in tmpl_records:
                key = (exporter_ip, obs_domain, tmpl_id)
                _templates[key] = fields
                log.debug("Stored template %s fields=%d", key, len(fields))

        elif flowset_id == 1 or flowset_id == 3:
            # Options template — skip (contains metadata, not traffic)
            pass

        elif flowset_id >= 256:
            # Data flowset
            key = (exporter_ip, obs_domain, flowset_id)
            fields = _templates.get(key)
            if fields is None:
                log.debug("No template yet for %s — buffering not implemented", key)
                continue
            flows.extend(_extract_flows_from_data_record(payload, fields))

    return flows


# ══════════════════════════════════════════════════════════════════════════
#  Main UDP listener
# ══════════════════════════════════════════════════════════════════════════
def main():
    conn  = init_db(DB_PATH)
    batch: list[dict] = []
    total = 0

    def flush():
        nonlocal total
        if not batch:
            return
        n = upsert_batch(conn, batch)
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

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((LISTEN_HOST, LISTEN_PORT))
    log.info("Listening for NetFlow/IPFIX on %s:%d", LISTEN_HOST, LISTEN_PORT)

    while True:
        try:
            data, (exporter_ip, _) = sock.recvfrom(BUF_SIZE)
        except OSError as e:
            log.error("Socket error: %s", e)
            continue

        if len(data) < 2:
            continue

        version = struct.unpack_from("!H", data, 0)[0]

        try:
            if version == 5:
                flows = parse_v5(data)
            elif version in (9, 10):
                flows = parse_v9_ipfix(data, exporter_ip)
            else:
                log.debug("Unknown NetFlow version %d from %s", version, exporter_ip)
                continue
        except Exception as exc:
            log.warning("Parse error from %s: %s", exporter_ip, exc)
            continue

        batch.extend(flows)

        if len(batch) >= BATCH_SIZE:
            flush()


if __name__ == "__main__":
    main()
