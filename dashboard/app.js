/* ═══════════════════════════════════════════════════════
   Perimeter Sentinel — Dashboard Application
   Single-page, no framework dependencies
═══════════════════════════════════════════════════════ */

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
//  SchengenWatch — Static Demo Data
//  Used when no backend is available (previews, screenshots, onboarding)
// ═══════════════════════════════════════════════════════════════════════════
const DEMO_DATA = {
  '/api/health': { status: 'ok', mmdb: true, db: true, version: '1.0.0' },

  '/api/stats/summary': {
    total_flows: 18432,
    total_communications: 94718,
    eu_flows: 11204,
    eu_communications: 71280,
    non_eu_flows: 5814,
    non_eu_communications: 19402,
    watch_unique_flows: 412,
    watch_communications: 3036,
    eu_pct: 60.8,
    non_eu_pct: 31.6,
    watch_pct: 7.6,
    unknown_flows: 1414
  },

  '/api/traffic/eu': { count: 11204, flows: [
    { src_ip:'10.10.1.12', dst_ip:'195.148.127.36', dst_port:443, protocol:'TCP', country:'DE', count:8821, last_seen:'2026-04-15T18:52:14Z' },
    { src_ip:'10.10.1.12', dst_ip:'77.245.25.1',    dst_port:443, protocol:'TCP', country:'FR', count:6134, last_seen:'2026-04-15T18:51:55Z' },
    { src_ip:'10.10.2.55', dst_ip:'91.108.56.165',  dst_port:443, protocol:'TCP', country:'NL', count:5490, last_seen:'2026-04-15T18:51:42Z' },
    { src_ip:'10.10.1.30', dst_ip:'104.244.42.195', dst_port:443, protocol:'TCP', country:'IE', count:4201, last_seen:'2026-04-15T18:50:33Z' },
    { src_ip:'10.10.3.18', dst_ip:'213.180.204.3',  dst_port:443, protocol:'TCP', country:'SE', count:3788, last_seen:'2026-04-15T18:49:12Z' },
    { src_ip:'10.10.1.44', dst_ip:'185.53.178.14',  dst_port:443, protocol:'TCP', country:'BE', count:3210, last_seen:'2026-04-15T18:48:02Z' },
    { src_ip:'10.10.2.77', dst_ip:'93.184.216.34',  dst_port:80,  protocol:'TCP', country:'DE', count:2901, last_seen:'2026-04-15T18:47:11Z' },
    { src_ip:'10.10.1.12', dst_ip:'78.46.0.1',      dst_port:443, protocol:'TCP', country:'DE', count:2488, last_seen:'2026-04-15T18:46:30Z' },
    { src_ip:'10.10.4.22', dst_ip:'82.195.147.14',  dst_port:443, protocol:'TCP', country:'ES', count:2001, last_seen:'2026-04-15T18:45:05Z' },
    { src_ip:'10.10.1.55', dst_ip:'130.255.240.1',  dst_port:443, protocol:'TCP', country:'PL', count:1840, last_seen:'2026-04-15T18:44:22Z' }
  ]},

  '/api/traffic/non-eu': { count: 5814, flows: [
    { src_ip:'10.10.1.12', dst_ip:'172.217.16.46',  dst_port:443, protocol:'TCP', country:'US', count:4812, last_seen:'2026-04-15T18:52:01Z' },
    { src_ip:'10.10.2.33', dst_ip:'13.107.42.14',   dst_port:443, protocol:'TCP', country:'US', count:3924, last_seen:'2026-04-15T18:51:45Z' },
    { src_ip:'10.10.3.18', dst_ip:'52.84.45.20',    dst_port:443, protocol:'TCP', country:'US', count:2811, last_seen:'2026-04-15T18:51:10Z' },
    { src_ip:'10.10.1.30', dst_ip:'203.0.113.50',   dst_port:443, protocol:'TCP', country:'SG', count:1204, last_seen:'2026-04-15T18:50:48Z' },
    { src_ip:'10.10.4.55', dst_ip:'185.199.108.153',dst_port:443, protocol:'TCP', country:'US', count:1100, last_seen:'2026-04-15T18:49:55Z' },
    { src_ip:'10.10.2.11', dst_ip:'104.16.88.20',   dst_port:443, protocol:'TCP', country:'US', count:988,  last_seen:'2026-04-15T18:48:32Z' },
    { src_ip:'10.10.1.44', dst_ip:'1.1.1.1',        dst_port:53,  protocol:'UDP', country:'AU', count:712,  last_seen:'2026-04-15T18:47:15Z' },
    { src_ip:'10.10.3.22', dst_ip:'8.8.8.8',        dst_port:53,  protocol:'UDP', country:'US', count:651,  last_seen:'2026-04-15T18:46:44Z' },
    { src_ip:'10.10.1.77', dst_ip:'54.230.150.27',  dst_port:443, protocol:'TCP', country:'US', count:480,  last_seen:'2026-04-15T18:45:30Z' },
    { src_ip:'10.10.2.55', dst_ip:'103.21.244.0',   dst_port:443, protocol:'TCP', country:'SG', count:408,  last_seen:'2026-04-15T18:44:10Z' }
  ]},

  '/api/traffic/watch': { count: 412, flows: [
    { src_ip:'10.10.1.12', dst_ip:'95.213.134.4',   dst_port:443, protocol:'TCP', country:'RU', count:288, last_seen:'2026-04-15T17:44:02Z' },
    { src_ip:'10.10.2.33', dst_ip:'203.208.40.15',  dst_port:80,  protocol:'TCP', country:'CN', count:124, last_seen:'2026-04-15T17:40:18Z' },
    { src_ip:'10.10.1.55', dst_ip:'95.213.134.12',  dst_port:8443,protocol:'TCP', country:'RU', count:88,  last_seen:'2026-04-15T16:55:44Z' },
    { src_ip:'10.10.4.22', dst_ip:'185.220.101.38', dst_port:443, protocol:'TCP', country:'RU', count:76,  last_seen:'2026-04-15T16:40:22Z' },
    { src_ip:'10.10.3.18', dst_ip:'119.29.29.29',   dst_port:53,  protocol:'UDP', country:'CN', count:44,  last_seen:'2026-04-15T15:22:10Z' }
  ]},

  '/api/top/countries': { countries: [
    { country:'DE', count:21440 },
    { country:'US', count:14188 },
    { country:'FR', count:9822 },
    { country:'NL', count:8104 },
    { country:'IE', count:7350 },
    { country:'SE', count:5920 },
    { country:'BE', count:4810 },
    { country:'SG', count:3204 },
    { country:'ES', count:2880 },
    { country:'AU', count:1740 }
  ],

  '/api/top/destinations': { destinations: [
    { dst_ip:'172.217.16.46', dst_port:443, country:'US', protocol:'TCP', count:4812 },
    { dst_ip:'195.148.127.36',dst_port:443, country:'DE', protocol:'TCP', count:4400 },
    { dst_ip:'13.107.42.14',  dst_port:443, country:'US', protocol:'TCP', count:3924 },
    { dst_ip:'77.245.25.1',   dst_port:443, country:'FR', protocol:'TCP', count:3800 },
    { dst_ip:'91.108.56.165', dst_port:443, country:'NL', protocol:'TCP', count:3200 },
    { dst_ip:'52.84.45.20',   dst_port:443, country:'US', protocol:'TCP', count:2811 },
    { dst_ip:'104.244.42.195',dst_port:443, country:'IE', protocol:'TCP', count:2400 },
    { dst_ip:'213.180.204.3', dst_port:443, country:'SE', protocol:'TCP', count:1990 },
    { dst_ip:'185.53.178.14', dst_port:443, country:'BE', protocol:'TCP', count:1600 },
    { dst_ip:'203.0.113.50',  dst_port:443, country:'SG', protocol:'TCP', count:1204 }
  ]},

  '/api/recent': (function() {
    const rawFlows = [
      ['10.10.1.12','172.217.16.46',443,'TCP','US'],
      ['10.10.2.33','195.148.127.36',443,'TCP','DE'],
      ['10.10.1.30','77.245.25.1',443,'TCP','FR'],
      ['10.10.3.18','91.108.56.165',443,'TCP','NL'],
      ['10.10.4.22','95.213.134.4',443,'TCP','RU'],
      ['10.10.1.44','104.244.42.195',443,'TCP','IE'],
      ['10.10.2.55','213.180.204.3',443,'TCP','SE'],
      ['10.10.1.77','13.107.42.14',443,'TCP','US'],
      ['10.10.2.11','203.208.40.15',80,'TCP','CN'],
      ['10.10.3.22','1.1.1.1',53,'UDP','AU'],
      ['10.10.1.12','185.53.178.14',443,'TCP','BE'],
      ['10.10.4.55','52.84.45.20',443,'TCP','US'],
      ['10.10.2.33','185.220.101.38',443,'TCP','RU'],
      ['10.10.1.55','78.46.0.1',443,'TCP','DE'],
      ['10.10.3.18','93.184.216.34',80,'TCP','DE'],
    ];
    const now = Date.now();
    return { flows: rawFlows.map((f,i) => ({
      src_ip: f[0], dst_ip: f[1], dst_port: f[2], protocol: f[3], country: f[4],
      last_seen: new Date(now - i * 42000).toISOString(),
      count: Math.floor(Math.random()*500)+50
    })) };
  })(),

  '/api/settings/watch': { countries: ['RU','CN','KP','IR'] },

  '/api/countries/list': [
    { iso:'DE', name:'Germany', count:21440 },
    { iso:'US', name:'United States', count:14188 },
    { iso:'FR', name:'France', count:9822 },
    { iso:'NL', name:'Netherlands', count:8104 },
    { iso:'IE', name:'Ireland', count:7350 },
    { iso:'SE', name:'Sweden', count:5920 },
    { iso:'BE', name:'Belgium', count:4810 },
    { iso:'SG', name:'Singapore', count:3204 },
    { iso:'ES', name:'Spain', count:2880 },
    { iso:'AU', name:'Australia', count:1740 },
    { iso:'RU', name:'Russia', count:412 },
    { iso:'CN', name:'China', count:168 },
    { iso:'PL', name:'Poland', count:1840 }
  ]
};

// ── Config ────────────────────────────────────────────────────────────────
let API_BASE = '';  // empty = same origin; set in settings to override

const AUTO_REFRESH_MS  = 30_000;  // 30 s live refresh
let   autoRefreshTimer = null;

// ── EU countries (for badge classification client-side) ───────────────────
const EU_CODES = new Set([
  'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI',
  'FR','GR','HR','HU','IE','IT','LT','LU','LV','MT',
  'NL','PL','PT','RO','SE','SI','SK',
]);

// ── Utility ───────────────────────────────────────────────────────────────
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-GB');
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', { hour12: false, timeZone: 'UTC' });
  } catch {
    return iso;
  }
}

