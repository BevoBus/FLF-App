exports.handler = async function(event, context) {
  const headers = { 
    "Access-Control-Allow-Origin": "*", 
    "Content-Type": "application/json" 
  };

  try {
    const params = event.queryStringParameters || {};
    const base = "https://aviationweather.gov";
    const format = "json";

    async function awc(path) {
      const res = await fetch(base + path, { headers: { "user-agent": "gliding-club-app/1.0" } });
      if (!res.ok) {
        const txt = await res.text();
        return { statusCode: res.status, headers, body: JSON.stringify({ error: txt || res.statusText }) };
      }
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        const data = await res.json();
        return { statusCode: 200, headers, body: JSON.stringify(data) };
      } else {
        const txt = await res.text();
        return { statusCode: 200, headers, body: JSON.stringify({ text: txt }) };
      }
    }

    function milesToLatDeg(mi) { return mi / 69.0; }
    function milesToLonDeg(mi, lat) { return mi / (69.172 * Math.cos(lat * Math.PI/180)); }

    // Handle ?ids=KGRK
    if (params.ids) {
      const ids = params.ids.toUpperCase();
      const path = `/api/data/metar?ids=${encodeURIComponent(ids)}&format=${format}`;
      return await awc(path);
    }

    // Handle ?near=KGRK&radius=100
    if (params.near) {
      const center = (params.near || "").toUpperCase();
      const radiusMiles = Math.max(1, Math.min(300, Number(params.radius || 100)));

      // Get airport coordinates
      const stPath = `/api/data/airport?ids=${encodeURIComponent(center)}&format=json`;
      const stRes = await fetch(base + stPath, { headers: { "user-agent": "gliding-club-app/1.0" } });
      if (!stRes.ok) {
        return { statusCode: stRes.status, headers, body: JSON.stringify({ error: "Failed to look up airport" }) };
      }

      const airports = await stRes.json();
      const ap = Array.isArray(airports) ? airports[0] : (airports && airports.airport) || null;
      if (!ap || !ap.lat || !ap.lon) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Airport coordinates not found" }) };
      }

      const lat = Number(ap.lat);
      const lon = Number(ap.lon);
      const dLat = milesToLatDeg(radiusMiles);
      const dLon = milesToLonDeg(radiusMiles, lat);
      const minLat = lat - dLat, maxLat = lat + dLat;
      const minLon = lon - dLon, maxLon = lon + dLon;
      const bbox = `${minLat.toFixed(4)},${minLon.toFixed(4)},${maxLat.toFixed(4)},${maxLon.toFixed(4)}`;
      const path = `/api/data/metar?bbox=${encodeURIComponent(bbox)}&format=${format}`;
      return await awc(path);
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: "Use ?ids=KGRK or ?near=KGRK&radius=100" }) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
