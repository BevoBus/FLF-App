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

function renderMetarDecoded(m) {
  const p = m || {};
  const parts = [];
  if (p.icaoId) parts.push(`Station: ${p.icaoId}`);
  if (p.obsTime) parts.push(`Time: ${p.obsTime}`);
  if (p.windDir !== undefined && p.windSpeed !== undefined) {
    const gust = p.windGust ? ` gust ${p.windGust} kt` : '';
    parts.push(`Wind: ${p.windDir}° at ${p.windSpeed} kt${gust}`);
  }
  if (p.visibility) parts.push(`Visibility: ${p.visibility} sm`);
  if (p.clouds && p.clouds.length) {
    const clouds = p.clouds.map(c => `${c.cover} ${c.base?c.base+' ft':''}`.trim()).join(', ');
    parts.push(`Clouds: ${clouds}`);
  }
  if (p.temp && p.dew) parts.push(`Temp/Dew: ${p.temp}°C / ${p.dew}°C`);
  if (p.altim) parts.push(`Altimeter: ${p.altim} inHg`);
  if (p.remarks) parts.push(`Remarks: ${p.remarks}`);
  return parts.join('\n');
}
function metarCard(entry) {
  const raw = entry.rawOb || entry.rawText || '(raw text unavailable)';
  const decoded = renderMetarDecoded(entry);
  return el('div', { class: 'card wx' }, [
    el('h3', { text: `METAR ${entry.icaoId || ''}` }),
    el('pre', {}, [ raw ]),
    el('pre', {}, [ decoded ])
  ]);
}

async function loadStation(station, root) {
  document.querySelectorAll('.wx').forEach(e => e.remove());
  const url = '/.netlify/functions/metar?ids=' + encodeURIComponent(station);
  try {
    const data = await fetchJSON(url);
    const items = (data && data.metars) || data || [];
    if (!items.length) root.appendChild(el('div', { class: 'card wx' }, [ el('p', { text: 'No recent METAR available.' }) ]));
    items.forEach(e => root.appendChild(metarCard(e)));
  } catch (e) {
    root.appendChild(el('div', { class: 'card wx' }, [ el('p', { class: 'bad', text: e.message }) ]));
  }
}
async function loadNearby(center, miles, root) {
  document.querySelectorAll('.wx').forEach(e => e.remove());
  const url = '/.netlify/functions/metar?near=' + encodeURIComponent(center) + '&radius=' + miles;
  try {
    const data = await fetchJSON(url);
    const items = (data && data.metars) || data || [];
    if (!items.length) root.appendChild(el('div', { class: 'card wx' }, [ el('p', { text: 'No nearby METARs found.' }) ]));
    items.forEach(e => root.appendChild(metarCard(e)));
  } catch (e) {
    root.appendChild(el('div', { class: 'card wx' }, [ el('p', { class: 'bad', text: e.message }) ]));
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