function categoryBadge(cat, iso) {
  if (cat === 'eu')      return `<span class="badge badge-eu">EU · ${iso}</span>`;
  if (cat === 'non-eu')  return `<span class="badge badge-non-eu">Non-EU · ${iso}</span>`;
  if (cat === 'watch')   return `<span class="badge badge-watch">⚠ Watch · ${iso}</span>`;
  return `<span class="badge badge-unknown">${iso || 'Unknown'}</span>`;
}

function protoBadge(proto) {
  if (!proto) return '—';
  const p = proto.toUpperCase();
  return `<span class="badge badge-${p.toLowerCase()}">${p}</span>`;
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('#toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

async function apiFetch(path) {
  const url = API_BASE ? `${API_BASE.replace(/\/$/, '')}${path}` : path;
  return fetch(url).then(r => {
    if (!r.ok) {
      // Fall back to demo data on backend error
      const demo = DEMO_DATA[path.split('?')[0]];
      if (demo !== undefined) return typeof demo === 'function' ? demo(path) : demo;
      throw new Error(`HTTP ${r.status}: ${path}`);
    }
    return r.json();
  }).catch(() => {
    // Fall back to demo data if fetch fails entirely (no backend)
    const demo = DEMO_DATA[path.split('?')[0]];
    if (demo !== undefined) return typeof demo === 'function' ? demo(path) : demo;
    return {};
  });
}

// ── Theme ─────────────────────────────────────────────────────────────────
(function initTheme() {
  const pref   = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'dark';
  document.documentElement.setAttribute('data-theme', pref);
})();

$('#theme-toggle').addEventListener('click', () => {
  const cur  = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  lucide.createIcons({ attrs: {} });
});

// ── Sidebar toggle ────────────────────────────────────────────────────────
$('#sidebar-toggle').addEventListener('click', () => {
  document.querySelector('.shell').classList.toggle('collapsed');
});

// ── Navigation ────────────────────────────────────────────────────────────
const VIEWS = {
  overview: 'Sovereignty Overview',
  country:  'By Country',
  eu:       'EU Traffic',
  'non-eu': 'Non-EU Alerts',
  watch:    'Watch List',
  recent:   'Recent Flows',
  settings: 'Settings',
};

function activateView(viewId) {
  $$('.nav-item').forEach(btn => {
    const active = btn.dataset.view === viewId;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-current', active ? 'page' : 'false');
  });
  $$('.view').forEach(v => v.classList.remove('active'));
  const target = $(`#view-${viewId}`);
  if (target) target.classList.add('active');
  $('#breadcrumb').textContent = VIEWS[viewId] || viewId;
}

$$('.nav-item[data-view]').forEach(btn => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    activateView(view);
    onViewLoad(view);
  });
});

