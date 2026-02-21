module.exports = {
  basic: {
    name: "Basic",
    priceMonthly: 49,
    messageLimit: 1000,
    rateLimit: { windowMs: 60000, max: 60 },
  },
  pro: {
    name: "Pro",
    priceMonthly: 99,
    messageLimit: 3000,
    rateLimit: { windowMs: 60000, max: 180 },
  },
  premium: {
    name: "Premium",
    priceMonthly: 0,
    messageLimit: 999999,
    rateLimit: { windowMs: 60000, max: 600 },
  },
};

