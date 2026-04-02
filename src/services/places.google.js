const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

async function searchPlacesByText(query) {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("Missing GOOGLE_PLACES_API_KEY");
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": [
        "places.displayName",
        "places.formattedAddress",
        "places.rating",
        "places.userRatingCount",
        "places.googleMapsUri",
        "places.websiteUri"
      ].join(",")
    },
    body: JSON.stringify({
      textQuery: query,
      maxResultCount: 5
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Places error ${res.status}: ${text}`);
  }

  const data = await res.json();
  return data.places || [];
}

module.exports = {
  searchPlacesByText,
};