// ── Charts state ──────────────────────────────────────────────────────────
let chartDonut         = null;
let chartTopCountries  = null;
let chartEU            = null;
let chartNonEU         = null;

function destroyChart(ref) {
  if (ref) { try { ref.destroy(); } catch (_) {} }
  return null;
}

// ── Chart helpers ──────────────────────────────────────────────────────────
const CHART_DEFAULTS = {
  font: { family: "'Satoshi', sans-serif", size: 12 },
  color: getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#7b8bb2',
};

function getColor(iso, cat) {
  if (!iso || iso === 'XX') return '#424d68';
  if (cat === 'eu')     return '#60a5fa';
  if (cat === 'non-eu') return '#a78bfa';
  if (cat === 'watch')  return '#f59e0b';
  return '#60a5fa';
}

// ── Overview ──────────────────────────────────────────────────────────────
async function loadOverview() {
  try {
    const [summary, topDest, topCountries] = await Promise.all([
      apiFetch('/api/stats/summary'),
      apiFetch('/api/top/destinations?n=25'),
      apiFetch('/api/top/countries?n=10'),
    ]);

    // KPIs
    $('#kpi-total-flows').textContent  = fmt(summary.total_unique_flows);
    $('#kpi-total-comms').textContent  = `${fmt(summary.total_communications)} communications`;
    $('#kpi-eu-flows').textContent     = fmt(summary.eu_unique_flows);
    $('#kpi-eu-comms').textContent     = `${fmt(summary.eu_communications)} communications`;
    $('#kpi-noneu-flows').textContent  = fmt(summary.non_eu_unique_flows);
    $('#kpi-noneu-comms').textContent  = `${fmt(summary.non_eu_communications)} communications`;
    $('#kpi-watch-flows').textContent  = fmt(summary.watch_unique_flows);
    $('#kpi-watch-comms').textContent  = `${fmt(summary.watch_communications)} communications`;

    // Watch badge
    const watchBadge = $('#watch-badge');
    if (summary.watch_unique_flows > 0) {
      watchBadge.textContent = summary.watch_unique_flows;
      watchBadge.classList.add('visible');
    } else {
      watchBadge.classList.remove('visible');
    }

    // Donut chart
    const donutData = [
      { label: 'EU',         value: summary.eu_communications,      color: '#60a5fa' },
      { label: 'Non-EU',     value: summary.non_eu_communications,   color: '#a78bfa' },
      { label: 'Watch',      value: summary.watch_communications,    color: '#f59e0b' },
      { label: 'Unknown',    value: summary.unknown_communications,  color: '#424d68' },
    ].filter(d => d.value > 0);

    chartDonut = destroyChart(chartDonut);
    const donutCtx = $('#chart-donut').getContext('2d');
    chartDonut = new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels: donutData.map(d => d.label),
        datasets: [{
          data:            donutData.map(d => d.value),
          backgroundColor: donutData.map(d => d.color),
          borderColor:     donutData.map(d => d.color + '44'),
          borderWidth: 1,
          hoverOffset: 6,
        }],
      },
      options: {
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}`,
            },
          },
        },
        maintainAspectRatio: false,
      },
    });

    // Donut legend
    const total = donutData.reduce((a, d) => a + d.value, 0);
    $('#donut-legend').innerHTML = donutData.map(d => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${d.color}"></div>
        <span class="legend-label">${d.label}</span>
        <span class="legend-count">${fmt(d.value)}</span>
      </div>
    `).join('');

    $('#chart-donut-meta').textContent = `${fmt(total)} total`;

    // Top countries bar
    const countries = topCountries.countries.slice(0, 10);
    chartTopCountries = destroyChart(chartTopCountries);
    const barCtx = $('#chart-top-countries').getContext('2d');
    chartTopCountries = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: countries.map(c => c.name || c.iso),
        datasets: [{
          data:            countries.map(c => c.count),
          backgroundColor: countries.map(c => getColor(c.iso, c.category) + 'cc'),
          borderColor:     countries.map(c => getColor(c.iso, c.category)),
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { color: '#7b8bb2', font: { family: "'JetBrains Mono'", size: 11 } },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#d4daf0', font: { family: "'Satoshi'", size: 12 } },
          },
        },
        maintainAspectRatio: false,
      },
    });

    // Top dest table
    renderTable('#tbody-top-dest', topDest.destinations, (r) => {
      const cat = classifyLocal(r.dst_country_iso, r.category);
      return `
        <td class="mono">${r.dst_ip}</td>
        <td class="mono">${r.dst_port}</td>
        <td>${protoBadge(r.protocol)}</td>
        <td>${r.dst_country_name || '—'}</td>
        <td>${categoryBadge(cat, r.dst_country_iso)}</td>
        <td class="num-col mono">${fmt(r.count)}</td>
        <td class="text-muted" style="font-size:var(--text-xs)">${fmtDate(r.first_seen)}</td>
        <td class="text-muted" style="font-size:var(--text-xs)">${fmtDate(r.last_seen)}</td>
      `;
    });

    $('#top-dest-meta').textContent = `${topDest.destinations.length} endpoints`;

    $('#last-updated').textContent = new Date().toLocaleTimeString('en-GB', { hour12: false });

  } catch (err) {
    toast(`Overview error: ${err.message}`, 'error');
    console.error(err);
  }
}

