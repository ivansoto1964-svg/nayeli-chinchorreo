const { getClientByApiKey } = require("../services/clients");

function requireApiKey(req, res, next) {
  const auth = req.headers.authorization || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;

  // soporte legacy
  const headerKey = String(req.headers["x-api-key"] || "").trim();

  const token = bearer || headerKey;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let client;
  try {
    client = getClientByApiKey(token);
  } catch (e) {
    return res.status(500).json({ error: "Server misconfigured: clients.json" });
  }

  if (!client || client.isActive !== true) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  req.client = client;
  next();
}

module.exports = requireApiKey;

