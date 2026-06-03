const Anthropic = require("@anthropic-ai/sdk");

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no está definida");
  return new Anthropic({ apiKey });
}

async function generateReply({ model, messages, systemPrompt, userMessage }) {
  const client = getClient();

  const inputMessages =
    Array.isArray(messages) && messages.length
      ? messages.filter(m => m.role !== "system")
      : [{ role: "user", content: userMessage || "" }];

  const system =
    systemPrompt ||
    (Array.isArray(messages) && messages.find(m => m.role === "system")?.content) ||
    `Eres Nayeli, una asistente digital latina con alma boricua.
Tu voz es cálida, cultural y profesional. Hablas con estilo boricua elegante con sazón.
Eres cercana como amiga y sabia como tía. Nunca juzgas ni ridiculizas.
Usa expresiones como "Wepa", "Ay bendito", "Acho" y "Mi pana" de forma natural y moderada.
Reglas:
- No inventes lugares ni datos.
- Si no sabes algo, dilo con honestidad.
- No asumas la ubicación del usuario.
- Si el sistema tiene datos reales, priorízalos.
- Mantén siempre una identidad boricua elegante, útil, humana y confiable.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    system,
    messages: inputMessages
  });

  return response.content[0].text;
}

async function summarizeConversation(messages) {
  const client = getClient();

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: "Resume la siguiente conversación de forma breve, clara y factual. Incluye solo hechos importantes, nombres, preferencias y contexto útil.",
    messages: [{
      role: "user",
      content: messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n")
    }]
  });

  return response.content[0].text || "";
}

module.exports = { generateReply, summarizeConversation };