// ── Country view ──────────────────────────────────────────────────────────
async function loadCountryList() {
  try {
    const data = await apiFetch('/api/countries/list');
    const sel  = $('#country-select');
    sel.innerHTML = '<option value="">— Select a country —</option>';
    data.countries.forEach(c => {
      const opt = document.createElement('option');
      opt.value       = c.iso;
      opt.textContent = `${c.name} (${c.iso})`;
      sel.appendChild(opt);
    });
  } catch (err) {
    console.warn('Country list error:', err.message);
  }
}

$('#country-load-btn').addEventListener('click', async () => {
  const iso = $('#country-select').value;
  if (!iso) { toast('Select a country first', 'warn'); return; }

  try {
    const data = await apiFetch(`/api/traffic/country?iso=${iso}`);
    const wrap  = $('#country-table-wrap');
    wrap.style.display = 'block';
    $('#country-table-title').textContent = data.country_iso;
    $('#country-table-meta').textContent  = `${fmt(data.count)} flows`;
    renderTable('#tbody-country', data.flows, flowRow);
  } catch (err) {
    toast(`Country load error: ${err.message}`, 'error');
  }
});

// ── EU view ───────────────────────────────────────────────────────────────
async function loadEU() {
  try {
    const data = await apiFetch('/api/traffic/eu?limit=500');
    const uniqueFlows = data.count;
    const totalComms  = data.flows.reduce((a, r) => a + r.count, 0);
    $('#eu-unique').textContent = fmt(uniqueFlows);
    $('#eu-comms').textContent  = fmt(totalComms);
    $('#eu-table-meta').textContent = `${fmt(uniqueFlows)} flows`;

    // EU countries chart
    const byCountry = aggregateByCountry(data.flows);
    chartEU = destroyChart(chartEU);
    const ctx = $('#chart-eu-countries').getContext('2d');
    chartEU = new Chart(ctx, countryBarConfig(byCountry, '#60a5fa'));

    renderTable('#tbody-eu', data.flows, flowRow);
  } catch (err) {
    toast(`EU load error: ${err.message}`, 'error');
  }
}

