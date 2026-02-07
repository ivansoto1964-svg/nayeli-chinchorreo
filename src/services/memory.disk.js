// Memoria por sessionId: RAM + persistencia en disco
const fs = require("fs");
const path = require("path");

// RAM caches
const sessions = new Map();
const summaries = new Map();

// Config
const MAX_MESSAGES = Number(process.env.MEMORY_MAX_MESSAGES || 10);

// 📌 Directorio base (local o Render)
const BASE_DATA_DIR = process.env.IVAMAR_DATA_DIR
  ? path.resolve(process.env.IVAMAR_DATA_DIR)
  : path.resolve(process.cwd(), "data");

const SESSIONS_DIR = path.join(BASE_DATA_DIR, "sessions");

// Asegurar que exista la carpeta
function ensureSessionsDir() {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Convierte sessionId en un nombre de archivo seguro
function safeSessionId(sessionId) {
  return String(sessionId || "default").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function sessionFilePath(sessionId) {
  ensureSessionsDir();
  return path.join(SESSIONS_DIR, `${safeSessionId(sessionId)}.json`);
}

// Cargar sesión desde disco si no está en RAM
function loadFromDisk(sessionId) {
  const sid = String(sessionId || "default");

  if (sessions.has(sid)) return;

  const file = sessionFilePath(sid);

  if (!fs.existsSync(file)) {
    sessions.set(sid, []);
    summaries.set(sid, "");
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    sessions.set(sid, data.history || []);
    summaries.set(sid, data.summary || "");
  } catch {
    sessions.set(sid, []);
    summaries.set(sid, "");
  }
}

function saveToDisk(sessionId) {
  const sid = String(sessionId || "default");

  const payload = {
    history: sessions.get(sid) || [],
    summary: summaries.get(sid) || "",
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(sessionFilePath(sid), JSON.stringify(payload, null, 2));
}

function getHistory(sessionId) {
  const sid = String(sessionId || "default");
  loadFromDisk(sid);
  return sessions.get(sid) || [];
}

function addMessage(sessionId, role, content) {
  const sid = String(sessionId || "default");
  loadFromDisk(sid);

  const history = sessions.get(sid) || [];
  history.push({ role, content });

  if (history.length > MAX_MESSAGES) {
    history.splice(0, history.length - MAX_MESSAGES);
  }

  sessions.set(sid, history);
  saveToDisk(sid);
}

function getSummary(sessionId) {
  const sid = String(sessionId || "default");
  loadFromDisk(sid);
  return summaries.get(sid) || "";
}

function setSummary(sessionId, summaryText) {
  const sid = String(sessionId || "default");
  loadFromDisk(sid);
  summaries.set(sid, String(summaryText || ""));
  saveToDisk(sid);
}

module.exports = {
  getHistory,
  addMessage,
  getSummary,
  setSummary,
};

