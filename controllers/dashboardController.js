const Job = require("../models/job");
const User = require("../models/user");
const JobApplication = require("../models/jobApplication");

const getDashboardStats = async (req, res) => {
  try {
    const totalJobs = await Job.countDocuments();
    const totalStudents = await User.countDocuments({ role: "student" });
    const totalApplications = await JobApplication.countDocuments();

    // Must match enum casing in JobApplication model
    const selected = await JobApplication.countDocuments({ status: "Selected" });
    const pending = await JobApplication.countDocuments({ status: "Pending" });
    const rejected = await JobApplication.countDocuments({ status: "Rejected" });

    return res.status(200).json({
      success: true,
      totalJobs,
      totalStudents,
      totalApplications,
      selected,
      pending,
      rejected,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard stats",
      error: error.message,
    });
  }
};

module.exports = { getDashboardStats };