// ── Non-EU view ───────────────────────────────────────────────────────────
async function loadNonEU() {
  try {
    const data = await apiFetch('/api/traffic/non-eu?limit=500');
    const uniqueFlows = data.count;
    const totalComms  = data.flows.reduce((a, r) => a + r.count, 0);
    $('#noneu-unique').textContent = fmt(uniqueFlows);
    $('#noneu-comms').textContent  = fmt(totalComms);
    $('#noneu-table-meta').textContent = `${fmt(uniqueFlows)} flows`;

    // Alert banner — non-EU traffic is the primary compliance concern in SchengenWatch
    const alertBar  = $('#noneu-alert');
    const alertText = $('#noneu-alert-text');
    if (alertBar) {
      if (uniqueFlows > 0) {
        alertBar.style.display = 'flex';
        alertText.textContent  = `${fmt(uniqueFlows)} flows detected outside the EU (${fmt(totalComms)} total communications). Review for GDPR Art. 44-49 compliance.`;
      } else {
        alertBar.style.display = 'none';
      }
      lucide.createIcons();
    }

    const byCountry = aggregateByCountry(data.flows);
    chartNonEU = destroyChart(chartNonEU);
    const ctx = $('#chart-noneu-countries').getContext('2d');
    chartNonEU = new Chart(ctx, countryBarConfig(byCountry, '#a78bfa'));

    renderTable('#tbody-noneu', data.flows, flowRow);
  } catch (err) {
    toast(`Non-EU load error: ${err.message}`, 'error');
  }
}

