require("dotenv").config();
const { searchPlacesByText } = require("./src/services/places.google");

async function main() {
  try {
    const places = await searchPlacesByText("Puerto Rican restaurant in Orlando, Florida");
    console.log(JSON.stringify(places, null, 2));
  } catch (err) {
    console.error("TEST_PLACES_ERROR:", err.message);
  }
}

main();
