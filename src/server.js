require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const chatRoutes = require("./routes/chat");
const { logger } = require("./middleware/logger");
const { apiLimiter } = require("./middleware/rateLimit");

const app = express();
app.set("trust proxy", 1);
// ------------------------------
// ✅ Bootstrap (PROD): clients.json en disco persistente
// ------------------------------
function bootstrapClientsFile() {
  // DATA_DIR: local -> ./data | prod -> /var/data (Render Disk)
  const DATA_DIR = process.env.IVAMAR_DATA_DIR
    ? path.resolve(process.env.IVAMAR_DATA_DIR)
    : path.resolve(process.cwd(), "data");

  const clientsFile = path.join(DATA_DIR, "clients.json");

  // Crear carpeta si no existe
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // Si existe, no hacemos nada
if (fs.existsSync(clientsFile)) {
  // Si ya existe, solo lo reemplazamos si es placeholder o si falta la key que viene en env
  try {
    const current = JSON.parse(fs.readFileSync(clientsFile, "utf8"));
    const hasPlaceholder = current?.keys && current.keys["__PLACEHOLDER__"];

    // Si hay JSON real en env, lo intentamos parsear para verificar si hay keys
    const rawEnv = process.env.IVAMAR_CLIENTS_JSON;
    if (rawEnv && String(rawEnv).trim()) {
      const envParsed = JSON.parse(String(rawEnv));
      const envKeys = envParsed?.keys ? Object.keys(envParsed.keys) : [];

      // Si el archivo actual es placeholder, o no contiene alguna key del env, lo reescribimos
      const missingAnyEnvKey =
        envKeys.length > 0 &&
        (!current?.keys || envKeys.some((k) => !current.keys[k]));

      if (!hasPlaceholder && !missingAnyEnvKey) return;
      // si es placeholder o faltan keys, seguimos para reescribir abajo
    } else {
      // si NO hay env JSON, y NO es placeholder, no tocamos nada
      if (!hasPlaceholder) return;
      // si es placeholder y no hay env, lo dejamos (no podemos inventar keys)
      return;
    }
  } catch (e) {
    // si está corrupto, seguimos para regenerarlo con env o fallback
  }
}


  // Fuente: variable de entorno (JSON string)
  // En Render la vas a setear como Secret: IVAMAR_CLIENTS_JSON
  const raw = process.env.IVAMAR_CLIENTS_JSON;

  // Si no hay variable, creamos un placeholder inactivo (para que no crashee)
  // OJO: sin keys activas => todo dará 401 hasta que configures el JSON real.
  const fallback = {
    keys: {
      "__PLACEHOLDER__": {
        clientId: "placeholder",
        name: "Placeholder (set IVAMAR_CLIENTS_JSON)",
        isActive: false,
        plan: "none",
        rateLimit: { windowMs: 60000, max: 10 },
      },
    },
  };

  let payload = fallback;

  if (raw && String(raw).trim()) {
    try {
      const parsed = JSON.parse(String(raw));
      if (parsed && typeof parsed === "object" && parsed.keys) {
        payload = parsed;
      }
    } catch (e) {
      // si el JSON viene malo, usamos fallback
      payload = fallback;
    }
  }

  try {
    fs.writeFileSync(clientsFile, JSON.stringify(payload, null, 2), "utf8");
    console.log("✅ Bootstrapped clients.json at:", clientsFile);
  } catch (e) {
    console.error("❌ Failed to bootstrap clients.json:", e.message);
  }
}

// Ejecutar bootstrap ANTES de rutas
bootstrapClientsFile();

// ------------------------------
// Middlewares
// ------------------------------

// Parsers
app.use(express.json());

// Logger middleware (requests)
app.use(logger);

const PORT = process.env.PORT || 3000;

// Health check (SIN rate limit)
app.get("/", (req, res) => {
  res.json({ ok: true, name: "ivamar-api", version: "v1" });
});

// ✅ v1 ping (liviano) para probar rate limit sin OpenAI
app.get("/v1/ping", apiLimiter, (req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// API v1 (CON rate limit)
app.use("/v1", apiLimiter, chatRoutes);

// Start server
const server = app.listen(PORT, () => {
  console.log(`Ivamar API escuchando en http://localhost:${PORT}`);
});

// Shutdown clean (Ctrl+C / stop)
process.on("SIGINT", () => {
  console.log("🟠 SIGINT (Ctrl+C)");
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  console.log("🟠 SIGTERM");
  server.close(() => process.exit(0));
});

