const getApplicantsForJob = async (req, res) => {
  try {
    // 1️⃣ Get jobId
    const { jobId } = req.params;

    // 2️⃣ Pagination logic
    const parsedPage = Number.parseInt(req.query.page, 10);
    const parsedLimit = Number.parseInt(req.query.limit, 10);

    const page =
      Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

    const limit =
      Number.isInteger(parsedLimit) &&
      parsedLimit >= 1 &&
      parsedLimit <= 100
        ? parsedLimit
        : 10;

    const skip = (page - 1) * limit;

    // 3️⃣ Dynamic Filter
    const filter = { jobId };

    // Status filter (pending / selected / rejected)
    if (req.query.status) {
      filter.status = req.query.status;
    }

    // 4️⃣ Count total applicants
    const totalApplicants = await JobApplication.countDocuments(filter);

    // 5️⃣ Fetch applicants with search + optimized populate
    const applicants = await JobApplication.find(filter)
      .populate({
        path: "studentId",
        match: req.query.search
          ? { name: { $regex: req.query.search, $options: "i" } }
          : {},
        select: "name email"
      })
      .populate("jobId", "title company location")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Remove null students if search does not match
    const filteredApplicants = applicants.filter(
      (app) => app.studentId !== null
    );

    // 6️⃣ Send response
    return res.status(200).json({
      success: true,
      totalApplicants,
      currentPage: page,
      totalPages: Math.ceil(totalApplicants / limit),
      applicants: filteredApplicants,
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch applicants",
      error: error.message,
    });
  }
};