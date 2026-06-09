// Express proxy for Nominatim + NWS with proper User-Agent contact info.
// CONTACT_EMAIL can be supplied via environment variable CONTACT_EMAIL.
// Default contact (if env not set): discordweston@gmail.com
const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('.')); // serve static front-end if desired

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'discordweston@gmail.com';
const USER_AGENT = `WestonWeather-DixieAlley (${CONTACT_EMAIL})`; // used for Nominatim and NWS headers

// Geocode: Nominatim (OpenStreetMap)
app.get('/api/geocode', async (req, res) => {
  try {
    const { town, state } = req.query;
    if (!town || !state) return res.status(400).json({ error: 'town and state required' });
    const q = `${town}, ${state}, USA`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!r.ok) return res.status(502).json({ error: 'geocode request failed', status: r.status });
    const data = await r.json();
    if (!data || !data.length) return res.status(404).json({ error: 'location not found' });
    res.json(data[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Weather: NWS (points -> forecast -> alerts)
app.get('/api/weather', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat and lon required' });
    const headers = {
      'User-Agent': USER_AGENT,
      'Accept': 'application/ld+json'
    };

    const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;
    const pResp = await fetch(pointsUrl, { headers });
    if (!pResp.ok) return res.status(502).json({ error: 'points lookup failed', status: pResp.status });
    const pData = await pResp.json();

    const forecastUrl = pData.properties.forecast;
    const forecastHourlyUrl = pData.properties.forecastHourly;

    const [forecastResp, hourlyResp, alertsResp] = await Promise.all([
      forecastUrl ? fetch(forecastUrl, { headers }).catch(()=>null) : null,
      forecastHourlyUrl ? fetch(forecastHourlyUrl, { headers }).catch(()=>null) : null,
      fetch(`https://api.weather.gov/alerts/active?point=${lat},${lon}`, { headers }).catch(()=>null),
    ]);

    const forecast = forecastResp && forecastResp.ok ? await forecastResp.json() : null;
    const hourly = hourlyResp && hourlyResp.ok ? await hourlyResp.json() : null;
    const alerts = alertsResp && alertsResp.ok ? await alertsResp.json() : null;

    res.json({ points: pData, forecast, hourly, alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`WestonWeather proxy running on port ${PORT} (CONTACT_EMAIL=${CONTACT_EMAIL})`));