// ... keep the top of your file as you have it (headers, fetchJson, toArray, normalizeMetar) ...

    if (params.near) {
      const center = params.near.toUpperCase().trim();
      const radiusMiles = Math.max(1, Math.min(300, Number(params.radius || 100)));

      const apRaw = await fetchJson(`/api/data/airport?ids=${encodeURIComponent(center)}&format=json`);
      const ap = Array.isArray(apRaw) ? apRaw[0] : apRaw?.airport;
      if (!ap || ap.lat == null || ap.lon == null) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: "Center airport not found" }) };
      }

      // helpers for bbox + distance/bearing
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

      // BBox query
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

        // Compute distance/bearing when coords exist
        const lat = Number(m.lat), lon = Number(m.lon);
        let dist = null, brg = null, card = null;
        if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
          dist = distanceNm(latC, lonC, lat, lon);
          brg  = initialBearing(latC, lonC, lat, lon);
          card = bearingCardinal(brg);
        }

        const norm = normalizeMetar(m);
        if (norm) {
          norm.distanceNm = dist != null ? Math.round(dist) : null;      // rounded to nearest nm
          norm.bearingDeg = brg != null ? Math.round(brg) : null;        // integer degrees
          norm.bearingCard = card || null;                                // e.g., "SW"
          results.push(norm);
        }
      }

      // Sort by distance (nulls last)
      results.sort((a,b) => {
        if (a.distanceNm == null && b.distanceNm == null) return 0;
        if (a.distanceNm == null) return 1;
        if (b.distanceNm == null) return -1;
        return a.distanceNm - b.distanceNm;
      });

      // limit to ~60
      return { statusCode: 200, headers, body: JSON.stringify(results.slice(0, 60)) };
    }

// ... keep the rest (ids branch, 400, catch) unchanged ...
