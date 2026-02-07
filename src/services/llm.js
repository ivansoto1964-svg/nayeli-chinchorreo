const OpenAIImport = require("openai");

// Compatibilidad por si el SDK exporta default
const OpenAI = OpenAIImport.default || OpenAIImport;

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no está definida en el archivo .env");
  }
  return new OpenAI({ apiKey });
}

/**
 * generateReply soporta DOS modos:
 * 1) Nuevo: { model, messages: [{role, content}, ...] }
 * 2) Viejo: { model, systemPrompt, userMessage }
 */
async function generateReply({ model, messages, systemPrompt, userMessage }) {
  const client = getClient();

  const inputMessages =
    Array.isArray(messages) && messages.length
      ? messages
      : [
          { role: "system", content: systemPrompt || "" },
          { role: "user", content: userMessage || "" }
        ];

  const response = await client.responses.create({
    model,
    input: inputMessages
  });

  return response.output_text || "";
}

/**
 * 🧠 NUEVO — resumir conversación
 * Recibe mensajes [{role, content}, ...]
 * Devuelve un resumen corto en texto
 */
async function summarizeConversation(messages) {
  const client = getClient();

  const prompt = [
    {
      role: "system",
      content:
        "Resume la siguiente conversación de forma breve, clara y factual. " +
        "Incluye solo hechos importantes, nombres, preferencias y contexto útil."
    },
    {
      role: "user",
      content: messages
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join("\n")
    }
  ];

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    input: prompt
  });

  return response.output_text || "";
}

module.exports = { generateReply, summarizeConversation };

