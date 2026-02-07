// Memoria simple en RAM por sessionId
const sessions = new Map();
const summaries = new Map();

// Límite de mensajes por sesión (default 10)
const MAX_MESSAGES = Number(process.env.MEMORY_MAX_MESSAGES || 10);

function getHistory(sessionId) {
  const sid = String(sessionId || "default");

  if (!sessions.has(sid)) {
    sessions.set(sid, []);
  }

  return sessions.get(sid);
}

function addMessage(sessionId, role, content) {
  const history = getHistory(sessionId);

  history.push({ role, content });

  // Mantener solo los últimos MAX_MESSAGES
  if (history.length > MAX_MESSAGES) {
    history.splice(0, history.length - MAX_MESSAGES);
  }
}

// --- Summary (para ETAPA 6.2) ---
function getSummary(sessionId) {
  const sid = String(sessionId || "default");
  return summaries.get(sid) || "";
}

function setSummary(sessionId, summaryText) {
  const sid = String(sessionId || "default");
  summaries.set(sid, String(summaryText || ""));
}

module.exports = { getHistory, addMessage, getSummary, setSummary };

