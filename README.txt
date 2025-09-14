Gliding Club App
=================

This is a web app for glider preparation and weather briefing.

Files:
------
index.html      - Main entry point
app.js          - App logic (home, glider prep, weather briefing)
manifest.json   - PWA manifest
logo.png        - Club logo (replace with your own)
netlify.toml    - Netlify config
netlify/functions/metar.js - Serverless function for weather API proxy

Deployment:
-----------
1. Unzip this folder.
2. In Netlify dashboard, go to your site -> Deploys -> drag and drop this folder.
3. Check Functions tab -> ensure "metar" function is listed.
4. Test: https://<yoursite>.netlify.app/.netlify/functions/metar?ids=KGRK
   should return JSON data.

Usage:
------
- Weather Briefing: fetches METAR from AviationWeather.gov (KGRK + nearby).
- Glider Preparation: checklists + weight/balance.
- Emergency Procedures: placeholder for future content.

Testing Locally:
----------------
Run a local server:
  python3 -m http.server 8080
Open http://localhost:8080 in your browser.
