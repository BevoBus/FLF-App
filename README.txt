Gliding Club App - Full Rebuild
================================

This package contains a working static web app + a Netlify serverless function.

Files
-----
index.html                  Main page
app.js                      App logic (Home, Glider Prep, Weather, Emergency)
manifest.json               PWA manifest
logo.png                    Placeholder logo (replace as needed)
netlify.toml                Netlify config (publish='.'; functions='netlify/functions')
netlify/functions/metar.js  Serverless function proxy for AviationWeather.gov

Deploy (GitHub + Netlify recommended)
-------------------------------------
1) Push this folder to a GitHub repo (top-level files in repo root).
2) In Netlify: Add new site -> Import from Git -> pick the repo.
   Build command: (leave empty)   Publish directory: .
3) After first deploy, test:
   https://<yoursite>.netlify.app/.netlify/functions/metar?ids=KGRK

Local test (UI only)
--------------------
python -m http.server 8080
Open http://localhost:8080
Note: Weather calls require Netlify function; will not work locally or on GitHub Pages.
