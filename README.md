# Perimeter Sentinel

Real-time perimeter firewall traffic intelligence: geo-classification, SQLite persistence, and a modern SaaS dashboard — all in three lightweight containers.

---

## Architecture

```
Firewall/Router
      │  syslog (UDP/TCP 514, TCP 601, TCP 6514)
      │
      │  NetFlow v5/v9/IPFIX (UDP 2055)
      │
      ├──────────────────────┬──────────────────────────┐
      ▼                      ▼                          │
┌─────────────┐    ┌─────────────────┐                  │
│  syslog-ng  │    │  netflow        │                  │
│  (Alpine)   │    │  (Python/Alpine)│                  │
│  Parse logs │    │  v5/v9/IPFIX    │                  │
│  Strip meta │    │  UDP collector  │                  │
└──────┬──────┘    └────────┬────────┘                  │
       │ JSONL              │ direct upsert             │
       ▼                    │                           │
┌──────────────────┐        │                           │
│  processor       │        │                           │
│  tail → SQLite   │◀───────┘                           │
└──────────┬───────┘                                    │
           │ /data/sentinel.db                          │
           ▼                                            │
┌──────────────────────────┐                            │
│  backend                 │◀───────────────────────────┘
│  FastAPI + GeoLite2      │
│  REST API + static serve │
│  http://localhost:8000   │
└──────────────────────────┘
```

### What syslog-ng strips

Every syslog field is discarded **except** the four fields below, which are emitted as a JSON line to a shared volume:

| Field      | Example             |
|------------|---------------------|
| `src_ip`   | `10.0.0.5`          |
| `dst_ip`   | `185.220.101.1`     |
| `dst_port` | `443`               |
| `protocol` | `TCP`               |

### SQLite schema

```sql
CREATE TABLE traffic (
    id         TEXT    PRIMARY KEY,   -- UUID v4
    src_ip     TEXT    NOT NULL,
    dst_ip     TEXT    NOT NULL,
    dst_port   INTEGER NOT NULL,
    protocol   TEXT    NOT NULL,      -- TCP | UDP
    first_seen TEXT    NOT NULL,      -- ISO-8601 UTC
    last_seen  TEXT    NOT NULL,      -- ISO-8601 UTC, updated on every hit
    count      INTEGER NOT NULL DEFAULT 1
);
-- Unique key: (src_ip, dst_ip, dst_port, protocol)
-- INSERT OR UPDATE increments count and refreshes last_seen
```

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Docker Engine ≥ 24 | Compose v2 included |
| MaxMind GeoLite2-Country.mmdb | Free — see below |
| Firewall configured to send syslog | UDP 514 / TCP 514 / 601 |

### Obtaining GeoLite2-Country.mmdb

