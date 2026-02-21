const crypto = require("crypto");

function generateApiKey(prefix = "iv_") {
  const token = crypto.randomBytes(32).toString("hex");
  return `${prefix}${token}`;
}

module.exports = { generateApiKey };

