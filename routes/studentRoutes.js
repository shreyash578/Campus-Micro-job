const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Student = require('../models/student');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, contactNumber, resumeLink } = req.body;

    if (!name || !email || !password || !contactNumber || !resumeLink) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingStudent = await Student.findOne({ email: normalizedEmail });

    if (existingStudent) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const student = await Student.create({
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

    const token = jwt.sign(
      { id: student._id, email: student.email },
      process.env.JWT_SECRET || 'your_jwt_secret',
      { expiresIn: '1d' }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
