const express = require("express");
const Stripe = require("stripe");
const { generateApiKey } = require("../services/apikeys");
const { readClientsFile, upsertClientKey } = require("../services/clients.store");
const requireApiKey = require("../middleware/requireApiKey");


const router = express.Router();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const baseUrl = process.env.BASE_URL || "http://localhost:3000";

// Simple ping
router.get("/ping", (req, res) => {
  res.json({ ok: true, route: "billing" });
});


// Create Stripe Customer Portal session (requires active API key)
router.post("/portal-session", requireApiKey, async (req, res) => {
  try {
    const client = req.client;

    if (!client.stripeCustomerId) {
      return res.status(400).json({ ok: false, error: "no_stripe_customer" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: client.stripeCustomerId,
      return_url: `${baseUrl}/v1/billing/portal-return`,
    });

    return res.json({ ok: true, url: session.url });
  } catch (err) {
    console.error("portal-session error:", err);
    return res.status(500).json({ ok: false, error: "portal_session_failed" });
  }
});

// simple return page for portal (temporary)
router.get("/portal-return", (req, res) => {
  res.send("Portal closed. You can return to the app.");
});



// Checkout session
router.post("/checkout-session", async (req, res) => {
  try {
    const { email, planId = "basic", name, business } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Valid email required" });
    }

    // 1) Create or reuse Stripe Customer for this email
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer =
      customers.data && customers.data.length > 0
        ? customers.data[0]
        : await stripe.customers.create({
            email,
            name: name || undefined,
          });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer: customer.id,



      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Ivamar AI - ${planId}`,
              description: "Monthly subscription",
            },
            unit_amount: 4900, // $49.00
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        plan: planId,
        name: name || "",
        business: business || "",
      },
      success_url: `${baseUrl}/v1/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/v1/billing/cancel`,
    });


    // 2) Pre-create / update client as "pending" (so we can link by email even if checkout isn't completed)
    const db = readClientsFile();

    const existingByEmail = Object.entries(db.keys || {}).find(
      ([, v]) => v && v.email && v.email.toLowerCase() === String(email).toLowerCase()
    );

    if (existingByEmail) {
      const [apiKeyFound, rec] = existingByEmail;

      upsertClientKey(apiKeyFound, {
        ...rec,
        email,
        plan: planId,
        planName: String(planId).toLowerCase(),
        isActive: rec.isActive === true ? true : false,
        source: rec.source || "pending",
        pendingStripeSessionId: session.id,
        stripeCustomerId: customer.id,
        updatedAt: new Date().toISOString(),
      });
    } else {
      const apiKey = generateApiKey();
      const clientId = `pending_${session.id}`;

      upsertClientKey(apiKey, {
        clientId,
        name: name || (email.includes("@") ? email.split("@")[0] : "pending-client"),
        email,
        plan: planId,
        planName: String(planId).toLowerCase(),
        isActive: false,
        source: "pending",
        pendingStripeSessionId: session.id,
        stripeCustomerId: customer.id,
        createdAt: new Date().toISOString(),
      });

      // IMPORTANT: don't log apiKey in production
      console.log("🟡 PENDING CLIENT CREATED:", { email, clientId, plan: planId });
      console.log("🔑 PENDING API KEY:", apiKey);
    }




    return res.json({ ok: true, id: session.id, url: session.url });

  } catch (err) {
    console.error("❌ checkout-session error:", err.message);
    return res.status(500).json({ ok: false, error: "checkout-session failed" });
  }
});

// Success route (temporary simple response)
router.get("/success", (req, res) => {
  res.send("Payment successful. You can close this window.");
});

// Cancel route (temporary simple response)
router.get("/cancel", (req, res) => {
  res.send("Payment canceled.");
});

module.exports = router;