1. Create a free account at [maxmind.com/en/geolite2/signup](https://www.maxmind.com/en/geolite2/signup)
2. Download **GeoLite2 Country** (`.mmdb` format)
3. Place the file at `./mmdb/GeoLite2-Country.mmdb`

```bash
mkdir -p mmdb
# copy your downloaded file:
cp ~/Downloads/GeoLite2-Country.mmdb mmdb/
```

---

## Quick Start

```bash
git clone <this-repo>
cd perimeter-sentinel

# 1. Add your MaxMind database
mkdir -p mmdb
cp /path/to/GeoLite2-Country.mmdb mmdb/

# 2. Start everything
docker compose up -d

# 3. Open the dashboard
open http://localhost:8000

# 4. (Optional) inject demo data
curl http://localhost:8000/api/db/seed?n=500
```

---

## Pointing Your Firewall at Sentinel — NetFlow

NetFlow is the preferred input method. It gives you byte counts, packet counts, and flow duration in addition to the 5-tuple, and most enterprise perimeter devices support it natively.

### Cisco IOS / IOS-XE (NetFlow v9)

```
ip flow-export version 9
ip flow-export destination <SENTINEL_IP> 2055
ip flow-export source GigabitEthernet0/0
ip flow-cache timeout active 1
ip flow-cache timeout inactive 15

interface GigabitEthernet0/0
 ip flow ingress
 ip flow egress
```

### Cisco ASA (NetFlow NSEL)

```
flow-export destination outside <SENTINEL_IP> 2055
flow-export template timeout-rate 1
flow-export delay flow-create 0

policy-map global_policy
 class class-default
  flow-export event-type all destination <SENTINEL_IP>
```

### Palo Alto Networks (IPFIX)

```
Device > Server Profiles > NetFlow
  Name:        sentinel
  Server:      <SENTINEL_IP>
  Port:        2055
  Version:     IPFIX
  Active Timeout: 60

Network > Interfaces > <your WAN interface>
  NetFlow Profile: sentinel
```

### Juniper SRX (v9)

```
set services flow-monitoring version9 template ipv4 flow-active-timeout 60
set services flow-monitoring version9 template ipv4 flow-inactive-timeout 15
set services flow-monitoring version9 template ipv4 template-id 100

set forwarding-options sampling instance default input rate 1
set forwarding-options sampling instance default family inet output flow-server <SENTINEL_IP> port 2055
set forwarding-options sampling instance default family inet output flow-server <SENTINEL_IP> version9 template ipv4
```

### Fortinet FortiGate (v9)

```
config system netflow
  set collector-ip <SENTINEL_IP>
  set collector-port 2055
  set source-ip <FORTIGATE_INTERFACE_IP>
  set active-flow-timeout 60
  set inactive-flow-timeout 15
end
```

### MikroTik RouterOS (v5)

```
/ip traffic-flow
set enabled=yes interfaces=all active-flow-timeout=1m inactive-flow-timeout=15s

/ip traffic-flow target
add dst-address=<SENTINEL_IP> port=2055 version=5
```

### Verify NetFlow is arriving

```bash
# Watch the collector logs live
docker compose logs -f netflow

# Check flows are hitting the database
curl -s http://localhost:8000/api/recent?limit=5 | python3 -m json.tool
```

---

## Pointing Your Firewall at Sentinel — Syslog

### Cisco ASA / FTD

```
logging enable
logging host inside <SENTINEL_IP> 514
logging trap informational
logging facility 16
```

### iptables / nftables (Linux router)

```bash
# iptables — log and send to syslog (rsyslog then forwards to sentinel)
iptables -A FORWARD -j LOG --log-prefix "PERIMETER: "

# /etc/rsyslog.d/99-sentinel.conf
*.* @<SENTINEL_IP>:514
```

### Palo Alto Networks

```
Device > Server Profiles > Syslog > Add
  Syslog Server: <SENTINEL_IP>
  Port: 514
  Format: BSD

Policies > Security > Log Forwarding Profile > Add
  Log Type: traffic
  Syslog Profile: <your profile>
```

### Juniper SRX

```
set system syslog host <SENTINEL_IP> any any
set system syslog host <SENTINEL_IP> port 514
```

### pfSense / OPNsense

`Status > System Logs > Settings`:
- Remote Logging: ✓ Enable
- Remote Log Server: `<SENTINEL_IP>:514`
- Source Address: LAN interface

---

## Dashboard Views

| View | Description |
|---|---|
| **Overview** | KPI cards, category donut chart, top 10 countries bar, top endpoint table |
| **By Country** | Select any observed country — view all flows to it |
| **EU Traffic** | Flows to EU member states; per-country breakdown chart |
| **Non-EU Traffic** | Flows outside EU; per-country breakdown chart |
| **Watch Countries** | Alert view for user-defined high-interest countries (default: RU, CN, KP, IR) |
| **Recent Flows** | Last 100 flows across all categories |
| **Settings** | Add/remove watch countries; configure API endpoint |

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness probe (DB + MMDB status) |
| GET | `/api/stats/summary` | All KPI counts |
| GET | `/api/traffic/country?iso=DE` | Flows to specific country |
| GET | `/api/traffic/eu` | EU flows |
| GET | `/api/traffic/non-eu` | Non-EU flows |
| GET | `/api/traffic/watch` | Watch-country flows |
| GET | `/api/top/destinations?n=25` | Top N endpoints by count |
| GET | `/api/top/countries?n=10` | Top N countries by count |
| GET | `/api/recent?limit=100` | Most recent flows |
| GET | `/api/countries/list` | All countries seen in traffic |
| GET | `/api/settings/watch` | Current watch countries |
| POST | `/api/settings/watch` | Update watch countries `{"countries":["RU","CN"]}` |
| GET | `/api/db/seed?n=300` | Inject demo data (dev only) |

---

## Environment Variables

### processor

| Variable | Default | Description |
|---|---|---|
| `SENTINEL_LOG_FILE` | `/var/log/perimeter/traffic.jsonl` | Path to syslog-ng output |
| `SENTINEL_DB_PATH` | `/data/sentinel.db` | SQLite database path |
| `SENTINEL_BATCH` | `50` | Rows per commit |
| `SENTINEL_POLL` | `0.5` | File poll interval (seconds) |

### backend

| Variable | Default | Description |
|---|---|---|
| `SENTINEL_DB_PATH` | `/data/sentinel.db` | SQLite database path |
| `MAXMIND_DB_PATH` | `/mmdb/GeoLite2-Country.mmdb` | MaxMind MMDB path |
| `STATIC_DIR` | `/app/static` | Dashboard static files |

---

## Supported Firewall Log Formats

syslog-ng parses the following with dedicated regex parsers:

- **Cisco ASA / PIX / FTD** — Built/Teardown connection messages
- **iptables / nftables** — `SRC= DST= PROTO= DPT= SPT=` format
- **Palo Alto Networks** — CSV traffic log format
- **Generic key=value** — Fortinet, Check Point, MikroTik, pfSense/OPNsense
- **Bare IP:port pairs** — any log containing `x.x.x.x:port` patterns

---

## Security Notes

- syslog-ng drops **all** metadata (hostname, facility, severity, timestamps, process names). Only the four traffic fields survive.
- The processor validates all IP addresses and port numbers before writing to SQLite — malformed entries are silently discarded.
- The backend mounts the SQLite database read-only.
- No authentication is included by default. Place a reverse proxy (nginx, Caddy, Traefik) with TLS and auth in front of port 8000 before exposing to a network.

---

## Development

### Running without Docker

```bash
# Terminal 1 — processor
cd processor
pip install -r requirements.txt
SENTINEL_LOG_FILE=./test.jsonl SENTINEL_DB_PATH=./dev.db python processor.py

# Terminal 2 — backend
cd backend
pip install -r requirements.txt
SENTINEL_DB_PATH=./dev.db MAXMIND_DB_PATH=./mmdb/GeoLite2-Country.mmdb \
STATIC_DIR=../dashboard uvicorn main:app --reload --port 8000

# Terminal 3 — inject test traffic
echo '{"src_ip":"10.0.0.5","dst_ip":"8.8.8.8","dst_port":53,"protocol":"UDP"}' >> ./test.jsonl
```

### Seed demo data

```bash
curl "http://localhost:8000/api/db/seed?n=500"
```

---

## File Structure

```
perimeter-sentinel/
├── docker-compose.yml
├── README.md
├── mmdb/                          ← place GeoLite2-Country.mmdb here
├── data/                          ← SQLite DB (created at runtime)
├── syslog-ng/
│   ├── Dockerfile                 ← Alpine + syslog-ng
│   └── syslog-ng.conf             ← parsers, filters, JSONL output
├── processor/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── processor.py               ← tail → normalise → SQLite upsert
├── netflow/
│   ├── Dockerfile                 ← Python 3.12 Alpine
│   └── collector.py               ← NetFlow v5/v9/IPFIX UDP listener
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py                    ← FastAPI + GeoLite2 + REST API
└── dashboard/
    ├── index.html                 ← SaaS dashboard UI
    ├── style.css
    └── app.js
```