// ── Watch view ────────────────────────────────────────────────────────────
async function loadWatch() {
  try {
    const data = await apiFetch('/api/traffic/watch?limit=500');
    const uniqueFlows = data.count;
    const totalComms  = data.flows.reduce((a, r) => a + r.count, 0);
    $('#watch-unique').textContent    = fmt(uniqueFlows);
    $('#watch-comms').textContent     = fmt(totalComms);
    $('#watch-table-meta').textContent = `${fmt(uniqueFlows)} flows`;

    // Watch tags
    const tagsEl = $('#watch-tags-container');
    tagsEl.innerHTML = (data.watch_countries || []).map(iso =>
      `<span class="watch-tag"><i data-lucide="shield-alert" style="width:12px;height:12px"></i>${iso}</span>`
    ).join('');

    // Alert
    const alertBar  = $('#watch-alert');
    const alertText = $('#watch-alert-text');
    if (uniqueFlows > 0) {
      alertBar.style.display = 'flex';
      alertText.textContent  = `${fmt(uniqueFlows)} flows to watch-list countries detected (${fmt(totalComms)} total communications).`;
    } else {
      alertBar.style.display = 'none';
    }

    renderTable('#tbody-watch', data.flows, flowRow);
    lucide.createIcons();
  } catch (err) {
    toast(`Watch load error: ${err.message}`, 'error');
  }
}

// ── Recent view ───────────────────────────────────────────────────────────
async function loadRecent() {
  try {
    const data = await apiFetch('/api/recent?limit=100');
    renderTable('#tbody-recent', data.flows, (r) => {
      const cat = classifyLocal(r.dst_country_iso, r.category);
      return `
        <td class="mono">${r.src_ip}</td>
        <td class="mono">${r.dst_ip}</td>
        <td class="mono">${r.dst_port}</td>
        <td>${protoBadge(r.protocol)}</td>
        <td>${r.dst_country_name || '—'}</td>
        <td>${categoryBadge(cat, r.dst_country_iso)}</td>
        <td class="num-col mono">${fmt(r.count)}</td>
        <td class="text-muted" style="font-size:var(--text-xs)">${fmtDate(r.last_seen)}</td>
      `;
    });
  } catch (err) {
    toast(`Recent load error: ${err.message}`, 'error');
  }
}

