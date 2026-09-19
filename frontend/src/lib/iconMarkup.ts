import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { LucideIcon } from "lucide-react";

// Leaflet divIcons take an HTML string, so render the lucide icon to static SVG markup
export function iconMarkup(Icon: LucideIcon, size: number, color = "white"): string {
  return renderToStaticMarkup(createElement(Icon, { size, color, strokeWidth: 2.25 }));
}
