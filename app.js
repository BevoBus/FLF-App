let page = 'home';
let selectedGlider = null;

const gliders = [
  { name: 'ASK-21', maxWeight: 600 },
  { name: 'Grob 103', maxWeight: 620 },
  { name: 'Schweizer 2-33', maxWeight: 550 }
];

const checklistItems = [
  'Pre-flight inspection',
  'Canopy closed & locked',
  'Instruments set',
  'Controls free & correct',
  'Ballast secured'
];
let checked = new Array(checklistItems.length).fill(false);

let pilotWeight = 0;
let passengerWeight = 0;
let ballast = 0;

// ----- Plain-English helpers -----
function zulu(dt) {
  try {
    // supports "2025-09-15T02:00:00.000Z" or epoch seconds
    if (typeof dt === 'number') return new Date(dt * 1000).toISOString().replace('.000','');
    if (typeof dt === 'string') return new Date(dt).toISOString().replace('.000','');
  } catch {}
  return '';
}

function cardinalFromDegrees(deg) {
  if (deg == null || isNaN(deg)) return '';
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const i = Math.round(((deg % 360) / 22.5)) % 16;
  return dirs[i];
}

function formatClouds(clouds) {
  if (!Array.isArray(clouds) || clouds.length === 0) return 'Clear';
  return clouds.map(c => {
    const cover = c.cover || '';
    const base = (c.baseFt ?? c.base);
    const prettyBase = (base || base === 0) ? `${base.toLocaleString()} ft` : '';
    // Translate FEW/SCT/BKN/OVC to words for students
    const coverWord = ({
      FEW: 'Few',
      SCT: 'Scattered',
      BKN: 'Broken',
      OVC: 'Overcast'
    }[cover] || cover);
    return prettyBase ? `${coverWord} at ${prettyBase}` : coverWord;
  }).join(', ');
}

function plainEnglish(entry) {
  const w = entry.weather || {};
  const lines = [];

  // Flight category tag is visually shown; still include words for learners
  if (entry.fltCat) lines.push(`Flight category: ${entry.fltCat}`);

  // Time
  const timeZ = zulu(entry.time);
  if (timeZ) lines.push(`Observation time: ${timeZ.replace('T',' ').replace('Z','Z')}`);

  // Wind
  if (w.wind) {
    // If wind like "100° at 9 kt", include cardinal
    const m = /(\d+)[°] at (\d+)/.exec(w.wind || '');
    if (m) {
      const dir = Number(m[1]);
      const spd = Number(m[2]);
      lines.push(`Wind: ${cardinalFromDegrees(dir)} (${dir}°) at ${spd} kt`);
    } else {
      lines.push(`Wind: ${w.wind}`);
    }
  }

  // Visibility
  if (w.visibility) lines.push(`Visibility: ${w.visibility}`);

  // Clouds
  lines.push(`Clouds: ${formatClouds(entry.clouds)}`);

  // Temps
  if (w.tempC != null || w.dewpointC != null) {
    const t = (w.tempC != null) ? `${w.tempC.toFixed ? w.tempC.toFixed(1) : w.tempC}°C` : '—';
    const d = (w.dewpointC != null) ? `${w.dewpointC.toFixed ? w.dewpointC.toFixed(1) : w.dewpointC}°C` : '—';
    lines.push(`Temperature/Dewpoint: ${t} / ${d}`);
  }

  // Altimeter
  if (w.altimeterInHg != null) lines.push(`Altimeter: ${w.altimeterInHg} inHg`);

  return lines;
}

function el(tag, attrs={}, children=[]) {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e[k] = v;
    else e.setAttribute(k, v);
  });
  for (const c of children) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}

function navButton(label, to) {
  return el('button', { onclick: () => { page = to; render(); } , text: label });
}

function toArray(d){ return Array.isArray(d) ? d : (d ? [d] : []); }

function renderHome() {
  return el('div', {}, [
    el('h1', { text: 'Welcome to the Gliding Club App' }),
    el('p', { class: 'muted', text: 'Select a section below to get started.' }),
    el('div', { class: 'card' }, [
      navButton('Weather Briefing', 'weather'),
      navButton('Glider Preparation', 'gliders'),
      navButton('Emergency Procedures', 'emergency')
    ])
  ]);
}

function renderGliders() {
  return el('div', {}, [
    navButton('← Back', 'home'),
    el('div', { class: 'card' }, [
      el('h2', { text: 'Select a Glider' }),
      ...gliders.map(g => navButton(g.name, 'prep_'+g.name))
    ])
  ]);
}

