"""
Perimeter Sentinel — FastAPI Backend
======================================
Serves the dashboard API:

  GET  /api/stats/summary          — KPI counts by geo category
  GET  /api/traffic/country        — traffic to a single country (ISO-2)
  GET  /api/traffic/eu             — traffic to EU member states
  GET  /api/traffic/non-eu         — traffic outside EU
  GET  /api/traffic/watch          — traffic to user-defined watch countries
  GET  /api/top/destinations       — top N dst_ip:dst_port by count
  GET  /api/top/countries          — top N countries by connection count
  GET  /api/recent                 — most recently seen connections
  GET  /api/countries/list         — all countries seen in traffic
  POST /api/settings/watch         — update watch country list
  GET  /api/settings/watch         — retrieve watch country list
  GET  /api/health                 — liveness probe
  GET  /api/db/seed                — (dev) inject synthetic traffic rows
"""

import os
import sqlite3
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Optional

import geoip2.database
import geoip2.errors
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

# ── Config ──────────────────────────────────────────────────────────────────
DB_PATH   = os.getenv("SENTINEL_DB_PATH",  "/data/sentinel.db")
MMDB_PATH = os.getenv("MAXMIND_DB_PATH",   "/mmdb/GeoLite2-Country.mmdb")
STATIC_DIR = os.getenv("STATIC_DIR",       "/app/static")

# ── EU member state ISO-3166-1 alpha-2 codes ───────────────────────────────
EU_COUNTRIES = frozenset({
    "AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI",
    "FR","GR","HR","HU","IE","IT","LT","LU","LV","MT",
    "NL","PL","PT","RO","SE","SI","SK",
})

# ── In-memory settings (watch countries) ───────────────────────────────────
_watch_countries: set[str] = {"RU", "CN", "KP", "IR"}   # defaults


# ── MaxMind reader (reused across requests) ─────────────────────────────────
_geoip_reader: geoip2.database.Reader | None = None

def get_geoip_reader() -> geoip2.database.Reader | None:
    global _geoip_reader
    if _geoip_reader is None and Path(MMDB_PATH).exists():
        _geoip_reader = geoip2.database.Reader(MMDB_PATH)
    return _geoip_reader


@lru_cache(maxsize=8192)
def ip_to_country(ip: str) -> str:
    """Return ISO-2 country code, or 'XX' if unknown / private."""
    reader = get_geoip_reader()
    if reader is None:
        return "XX"
    try:
        response = reader.country(ip)
        return response.country.iso_code or "XX"
    except (geoip2.errors.AddressNotFoundError, ValueError):
        return "XX"


@lru_cache(maxsize=8192)
def ip_to_country_name(ip: str) -> str:
    reader = get_geoip_reader()
    if reader is None:
        return "Unknown"
    try:
        response = reader.country(ip)
        return response.country.name or "Unknown"
    except (geoip2.errors.AddressNotFoundError, ValueError):
        return "Unknown"


# ── SQLite helpers ──────────────────────────────────────────────────────────
def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def ensure_db():
    """Create tables if they don't exist (dev / first-run)."""
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    with get_conn() as conn:
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
        conn.commit()


# ── Lifespan ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_db()
    get_geoip_reader()   # warm up on startup
    yield
    if _geoip_reader:
        _geoip_reader.close()


# ── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="Perimeter Sentinel API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ─────────────────────────────────────────────────────────────────
def classify(iso: str) -> str:
    if iso == "XX":
        return "unknown"
    if iso in EU_COUNTRIES:
        return "eu"
    return "non-eu"


def enrich_row(row: sqlite3.Row) -> dict:
    d = dict(row)
    iso  = ip_to_country(d["dst_ip"])
    name = ip_to_country_name(d["dst_ip"])
    d["dst_country_iso"]  = iso
    d["dst_country_name"] = name
    d["category"]         = classify(iso)
    return d


def all_traffic(limit: int = 50000) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM traffic ORDER BY last_seen DESC LIMIT ?", (limit,)
        ).fetchall()
    return [enrich_row(r) for r in rows]


