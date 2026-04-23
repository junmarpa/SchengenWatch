# SchengenWatch — EU Data Sovereignty Validator

**Open-source network traffic validator for organisations operating under EU data sovereignty requirements.**

SchengenWatch monitors outbound network communications in real time and alerts when traffic crosses EU borders — giving security, compliance, and legal teams continuous visibility into whether data flows respect jurisdictional boundaries required by GDPR, NIS2, DORA, and TISAX.

---

## Why SchengenWatch

EU-based organisations face increasing regulatory pressure to demonstrate that data — and the network communications that carry it — remain within defined jurisdictions. Auditors ask. Regulators require it. Proving it has historically meant expensive SIEM deployments or manual log reviews.

SchengenWatch is a lightweight, self-hosted alternative that answers one question continuously:

> **Is our traffic staying where it should?**

It classifies every outbound connection by destination country, flags anything leaving the EU, and highlights communications to specific high-interest jurisdictions. No data leaves your environment. No SaaS dependency. No per-seat licensing.

SchengenWatch goes beyond simple geo-classification: it resolves every flow's **Autonomous System** via MaxMind GeoLite2-ASN and matches it against a curated corporate-ownership graph. A flow to an EU-hosted Microsoft, Google or AWS endpoint is flagged as Non-EU because the ultimate beneficial owner falls under the US CLOUD Act — the same principle applies to UK_IPA, CN_NSL and FISA §702. Data sovereignty is evaluated by jurisdiction, not just by IP geography.

---

## Dashboard Screenshots