$('#recent-refresh-btn').addEventListener('click', loadRecent);

// ── Settings ──────────────────────────────────────────────────────────────
let localWatchCountries = [];

async function loadSettings() {
  // Health check
  try {
    const h = await apiFetch('/api/health');
    const hEl = $('#health-value');
    hEl.textContent = h.status === 'ok' ? 'Connected' : 'Degraded';
    hEl.className   = `health-value ${h.status === 'ok' ? 'health-ok' : 'health-warn'}`;

    const mmdb = $('#mmdb-status');
    mmdb.textContent = h.mmdb ? 'GeoLite2 loaded' : 'MMDB not found';
    mmdb.className   = `health-value ${h.mmdb ? 'health-ok' : 'health-err'}`;
  } catch (err) {
    const hEl = $('#health-value');
    hEl.textContent = `Unreachable — ${err.message}`;
    hEl.className   = 'health-value health-err';
  }

  // Watch countries
  try {
    const data = await apiFetch('/api/settings/watch');
    localWatchCountries = data.watch_countries || [];
    renderSettingsWatchTags();
  } catch (err) {
    console.warn('Watch settings load error:', err);
  }

  // Show saved API URL
  const stored = API_BASE || window.location.origin;
  $('#api-url-input').value = stored;
}

function renderSettingsWatchTags() {
  $('#settings-watch-tags').innerHTML = localWatchCountries.map(iso => `
    <span class="watch-tag">
      ${iso}
      <span class="rm-tag" data-iso="${iso}" role="button" aria-label="Remove ${iso}">×</span>
    </span>
  `).join('');

  $$('#settings-watch-tags .rm-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      localWatchCountries = localWatchCountries.filter(c => c !== btn.dataset.iso);
      renderSettingsWatchTags();
    });
  });
}

$('#watch-add-btn').addEventListener('click', () => {
  const val = $('#watch-input').value.trim().toUpperCase();
  if (val.length !== 2) { toast('Enter a 2-letter ISO code', 'warn'); return; }
  if (localWatchCountries.includes(val)) { toast(`${val} already in list`, 'warn'); return; }
  localWatchCountries.push(val);
  $('#watch-input').value = '';
  renderSettingsWatchTags();
});

$('#watch-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('#watch-add-btn').click();
});

