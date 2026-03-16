const express = require('express');
const bcrypt = require('bcryptjs');
const Admin = require('../models/admin');
const RevokedToken = require('../models/revokedToken');
const verifyToken = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const { signAccessToken } = require('../utils/jwt');
const { hashToken } = require('../utils/tokenHash');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingAdmin = await Admin.findOne({ email: normalizedEmail });
    if (existingAdmin) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const admin = await Admin.create({
      name,
      email: normalizedEmail,
      password,
    });

    return res.status(201).json({
      message: 'Admin registered successfully',
      adminId: admin._id,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const admin = await Admin.findOne({ email: normalizedEmail });
    if (!admin) {
      return res.status(404).json({ message: 'Email not registered' });
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const token = signAccessToken({
      sub: String(admin._id),
      id: String(admin._id),
      email: admin.email,
      role: 'admin',
    });

    return res.status(200).json({
      message: 'Login successful',
      token,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/logout', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    if (!req.authToken) {
      return res.status(400).json({ message: 'Token missing' });
    }

    const tokenHash = hashToken(req.authToken);
    const expiresAt = req.user.exp
      ? new Date(req.user.exp * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    await RevokedToken.updateOne(
      { tokenHash },
      { $setOnInsert: { tokenHash, expiresAt } },
      { upsert: true }
    );

    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/me', verifyToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-password');
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    return res.status(200).json({ admin });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
