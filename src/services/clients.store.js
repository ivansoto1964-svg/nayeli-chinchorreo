const fs = require("fs");
const path = require("path");

function getDataDir() {
  return process.env.IVAMAR_DATA_DIR
    ? path.resolve(process.env.IVAMAR_DATA_DIR)
    : path.resolve(process.cwd(), "data");
}

function getClientsFilePath() {
  const DATA_DIR = getDataDir();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  return path.join(DATA_DIR, "clients.json");
}

function readClientsFile() {
  const file = getClientsFilePath();
  if (!fs.existsSync(file)) return { keys: {} };
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return { keys: {} };
  }
}

function writeClientsFile(payload) {
  const file = getClientsFilePath();
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
}

function upsertClientKey(apiKey, clientObj) {
  const db = readClientsFile();
  db.keys = db.keys || {};
  db.keys[apiKey] = clientObj;
  writeClientsFile(db);
  return db.keys[apiKey];
}

function setClientActive(apiKey, isActive) {
  const db = readClientsFile();
  if (!db.keys || !db.keys[apiKey]) return null;
  db.keys[apiKey].isActive = !!isActive;
  writeClientsFile(db);
  return db.keys[apiKey];
}

module.exports = {
  readClientsFile,
  writeClientsFile,
  upsertClientKey,
  setClientActive,
};