> **Note:** Screenshots show demo data seeded via `GET /api/db/seed`. Country fields display `—` in screenshots because geo-enrichment requires a [MaxMind GeoLite2-Country](https://dev.maxmind.com/geoip/geolite2-free-geolocation-data) database (`GeoLite2-Country.mmdb`), which is not distributed with SchengenWatch due to MaxMind's licensing terms. See [Obtaining GeoLite2-Country.mmdb](#obtaining-geolite2-countrymmmdb) for setup instructions. With the MMDB in place, all country columns, EU/non-EU classification, and watch-list matching resolve correctly.
>
> The dashboard uses the **Damovo Traces** dark theme — charcoal surfaces with crimson accents, Raleway/Inter typography, and the Damovo Traces logo in the sidebar.

### Sovereignty Overview

Real-time KPI summary — total flows, EU/non-EU split, watch-list hits, and a live donut chart with top destination countries.

![Sovereignty Overview](docs/screenshots/01-overview-v2.png)

---

### Non-EU Alerts

Primary compliance alert view — every flow crossing EU borders, flagged for GDPR Art. 44-49 review.

![Non-EU Alerts](docs/screenshots/02-non-eu-alerts-v2.png)

---

### EU Traffic

Flows terminating within EU member states — compliant under GDPR adequacy provisions.

![EU Traffic](docs/screenshots/03-eu-traffic-v2.png)

---

### Watch List

Flows to user-defined high-risk jurisdictions. Default watch countries: Russia, China, North Korea, Iran.

![Watch List](docs/screenshots/04-watch-list-v2.png)

---

### Recent Flows

Live feed of the last 100 connections, auto-refreshing every 30 seconds.

![Recent Flows](docs/screenshots/05-recent-flows-v2.png)


---

## Architecture

```
Firewall / Router
      │
      │  syslog  (UDP/TCP 514, TCP 601, TCP 6514)
      │  NetFlow v5/v9/IPFIX  (UDP 2055)
      │  PCAP upload  (HTTP POST /api/ingest/pcap)
      │
      ├─────────────────────┬──────────────────────┐
      ▼                     ▼                      │
┌───────────┐    ┌──────────────────┐              │
│ syslog-ng │    │ netflow          │              │
│ (Alpine)  │    │ collector        │              │
│ Parse +   │    │ v5/v9/IPFIX      │              │
│ strip meta│    │ UDP listener     │              │
└─────┬─────┘    └────────┬─────────┘              │
      │ JSONL             │ direct upsert          │
      ▼                   │                        │
┌─────────────────┐       │                        │
│ processor       │◀──────┘                        │
│ tail → SQLite   │                                │
└────────┬────────┘                                │
         │ /data/schengenwatch.db                  │
         ▼                                         │
┌─────────────────────────┐                        │
│ backend                 │◀───────────────────────┘
│ FastAPI                 │
│ GeoLite2-Country (geo)  │
│ GeoLite2-ASN (ASN+org)  │
│ jurisdiction/*.yaml     │
│ REST API + dashboard    │
│ http://localhost:8000   │
└─────────────────────────┘
```

---

## Data Sovereignty Views

| View | Purpose |
|---|---|
| **Overview** | KPI summary — in-country, EU, non-EU, and watch-country flow counts |
| **In-Country** | Flows staying within your home country (e.g. Germany only) |
| **EU Traffic** | Flows within EU member states — compliant under GDPR adequacy |
| **Non-EU Traffic** | Flows leaving the EU — primary compliance alert view |
| **Watch Countries** | Flows to user-defined high-risk jurisdictions (e.g. CN, RU, US) |
| **Recent Flows** | Live feed of the last 100 connections |
| **Settings** | Configure home country, watch list, API endpoint |

---

## Jurisdiction Classification

SchengenWatch classifies every flow by two independent dimensions:

1. **Geography** — the destination IP's country, from GeoLite2-Country
2. **Legal jurisdiction** — the ultimate beneficial owner (UBO) of the destination ASN, from a curated corporate-ownership graph

A flow carrying any jurisdiction tag is treated as **Non-EU**, even when the destination country is inside the EU. Example: traffic to `104.40.0.1` (Microsoft Ireland, country `IE`) resolves to `MSFT_ROOT` via ASN 8075 and is tagged `US_CLOUD_ACT` + `US_FISA_702` — the flow is shown under Non-EU Alerts, not EU Traffic.

### Supported Jurisdiction Tags

| Tag | Legal Basis | Risk |
|---|---|---|
| `US_CLOUD_ACT` | Clarifying Lawful Overseas Use of Data Act (2018) | High |
| `US_FISA_702` | Foreign Intelligence Surveillance Act §702 (reauth. 2024) | Critical |
| `CN_NSL` | Chinese National Intelligence Law (2017) + HK NSL (2020) | Critical |
| `UK_IPA` | UK Investigatory Powers Act (2016, amended 2024) | High |

Definitions live in [`jurisdiction/jurisdiction_policy.yaml`](jurisdiction/jurisdiction_policy.yaml).

### Corporate Ownership Graph

[`jurisdiction/parent_company_graph.yaml`](jurisdiction/parent_company_graph.yaml) is the single source of truth for:

- Corporate ownership chains (tier-0 UBO → tier-1 subsidiary → ...)
- ASN-number assignments per entity
- MaxMind `autonomous_system_organization` pattern matches
- Jurisdiction tag assignments (set on the UBO, cascaded automatically)

On backend startup the graph is parsed, tags are resolved recursively up to the UBO, and two lookup tables are built: `ASN number → tags` and `org-name substring → tags`. The ASN lookup wins when both match.

Currently mapped: Microsoft, Alphabet, Amazon, Meta, Apple, Oracle, Salesforce, IBM, Cloudflare, Akamai, Fastly, DigitalOcean, Zscaler, Palo Alto Networks, CrowdStrike, AT&T, Verizon, Lumen, Twilio, Alibaba, Tencent, Huawei, ByteDance, Baidu, China Telecom/Unicom/Mobile, BT, Virgin Media O2, Sky UK, Vodafone UK, TalkTalk, Telefónica UK.

Adding a new entity requires no code change — edit the YAML and restart the backend container.

---

## Regulatory Context

| Regulation | Relevance |
|---|---|
| **GDPR Art. 44-49** | Restricts personal data transfers outside the EEA without adequate safeguards |
| **NIS2 Directive** | Requires operators of essential services to control and audit data flows |
| **DORA (EU 2022/2554)** | Financial entities must demonstrate ICT supply chain and data residency controls |
| **TISAX** | Automotive industry information security — data localisation is assessed |
| **Schrems II** | Invalidated Privacy Shield; transfers to US require explicit legal basis |

SchengenWatch does not replace legal advice or a formal Data Protection Impact Assessment. It provides the continuous technical evidence that supports those processes.

---

## Infrastructure Requirements

### Minimum — Lab / Proof of Concept

> Single firewall or router, low-traffic environment, no HA requirement.

| Resource | Minimum |
|---|---|
| **CPU** | 2 vCPUs (x86-64 or ARM64) |
| **RAM** | 2 GB |
| **Disk** | 20 GB SSD |
| **OS** | Any Linux with Docker Engine ≥ 24 + Compose v2 |
| **Network** | 100 Mbps NIC |
| **Flow rate** | Up to ~500 flows/sec syslog, ~1,000 flows/sec NetFlow |

Suitable hardware: Raspberry Pi 5 (8 GB), Intel NUC, any modest VPS, or a spare workstation.

### Recommended — SME Production

> Multiple firewalls/switches, several concurrent analysts, sustained traffic, months of history.

| Resource | Recommended |
|---|---|
| **CPU** | 4 vCPUs (x86-64) |
| **RAM** | 8 GB |
| **Disk** | 100 GB NVMe SSD |
| **OS** | Ubuntu 22.04 LTS or Debian 12 — Docker Engine ≥ 24 + Compose v2 |
| **Network** | 1 Gbps NIC; dedicated interface for syslog/NetFlow ingestion recommended |
| **Flow rate** | ~5,000–10,000 flows/sec sustained across syslog + NetFlow combined |
| **Reverse proxy** | nginx or Caddy in front of port 8000 — TLS termination + basic auth |
| **Retention** | SQLite DB grows ~200–400 bytes per unique flow (deduplication reduces this significantly); 100 GB covers years of typical SME traffic |

Suitable hosting: a mid-range dedicated server, on-prem VM (Proxmox/ESXi), or a cloud instance equivalent to AWS t3.xlarge / Azure D4s v3 / GCP e2-standard-4.

### Production Hardening Checklist

- [ ] Set `ENABLE_SEED=false` in `docker-compose.yml` — the dev default is `true`
- [ ] Place nginx or Caddy in front of port 8000 with TLS and basic auth
- [ ] Set `CORS_ORIGINS` to your dashboard hostname if serving beyond localhost
- [ ] Bind syslog/NetFlow ports to the internal-facing NIC only (e.g. `<internal_ip>:514:514`) to avoid exposing them on a public interface
- [ ] Add a SQLite backup cron: `sqlite3 sentinel.db ".backup /backups/sentinel-$(date +%F).db"`
- [ ] Configure log rotation for `traffic.jsonl` — syslog-ng appends indefinitely
- [ ] Set `mem_limit` and `cpus` in `docker-compose.yml` to prevent any container starving the host under a log flood
- [ ] Review and update `jurisdiction/parent_company_graph.yaml` quarterly or after significant M&A events (new entities, ownership changes)

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Docker Engine ≥ 24 | Compose v2 included |
| MaxMind GeoLite2-Country.mmdb | Free — country-level geo classification |
| MaxMind GeoLite2-ASN.mmdb | Free — ASN + organisation name for jurisdiction classification |
| Firewall configured to send syslog or NetFlow | UDP 514 / TCP 514 / UDP 2055 |

### Obtaining the GeoLite2 Databases

SchengenWatch uses **two** MaxMind databases. Both are free, both are downloaded from the same MaxMind account, and both must sit side-by-side in `./mmdb/`.

1. Create a free account at [maxmind.com/en/geolite2/signup](https://www.maxmind.com/en/geolite2/signup)
2. Download **GeoLite2 Country** and **GeoLite2 ASN** (both in `.mmdb` format)
3. Place both files in `./mmdb/`:

```bash
mkdir -p mmdb
cp ~/Downloads/GeoLite2-Country_*/GeoLite2-Country.mmdb mmdb/
cp ~/Downloads/GeoLite2-ASN_*/GeoLite2-ASN.mmdb         mmdb/
```

Without `GeoLite2-ASN.mmdb` the backend still runs, but jurisdiction tags (`US_CLOUD_ACT`, `US_FISA_702`, `CN_NSL`, `UK_IPA`) are not resolved and flows fall back to pure country-based classification.

---

## Quick Start

```bash
git clone https://github.com/andrewsmhay/SchengenWatch.git
cd SchengenWatch

# 1. Add both MaxMind databases
mkdir -p mmdb
cp /path/to/GeoLite2-Country.mmdb mmdb/
cp /path/to/GeoLite2-ASN.mmdb     mmdb/

# 2. Start everything
docker compose up -d

# 3. Open the dashboard
open http://localhost:8000

# 4. Inject demo data (no firewall required — dev mode enabled by default)
curl "http://localhost:8000/api/db/seed?n=500"
```

---

## Input Sources

### Syslog (UDP/TCP 514, TCP 601)

Supported firewall log formats:

- **Cisco ASA / PIX / FTD** — Built/Teardown connection messages
- **iptables / nftables** — `SRC= DST= PROTO= DPT=` format
- **Palo Alto Networks** — CSV traffic log
- **Generic key=value** — Fortinet, Check Point, pfSense, OPNsense, MikroTik

**Cisco ASA:**
```
logging enable
logging host inside <SCHENGENWATCH_IP> 514
logging trap informational
```

**iptables:**
```bash
# /etc/rsyslog.d/99-schengenwatch.conf
*.* @<SCHENGENWATCH_IP>:514
```

**pfSense / OPNsense:** Status > System Logs > Settings > Remote Logging > `<SCHENGENWATCH_IP>:514`

**Extreme Networks (ExtremeXOS — UDP 514):**
```
# Add SchengenWatch as a syslog target (facility local1, UDP 514)
configure syslog add <SCHENGENWATCH_IP> local1
enable log target syslog <SCHENGENWATCH_IP> local1
enable syslog

# Optional: enable CLI audit logging (records every config change with user + source IP)
enable cli config-logging
```

Up to four syslog servers can be configured simultaneously. Supported on ExtremeSwitching X435, X440-G2, X450-G2, X460-G2, X465, X590, X620, and X695 series switches running ExtremeXOS 22.4+.

**Extreme Networks (ExtremeXOS — TLS 6514):**
```
# Encrypted syslog over TLS (port 6514 is the ExtremeXOS default)
configure syslog add <SCHENGENWATCH_IP> tls-port 6514 local1
enable log target syslog <SCHENGENWATCH_IP> local1
enable syslog
```

See [ExtremeXOS configure syslog documentation](https://documentation.extremenetworks.com/exos_commands_22.4/exos_21_1/exos_commands_all/r_configure-syslog-add.shtml) for full syntax reference.

---

### NetFlow / IPFIX (UDP 2055)

NetFlow provides richer data (byte counts, packet counts, flow duration) and is the preferred input for enterprise environments.

**Cisco IOS / IOS-XE (v9):**
```
ip flow-export version 9
ip flow-export destination <SCHENGENWATCH_IP> 2055
interface GigabitEthernet0/0
 ip flow ingress
 ip flow egress
```

**Palo Alto (IPFIX):**
```
Device > Server Profiles > NetFlow
  Server: <SCHENGENWATCH_IP>  Port: 2055  Version: IPFIX
Network > Interfaces > <WAN interface> > NetFlow Profile
```

**Fortinet FortiGate (v9):**
```
config system netflow
  set collector-ip <SCHENGENWATCH_IP>
  set collector-port 2055
end
```

**MikroTik (v5):**
```
/ip traffic-flow
set enabled=yes interfaces=all
/ip traffic-flow target
add dst-address=<SCHENGENWATCH_IP> port=2055 version=5
```

**Juniper SRX (v9):**
```
set forwarding-options sampling instance default family inet \
    output flow-server <SCHENGENWATCH_IP> port 2055 version9 template ipv4
```

**Extreme Networks (ExtremeXOS — IPFIX, X460-G2 series):**
```
# Configure flow keys (5-tuple: src/dst IP, src/dst port, protocol)
configure ip-fix flow-key ipv4 src-ip dest-ip src-port dest-port protocol

# Enable IPFIX on all ports (IPv4 traffic)
enable ip-fix ports all ipv4

# Point the collector at SchengenWatch
configure ip-fix collector <SCHENGENWATCH_IP> port 2055

# Enable IPFIX globally
enable ip-fix
```

IPFIX is supported on ExtremeSwitching X460-G2 series switches. Flow count is limited to 4K (2K ingress, 2K egress) per switch. See [Extreme Networks IPFIX documentation](https://documentation.extremenetworks.com/exos_32.1/GUID-BA130F20-2293-4EE4-A7E9-1514D6624741.shtml) for full reference.

**Extreme Networks (EOS / legacy switches — NetFlow v9):**
```
set netflow export-interval 1
set netflow export-destination <SCHENGENWATCH_IP> 2055
set netflow cache enable
set netflow export-version 9
set netflow template refresh-rate 600 timeout 1

# Enable NetFlow on each interface (repeat per interface)
set netflow port <INTERFACE_NAME> enable both
```

Applies to older Extreme Networks (formerly Enterasys) EOS-based switches.

---

### PCAP Upload

Upload a previously captured packet capture file and SchengenWatch will extract all TCP/UDP flows, geo-classify them, and add them to the database.

```bash
# Place pcap in the pcaps/ directory (git-ignored)
cp ~/Downloads/capture.pcap ./pcaps/

# Upload
curl -X POST http://localhost:8000/api/ingest/pcap \
     -F "file=@./pcaps/capture.pcap"
```

Supported formats: `.pcap`, `.pcapng`, `.cap`

Flows are deduplicated — if a flow already exists from syslog or NetFlow, `last_seen` and `count` are updated.

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness probe — reports DB, both MMDBs, jurisdiction entry count, and `FILTER_PRIVATE_DST` flag |
| GET | `/api/stats/summary` | All KPI counts |
| GET | `/api/traffic/country?iso=DE` | Flows to a specific country |
| GET | `/api/traffic/eu` | EU flows |
| GET | `/api/traffic/non-eu` | Non-EU flows (primary alert) |
| GET | `/api/traffic/watch` | Watch-country flows |
| GET | `/api/top/destinations?n=25` | Top N endpoints by count |
| GET | `/api/top/countries?n=10` | Top N countries by count |
| GET | `/api/recent?limit=100` | Most recent flows |
| GET | `/api/countries/list` | All countries seen in traffic |
| GET | `/api/settings/watch` | Current watch countries |
| POST | `/api/settings/watch` | Update watch countries `{"countries":["RU","CN"]}` |
| POST | `/api/ingest/pcap` | Upload `.pcap` / `.pcapng`, extract flows |
| GET | `/api/db/seed?n=300` | Inject demo data (`ENABLE_SEED=true` required) |

All flow-returning endpoints (`/api/traffic/*`, `/api/top/destinations`, `/api/recent`) include the following per-flow enrichment fields when the ASN database and jurisdiction YAMLs are loaded:

- `asn` — autonomous system number (integer) or `null`
- `org_name` — MaxMind `autonomous_system_organization` string or `null`
- `jurisdiction_tags` — array of tag strings (e.g. `["US_CLOUD_ACT", "US_FISA_702"]`); empty when the destination's UBO has no policy tags assigned

---

## Environment Variables

### processor

| Variable | Default | Description |
|---|---|---|
| `SENTINEL_LOG_FILE` | `/var/log/perimeter/traffic.jsonl` | syslog-ng output path |
| `SENTINEL_DB_PATH` | `/data/schengenwatch.db` | SQLite database path |
| `SENTINEL_BATCH` | `50` | Rows per commit |
| `SENTINEL_POLL` | `0.5` | File poll interval (seconds) |

### netflow

| Variable | Default | Description |
|---|---|---|
| `NETFLOW_HOST` | `0.0.0.0` | Listen address |
| `NETFLOW_PORT` | `2055` | Listen port |
| `SENTINEL_DB_PATH` | `/data/schengenwatch.db` | SQLite database path |

### backend

| Variable | Default | Description |
|---|---|---|
| `SENTINEL_DB_PATH` | `/data/sentinel.db` | SQLite database path |
| `MAXMIND_DB_PATH` | `/mmdb/GeoLite2-Country.mmdb` | MaxMind country MMDB path |
| `MAXMIND_ASN_DB_PATH` | `/mmdb/GeoLite2-ASN.mmdb` | MaxMind ASN MMDB path — enables ASN/org enrichment and jurisdiction tagging |
| `CLASSIFICATION_DIR` | `/app/jurisdiction` | Directory containing `jurisdiction_policy.yaml` + `parent_company_graph.yaml` |
| `FILTER_PRIVATE_DST` | `false` | Set `true` to drop flows whose destination is an RFC 1918 / loopback / link-local address (reduces noise from internal LAN traffic) |
| `STATIC_DIR` | `/app/static` | Dashboard static files |
| `ENABLE_SEED` | `false` | Set `true` to enable `/api/db/seed` (dev only — disable in production) |
| `CORS_ORIGINS` | _(empty)_ | Comma-separated allowed CORS origins — leave unset for same-origin only |

---

## SQLite Schema

```sql
CREATE TABLE traffic (
    id         TEXT    PRIMARY KEY,   -- UUID v4
    src_ip     TEXT    NOT NULL,
    dst_ip     TEXT    NOT NULL,
    dst_port   INTEGER NOT NULL,
    protocol   TEXT    NOT NULL,      -- TCP | UDP
    first_seen TEXT    NOT NULL,      -- ISO-8601 UTC
    last_seen  TEXT    NOT NULL,      -- updated on every hit
    count      INTEGER NOT NULL DEFAULT 1
);
-- Unique key: (src_ip, dst_ip, dst_port, protocol)
```

---

## Security

### OWASP Top 10 Assessment

SchengenWatch was assessed against the OWASP Top 10. Key findings and mitigations:

| Category | Status | Notes |
|---|---|---|
| A01 Broken Access Control | Mitigated | Seed endpoint gated behind `ENABLE_SEED` env var; watch settings writable by any local user |
| A02 Cryptographic Failures | Acceptable | No PII stored; HTTP only — add TLS reverse proxy for network exposure |
| A03 Injection | Clean | All SQL uses parameterised queries; IPs/ports/protocols validated against strict allowlists |
| A04 Insecure Design | Mitigated | Seed endpoint returns 403 unless `ENABLE_SEED=true` |
| A05 Security Misconfiguration | Mitigated | CORS locked to same-origin; security headers added (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) |
| A06 Vulnerable Components | Patched | CVEs in `python-multipart` and `starlette` resolved — `python-multipart>=0.0.26` |
| A07 Auth & Identity | By design | Self-hosted, single-tenant; no auth layer — protect with network isolation or reverse proxy |
| A08 Software Integrity | Clean | No `eval`/`exec` on untrusted input; no shell execution in PCAP ingestion |
| A09 Logging & Monitoring | Clean | Structured logging in all containers; no credentials or PII logged |
| A10 SSRF | N/A | Backend makes no outbound HTTP requests |

### General Notes

- All metadata (hostname, facility, severity, timestamps, process names) is stripped at ingest. Only `src_ip`, `dst_ip`, `dst_port`, and `protocol` survive.
- All IP addresses and port numbers are validated before writing to SQLite.
- No authentication is included. Place a reverse proxy (nginx, Caddy, Traefik) with TLS and basic auth in front of port 8000 before network exposure.
- PCAP files are excluded from git — they may contain sensitive traffic data.
- The `/api/db/seed` endpoint is disabled by default (`ENABLE_SEED=false`). Never set `ENABLE_SEED=true` in production.

---

## File Structure

```
schengenwatch/
├── docker-compose.yml
├── README.md
├── .gitignore
├── mmdb/                          ← GeoLite2-Country.mmdb + GeoLite2-ASN.mmdb
├── jurisdiction/                  ← jurisdiction classification policy
│   ├── jurisdiction_policy.yaml   ← tag definitions (US_CLOUD_ACT, CN_NSL, …)
│   └── parent_company_graph.yaml  ← corporate ownership + ASN assignments
├── data/                          ← SQLite DB (runtime)
├── pcaps/                         ← drop .pcap files here (git-ignored)
├── syslog-ng/
│   ├── Dockerfile
│   └── syslog-ng.conf
├── processor/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── processor.py
├── netflow/
│   ├── Dockerfile
│   └── collector.py
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── main.py
└── dashboard/
    ├── index.html
    ├── style.css
    ├── app.js
    ├── logo.jpg          ← Damovo Traces sidebar logo
    └── traces.jpg        ← Damovo Traces topbar logo
```

---

## Compliance

SchengenWatch provides continuous, automated technical evidence to support your organisation's obligations under the following frameworks. It does not replace legal advice, a formal Data Protection Impact Assessment (DPIA), or a certified audit — but it gives compliance, security, and legal teams the real-time visibility they need to demonstrate control.

### GDPR (General Data Protection Regulation)

| Requirement | How SchengenWatch Helps |
|---|---|
| **Art. 44-49** — Restricted transfers to third countries | Non-EU Alerts view flags every flow leaving the EEA in real time — including flows to EU-hosted infrastructure owned by non-EU parent companies (jurisdiction-aware classification via GeoLite2-ASN + corporate ownership graph); provides timestamped evidence for regulatory enquiries |
| **Art. 32** — Security of processing | Demonstrates that technical controls are in place to monitor and detect unauthorised data transfers |
| **Art. 30** — Records of processing activities | Flow logs (src/dst IP, port, protocol, first/last seen) provide a machine-readable audit trail |
| **Art. 35** — Data Protection Impact Assessment | SchengenWatch output can be referenced as supporting evidence in a DPIA for cross-border data flows |
| **Schrems II** | Identifies flows subject to US surveillance law (CLOUD Act, FISA §702) even when the destination IP geolocates inside the EU — the UBO-based jurisdiction classifier surfaces exactly the transfer scenarios the CJEU ruling targeted, prompting review of legal basis and supplementary measures |

### NIS2 Directive (EU 2022/2555)

| Requirement | How SchengenWatch Helps |
|---|---|
| **Art. 21** — Risk management measures | Provides a dedicated control for monitoring network-layer data flows across jurisdictional boundaries |
| **Art. 23** — Incident reporting | Non-EU and watch-country alerts generate timestamped records that can be included in incident notification to national competent authorities |
| **Supply chain security** | Watch-list feature enables operators to flag flows to specific third-country suppliers or service providers |
| **Access controls and monitoring** | Continuous flow visibility supports the network monitoring requirements for operators of essential services and important entities |

### DORA (Digital Operational Resilience Act — EU 2022/2554)

| Requirement | How SchengenWatch Helps |
|---|---|
| **Art. 9** — ICT risk management | Network flow monitoring is a required technical control; SchengenWatch provides continuous coverage without a SIEM dependency |
| **Art. 28** — ICT third-party risk | Identifies outbound connections to non-EU third-party providers; supports ICT concentration risk assessments |
| **Art. 10** — Detection | Real-time alerting on cross-border flows supports DORA's requirement to detect anomalous network activities |
| **Art. 12** — Backup and recovery | Exported flow data (SQLite DB) can be included in backup and recovery procedures as part of ICT continuity planning |

### ISO/IEC 27001:2022

| Control | How SchengenWatch Helps |
|---|---|
| **A.8.15** — Logging | Structured, append-only flow logs with timestamps, IPs, ports, and protocol |
| **A.8.16** — Monitoring activities | Continuous NetFlow/syslog ingestion and dashboard alerting for anomalous or policy-violating flows |
| **A.5.14** — Information transfer | Technical control verifying that data transfers remain within approved jurisdictions |
| **A.8.23** — Web filtering / network controls | Flow-level visibility into all outbound connections, not just HTTP |
| **A.5.30** — ICT readiness for business continuity | Flow history supports post-incident analysis and business continuity reporting |

### NIST Cybersecurity Framework (CSF 2.0)

| Function / Category | How SchengenWatch Helps |
|---|---|
| **IDENTIFY (ID.AM)** — Asset management | Maps active network communication relationships between internal assets and external destinations |
| **PROTECT (PR.DS)** — Data security | Enforces visibility over data-in-transit flows; supports jurisdiction-based data handling policies |
| **DETECT (DE.CM)** — Continuous monitoring | Real-time syslog and NetFlow ingestion with immediate alerting on non-EU and watch-country flows |
| **DETECT (DE.AE)** — Anomaly detection | Watch-list matching and Non-EU Alerts provide anomaly detection for flows to unexpected destinations |
| **RESPOND (RS.AN)** — Analysis | Timestamped flow records support incident analysis and root-cause investigation |
| **RECOVER (RC.CO)** — Communications | Flow logs can be shared with regulators and stakeholders as evidence of detection and response capability |

### Cyber Resilience Act (CRA — EU 2024/2847)

| Requirement | How SchengenWatch Helps |
|---|---|
| **Art. 13** — Security by design | SchengenWatch is self-hosted and processes no external data; no PII is stored beyond IP addresses and ports |
| **Vulnerability management** | OWASP Top 10 assessment completed; CVEs patched; dependency pinning enforced |
| **Transparency and documentation** | Open-source codebase; full architecture, API, and security documentation in this README |
| **Incident and anomaly reporting** | Non-EU Alerts and watch-list flows provide the detection layer needed to identify and report security-relevant network events |

### BSI IT-Grundschutz

| Baustein | How SchengenWatch Helps |
|---|---|
| **NET.1.1** — Netzarchitektur und -design | Supports documentation of network communication relationships and data flows between zones |
| **NET.3.2** — Router und Switches | Provides a receiving endpoint for syslog and NetFlow from network infrastructure, enabling centralised flow visibility |
| **OPS.1.1.5** — Protokollierung | Continuous, structured logging of all network flows with src/dst IP, port, protocol, and timestamps |
| **OPS.1.1.6** — Software-Tests und Freigaben | OWASP assessment documented; all containers use pinned, reviewed base images |
| **CON.2** — Datenschutz | Technical enforcement of GDPR Art. 44-49 data transfer restrictions at the network layer |
| **DER.1** — Detektion von sicherheitsrelevanten Ereignissen | Real-time alerting on flows to non-EU destinations and user-defined watch countries |

---

> SchengenWatch does not replace legal advice, a formal DPIA, or a certified compliance audit. It provides the continuous technical evidence layer that supports those processes.

---

## Contributing

SchengenWatch is open source under the MIT licence. Contributions welcome — particularly:

- Additional firewall log parsers (syslog-ng)
- IPv6 flow support
- Alert webhooks (Slack, Teams, email) for non-EU traffic threshold breaches
- Grafana data source plugin
- Kubernetes / Helm deployment manifests

---

## Licence

MIT — see [LICENSE](LICENSE)
