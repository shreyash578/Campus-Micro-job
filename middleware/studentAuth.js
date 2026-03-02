const RevokedToken = require('../models/revokedToken');
const Student = require('../models/student');
const { hashToken } = require('../utils/tokenHash');
const { extractBearerToken, verifyAccessToken } = require('../utils/jwt');

const studentAuth = async (req, res, next) => {
  try {
    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ message: 'Authorization token missing' });
    }

    const decoded = verifyAccessToken(token);
    const tokenHash = hashToken(token);
    const revoked = await RevokedToken.exists({ tokenHash });

    if (revoked) {
      return res.status(401).json({ message: 'Token revoked' });
    }

    const studentId = decoded.id || decoded.sub || decoded.studentId;

    if (!studentId) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(401).json({ message: 'Student not found' });
    }

    req.authToken = token;
    req.student = student;
    req.user = {
      ...decoded,
      id: studentId,
      role: decoded.role || 'student',
    };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }

    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = studentAuth;
