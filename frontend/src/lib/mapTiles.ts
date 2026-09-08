// CARTO's anonymous basemap tiles now require an API key (free tier —
// sign up at carto.com, no credit card needed) or they serve a tile
// watermarked "API KEY REQUIRED" instead of failing outright.
// Set NEXT_PUBLIC_CARTO_API_KEY to enable; falls back to the unauthenticated
// (watermarked) URL if unset so local dev without a key still renders a map.
export function cartoTileUrl(style: "light_all" | "dark_all"): string {
  const base = `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`;
  const apiKey = process.env.NEXT_PUBLIC_CARTO_API_KEY;
  return apiKey ? `${base}?api_key=${apiKey}` : base;
}
