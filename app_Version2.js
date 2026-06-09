// Client script to call the proxy and display results.
// Uses PROXY_BASE set in index.html
const PROXY = (typeof PROXY_BASE === 'string' && PROXY_BASE && PROXY_BASE !== 'https://REPLACE_WITH_YOUR_PROXY_URL') 
  ? PROXY_BASE 
  : window.location.origin;

const form = document.getElementById('searchForm');
const townInput = document.getElementById('town');
const stateInput = document.getElementById('state');
const locationEl = document.getElementById('location');
const forecastEl = document.getElementById('forecast');
const hourlyEl = document.getElementById('hourly');
const alertsEl = document.getElementById('alerts');
const statusEl = document.getElementById('status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const town = townInput.value.trim();
  const state = stateInput.value.trim();
  if (!town || !state) return;
  clearUI();
  status('Geocoding...');
  try {
    const geoRes = await fetch(`${PROXY}/api/geocode?town=${encodeURIComponent(town)}&state=${encodeURIComponent(state)}`);
    if (!geoRes.ok) throw new Error('Geocode failed: ' + geoRes.status);
    const geo = await geoRes.json();
    const lat = geo.lat, lon = geo.lon;
    locationEl.innerHTML = `<strong>Location:</strong> ${escapeHtml(geo.display_name)} (lat: ${lat}, lon: ${lon})`;
    status('Fetching weather from NWS...');
    const weatherRes = await fetch(`${PROXY}/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
    if (!weatherRes.ok) throw new Error('Weather fetch failed: ' + weatherRes.status);
    const data = await weatherRes.json();
    renderForecast(data);
  } catch (err) {
    status('Error: ' + err.message);
  }
});

function clearUI() {
  locationEl.innerHTML = '';
  forecastEl.innerHTML = '';
  hourlyEl.innerHTML = '';
  alertsEl.innerHTML = '';
  statusEl.textContent = '';
}

function status(text) {
  statusEl.textContent = text;
}

function renderForecast(data) {
  // Points metadata
  const p = data.points?.properties || {};
  // Alerts
  const alerts = data.alerts?.features || [];
  if (alerts.length) {
    alertsEl.innerHTML = '<h3>Active Alerts</h3>' + alerts.map(a => {
      const prop = a.properties || {};
      return `<div class="alert"><strong>${escapeHtml(prop.event||'Alert')}</strong> — ${escapeHtml(prop.headline||'')}</div>`;
    }).join('');
  } else {
    alertsEl.innerHTML = '<h3>Active Alerts</h3><div>No active alerts.</div>';
  }

  // Forecast (7-day)
  const periods = data.forecast?.properties?.periods || [];
  if (periods.length) {
    forecastEl.innerHTML = '<h3>7-Day Forecast</h3>' + periods.map(p => `
      <div class="period">
        <strong>${escapeHtml(p.name)}</strong> · ${escapeHtml(p.temperature)} ${escapeHtml(p.temperatureUnit)} · ${escapeHtml(p.shortForecast)}
        <div style="color:#555">${escapeHtml(p.detailedForecast)}</div>
      </div>
    `).join('');
  } else {
    forecastEl.innerHTML = '<h3>7-Day Forecast</h3><div>Forecast not available.</div>';
  }

  // Hourly
  const hourly = data.hourly?.properties?.periods || [];
  if (hourly.length) {
    hourlyEl.innerHTML = '<h3>Hourly (next 48 hours)</h3>' + hourly.slice(0, 24).map(h => `
      <div class="period">
        <strong>${escapeHtml(h.startTime)}</strong> ${escapeHtml(h.temperature)} ${escapeHtml(h.temperatureUnit)} · ${escapeHtml(h.shortForecast)}
      </div>
    `).join('');
  } else {
    hourlyEl.innerHTML = '<h3>Hourly</h3><div>Hourly forecast not available.</div>';
  }

  status('Done.');
}

function escapeHtml(s) {
  if (!s) return '';
  return s.toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}