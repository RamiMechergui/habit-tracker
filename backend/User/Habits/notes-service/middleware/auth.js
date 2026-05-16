const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  let token;
  if (req.cookies && req.cookies.habitToken) {
    token = req.cookies.habitToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) return res.status(401).json({ message: 'Not authorized, no token' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod');
    // Microservices extract the ID from the JWT payload without querying the User DB
    req.user = { id: decoded.id };
    next();
  } catch (error) {
    console.error('[Auth Middleware] Error:', error.message);
    res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

module.exports = auth;
