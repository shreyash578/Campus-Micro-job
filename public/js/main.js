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

function getStudentToken() {
  return localStorage.getItem('studentToken');
}

function clearStudentToken() {
  localStorage.removeItem('studentToken');
}

function getAuthHeaders() {
  const token = getStudentToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getCurrentPageName() {
  const raw = window.location.pathname.split('/').pop();
  return raw || 'index.html';
}

function isAuthErrorStatus(status) {
  return status === 401 || status === 403;
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

async function requestJsonRaw(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data = {};

  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = {};
    }
  }

  return { response, data };
}

async function fetchCurrentStudent() {
  const token = getStudentToken();
  if (!token) return null;

  try {
    const response = await fetch(`${getBaseUrl()}/api/students/me`, {
      headers: {
        ...getAuthHeaders()
      }
    });
    const data = await parseJsonSafe(response);
    return data.student || null;
  } catch (error) {
    if (isAuthErrorStatus(error.status)) {
      clearStudentToken();
      return null;
    }
    return null;
  }
}

async function logoutStudent() {
  const token = getStudentToken();

  try {
    if (token) {
      const response = await fetch(`${getBaseUrl()}/api/students/logout`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders()
        }
      });

      if (response.ok) {
        await parseJsonSafe(response);
      }
    }
  } catch (error) {
    // Ignore logout API errors and always clear local session.
  } finally {
    clearStudentToken();
  }
}

function buildSessionControls(student) {
  const wrapper = document.createElement('div');
  wrapper.className = 'session-controls';

  const status = document.createElement('span');
  status.className = 'session-status';
  status.textContent = student ? `Logged in: ${student.name || student.email}` : 'Guest mode';
  wrapper.appendChild(status);

  if (student) {
    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'session-logout-btn';
    logoutBtn.textContent = 'Logout';
    logoutBtn.addEventListener('click', async () => {
      await logoutStudent();
      window.location.href = `${getBaseUrl()}/login.html`;
    });
    wrapper.appendChild(logoutBtn);
  } else {
    const guestBtn = document.createElement('button');
    guestBtn.type = 'button';
    guestBtn.className = 'session-guest-btn';
    guestBtn.textContent = 'Continue as Guest';
    guestBtn.addEventListener('click', () => {
      clearStudentToken();
      window.location.href = `${getBaseUrl()}/jobs.html`;
    });
    wrapper.appendChild(guestBtn);
  }

  return wrapper;
}

function renderSessionUI(student) {
  const nav = document.querySelector('.top-bar') || document.querySelector('.nav-links');
  if (!nav) return;

  const existing = nav.querySelector('.session-controls');
  if (existing) existing.remove();

  nav.appendChild(buildSessionControls(student));
}

function redirectToLogin() {
  const next = encodeURIComponent(window.location.pathname.split('/').pop() || 'my-applications.html');
  window.location.href = `${getBaseUrl()}/login.html?reason=auth&next=${next}`;
}

async function enforcePageGuard(student) {
  const page = getCurrentPageName();

  if ((page === 'my-applications.html' || page === 'student-dashboard.html') && !student) {
    redirectToLogin();
    return false;
  }

  return true;
}

function maybeShowLoginReason() {
  const page = getCurrentPageName();
  if (page !== 'login.html') return;

  const params = new URLSearchParams(window.location.search);
  const reason = params.get('reason');
  const messageEl = document.getElementById('loginMessage');
  const roleParam = params.get('role');
  const roleSelect = document.getElementById('loginRole');

  if (reason === 'auth') {
    showMessage(messageEl, 'Please login to continue.', 'error');
  }

  if (roleParam && roleSelect) {
    roleSelect.value = roleParam;
  }
}

