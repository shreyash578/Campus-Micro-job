const express = require('express');
const bcrypt = require('bcryptjs');
const Company = require('../models/company');
const RevokedToken = require('../models/revokedToken');
const verifyToken = require('../middleware/authMiddleware');
const authorizeRoles = require('../middleware/roleMiddleware');
const { signAccessToken } = require('../utils/jwt');
const { hashToken } = require('../utils/tokenHash');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { companyName, email, password, description } = req.body;

    if (!companyName || !email || !password || !description) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingCompany = await Company.findOne({ email: normalizedEmail });
    if (existingCompany) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const company = await Company.create({
      companyName,
      email: normalizedEmail,
      password,
      description,
    });

    return res.status(201).json({
      message: 'Company registered successfully',
      companyId: company._id,
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
    const company = await Company.findOne({ email: normalizedEmail });
    if (!company) {
      return res.status(404).json({ message: 'Email not registered' });
    }

    const isPasswordValid = await bcrypt.compare(password, company.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const token = signAccessToken({
      sub: String(company._id),
      id: String(company._id),
      email: company.email,
      role: 'company',
    });

    return res.status(200).json({
      message: 'Login successful',
      token,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/logout', verifyToken, authorizeRoles('company'), async (req, res) => {
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

router.get('/me', verifyToken, authorizeRoles('company'), async (req, res) => {
  try {
    const company = await Company.findById(req.user.id).select('-password');
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }

    return res.status(200).json({ company });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
