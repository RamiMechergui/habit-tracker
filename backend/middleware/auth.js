const jwt          = require('jsonwebtoken');
const { getUserById } = require('../db/users');
const { getSession, touchSession } = require('../db/sessions');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod';

/**
 * Protect middleware — verifies the JWT, checks the session is not revoked,
 * and attaches the full user object + sessionId to req.user.
 */
const protect = async (req, res, next) => {
  const token =
    req.cookies?.habitToken ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const sessionId = decoded.sid;
    const user    = await getUserById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });

    req.user = user;

    // If the JWT carries a sessionId, check it's not revoked
    if (sessionId) {
      const session = await getSession(decoded.id, sessionId);
      if (!session || session.isRevoked) {
        return res.status(401).json({ message: 'Session revoked, please log in again' });
      }
      // Touch lastActiveAt in the background
      touchSession(decoded.id, sessionId);
      req.sessionId = sessionId;
    }

    next();
  } catch {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

module.exports = { protect };

