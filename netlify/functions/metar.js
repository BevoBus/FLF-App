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

    // Decode flight category (basic: VFR/MVFR/IFR/LIFR)
    function decodeCategory(visibility, clouds) {
      const vis = Number(visibility || 99);
      let ceiling = 99999;
      if (Array.isArray(clouds) && clouds.length) {
        ceiling = Math.min(...clouds.map(c => c.base || 99999));
      }

      if (ceiling < 500 || vis < 1) return "LIFR";
      if (ceiling < 1000 || vis < 3) return "IFR";
      if (ceiling < 3000 || vis < 5) return "MVFR";
      return "VFR";
    }

    async function buildStationReport(icao) {
      // Fetch METARs
      const metarData = await fetchJson(`/api/data/metar?ids=${icao}&format=${format}`);
      const metar = (metarData.metars && metarData.metars[0]) || null;
      if (!metar) return null;

      // Fetch airport info
      const airportData = await fetchJson(`/api/data/airport?ids=${icao}&format=json`);
      const airport = Array.isArray(airportData) ? airportData[0] : airportData.airport;

      // Build decoded object
      const decoded = {
        category: decodeCategory(metar.visibility, metar.clouds),
        time: metar.obsTime,
        wind: `${metar.windDir}° at ${metar.windSpeed} kt${metar.windGust ? " gust " + metar.windGust + " kt" : ""}`,
        visibility: `${metar.visibility} sm`,
        clouds: metar.clouds && metar.clouds.length ? 
                  metar.clouds.map(c => `${c.cover}${c.base ? " " + c.base + " ft" : ""}`).join(", ") : "Clear",
        tempDew: `${metar.temp}°C / ${metar.dew}°C`,
        altim: `${metar.altim} inHg`,
        remarks: metar.remarks || ""
      };

      return {
        icaoId: metar.icaoId,
        name: airport?.name || "",
        raw: metar.rawOb || metar.rawText || "",
        decoded
      };
    }

    // Handle single station
    if (params.ids) {
      const icao = params.ids.toUpperCase();
      const report = await buildStationReport(icao);
      return { statusCode: 200, headers, body: JSON.stringify(report) };
    }

    // Handle nearby search
    if (params.near) {
      const center = (params.near || "").toUpperCase();
      const radiusMiles = Math.max(1, Math.min(300, Number(params.radius || 100)));

      // Get center airport coords
      const airportData = await fetchJson(`/api/data/airport?ids=${center}&format=json`);
      const ap = Array.isArray(airportData) ? airportData[0] : airportData.airport;
      if (!ap || !ap.lat || !ap.lon) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Center airport not found" }) };
      }

      // Compute bounding box
      function milesToLatDeg(mi) { return mi / 69.0; }
      function milesToLonDeg(mi, lat) { return mi / (69.172 * Math.cos(lat * Math.PI/180)); }
      const lat = Number(ap.lat), lon = Number(ap.lon);
      const dLat = milesToLatDeg(radiusMiles), dLon = milesToLonDeg(radiusMiles, lat);
      const bbox = `${(lat - dLat).toFixed(4)},${(lon - dLon).toFixed(4)},${(lat + dLat).toFixed(4)},${(lon + dLon).toFixed(4)}`;

      // Fetch nearby METARs
      const metarData = await fetchJson(`/api/data/metar?bbox=${bbox}&format=${format}`);
      const stations = metarData.metars?.map(m => m.icaoId).filter(Boolean) || [];

      // Deduplicate ICAOs and build reports
      const reports = [];
      for (const icao of [...new Set(stations)]) {
        try {
          const r = await buildStationReport(icao);
          if (r) reports.push(r);
        } catch (e) {
          // skip failed station
        }
      }

      return { statusCode: 200, headers, body: JSON.stringify(reports) };
    }

    // No valid params
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Use ?ids=KGRK or ?near=KGRK&radius=100" }) };

  } catch (e) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
  }
}
