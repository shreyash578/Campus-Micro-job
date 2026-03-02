require('dotenv').config();
const assert = require('assert');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const Job = require('../models/job');
const JobApplication = require('../models/jobApplication');
const Student = require('../models/student');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl, retries = 30) {
  for (let i = 0; i < retries; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch (error) {
      // Keep polling
    }
    await sleep(500);
  }
  throw new Error('Server did not start in time');
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  return { response, data };
}

async function run() {
  const port = 4020;
  const baseUrl = `http://localhost:${port}`;
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_microjob';

  await mongoose.connect(mongoUri);
  const job = await Job.create({
    title: `Smoke Test Job ${Date.now()}`,
    description: 'Temporary job for API smoke test validation.',
    stipend: 5000,
    deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    domain: 'Web Development',
    campus: 'Main Campus',
    postedBy: new mongoose.Types.ObjectId(),
  });
  await mongoose.disconnect();

  const serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: 'ignore',
  });

  const email = `apitest${Date.now()}@example.com`;
  const password = 'pass1234';

  try {
    await waitForServer(baseUrl);

    const registerPayload = {
      name: 'API Smoke User',
      email,
      password,
      contactNumber: '9999999999',
      resumeLink: 'https://example.com/resume.pdf',
      campus: 'Main Campus',
      preferredDomains: ['Web Development'],
    };

    const registerResult = await requestJson(`${baseUrl}/api/students/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registerPayload),
    });
    assert.strictEqual(registerResult.response.status, 201, 'Register failed');

    const loginResult = await requestJson(`${baseUrl}/api/students/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    assert.strictEqual(loginResult.response.status, 200, 'Login failed');
    assert.ok(loginResult.data.token, 'Token missing from login response');

    const jobsResult = await requestJson(`${baseUrl}/api/jobs?domain=Web%20Development&campus=Main%20Campus`);
    assert.strictEqual(jobsResult.response.status, 200, 'Jobs fetch failed');
    assert.ok(Array.isArray(jobsResult.data.jobs), 'Jobs list is not an array');
    assert.ok(jobsResult.data.jobs.length >= 1, 'No jobs returned');

    const applyResult = await requestJson(`${baseUrl}/api/jobs/apply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginResult.data.token}`,
      },
      body: JSON.stringify({ jobId: String(job._id) }),
    });
    assert.strictEqual(applyResult.response.status, 201, 'Apply failed');

    console.log('API smoke test passed');
  } finally {
    serverProcess.kill('SIGTERM');

    await mongoose.connect(mongoUri);
    await JobApplication.deleteMany({ jobId: job._id });
    await Job.deleteOne({ _id: job._id });
    await Student.deleteMany({ email: /apitest\d+@example\.com$/ });
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error('API smoke test failed:', error.message);
  process.exit(1);
});