# ── Routes — Health ─────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    mmdb_ok = Path(MMDB_PATH).exists()
    db_ok   = Path(DB_PATH).exists()
    return {
        "status": "ok",
        "db": db_ok,
        "mmdb": mmdb_ok,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Routes — Summary KPIs ───────────────────────────────────────────────────
@app.get("/api/stats/summary")
def stats_summary():
    rows = all_traffic()
    total       = len(rows)
    total_conns = sum(r["count"] for r in rows)
    eu_rows     = [r for r in rows if r["category"] == "eu"]
    non_eu_rows = [r for r in rows if r["category"] == "non-eu"]
    watch_rows  = [r for r in rows if r["dst_country_iso"] in _watch_countries]
    unknown_rows= [r for r in rows if r["category"] == "unknown"]

    return {
        "total_unique_flows":       total,
        "total_communications":     total_conns,
        "eu_unique_flows":          len(eu_rows),
        "eu_communications":        sum(r["count"] for r in eu_rows),
        "non_eu_unique_flows":      len(non_eu_rows),
        "non_eu_communications":    sum(r["count"] for r in non_eu_rows),
        "watch_unique_flows":       len(watch_rows),
        "watch_communications":     sum(r["count"] for r in watch_rows),
        "unknown_unique_flows":     len(unknown_rows),
        "unknown_communications":   sum(r["count"] for r in unknown_rows),
        "watch_countries":          sorted(_watch_countries),
    }


# ── Routes — Traffic by Category ────────────────────────────────────────────
@app.get("/api/traffic/country")
def traffic_by_country(
    iso: str = Query(..., description="ISO 3166-1 alpha-2 country code"),
    limit: int = Query(500, le=5000),
):
    iso = iso.upper()
    rows = [r for r in all_traffic() if r["dst_country_iso"] == iso]
    rows.sort(key=lambda r: r["count"], reverse=True)
    return {"country_iso": iso, "count": len(rows), "flows": rows[:limit]}


@app.get("/api/traffic/eu")
def traffic_eu(limit: int = Query(500, le=5000)):
    rows = [r for r in all_traffic() if r["category"] == "eu"]
    rows.sort(key=lambda r: r["count"], reverse=True)
    return {"count": len(rows), "flows": rows[:limit]}


@app.get("/api/traffic/non-eu")
def traffic_non_eu(limit: int = Query(500, le=5000)):
    rows = [r for r in all_traffic() if r["category"] == "non-eu"]
    rows.sort(key=lambda r: r["count"], reverse=True)
    return {"count": len(rows), "flows": rows[:limit]}


@app.get("/api/traffic/watch")
def traffic_watch(limit: int = Query(500, le=5000)):
    rows = [r for r in all_traffic() if r["dst_country_iso"] in _watch_countries]
    rows.sort(key=lambda r: r["count"], reverse=True)
    return {
        "watch_countries": sorted(_watch_countries),
        "count": len(rows),
        "flows": rows[:limit],
    }


# ── Routes — Top Lists ──────────────────────────────────────────────────────
@app.get("/api/top/destinations")
def top_destinations(n: int = Query(20, le=100)):
    rows = all_traffic()
    rows.sort(key=lambda r: r["count"], reverse=True)
    return {"destinations": rows[:n]}


@app.get("/api/top/countries")
def top_countries(n: int = Query(20, le=100)):
    from collections import defaultdict
    rows = all_traffic()
    agg: dict[str, dict] = defaultdict(lambda: {"count": 0, "flows": 0})
    for r in rows:
        iso  = r["dst_country_iso"]
        name = r["dst_country_name"]
        agg[iso]["count"] += r["count"]
        agg[iso]["flows"] += 1
        agg[iso]["name"]  = name
        agg[iso]["iso"]   = iso
        agg[iso]["category"] = r["category"]
    result = sorted(agg.values(), key=lambda x: x["count"], reverse=True)
    return {"countries": result[:n]}


@app.get("/api/recent")
def recent_traffic(limit: int = Query(50, le=500)):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM traffic ORDER BY last_seen DESC LIMIT ?", (limit,)
        ).fetchall()
    return {"flows": [enrich_row(r) for r in rows]}


@app.get("/api/countries/list")
def countries_list():
    rows = all_traffic()
    seen = {}
    for r in rows:
        iso = r["dst_country_iso"]
        if iso not in seen:
            seen[iso] = {
                "iso":      iso,
                "name":     r["dst_country_name"],
                "category": r["category"],
            }
    return {"countries": sorted(seen.values(), key=lambda x: x["name"])}


# ── Routes — Watch Settings ─────────────────────────────────────────────────
class WatchUpdate(BaseModel):
    countries: list[str]

@app.get("/api/settings/watch")
def get_watch():
    return {"watch_countries": sorted(_watch_countries)}

@app.post("/api/settings/watch")
def set_watch(payload: WatchUpdate):
    global _watch_countries
    _watch_countries = {c.upper() for c in payload.countries if len(c) == 2}
    return {"watch_countries": sorted(_watch_countries)}


# ── Dev: seed route ─────────────────────────────────────────────────────────
@app.get("/api/db/seed")
def seed_db(n: int = Query(200, le=2000)):
    """Inject synthetic traffic rows for demo/testing."""
    import random

    SAMPLE_IPS = [
        # Germany
        "185.220.101.1","91.107.8.1","62.153.208.1",
        # France
        "194.2.0.1","212.27.40.1","86.75.30.1",
        # UK (non-EU post-Brexit)
        "51.68.0.1","5.39.0.1","51.254.0.1",
        # USA
        "8.8.8.8","1.1.1.1","13.32.0.1","52.0.0.1","54.0.0.1",
        # China
        "36.110.0.1","42.120.0.1","61.135.0.1",
        # Russia
        "77.88.8.8","5.255.255.1","213.180.200.1",
        # North Korea
        "175.45.176.1","210.52.109.1",
        # Netherlands
        "178.21.16.1","185.107.80.1",
        # Ireland
        "213.146.0.1","86.43.0.1",
        # Canada
        "209.197.0.1","66.220.0.1",
        # Random internal src
        "10.0.0.5","10.0.0.10","192.168.1.100","172.16.0.50",
    ]
    PORTS    = [80, 443, 53, 25, 587, 993, 8080, 8443, 3306, 5432, 22, 21]
    PROTOS   = ["TCP", "UDP"]
    INTERNAL = [ip for ip in SAMPLE_IPS if ip.startswith(("10.", "192.", "172."))]
    EXTERNAL = [ip for ip in SAMPLE_IPS if not ip.startswith(("10.", "192.", "172."))]

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    rows = []
    for _ in range(n):
        src = random.choice(INTERNAL)
        dst = random.choice(EXTERNAL)
        dport = random.choice(PORTS)
        proto = random.choice(PROTOS)
        count = random.randint(1, 500)
        rows.append((str(uuid.uuid4()), src, dst, dport, proto, now, now, count))

    with get_conn() as conn:
        conn.executemany("""
            INSERT OR IGNORE INTO traffic
            (id, src_ip, dst_ip, dst_port, protocol, first_seen, last_seen, count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, rows)
        conn.commit()

    return {"seeded": n, "message": "Demo data injected"}


# ── Serve dashboard static files ────────────────────────────────────────────
if Path(STATIC_DIR).exists():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
