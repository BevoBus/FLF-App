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

    if (params.near) {
      const center = params.near.toUpperCase().trim();
      const radiusMiles = Math.max(1, Math.min(300, Number(params.radius || 100)));

      const apRaw = await fetchJson(`/api/data/airport?ids=${encodeURIComponent(center)}&format=json`);
      const ap = Array.isArray(apRaw) ? apRaw[0] : apRaw?.airport;
      if (!ap || ap.lat == null || ap.lon == null) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Center airport not found" }) };
      }

      const milesToLatDeg = (mi) => mi / 69.0;
      const milesToLonDeg = (mi, lat) => mi / (69.172 * Math.cos(lat * Math.PI / 180));
      const lat = Number(ap.lat), lon = Number(ap.lon);
      const dLat = milesToLatDeg(radiusMiles), dLon = milesToLonDeg(radiusMiles, lat);
      const bbox = `${(lat - dLat).toFixed(4)},${(lon - dLon).toFixed(4)},${(lat + dLat).toFixed(4)},${(lon + dLon).toFixed(4)}`;

      const raw = await fetchJson(`/api/data/metar?bbox=${bbox}&format=${format}`);
      const arr = toArray(raw);

      const seen = new Set();
      const results = [];
      for (const m of arr) {
        const id = m.icaoId || "";
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const norm = normalizeMetar(m);
        if (norm) results.push(norm);
      }

      return { statusCode: 200, headers, body: JSON.stringify(results) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Use ?ids=KGRK or ?near=KGRK&radius=100" }) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
};
