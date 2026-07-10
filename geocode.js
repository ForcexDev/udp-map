const addresses = [
  "Ejército Libertador 441, Santiago",
  "Ejército Libertador 141, Santiago",
  "Vergara 275, Santiago",
  "Manuel Rodríguez Sur 253, Santiago",
  "Avenida República 105, Santiago",
  "Avenida República 180, Santiago",
  "Vergara 240, Santiago",
  "Ejército Libertador 333, Santiago",
  "Vergara 210, Santiago",
  "Vergara 324, Santiago",
  "Avenida Santa Clara 797, Huechuraba"
];

async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=cl&limit=1`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'UDP-Map-Bot' } });
    const result = await res.json();
    if (result.length > 0) {
      return { q: query, lat: result[0].lat, lon: result[0].lon };
    } else {
      return { q: query, error: 'Not found' };
    }
  } catch (e) {
    return { q: query, error: e.message };
  }
}

async function run() {
  for (const addr of addresses) {
    const res = await geocode(addr);
    console.log(JSON.stringify(res));
    await new Promise(r => setTimeout(r, 1000)); // Rate limit
  }
}

run();