function renderGliderPrep(glider) {
  const within = (pilotWeight + passengerWeight + ballast) <= glider.maxWeight;
  return el('div', {}, [
    navButton('← Back', 'gliders'),
    el('h2', { text: `${glider.name} Preparation` }),
    el('div', { class: 'card' }, [
      el('h3', { text: 'Checklist' }),
      ...checklistItems.map((item, i) => {
        const row = el('div', { class: 'checklist-item' });
        const box = el('input', { type: 'checkbox' });
        box.checked = !!checked[i];
        box.onchange = () => { checked[i] = !checked[i]; render(); };
        row.appendChild(box);
        row.appendChild(el('span', { text: ' ' + item, class: checked[i] ? 'checked' : '' }));
        return row;
      }),
      el('button', { text: 'Reset Checklist', onclick: () => { checked = new Array(checklistItems.length).fill(false); render(); } })
    ]),
    el('div', { class: 'card' }, [
      el('h3', { text: 'Weight & Balance' }),
      el('div', { class: 'row' }, [
        el('label', {}, [ 'Pilot Weight (kg)', el('input', { type: 'number', value: pilotWeight, oninput: (e)=>{ pilotWeight=Number(e.target.value||0); render(); } }) ]),
        el('label', {}, [ 'Passenger Weight (kg)', el('input', { type: 'number', value: passengerWeight, oninput: (e)=>{ passengerWeight=Number(e.target.value||0); render(); } }) ]),
      ]),
      el('label', {}, [ 'Ballast (kg)', el('input', { type: 'number', value: ballast, oninput: (e)=>{ ballast=Number(e.target.value||0); render(); } }) ]),
      el('div', { class: 'muted', text: `Total: ${pilotWeight + passengerWeight + ballast} kg` }),
      el('div', { class: within ? 'ok' : 'bad', text: within ? 'Within limits ✅' : 'Exceeds limits ❌' })
    ])
  ]);
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Fetch failed: ' + res.status);
  return res.json();
}

function metarCard(entry) {
  const icao = entry.icaoId || '';
  const name = entry.name || '';
  const cat  = entry.fltCat || '';
  const raw  = entry.raw || entry.rawOb || entry.rawText || '(raw text unavailable)';

  const header = [icao, name].filter(Boolean).join(' – ');
  const tag = cat ? el('span', { class: 'wx-tag ' + cat, text: cat }) : null;

  const details = el('details', {}, [
    el('summary', { text: 'Show Raw Text' }),
    el('pre', {}, [ raw ])
  ]);

  return el('div', { class: 'card wx' }, [
    el('h3', {}, [document.createTextNode(header), tag ? document.createTextNode(' ') : null, tag]),
    details
  ]);
}

async function loadStation(station, root) {
  document.querySelectorAll('.wx').forEach(e => e.remove());
  const url = '/.netlify/functions/metar?ids=' + encodeURIComponent(station);
  try {
    const data = await fetchJSON(url);
    if (data && data.error) throw new Error(data.error);
    const items = toArray(data);
    if (!items.length) {
      root.appendChild(el('div', { class: 'card wx' }, [ el('p', { text: 'No recent METAR available.' }) ]));
      return;
    }
    items.forEach(e => root.appendChild(metarCard(e)));
  } catch (e) {
    root.appendChild(el('div', { class: 'card wx' }, [ el('p', { class: 'bad', text: 'Fetch failed: ' + e.message }) ]));
  }
}

async function loadNearby(center, miles, root) {
  document.querySelectorAll('.wx').forEach(e => e.remove());
  const url = '/.netlify/functions/metar?near=' + encodeURIComponent(center) + '&radius=' + miles;
  try {
    const data = await fetchJSON(url);
    if (data && data.error) throw new Error(data.error);
    const items = toArray(data);
    if (!items.length) {
      root.appendChild(el('div', { class: 'card wx' }, [ el('p', { text: 'No nearby METARs found.' }) ]));
      return;
    }
    items.forEach(e => root.appendChild(metarCard(e)));
  } catch (e) {
    root.appendChild(el('div', { class: 'card wx' }, [ el('p', { class: 'bad', text: 'Fetch failed: ' + e.message }) ]));
  }
}

async function renderWeather() {
  const container = el('div', {});
  container.appendChild(navButton('← Back', 'home'));
  container.appendChild(el('h2', { text: 'Weather Briefing' }));
  const controls = el('div', { class: 'card' }, [
    el('label', {}, [ 'Station (ICAO):', el('input', { id: 'stationInput', value: 'KGRK' }) ]),
    el('button', { text: 'Refresh', onclick: async () => { await loadStation(document.getElementById('stationInput').value.trim().toUpperCase(), container); } }),
    el('button', { text: 'Nearby (100 mi)', onclick: async () => { await loadNearby(document.getElementById('stationInput').value.trim().toUpperCase(), 100, container); } }),
    el('p', { class: 'muted', text: 'Data via AviationWeather.gov. Default: KGRK.' })
  ]);
  container.appendChild(controls);
  await loadStation('KGRK', container);
  return container;
}

function renderEmergency() {
  return el('div', {}, [
    navButton('← Back', 'home'),
    el('div', { class: 'card' }, [
      el('h2', { text: 'Emergency Procedures' }),
      el('p', { text: 'Rope break, radio failure, etc. coming soon...' })
    ])
  ]);
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  if (page === 'home') app.appendChild(renderHome());
  else if (page === 'gliders') app.appendChild(renderGliders());
  else if (page.startsWith('prep_')) {
    const name = page.substring(5);
    const gl = gliders.find(g => g.name === name);
    app.appendChild(renderGliderPrep(gl));
  } else if (page === 'weather') {
    renderWeather().then(node => app.appendChild(node));
  } else if (page === 'emergency') app.appendChild(renderEmergency());
}

window.addEventListener('DOMContentLoaded', render);
