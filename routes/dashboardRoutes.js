const express = require("express");
const router = express.Router();

const { getDashboardStats } = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");

// Protected Route
router.get("/stats", authMiddleware, getDashboardStats);

module.exports = router;