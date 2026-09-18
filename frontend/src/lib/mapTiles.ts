// Esri's World Gray Canvas basemap tiles — free, no API key or account
// required. Ever. Replaces the previous CARTO setup, which needed a
// per-account API key that kept getting rejected (Carto returns HTTP 200
// with a watermarked "API KEY REQUIRED" tile instead of an error when the
// key isn't authorized, which made that failure mode hard to detect).
//
// This basemap ships as two stacked raster layers: a shapes/fill "Base"
// layer and a "Reference" layer with labels/roads on top — render both
// TileLayers together (base first, reference second) to get the same look
// CARTO's single "light_all"/"dark_all" tiles gave.
export function grayCanvasBaseUrl(variant: "light" | "dark"): string {
  const layer = variant === "dark" ? "World_Dark_Gray_Base" : "World_Light_Gray_Base";
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${layer}/MapServer/tile/{z}/{y}/{x}`;
}

export function grayCanvasReferenceUrl(variant: "light" | "dark"): string {
  const layer = variant === "dark" ? "World_Dark_Gray_Reference" : "World_Light_Gray_Reference";
  return `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/${layer}/MapServer/tile/{z}/{y}/{x}`;
}

// Esri's Gray Canvas tiles only exist up to zoom 16 — pass this as
// maxZoom on the base TileLayer (Leaflet upscales beyond it if needed).
export const GRAY_CANVAS_MAX_ZOOM = 16;

export const GRAY_CANVAS_ATTRIBUTION =
  '&copy; <a href="https://www.esri.com/">Esri</a> — Esri, HERE, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors, GIS User Community';
