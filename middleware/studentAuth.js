const jwt = require('jsonwebtoken');
const Student = require('../models/student');

const studentAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token missing' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');

    const studentId = decoded.id || decoded.studentId;
    if (!studentId) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(401).json({ message: 'Student not found' });
    }

    req.student = student;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = studentAuth;
