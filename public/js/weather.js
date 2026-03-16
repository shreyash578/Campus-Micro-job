const WEATHER_CODE_MAP = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow fall',
  73: 'Moderate snow fall',
  75: 'Heavy snow fall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

function weatherCodeToText(code) {
  if (code === undefined || code === null) return 'Unknown conditions';
  return WEATHER_CODE_MAP[code] || 'Unknown conditions';
}

function requestCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported in this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => reject(error),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  });
}

function getSavedLocation(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.latitude === 'number' && typeof parsed?.longitude === 'number') {
      return parsed;
    }
  } catch (error) {
    // ignore
  }
  return null;
}

function saveLocation(latitude, longitude, storageKey) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ latitude, longitude }));
  } catch (error) {
    // ignore
  }
}

async function reverseGeocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`;
  const response = await fetch(url);
  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const address = data.address || {};
  return (
    address.city ||
    address.town ||
    address.village ||
    address.suburb ||
    address.county ||
    data.display_name ||
    null
  );
}

function startWatchPosition(onUpdate, onError) {
  if (!navigator.geolocation) {
    if (onError) onError(new Error('Geolocation is not supported in this browser.'));
    return null;
  }

  return navigator.geolocation.watchPosition(
    (position) => onUpdate(position),
    (error) => {
      if (onError) onError(error);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 }
  );
}

async function fetchCurrentWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather request failed (${response.status})`);
  }

  const data = await response.json();
  return data.current_weather || null;
}

async function loadWeather(messageEl, detailsEl, userKey) {
  if (!messageEl || !detailsEl) return;

  const storageKey = userKey ? `lastKnownLocation:${userKey}` : 'lastKnownLocation';

  messageEl.textContent = 'Fetching weather for your location...';
  messageEl.classList.remove('error', 'success');

  let lastCoords = null;
  let watchId = null;

  const renderWeather = async (latitude, longitude, locationNote) => {
    const current = await fetchCurrentWeather(latitude, longitude);
    if (!current) {
      throw new Error('No weather data available.');
    }

    const cityName = await reverseGeocode(latitude, longitude);
    const condition = weatherCodeToText(current.weathercode);
    const temp = Math.round(current.temperature);
    const wind = Math.round(current.windspeed);

    detailsEl.innerHTML = `
      <article class="job-card">
        <h3>${condition}</h3>
        <p><strong>Location:</strong> ${cityName || 'Your area'}${locationNote || ''}</p>
        <p><strong>Temperature:</strong> ${temp}&deg;C</p>
        <p><strong>Wind:</strong> ${wind} km/h</p>
        <p><strong>Observed:</strong> ${current.time}</p>
      </article>
    `;

    messageEl.textContent = 'Weather updated from your location.';
    messageEl.classList.add('success');
  };

  const updateFromCoords = async (latitude, longitude, locationNote) => {
    saveLocation(latitude, longitude, storageKey);
    lastCoords = { latitude, longitude };
    await renderWeather(latitude, longitude, locationNote);
  };

  let lastUpdatedAt = 0;
  const shouldUpdate = () => Date.now() - lastUpdatedAt >= 10 * 60 * 1000;

  try {
    let latitude;
    let longitude;
    let locationNote = '';

    try {
      const position = await requestCurrentPosition();
      latitude = position.coords.latitude;
      longitude = position.coords.longitude;
      if (shouldUpdate()) {
        await updateFromCoords(latitude, longitude, '');
        lastUpdatedAt = Date.now();
      }
    } catch (geoError) {
      const saved = getSavedLocation(storageKey);
      if (!saved) {
        throw geoError;
      }
      latitude = saved.latitude;
      longitude = saved.longitude;
      locationNote = ' (last known location)';
      if (shouldUpdate()) {
        await updateFromCoords(latitude, longitude, locationNote);
        lastUpdatedAt = Date.now();
      }
    }

    watchId = startWatchPosition(async (position) => {
      const { latitude: newLat, longitude: newLon } = position.coords;
      const changed =
        !lastCoords ||
        Math.abs(newLat - lastCoords.latitude) > 0.01 ||
        Math.abs(newLon - lastCoords.longitude) > 0.01;
      if (changed && shouldUpdate()) {
        await updateFromCoords(newLat, newLon, '');
        lastUpdatedAt = Date.now();
      }
    });
  } catch (error) {
    messageEl.textContent = error.message || 'Unable to load weather.';
    messageEl.classList.add('error');
  }

  return () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
  };
}

window.loadWeather = loadWeather;
