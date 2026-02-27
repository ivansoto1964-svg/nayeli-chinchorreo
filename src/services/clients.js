// Servicio de clientes (API keys por cliente) – CLOUD READY
const fs = require("fs");
const path = require("path");

// 📁 Directorio base para datos (local vs producción)
const DATA_DIR = process.env.IVAMAR_DATA_DIR
  ? path.resolve(process.env.IVAMAR_DATA_DIR)
  : path.resolve(process.cwd(), "data");

// 📄 Archivo de clientes
const CLIENTS_FILE = path.join(DATA_DIR, "clients.json");

// Cache en memoria
let clientsCache = null;
let lastLoadedAt = 0;
const CACHE_TTL_MS = 10_000; // 10 segundos

function loadClientsFromDisk() {
// ✅ Producción sin archivo: permitir clients desde ENV
if (process.env.IVAMAR_CLIENTS_JSON && process.env.IVAMAR_CLIENTS_JSON.trim()) {
  try {
    const db = JSON.parse(process.env.IVAMAR_CLIENTS_JSON);
    if (!db.keys) throw new Error("clients env inválido: falta 'keys'");
    return db;
  } catch (e) {
    throw new Error("IVAMAR_CLIENTS_JSON inválido (JSON mal formado)");
  }
}







  if (!fs.existsSync(CLIENTS_FILE)) {
    throw new Error(`clients.json no existe en ${CLIENTS_FILE}`);
  }

  const raw = fs.readFileSync(CLIENTS_FILE, "utf8");
  const data = JSON.parse(raw);

  if (!data || typeof data !== "object" || !data.keys) {
    throw new Error("clients.json inválido: falta 'keys'");
  }

  clientsCache = data.keys;
  lastLoadedAt = Date.now();
}

function getClients() {
  const now = Date.now();
  if (!clientsCache || now - lastLoadedAt > CACHE_TTL_MS) {
    loadClientsFromDisk();
  }
  return clientsCache;
}

function getClientByApiKey(apiKey) {
  if (!apiKey) return null;
  const clients = getClients();
  const client = clients[apiKey];
  return client || null;
}

module.exports = {
  getClientByApiKey,
};