async function registerStudent(event) {
  event.preventDefault();

  const form = event.target;
  const messageEl = document.getElementById('registerMessage');
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.preferredDomains = String(payload.preferredDomains || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  try {
    const response = await fetch(`${getBaseUrl()}/api/students/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await parseJsonSafe(response);

    showMessage(messageEl, data.message || 'Registration successful', 'success');
    form.reset();
  } catch (error) {
    showMessage(messageEl, error.message || 'Something went wrong', 'error');
  }
}

async function loginStudent(event) {
  event.preventDefault();

  const form = event.target;
  const messageEl = document.getElementById('loginMessage');
  const payload = Object.fromEntries(new FormData(form).entries());
  const baseUrl = getBaseUrl();

  try {
    const role = String(payload.role || 'auto').toLowerCase();
    delete payload.role;

    const allAttempts = [
      { role: 'student', endpoint: `${baseUrl}/api/students/login` },
      { role: 'admin', endpoint: `${baseUrl}/api/admin/login` },
      { role: 'company', endpoint: `${baseUrl}/api/companies/login` },
    ];

    const loginAttempts = role === 'auto'
      ? allAttempts
      : allAttempts.filter((attempt) => attempt.role === role);

    for (const attempt of loginAttempts) {
      const { response, data } = await requestJsonRaw(attempt.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok && data.token) {
        localStorage.removeItem('studentToken');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('companyToken');

        if (attempt.role === 'student') {
          localStorage.setItem('studentToken', data.token);
        } else if (attempt.role === 'admin') {
          localStorage.setItem('adminToken', data.token);
        } else {
          localStorage.setItem('companyToken', data.token);
        }

        showMessage(messageEl, data.message || 'Login successful', 'success');
        form.reset();

        if (attempt.role === 'admin') {
          window.location.href = `${baseUrl}/admin-dashboard.html`;
          return;
        }

        if (attempt.role === 'company') {
          window.location.href = `${baseUrl}/jobs.html`;
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const next = params.get('next') || 'student-dashboard.html';
        const target = next.startsWith('http') ? next : `${baseUrl}/${next}`;
        window.location.href = target;
        return;
      }

      if (response.status === 401) {
        showMessage(messageEl, data.message || 'Incorrect password', 'error');
        return;
      }

      if (response.status !== 404) {
        showMessage(messageEl, data.message || 'Login failed', 'error');
        return;
      }
      // If 404, try next role.
    }

    showMessage(messageEl, 'Email not registered for any role', 'error');
  } catch (error) {
    showMessage(messageEl, error.message || 'Something went wrong', 'error');
  }
}

async function registerAdminFromLogin(event) {
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
    showMessage(messageEl, data.message || 'Admin registered', 'success');
    form.reset();
  } catch (error) {
    showMessage(messageEl, error.message || 'Registration failed', 'error');
  }
}

function loadStudentDashboard(student) {
  const welcomeEl = document.getElementById('studentWelcome');
  const weatherMessage = document.getElementById('studentWeatherMessage');
  const weatherDetails = document.getElementById('studentWeatherDetails');

  if (welcomeEl) {
    showMessage(welcomeEl, `Welcome, ${student.name || student.email}`, 'success');
  }

  if (typeof window.loadWeather === 'function') {
    const userKey = student._id || student.id || student.email;
    window.loadWeather(weatherMessage, weatherDetails, userKey);
  }
}

function createJobCard(job, options) {
  const { showApplyButton = false } = options || {};
  const card = document.createElement('article');
  card.className = 'job-card';

  const companyName = job.postedBy && job.postedBy.companyName ? job.postedBy.companyName : 'N/A';

  card.innerHTML = `
    <h3>${job.title || 'Untitled Job'}</h3>
    <p><strong>Company:</strong> ${companyName}</p>
    <p><strong>Domain:</strong> ${job.domain || 'N/A'}</p>
    <p><strong>Campus:</strong> ${job.campus || 'N/A'}</p>
    <p><strong>Description:</strong> ${job.description || 'No description'}</p>
    <p><strong>Stipend:</strong> ${job.stipend || 'N/A'}</p>
  `;

  if (showApplyButton && getStudentToken()) {
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'apply-btn';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', () => applyToJob(job._id, applyBtn));
    card.appendChild(applyBtn);
  }

  return card;
}

function createApplicationCard(application) {
  const card = document.createElement('article');
  card.className = 'job-card';

  const job = application.jobId || {};
  const status = application.status || 'Pending';

  card.innerHTML = `
    <h3>${job.title || 'Job Not Available'}</h3>
    <p><strong>Domain:</strong> ${job.domain || 'N/A'}</p>
    <p><strong>Campus:</strong> ${job.campus || 'N/A'}</p>
    <p><strong>Status:</strong> <span class="status-badge status-${String(status).toLowerCase()}">${status}</span></p>
    <p><strong>Stipend:</strong> ${job.stipend || 'N/A'}</p>
  `;

  return card;
}

async function applyToJob(jobId, buttonElement) {
  const token = getStudentToken();
  if (!token) {
    alert('Please login first to apply.');
    window.location.href = `${getBaseUrl()}/login.html?reason=auth&next=jobs.html`;
    return;
  }

  const originalText = buttonElement ? buttonElement.textContent : '';
  if (buttonElement) {
    buttonElement.disabled = true;
    buttonElement.textContent = 'Applying...';
  }

  try {
    const response = await fetch(`${getBaseUrl()}/api/jobs/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ jobId })
    });

    const data = await parseJsonSafe(response);
    if (buttonElement) {
      buttonElement.textContent = 'Applied';
    }

    alert(data.message || 'Job application submitted successfully');
  } catch (error) {
    if (buttonElement) {
      buttonElement.disabled = false;
      buttonElement.textContent = originalText || 'Apply';
    }

    if (isAuthErrorStatus(error.status)) {
      clearStudentToken();
      alert('Session expired. Please login again.');
      window.location.href = `${getBaseUrl()}/login.html?reason=auth&next=jobs.html`;
      return;
    }

    alert(error.message || 'Failed to apply for job');
  }
}

