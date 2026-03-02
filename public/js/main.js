function showMessage(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.classList.remove('error', 'success');
  if (type) element.classList.add(type);
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

async function fetchCurrentStudent() {
  const token = getStudentToken();
  if (!token) return null;

  try {
    const response = await fetch('/api/students/me', {
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
      const response = await fetch('/api/students/logout', {
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
      window.location.href = 'login.html';
    });
    wrapper.appendChild(logoutBtn);
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
  window.location.href = `login.html?reason=auth&next=${next}`;
}

async function enforcePageGuard(student) {
  const page = getCurrentPageName();

  if (page === 'my-applications.html' && !student) {
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

  if (reason === 'auth') {
    showMessage(messageEl, 'Please login to continue.', 'error');
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
    const response = await fetch('/api/students/register', {
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

  try {
    const response = await fetch('/api/students/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await parseJsonSafe(response);

    if (data.token) {
      localStorage.setItem('studentToken', data.token);
    }

    showMessage(messageEl, data.message || 'Login successful', 'success');
    form.reset();

    const params = new URLSearchParams(window.location.search);
    const next = params.get('next') || 'jobs.html';
    window.location.href = next;
  } catch (error) {
    showMessage(messageEl, error.message || 'Something went wrong', 'error');
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
    window.location.href = 'login.html?reason=auth&next=jobs.html';
    return;
  }

  const originalText = buttonElement ? buttonElement.textContent : '';
  if (buttonElement) {
    buttonElement.disabled = true;
    buttonElement.textContent = 'Applying...';
  }

  try {
    const response = await fetch('/api/jobs/apply', {
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
      window.location.href = 'login.html?reason=auth&next=jobs.html';
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
    const response = await fetch(query ? `/api/jobs?${query}` : '/api/jobs');
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
    const response = await fetch('/api/jobs/suggestions', {
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
    const response = await fetch('/api/jobs/my-applications', {
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
  maybeShowLoginReason();

  const student = await fetchCurrentStudent();
  renderSessionUI(student);

  const allowed = await enforcePageGuard(student);
  if (!allowed) return;

  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', registerStudent);

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', loginStudent);

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
});
