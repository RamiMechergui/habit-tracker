const jwt          = require('jsonwebtoken');
const { getUserById } = require('../db/users');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod';

/**
 * Protect middleware — verifies the JWT and attaches the full user object
 * to req.user. Uses DynamoDB GetItem instead of Mongoose findById.
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
    const user    = await getUserById(decoded.id);
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

module.exports = { protect };
