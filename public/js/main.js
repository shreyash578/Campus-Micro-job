function showMessage(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.classList.remove("error", "success");
  if (type) element.classList.add(type);
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
    throw new Error(data.message || `Request failed (${response.status})`);
  }

  return data;
}

async function registerStudent(event) {
  event.preventDefault();

  const form = event.target;
  const messageEl = document.getElementById("registerMessage");
  const payload = Object.fromEntries(new FormData(form).entries());
  payload.preferredDomains = String(payload.preferredDomains || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  try {
    const response = await fetch("/api/students/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await parseJsonSafe(response);

    showMessage(messageEl, data.message || "Registration successful", "success");
    form.reset();
  } catch (error) {
    showMessage(messageEl, error.message || "Something went wrong", "error");
  }
}

async function loginStudent(event) {
  event.preventDefault();

  const form = event.target;
  const messageEl = document.getElementById("loginMessage");
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    const response = await fetch("/api/students/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await parseJsonSafe(response);

    if (data.token) {
      localStorage.setItem("studentToken", data.token);
    }

    showMessage(messageEl, data.message || "Login successful", "success");
    form.reset();
  } catch (error) {
    showMessage(messageEl, error.message || "Something went wrong", "error");
  }
}

function createJobCard(job) {
  const card = document.createElement("article");
  card.className = "job-card";

  const companyName = job.postedBy?.companyName || "N/A";

  card.innerHTML = `
    <h3>${job.title || "Untitled Job"}</h3>
    <p><strong>Company:</strong> ${companyName}</p>
    <p><strong>Description:</strong> ${job.description || "No description"}</p>
    <p><strong>Stipend:</strong> ${job.stipend || "N/A"}</p>
  `;

  return card;
}

async function fetchJobs() {
  const jobsListEl = document.getElementById("jobsList");
  const messageEl = document.getElementById("jobsMessage");
  const domainInput = document.getElementById("domainFilter");
  const campusInput = document.getElementById("campusFilter");

  if (!jobsListEl) return;

  try {
    const params = new URLSearchParams();
    const domain = domainInput ? domainInput.value.trim() : "";
    const campus = campusInput ? campusInput.value.trim() : "";

    if (domain) params.set("domain", domain);
    if (campus) params.set("campus", campus);

    const query = params.toString();
    const response = await fetch(query ? `/api/jobs?${query}` : "/api/jobs");
    const data = await parseJsonSafe(response);

    const jobs = Array.isArray(data.jobs) ? data.jobs : [];

    if (jobs.length === 0) {
      showMessage(messageEl, "No jobs available right now.");
      jobsListEl.innerHTML = "";
      return;
    }

    jobsListEl.innerHTML = "";
    jobs.forEach((job) => jobsListEl.appendChild(createJobCard(job)));
  } catch (error) {
    showMessage(messageEl, error.message || "Something went wrong", "error");
  }
}

async function fetchSuggestions() {
  const token = localStorage.getItem("studentToken");
  const sectionEl = document.getElementById("suggestionsSection");
  const listEl = document.getElementById("suggestedJobsList");
  const messageEl = document.getElementById("suggestionsMessage");

  if (!sectionEl || !listEl || !messageEl || !token) return;

  sectionEl.classList.remove("hidden");

  try {
    const response = await fetch("/api/jobs/suggestions", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    const data = await parseJsonSafe(response);

    const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];
    if (suggestions.length === 0) {
      showMessage(messageEl, "No personalized suggestions yet. Apply to a few jobs to improve recommendations.");
      listEl.innerHTML = "";
      return;
    }

    showMessage(messageEl, "Based on your profile and applications.");
    listEl.innerHTML = "";
    suggestions.forEach((job) => listEl.appendChild(createJobCard(job)));
  } catch (error) {
    showMessage(messageEl, error.message || "Something went wrong", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  if (registerForm) registerForm.addEventListener("submit", registerStudent);

  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", loginStudent);

  if (document.getElementById("jobsList")) {
    const applyFiltersBtn = document.getElementById("applyFiltersBtn");
    if (applyFiltersBtn) {
      applyFiltersBtn.addEventListener("click", fetchJobs);
    }

    fetchSuggestions();
    fetchJobs();
  }
});
