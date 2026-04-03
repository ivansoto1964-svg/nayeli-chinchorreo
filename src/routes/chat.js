const express = require("express");
const registry = require("../assistants/registry");
const { generateReply, summarizeConversation } = require("../services/llm");
const {
  getHistory,
  addMessage,
  getSummary,
  setSummary,
} = require("../services/memory.disk");

const { getClientByApiKey } = require("../services/clients");
const { searchPlacesByText } = require("../services/places.google");
const router = express.Router();
router.get("/debug/env", (req, res) => {
  res.json({
    hasClientsEnv: !!(process.env.IVAMAR_CLIENTS_JSON && process.env.IVAMAR_CLIENTS_JSON.trim()),
    hasOpenAIKey: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim()),
     dataDir: process.env.IVAMAR_DATA_DIR || null,
    nodeEnv: process.env.NODE_ENV || null,
  });
});




// --- Seguridad por Bearer token (API keys por cliente) ---

// --- Seguridad por API key (Bearer recomendado; x-api-key permitido) ---
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



// --- helper: timeout para promesas ---
function withTimeout(promise, ms, label = "Operation") {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      const err = new Error(`${label} timed out after ${ms}ms`);
      err.code = "TIMEOUT";
      reject(err);
    }, ms);

    promise
      .then((val) => {
        clearTimeout(t);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(t);
        reject(err);
      });
  });
}


// 🔒 DEBUG MEMORY — solo disponible en desarrollo
if (process.env.NODE_ENV !== "production") {
  router.get("/debug/memory", requireApiKey, (req, res) => {
    if (process.env.DEBUG_MEMORY !== "true") {
      return res.status(404).json({ error: "Not found" });
    }

    const sid =
      req.query.sessionId && String(req.query.sessionId).trim()
        ? String(req.query.sessionId).trim()
        : "default";

    const history = getHistory(sid) || [];
    const summary = getSummary(sid);

    return res.json({
      sessionId: sid,
      summary,
      historyCount: history.length,
      historyTail: history.slice(-6),
    });
  });
}




























// --- Chat endpoint ---
router.post("/chat", requireApiKey, async (req, res) => {
  const { assistantId, message, sessionId } = req.body || {};

  if (!assistantId || !message) {
    return res.status(400).json({
      error: "Debes enviar assistantId y message en el body (JSON)",
    });
  }

  const assistant = registry[assistantId];
  if (!assistant) {
    return res.status(404).json({
      error: `Assistant "${assistantId}" no existe`,
    });
  }

  const sid =
    sessionId && String(sessionId).trim()
      ? String(sessionId).trim()
      : `sid_${Date.now()}`;

  const TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 20000);
  const MAX_MESSAGES = Number(process.env.MEMORY_MAX_MESSAGES || 10);
  const KEEP_RECENT = Number(process.env.MEMORY_KEEP_RECENT || 4);

const history = getHistory(sid) || [];
const summary = getSummary(sid);

let inferredLocation = null;

for (let i = history.length - 1; i >= 0; i--) {
  const msg = history[i];
  if (msg.role === "user") {
    const text = String(msg.content || "");
    if (/estoy en|vivo en|ando por|estamos en|por /i.test(text)) {
      inferredLocation = text;
      break;
    }
  }
}

let placesContext = "";







if (isFoodQuery && inferredLocation) {
  try {
    const places = await searchPlacesByText(
      `Puerto Rican restaurant in ${inferredLocation}`
    );

    if (places.length) {
      const topPlaces = places.slice(0, 5);

      const formatted = topPlaces.map((p, idx) => {
        const name = p.displayName?.text || "Lugar";
        const addr = p.formattedAddress || "Dirección no disponible";
        const rating = p.rating ? `⭐ ${p.rating}` : "Sin rating";
        const maps = p.googleMapsUri ? `\nMapa: ${p.googleMapsUri}` : "";
        const web = p.websiteUri ? `\nWeb: ${p.websiteUri}` : "";

        return `${idx + 1}. ${name}
📍 ${addr}
${rating}${maps}${web}`;
      });

      const directReply = `¡Wepa! Si estás en ${inferredLocation}, aquí tienes algunos spots reales que encontré para comer boricua:\n\n${formatted.join("\n\n")}\n\nConsejito de Nayeli: verifica horario y menú antes de salir, pa’ evitar corajes.`;

      addMessage(sid, "user", String(message));
      addMessage(sid, "assistant", directReply);

      return res.json({
        reply: directReply,
        sessionId: sid,
      });
    }
  } catch (e) {
    console.error("PLACES_ERROR:", e.message);
  }
}


































const messages = [
  { role: "system", content: assistant.systemPrompt || "" },
  ...(inferredLocation
    ? [{ role: "system", content: `User location context: ${inferredLocation}` }]
    : []),
  ...(placesContext
    ? [{
        role: "system",
        content: `${placesContext}\n\nUsa estos lugares reales si el usuario pide recomendaciones. No inventes negocios.`
      }]
    : []),
  ...(summary
    ? [{ role: "system", content: `Conversation summary: ${summary}` }]
    : []),
  ...history,
  { role: "user", content: String(message) },
];

  addMessage(sid, "user", String(message));

  try {
    const reply = await withTimeout(
      generateReply({
        model: assistant.model || "gpt-4o-mini",
        messages,
      }),
      TIMEOUT_MS,
      "OpenAI"
    );

    addMessage(sid, "assistant", reply);

    const liveHistory = getHistory(sid) || [];
    if (liveHistory.length >= MAX_MESSAGES) {
      const existing = getSummary(sid);

      const summaryInput = [
        ...(existing
          ? [{ role: "system", content: `Existing summary: ${existing}` }]
          : []),
        ...liveHistory,
      ];

      try {
        const newSummary = await withTimeout(
          summarizeConversation(summaryInput),
          TIMEOUT_MS,
          "Summarizer"
        );

        if (newSummary && String(newSummary).trim()) {
          setSummary(sid, String(newSummary).trim());
        }

        if (liveHistory.length > KEEP_RECENT) {
          liveHistory.splice(0, liveHistory.length - KEEP_RECENT);
        }
      } catch (e) {}
    }

    return res.json({ reply, sessionId: sid });
  } catch (err) {
console.error("OPENAI_ERROR:", err?.message || err);
    
const fallback = assistant.reply
      ? assistant.reply(String(message))
      : "Servicio temporalmente no disponible.";

    addMessage(sid, "assistant", fallback);

    return res.status(200).json({
      reply: fallback,
      sessionId: sid,
      warning: "OpenAI failed or timeout",
    });
  }
});


