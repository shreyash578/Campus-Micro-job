const RevokedToken = require('../models/revokedToken');
const { hashToken } = require('../utils/tokenHash');
const { extractBearerToken, verifyAccessToken } = require('../utils/jwt');

const verifyToken = async (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ message: 'Token missing' });
  }

  try {
    const decoded = verifyAccessToken(token);
    const tokenHash = hashToken(token);

    const revoked = await RevokedToken.exists({ tokenHash });
    if (revoked) {
      return res.status(401).json({ message: 'Token revoked' });
    }

    req.authToken = token;
    req.user = {
      ...decoded,
      id: decoded.id || decoded.sub,
    };

    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }

    return res.status(403).json({ message: 'Invalid token' });
  }
};

module.exports = verifyToken;
