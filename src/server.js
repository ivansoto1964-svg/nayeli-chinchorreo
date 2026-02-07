require("dotenv").config();
const express = require("express");
const chatRoutes = require("./routes/chat");
const { logger } = require("./middleware/logger");
const { apiLimiter } = require("./middleware/rateLimit");

const app = express();

// Parsers
app.use(express.json());

// Logger middleware (requests)
app.use(logger);

const PORT = process.env.PORT || 3000;

// Health check (SIN rate limit)
app.get("/", (req, res) => {
  res.json({ ok: true, name: "ivamar-api", version: "v1" });
});

// ✅ v1 ping (liviano) para probar rate limit sin OpenAI
app.get("/v1/ping", apiLimiter, (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// API v1 (CON rate limit)
app.use("/v1", apiLimiter, chatRoutes);

// Start server
const server = app.listen(PORT, () => {
  console.log(`Ivamar API escuchando en http://localhost:${PORT}`);
});

// Shutdown clean (Ctrl+C / stop)
process.on("SIGINT", () => {
  console.log("🟠 SIGINT (Ctrl+C)");
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.log("🟠 SIGTERM");
  server.close(() => process.exit(0));
});