$('#watch-save-btn').addEventListener('click', async () => {
  try {
    await fetch(`${API_BASE}/api/settings/watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countries: localWatchCountries }),
    });
    const status = $('#watch-save-status');
    status.textContent = 'Saved';
    setTimeout(() => { status.textContent = ''; }, 3000);
    toast('Watch list saved', 'success');
  } catch (err) {
    toast(`Save error: ${err.message}`, 'error');
  }
});

$('#api-url-save-btn').addEventListener('click', () => {
  API_BASE = $('#api-url-input').value.trim().replace(/\/$/, '');
  toast(`API endpoint updated`, 'success');
  loadSettings();
});

// ── Demo data seed ────────────────────────────────────────────────────────
$('#seed-btn').addEventListener('click', async () => {
  const btn = $('#seed-btn');
  const origHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i data-lucide="loader"></i> <span>Seeding…</span>';
  lucide.createIcons();
  try {
    const result = await apiFetch('/api/db/seed?n=300');
    toast(`Demo data injected (${result.seeded} rows) — refreshing…`, 'success');
    await loadOverview();
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('Load failed')) {
      toast('No backend reachable. Run docker compose up -d first, then open http://localhost:8000', 'warn');
    } else {
      toast(`Seed error: ${err.message}`, 'error');
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = origHTML;
    lucide.createIcons();
  }
});

$('#refresh-btn').addEventListener('click', async () => {
  const btn = $('#refresh-btn');
  btn.disabled = true;
  const currentView = $$('.nav-item.active')[0]?.dataset.view || 'overview';
  try {
    await onViewLoad(currentView);
    toast('Refreshed', 'success');
  } catch (err) {
    toast('Refresh failed — is the backend running?', 'warn');
  } finally {
    btn.disabled = false;
  }
});

// ── Render helpers ────────────────────────────────────────────────────────
function renderTable(tbodySelector, rows, rowFn) {
  const tbody = $(tbodySelector);
  if (!rows || rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-state">No data</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r => `<tr>${rowFn(r)}</tr>`).join('');
}

function flowRow(r) {
  const cat = classifyLocal(r.dst_country_iso, r.category);
  return `
    <td class="mono">${r.src_ip}</td>
    <td class="mono">${r.dst_ip}</td>
    <td class="mono">${r.dst_port}</td>
    <td>${protoBadge(r.protocol)}</td>
    <td>${r.dst_country_name || '—'}</td>
    <td class="num-col mono">${fmt(r.count)}</td>
    <td class="text-muted" style="font-size:var(--text-xs)">${fmtDate(r.first_seen)}</td>
    <td class="text-muted" style="font-size:var(--text-xs)">${fmtDate(r.last_seen)}</td>
  `;
}

function classifyLocal(iso, serverCat) {
  // Use server category when available; fall back to client-side EU set
  if (serverCat && serverCat !== 'unknown') return serverCat;
  if (!iso || iso === 'XX') return 'unknown';
  return EU_CODES.has(iso) ? 'eu' : 'non-eu';
}

function aggregateByCountry(flows) {
  const agg = {};
  flows.forEach(r => {
    const iso = r.dst_country_iso || 'XX';
    if (!agg[iso]) agg[iso] = { name: r.dst_country_name || iso, count: 0 };
    agg[iso].count += r.count;
  });
  return Object.entries(agg)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
}

function countryBarConfig(byCountry, color) {
  return {
    type: 'bar',
    data: {
      labels: byCountry.map(([_, v]) => v.name),
      datasets: [{
        data:            byCountry.map(([_, v]) => v.count),
        backgroundColor: color + 'aa',
        borderColor:     color,
        borderWidth:     1,
        borderRadius:    4,
      }],
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid:  { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#7b8bb2', font: { family: "'JetBrains Mono'", size: 11 } },
        },
        y: {
          grid:  { display: false },
          ticks: { color: '#d4daf0', font: { family: "'Satoshi'", size: 12 } },
        },
      },
      maintainAspectRatio: false,
    },
  };
}

// ── View dispatcher ───────────────────────────────────────────────────────
async function onViewLoad(view) {
  switch (view) {
    case 'overview': return loadOverview();
    case 'country':  return loadCountryList();
    case 'eu':       return loadEU();
    case 'non-eu':   return loadNonEU();
    case 'watch':    return loadWatch();
    case 'recent':   return loadRecent();
    case 'settings': return loadSettings();
  }
}

// ── Auto-refresh ──────────────────────────────────────────────────────────
function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => {
    const active = $$('.nav-item.active')[0]?.dataset.view;
    if (active && active !== 'settings') onViewLoad(active);
  }, AUTO_REFRESH_MS);
}

// ── Init ──────────────────────────────────────────────────────────────────
(async function init() {
  lucide.createIcons();

  // Load overview on start
  activateView('overview');
  try {
    await loadOverview();
  } catch (_) {
    // No backend available — static preview mode, show a hint
    $$('.kpi-value').forEach(el => { el.textContent = '—'; });
    const hint = document.createElement('div');
    hint.style.cssText = 'position:fixed;bottom:80px;right:24px;background:var(--surface-2);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:var(--r-lg);padding:12px 16px;font-size:var(--text-xs);color:var(--text-muted);max-width:320px;z-index:998;line-height:1.5';
    hint.innerHTML = '<strong style="color:var(--accent)">Static preview</strong><br>Run <code>docker compose up -d</code> and open <a href="http://localhost:8000" style="color:var(--accent)">localhost:8000</a> to see live data.';
    document.body.appendChild(hint);
    setTimeout(() => hint.remove(), 12000);
  }
  startAutoRefresh();
})();
