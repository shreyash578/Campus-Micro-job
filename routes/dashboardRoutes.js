const express = require("express");
const router = express.Router();

const { getDashboardStats } = require("../controllers/dashboardController");
const authMiddleware = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

// Protected Route
router.get("/stats", authMiddleware, authorizeRoles('admin', 'company'), getDashboardStats);

module.exports = router;
