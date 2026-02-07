const rateLimit = require("express-rate-limit");

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 100, // 100 requests por IP por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again later." },
});

module.exports = { apiLimiter };

