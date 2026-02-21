require("dotenv").config();
const express = require("express");

const chatRoutes = require("./routes/chat");
const billingRoutes = require("./routes/billing");
const stripeWebhookRoutes = require("./routes/stripe.webhook");

const { logger } = require("./middleware/logger");
const { apiLimiter } = require("./middleware/rateLimit");

const app = express();

// Trust proxy (Render / rate-limit)
app.set("trust proxy", 1);

/**
 * ✅ Stripe Webhook MUST use raw body
 * IMPORTANT: this must be mounted BEFORE express.json()
 * Also: DO NOT rate-limit webhooks (Stripe retries)
 */
app.use(
  "/v1/stripe/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhookRoutes
);

// Parsers (for the rest of the API)
app.use(express.json());

// Logger middleware (requests)
app.use(logger);

const PORT = process.env.PORT || 3000;

// Health check (SIN rate limit)
app.get("/", (req, res) => {
  res.json({ ok: true, name: "ivamar-api", version: "v1" });
});

// v1 ping (liviano) para probar rate limit sin OpenAI
app.get("/v1/ping", apiLimiter, (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// Billing routes (admin, stripe webhooks luego)
app.use("/v1/billing", billingRoutes);
// API v1 (CON rate limit)
app.use("/v1", apiLimiter, chatRoutes);

// Start server
const server = app.listen(PORT, () => {
  console.log(`Ivamar API escuchando en http://localhost:${PORT}`);
});

// Shutdown clean (Ctrl+C / stop)
process.on("SIGINT", () => {
  console.log("  SIGINT (Ctrl+C)");
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.log("  SIGTERM");
  server.close(() => process.exit(0));
});

