const express = require('express');
const bcrypt = require('bcryptjs');
const Student = require('../models/student');
const RevokedToken = require('../models/revokedToken');
const verifyToken = require('../middleware/authMiddleware');
const { signAccessToken } = require('../utils/jwt');
const { hashToken } = require('../utils/tokenHash');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, contactNumber, resumeLink, campus, preferredDomains } = req.body;

    if (!name || !email || !password || !contactNumber || !resumeLink || !campus) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingStudent = await Student.findOne({ email: normalizedEmail });

    if (existingStudent) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const student = await Student.create({
      campus: String(campus).trim(),
      preferredDomains: Array.isArray(preferredDomains)
        ? preferredDomains
        : String(preferredDomains || '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
      name,
      email: normalizedEmail,
      password: hashedPassword,
      contactNumber,
      resumeLink,
    });

    return res.status(201).json({
      message: 'Student registered successfully',
      studentId: student._id,
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
    const student = await Student.findOne({ email: normalizedEmail });

    if (!student) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, student.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signAccessToken({
      sub: String(student._id),
      id: String(student._id),
      email: student.email,
      role: 'student',
    });

    return res.status(200).json({
      message: 'Login successful',
      token,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/logout', verifyToken, async (req, res) => {
  try {
    if (!req.authToken) {
      return res.status(400).json({ message: 'Token missing' });
    }

    const tokenHash = hashToken(req.authToken);
    const expiresAt = req.user.exp ? new Date(req.user.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000);

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

router.get('/me', verifyToken, async (req, res) => {
  try {
    const student = await Student.findById(req.user.id).select('-password');
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    return res.status(200).json({ student });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
