const express = require('express');
require('../models/company');
const Job = require('../models/job');
const JobApplication = require('../models/jobApplication');
const {
  getMyApplications,
  getJobSuggestions,
  getApplicantsForJob,
  updateApplicationStatus,
} = require('../controllers/jobController');
const verifyToken = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { domain, campus } = req.query;
    const filter = {};

    if (domain) {
      filter.domain = { $regex: `^${String(domain).trim()}$`, $options: 'i' };
    }

    if (campus) {
      filter.campus = { $regex: `^${String(campus).trim()}$`, $options: 'i' };
    }

    const jobs = await Job.find(filter)
      .populate('postedBy', 'companyName')
      .sort({ createdAt: -1 });

    return res.status(200).json({ jobs });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/apply', verifyToken, authorizeRoles('student'), async (req, res) => {
  try {
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ message: 'jobId is required' });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    const existingApplication = await JobApplication.findOne({
      studentId: req.user.id,
      jobId,
    });

    if (existingApplication) {
      return res.status(409).json({ message: 'You have already applied for this job' });
    }

    await JobApplication.create({
      studentId: req.user.id,
      jobId,
    });

    return res.status(201).json({ message: 'Job application submitted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/my-applications', verifyToken, authorizeRoles('student'), getMyApplications);
router.get('/suggestions', verifyToken, authorizeRoles('student'), getJobSuggestions);

router.get(
  '/:jobId/applicants',
  verifyToken,
  authorizeRoles('admin', 'company'),
  getApplicantsForJob
);

router.put(
  '/application/:applicationId/status',
  verifyToken,
  authorizeRoles('admin', 'company'),
  updateApplicationStatus
);

module.exports = router;
