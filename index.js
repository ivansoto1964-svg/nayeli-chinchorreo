const express = require("express");
const axios = require("axios");

const app = express();
const PORT = 3000;
const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Ruta base
app.get("/", (req, res) => {
  res.send("🌺 Nayeli está viva y escuchando 🌺");
});

// Ruta buscar con Google Places
app.get("/buscar", async (req, res) => {
  const { ciudad, pais } = req.query;

  if (!ciudad || !pais) {
    return res.status(400).json({
      error: "Debes enviar ciudad y pais"
    });
  }

  // Decidir keywords según país
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

    const lugares = response.data.results.map(lugar => ({
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
