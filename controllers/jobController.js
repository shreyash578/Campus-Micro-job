const JobApplication = require('../models/jobApplication');
const Job = require('../models/job');

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'you', 'your', 'our',
  'job', 'role', 'work', 'are', 'will', 'have', 'has', 'not', 'but', 'all',
  'any', 'can', 'who', 'how', 'why', 'what', 'into', 'over', 'under', 'more',
  'less', 'very', 'than', 'their', 'they', 'them', 'its', 'our', 'out',
]);

function getTopKeywords(text, maxKeywords = 20) {
  const counts = new Map();

  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
    .forEach((word) => {
      counts.set(word, (counts.get(word) || 0) + 1);
    });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);
}

// Get my applications (Student)
exports.getMyApplications = async (req, res) => {
  try {
    const applications = await JobApplication.find({
      studentId: req.user.id,
    }).populate('jobId');

    return res.status(200).json({ applications });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get personalized job suggestions for student
exports.getJobSuggestions = async (req, res) => {
  try {
    const studentId = req.user.id;

    const applications = await JobApplication.find({ studentId }).select('jobId');
    const appliedJobIds = applications.map((item) => item.jobId);

    const candidateJobs = await Job.find({
      _id: { $nin: appliedJobIds },
    })
      .populate('postedBy', 'companyName')
      .sort({ createdAt: -1 })
      .limit(50);

    if (candidateJobs.length === 0) {
      return res.status(200).json({ suggestions: [] });
    }

    if (appliedJobIds.length === 0) {
      return res.status(200).json({ suggestions: candidateJobs.slice(0, 6) });
    }

    const appliedJobs = await Job.find({ _id: { $in: appliedJobIds } }).select('title description');
    const profileText = appliedJobs.map((job) => `${job.title} ${job.description}`).join(' ');
    const keywords = getTopKeywords(profileText);

    const scored = candidateJobs.map((job) => {
      const haystack = `${job.title} ${job.description}`.toLowerCase();
      const score = keywords.reduce((sum, word) => (haystack.includes(word) ? sum + 1 : sum), 0);
      return { job, score };
    });

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.job.createdAt) - new Date(a.job.createdAt);
    });

    const suggestions = scored.slice(0, 6).map((item) => item.job);
    return res.status(200).json({ suggestions });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get applicants for a specific job (Admin/Company)
exports.getApplicantsForJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const applications = await JobApplication.find({ jobId })
      .populate('studentId', 'name email');

    return res.status(200).json({ applications });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update application status
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['Pending', 'Selected', 'Rejected'];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: `Status must be one of: ${allowedStatuses.join(', ')}`,
      });
    }

    const updated = await JobApplication.findByIdAndUpdate(
      applicationId,
      { status },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Application not found' });
    }

    return res.status(200).json({
      message: 'Application status updated',
      updated,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};
