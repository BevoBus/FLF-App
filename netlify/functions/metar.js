exports.handler = async function(event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  try {
    const params = event.queryStringParameters || {};
    const base = "https://aviationweather.gov";
    const format = "json";

    async function fetchJson(path) {
      const res = await fetch(base + path, { headers: { "user-agent": "gliding-club-app/1.0" } });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return res.json();
    }

    function toArray(payload) {
      if (!payload) return [];
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload.metars)) return payload.metars;
      return [];
    }

    function normalizeMetar(m) {
      if (!m) return null;
      const altInHg = (m.altim != null)
        ? (Math.round((Number(m.altim) / 33.8638866667) * 100) / 100).toFixed(2)
        : null;
      return {
        icaoId: m.icaoId || "",
        name: m.name || "",
        time: m.reportTime || m.obsTime || "",
        fltCat: m.fltCat || "",
        raw: m.rawOb || m.rawText || "",
        weather: {
          tempC: m.temp ?? null,
          dewpointC: m.dewp ?? null,
          wind: (m.wdir != null && m.wspd != null)
            ? `${m.wdir}° at ${m.wspd} kt`
            : (m.wspd != null ? `${m.wspd} kt` : ""),
          visibility: (m.visib != null) ? `${m.visib} sm` : "",
          altimeterInHg: altInHg
        },
        clouds: Array.isArray(m.clouds) ? m.clouds.map(c => ({
          cover: c.cover || "",
          baseFt: c.base ?? null
        })) : []
      };
    }

    // --- Single station ---
    if (params.ids) {
      const icao = params.ids.toUpperCase().trim();
      const raw = await fetchJson(`/api/data/metar?ids=${encodeURIComponent(icao)}&format=${format}`);
      const arr = toArray(raw);
      const latest = arr.length ? arr[0] : null;
      const out = normalizeMetar(latest);
      if (!out) {
        return { statusCode: 200, headers, body: JSON.stringify({ error: "No recent METAR found for station." }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify(out) };
    }

    // --- Nearby stations ---
    if (params.near) {
      const center = params.near.toUpperCase().trim();
      const radiusMiles = Math.max(1, Math.min(300, Number(params.radius || 100)));

      const apRaw = await fetchJson(`/api/data/airport?ids=${encodeURIComponent(center)}&format=json`);
      const ap = Array.isArray(apRaw) ? apRaw[0] : apRaw?.airport;
      if (!ap || ap.lat == null || ap.lon == null) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Center airport not found" }) };
      }

      // helpers
      const milesToLatDeg = (mi) => mi / 69.0;
      const milesToLonDeg = (mi, lat) => mi / (69.172 * Math.cos(lat * Math.PI / 180));
      const toRad = (d) => d * Math.PI / 180;
      const toDeg = (r) => r * 180 / Math.PI;

      function bearingCardinal(b) {
        const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
        return dirs[Math.round(b / 22.5) % 16];
      }

      function distanceNm(lat1, lon1, lat2, lon2) {
        const R = 3440.065; // Earth radius in nautical miles
        const φ1 = toRad(lat1), φ2 = toRad(lat2);
        const dφ = toRad(lat2 - lat1);
        const dλ = toRad(lon2 - lon1);
        const a = Math.sin(dφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(dλ/2)**2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      }

      function initialBearing(lat1, lon1, lat2, lon2) {
        const φ1 = toRad(lat1), φ2 = toRad(lat2);
        const λ1 = toRad(lon1), λ2 = toRad(lon2);
        const y = Math.sin(λ2-λ1) * Math.cos(φ2);
        const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(λ2-λ1);
        const θ = Math.atan2(y, x);
        const deg = (toDeg(θ) + 360) % 360;
        return deg;
      }

      const latC = Number(ap.lat), lonC = Number(ap.lon);

      const dLat = milesToLatDeg(radiusMiles), dLon = milesToLonDeg(radiusMiles, latC);
      const bbox = `${(latC - dLat).toFixed(4)},${(lonC - dLon).toFixed(4)},${(latC + dLat).toFixed(4)},${(lonC + dLon).toFixed(4)}`;

      const raw = await fetchJson(`/api/data/metar?bbox=${bbox}&format=${format}`);
      const arr = toArray(raw);

      const seen = new Set();
      const results = [];
      for (const m of arr) {
        const id = m.icaoId || "";
        if (!id || seen.has(id)) continue;
        seen.add(id);

        const lat = Number(m.lat), lon = Number(m.lon);
        let dist = null, brg = null, card = null;
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          dist = distanceNm(latC, lonC, lat, lon);
          brg  = initialBearing(latC, lonC, lat, lon);
          card = bearingCardinal(brg);
        }

        const norm = normalizeMetar(m);
        if (norm) {
          norm.distanceNm = dist != null ? Math.round(dist) : null;
          norm.bearingDeg = brg != null ? Math.round(brg) : null;
          norm.bearingCard = card || null;
          results.push(norm);
        }
      }

      results.sort((a,b) => {
        if (a.distanceNm == null && b.distanceNm == null) return 0;
        if (a.distanceNm == null) return 1;
        if (b.distanceNm == null) return -1;
        return a.distanceNm - b.distanceNm;
      });

      return { statusCode: 200, headers, body: JSON.stringify(results.slice(0, 60)) };
    }

    // --- Fallback ---
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Use ?ids=KGRK or ?near=KGRK&radius=100" }) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
