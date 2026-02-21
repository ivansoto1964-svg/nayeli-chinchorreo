const express = require("express");
const Stripe = require("stripe");
const { generateApiKey } = require("../services/apikeys");
const { readClientsFile, upsertClientKey } = require("../services/clients.store");
const plans = require("../config/plans");

const router = express.Router();

router.post("/", (req, res) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Stripe webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const type = event.type;
  console.log("✅ Stripe webhook verified:", type);

  if (type === "checkout.session.completed") {
    const session = event.data.object;

    // Email can be missing in some cases; we prefer matching by session.id
    const email = session.customer_details?.email || session.customer_email || null;

    const metadata = session.metadata || {};

    // NOTE: billing.js currently uses metadata.plan, so we keep reading metadata.plan
    const planIdRaw = String(metadata.plan || "basic").toLowerCase().trim();
    const planId = plans[planIdRaw] ? planIdRaw : "basic";
    const planConfig = plans[planId];

    const stripeCustomerId = session.customer || null;
    const stripeSubscriptionId = session.subscription || null;

    const clientsData = readClientsFile();

    // 1) Prefer match by pendingStripeSessionId (most reliable)
    const existingByPending = Object.entries(clientsData.keys || {}).find(
      ([, v]) =>
        v && v.pendingStripeSessionId && v.pendingStripeSessionId === session.id
    );

    // 2) Fallback match by email (if available)
    const existingByEmail = email
      ? Object.entries(clientsData.keys || {}).find(
          ([, v]) =>
            v &&
            v.email &&
            v.email.toLowerCase() === String(email).toLowerCase()
        )
      : null;

    const match = existingByPending || existingByEmail;

    if (match) {
      const [apiKeyFound, rec] = match;

      upsertClientKey(apiKeyFound, {
        ...rec,
        isActive: true,
        plan: planId,
        planName: planConfig.name,
        messageLimit: planConfig.messageLimit,
        rateLimit: planConfig.rateLimit,
        source: "stripe",
        stripeCustomerId,
        stripeSubscriptionId,
        lastStripeSessionId: session.id,
        // keep original pendingStripeSessionId if it exists
        pendingStripeSessionId: rec.pendingStripeSessionId || rec.pendingStripeSessionId,
        updatedAt: new Date().toISOString(),
      });

      console.log("🟡 Client activated:", rec.email || email || apiKeyFound);
      return res.status(200).json({ received: true, updated: true });
    }

    // If no pending match and no email match, create a new client
    const clientId = `stripe_${session.id}`;
    const apiKey = generateApiKey();

    upsertClientKey(apiKey, {
      clientId,
      name: (email && email.includes("@")) ? email.split("@")[0] : "stripe_client",
      email: email || "",
      plan: planId,
      planName: planConfig.name,
      messageLimit: planConfig.messageLimit,
      rateLimit: planConfig.rateLimit,
      createdAt: new Date().toISOString(),
      isActive: true,
      source: "stripe",
      stripeSessionId: session.id,
      stripeCustomerId,
      stripeSubscriptionId,
    });

    console.log("✅ NEW CLIENT CREATED:", email || "(no email)");
    console.log("🔑 API KEY:", apiKey);
    return res.status(200).json({ received: true, created: true });
  }

  return res.status(200).json({ received: true });
});

module.exports = router;

