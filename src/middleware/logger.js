
function logger(req, res, next) {
  const start = Date.now();
  console.log("➡️ REQUEST:", req.method, req.originalUrl);

  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log("✅ RESPONSE:", req.method, req.originalUrl, res.statusCode, `${ms}ms`);
  });

  next();
}

module.exports = { logger };