async function fetchJobs() {
  const jobsListEl = document.getElementById('jobsList');
  const messageEl = document.getElementById('jobsMessage');
  const domainInput = document.getElementById('domainFilter');
  const campusInput = document.getElementById('campusFilter');

  if (!jobsListEl) return;

  try {
    const params = new URLSearchParams();
    const domain = domainInput ? domainInput.value.trim() : '';
    const campus = campusInput ? campusInput.value.trim() : '';

    if (domain) params.set('domain', domain);
    if (campus) params.set('campus', campus);

    const query = params.toString();
    const baseUrl = getBaseUrl();
    const response = await fetch(query ? `${baseUrl}/api/jobs?${query}` : `${baseUrl}/api/jobs`);
    const data = await parseJsonSafe(response);

    const jobs = Array.isArray(data.jobs) ? data.jobs : [];

    if (jobs.length === 0) {
      showMessage(messageEl, 'No jobs available with selected filters.');
      jobsListEl.innerHTML = '';
      return;
    }

    showMessage(messageEl, `Showing ${jobs.length} jobs.`, 'success');
    jobsListEl.innerHTML = '';
    jobs.forEach((job) => jobsListEl.appendChild(createJobCard(job, { showApplyButton: true })));
  } catch (error) {
    showMessage(messageEl, error.message || 'Something went wrong', 'error');
  }
}

async function fetchSuggestions() {
  const token = getStudentToken();
  const sectionEl = document.getElementById('suggestionsSection');
  const listEl = document.getElementById('suggestedJobsList');
  const messageEl = document.getElementById('suggestionsMessage');

  if (!sectionEl || !listEl || !messageEl || !token) return;

  sectionEl.classList.remove('hidden');

  try {
    const response = await fetch(`${getBaseUrl()}/api/jobs/suggestions`, {
      headers: {
        ...getAuthHeaders()
      }
    });
    const data = await parseJsonSafe(response);

    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    if (suggestions.length === 0) {
      showMessage(messageEl, 'No personalized suggestions yet. Apply to a few jobs to improve recommendations.');
      listEl.innerHTML = '';
      return;
    }

    showMessage(messageEl, 'Based on your profile and applications.', 'success');
    listEl.innerHTML = '';
    suggestions.forEach((job) => listEl.appendChild(createJobCard(job, { showApplyButton: true })));
  } catch (error) {
    if (isAuthErrorStatus(error.status)) {
      clearStudentToken();
      sectionEl.classList.add('hidden');
      return;
    }

    showMessage(messageEl, error.message || 'Something went wrong', 'error');
  }
}

async function fetchMyApplications() {
  const listEl = document.getElementById('applicationsList');
  const messageEl = document.getElementById('applicationsMessage');

  if (!listEl || !messageEl) return;

  try {
    const response = await fetch(`${getBaseUrl()}/api/jobs/my-applications`, {
      headers: {
        ...getAuthHeaders()
      }
    });

    const data = await parseJsonSafe(response);
    const applications = Array.isArray(data.applications) ? data.applications : [];

    if (applications.length === 0) {
      showMessage(messageEl, 'You have not applied for any jobs yet.');
      listEl.innerHTML = '';
      return;
    }

    showMessage(messageEl, `You have ${applications.length} applications.`, 'success');
    listEl.innerHTML = '';
    applications.forEach((application) => {
      listEl.appendChild(createApplicationCard(application));
    });
  } catch (error) {
    if (isAuthErrorStatus(error.status)) {
      clearStudentToken();
      redirectToLogin();
      return;
    }

    showMessage(messageEl, error.message || 'Failed to load applications', 'error');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const passwordToggles = document.querySelectorAll('.password-toggle');
  passwordToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const targetId = toggle.getAttribute('data-target');
      const input = targetId ? document.getElementById(targetId) : null;
      if (!input) return;
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggle.textContent = isPassword ? 'Hide' : 'Show';
    });
  });

  maybeShowLoginReason();

  const student = await fetchCurrentStudent();
  renderSessionUI(student);

  const allowed = await enforcePageGuard(student);
  if (!allowed) return;

  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', registerStudent);

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', loginStudent);

  const adminRegisterForm = document.getElementById('adminRegisterForm');
  if (adminRegisterForm) adminRegisterForm.addEventListener('submit', registerAdminFromLogin);

  if (document.getElementById('jobsList')) {
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener('click', fetchJobs);
    }

    fetchSuggestions();
    fetchJobs();
  }

  if (document.getElementById('applicationsList')) {
    fetchMyApplications();
  }

  if (document.getElementById('studentWelcome') && student) {
    loadStudentDashboard(student);
  }
});
