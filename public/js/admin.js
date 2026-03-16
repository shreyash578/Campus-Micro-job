function showMessage(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.classList.remove('error', 'success');
  if (type) element.classList.add(type);
}

function getBaseUrl() {
  const { protocol, hostname, port } = window.location;
  if (protocol === 'file:') {
    return 'http://localhost:4000';
  }
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && port !== '4000') {
    return 'http://localhost:4000';
  }
  return '';
}

function getAdminToken() {
  return localStorage.getItem('adminToken');
}

function setAdminToken(token) {
  if (token) {
    localStorage.setItem('adminToken', token);
  }
}

function clearAdminToken() {
  localStorage.removeItem('adminToken');
}

function getAuthHeaders() {
  const token = getAdminToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getCurrentPageName() {
  const raw = window.location.pathname.split('/').pop();
  return raw || 'index.html';
}

async function parseJsonSafe(response) {
  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = {};
    }
  }

  if (!response.ok) {
    const err = new Error(data.message || `Request failed (${response.status})`);
    err.status = response.status;
    throw err;
  }

  return data;
}

async function loginAdmin(event) {
  event.preventDefault();
  const form = event.target;
  const messageEl = document.getElementById('adminLoginMessage');
  const payload = Object.fromEntries(new FormData(form).entries());
  const baseUrl = getBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafe(response);
    setAdminToken(data.token);
    showMessage(messageEl, data.message || 'Login successful', 'success');

    window.location.href = `${baseUrl}/admin-dashboard.html`;
  } catch (error) {
    showMessage(messageEl, error.message || 'Login failed', 'error');
  }
}

function maybeShowAdminLoginReason() {
  const params = new URLSearchParams(window.location.search);
  const reason = params.get('reason');
  const messageEl = document.getElementById('loginMessage');
  const roleSelect = document.getElementById('loginRole');

  if (reason === 'auth') {
    showMessage(messageEl, 'Please login as admin to continue.', 'error');
  }

  if (roleSelect) {
    roleSelect.value = 'admin';
  }
}

async function registerAdmin(event) {
  event.preventDefault();
  const form = event.target;
  const messageEl = document.getElementById('adminRegisterMessage');
  const payload = Object.fromEntries(new FormData(form).entries());
  const baseUrl = getBaseUrl();

  try {
    const response = await fetch(`${baseUrl}/api/admin/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await parseJsonSafe(response);
    showMessage(messageEl, data.message || 'Registration successful', 'success');
    form.reset();
  } catch (error) {
    showMessage(messageEl, error.message || 'Registration failed', 'error');
  }
}

async function logoutAdmin() {
  const token = getAdminToken();
  const baseUrl = getBaseUrl();
  try {
    if (token) {
      await fetch(`${baseUrl}/api/admin/logout`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
        },
      });
    }
  } catch (error) {
    // Ignore logout API errors.
  } finally {
    clearAdminToken();
    window.location.href = `${baseUrl}/login.html?role=admin`;
  }
}

function createStatCard(label, value) {
  const card = document.createElement('article');
  card.className = 'job-card';
  card.innerHTML = `
    <h3>${label}</h3>
    <p><strong>Total:</strong> ${value}</p>
  `;
  return card;
}

async function loadDashboard() {
  const statsMessage = document.getElementById('adminStatsMessage');
  const statsGrid = document.getElementById('adminStatsGrid');
  const welcomeEl = document.getElementById('adminWelcome');
  const weatherMessage = document.getElementById('adminWeatherMessage');
  const weatherDetails = document.getElementById('adminWeatherDetails');

  if (!statsGrid) return;

  try {
    const response = await fetch(`${getBaseUrl()}/api/admin/me`, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    const adminData = await parseJsonSafe(response);
    showMessage(welcomeEl, `Welcome, ${adminData.admin?.name || adminData.admin?.email}`, 'success');
    if (typeof window.loadWeather === 'function') {
      const adminKey = adminData.admin?._id || adminData.admin?.email;
      window.loadWeather(weatherMessage, weatherDetails, adminKey);
    }
  } catch (error) {
    clearAdminToken();
    window.location.href = `${getBaseUrl()}/login.html?role=admin&reason=auth`;
    return;
  }

  try {
    const response = await fetch(`${getBaseUrl()}/api/dashboard/stats`, {
      headers: {
        ...getAuthHeaders(),
      },
    });
    const data = await parseJsonSafe(response);

    statsGrid.innerHTML = '';
    statsGrid.appendChild(createStatCard('Jobs', data.totalJobs));
    statsGrid.appendChild(createStatCard('Students', data.totalStudents));
    statsGrid.appendChild(createStatCard('Applications', data.totalApplications));
    statsGrid.appendChild(createStatCard('Selected', data.selected));
    statsGrid.appendChild(createStatCard('Pending', data.pending));
    statsGrid.appendChild(createStatCard('Rejected', data.rejected));

    showMessage(statsMessage, 'Dashboard loaded.', 'success');
  } catch (error) {
    showMessage(statsMessage, error.message || 'Failed to load dashboard', 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const page = getCurrentPageName();
  const loginForm = document.getElementById('adminLoginForm');
  const registerForm = document.getElementById('adminRegisterForm');
  const logoutBtn = document.getElementById('adminLogoutBtn');

  if (loginForm) {
    loginForm.addEventListener('submit', loginAdmin);
  }

  if (registerForm) {
    registerForm.addEventListener('submit', registerAdmin);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', logoutAdmin);
  }

  if (page === 'admin-dashboard.html') {
    const token = getAdminToken();
    if (!token) {
      window.location.href = `${getBaseUrl()}/login.html?role=admin&reason=auth`;
      return;
    }
    loadDashboard();
  }

  if (page === 'login.html') {
    maybeShowAdminLoginReason();
  }
});