// --- Blog chat público (sin exponer API key en Blogger) ---
router.post("/blog-chat", async (req, res) => {
  const { message, sessionId } = req.body || {};

  const rawMessage = String(message || "").trim().toLowerCase();
  const isFoodQuery =
    rawMessage.includes("comer") ||
    rawMessage.includes("restaurant") ||
    rawMessage.includes("restaurante") ||
    rawMessage.includes("chinchorro") ||
    rawMessage.includes("food truck") ||
    rawMessage.includes("mofongo") ||
    rawMessage.includes("alcapurria") ||
    rawMessage.includes("bacalaíto") ||
    rawMessage.includes("boricua");

  if (!message) {
    return res.status(400).json({
      error: "Debes enviar message en el body (JSON)",
    });
  }

  const assistant = registry["nayeli"];
  if (!assistant) {
    return res.status(404).json({
      error: 'Assistant "nayeli" no existe',
    });
  }

  const sid =
    sessionId && String(sessionId).trim()
      ? String(sessionId).trim()
      : `sid_${Date.now()}`;

  const TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 20000);
  const MAX_MESSAGES = Number(process.env.MEMORY_MAX_MESSAGES || 10);
  const KEEP_RECENT = Number(process.env.MEMORY_KEEP_RECENT || 4);

  const history = getHistory(sid) || [];
  const summary = getSummary(sid);

  let inferredLocation = null;

  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === "user") {
      const text = String(msg.content || "");
      if (/estoy en|vivo en|ando por|estamos en|por /i.test(text)) {
        inferredLocation = text;
        break;
      }
    }
  }

  let placesContext = "";

  if (isFoodQuery && inferredLocation) {
    try {
      const places = await searchPlacesByText(
        `Puerto Rican restaurant in ${inferredLocation}`
      );

      if (places.length) {
        const top = places.slice(0, 5).map((p, idx) => {
          const name = p.displayName?.text || "Lugar";
          const addr = p.formattedAddress || "Dirección no disponible";
          const rating = p.rating ? `⭐ ${p.rating}` : "Sin rating";
          return `${idx + 1}. ${name} — ${addr} — ${rating}`;
        });

        placesContext =
          `Lugares reales encontrados cerca del usuario:\n${top.join("\n")}`;
      }
    } catch (e) {
      console.error("PLACES_ERROR:", e.message);
    }
  }

  const messages = [
    { role: "system", content: assistant.systemPrompt || "" },
    ...(inferredLocation
      ? [{ role: "system", content: `User location context: ${inferredLocation}` }]
      : []),
    ...(placesContext
      ? [{
          role: "system",
          content: `${placesContext}\n\nUsa estos lugares reales si el usuario pide recomendaciones. No inventes negocios.`
        }]
      : []),
    ...(summary
      ? [{ role: "system", content: `Conversation summary: ${summary}` }]
      : []),
    ...history,
    { role: "user", content: String(message) },
  ];

  addMessage(sid, "user", String(message));

  try {
    const reply = await withTimeout(
      generateReply({
        model: assistant.model || "gpt-4o-mini",
        messages,
      }),
      TIMEOUT_MS,
      "OpenAI"
    );

    addMessage(sid, "assistant", reply);

    const liveHistory = getHistory(sid) || [];
    if (liveHistory.length >= MAX_MESSAGES) {
      const existing = getSummary(sid);

      const summaryInput = [
        ...(existing
          ? [{ role: "system", content: `Existing summary: ${existing}` }]
          : []),
        ...liveHistory,
      ];

      try {
        const newSummary = await withTimeout(
          summarizeConversation(summaryInput),
          TIMEOUT_MS,
          "Summarizer"
        );

        if (newSummary && String(newSummary).trim()) {
          setSummary(sid, String(newSummary).trim());
        }

        if (liveHistory.length > KEEP_RECENT) {
          liveHistory.splice(0, liveHistory.length - KEEP_RECENT);
        }
      } catch (e) {}
    }

    return res.json({ reply, sessionId: sid });
  } catch (err) {
    console.error("OPENAI_ERROR:", err?.message || err);

    const fallback = assistant.reply
      ? assistant.reply(String(message))
      : "Servicio temporalmente no disponible.";

    addMessage(sid, "assistant", fallback);

    return res.status(200).json({
      reply: fallback,
      sessionId: sid,
      warning: "OpenAI failed or timeout",
    });
  }
});













module.exports = router;

