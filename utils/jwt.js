const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

const MIN_SECRET_LENGTH = 32;

function getJwtConfig() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error('JWT_SECRET must be set and at least 32 characters long');
  }

  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    issuer: process.env.JWT_ISSUER || 'campus-micro-placement',
    audience: process.env.JWT_AUDIENCE || 'campus-micro-placement-users',
  };
}

function signAccessToken(payload) {
  const { secret, expiresIn, issuer, audience } = getJwtConfig();

  return jwt.sign(payload, secret, {
    algorithm: 'HS256',
    expiresIn,
    issuer,
    audience,
    jwtid: randomUUID(),
  });
}

function verifyAccessToken(token) {
  const { secret, issuer, audience } = getJwtConfig();

  return jwt.verify(token, secret, {
    algorithms: ['HS256'],
    issuer,
    audience,
  });
}

function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return null;
  }

  return authorizationHeader.slice(7).trim();
}

module.exports = {
  getJwtConfig,
  signAccessToken,
  verifyAccessToken,
  extractBearerToken,
};
