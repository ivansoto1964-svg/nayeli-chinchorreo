const express = require("express");
const axios = require("axios");

// importar asistente Nayeli
const nayeliReply = require("./assistants/nayeli");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Ruta base
app.get("/", (req, res) => {
  res.send("🌺 Nayeli está viva y escuchando 🌺");
});

// Ivamar.AI – endpoint único (multi-assistant)
app.post("/api/chat", (req, res) => {
  const { assistant, message } = req.body;

  if (!assistant || !message) {
    return res.status(400).json({
      error: "Debes enviar assistant y message en el body (JSON)"
    });
  }

  // Selector de asistente
  if (assistant === "nayeli") {
    const reply = nayeliReply(message);
    return res.json({
      ok: true,
      assistant,
      reply
    });
  }

  return res.status(404).json({
    error: `Assistant "${assistant}" no existe`
  });
});

// Ruta buscar con Google Places
app.get("/buscar", async (req, res) => {
  const { ciudad, pais } = req.query;

  if (!ciudad || !pais) {
    return res.status(400).json({
      error: "Debes enviar ciudad y pais"
    });
  }

  let keyword;
  if (pais.toUpperCase() === "PR") {
    keyword = "chinchorro comida criolla";
  } else {
    keyword = "puerto rican food";
  }

  try {
    const url = "https://maps.googleapis.com/maps/api/place/textsearch/json";

    const response = await axios.get(url, {
      params: {
        query: `${keyword} en ${ciudad}`,
        key: API_KEY
      }
    });

    const lugares = (response.data.results || []).map((lugar) => ({
      nombre: lugar.name,
      rating: lugar.rating || null,
      direccion: lugar.formatted_address
    }));

    res.json({
      contexto: pais.toUpperCase() === "PR" ? "Puerto Rico" : "Estados Unidos",
      ciudad,
      resultados: lugares
    });
  } catch (error) {
    res.status(500).json({
      error: "Error llamando a Google Places",
      detalle: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Nayeli escuchando en http://localhost:${PORT}`);
});
