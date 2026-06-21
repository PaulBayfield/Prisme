export function getContrastTextColor(hex: string): string {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return "#ffffff";

  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16) / 255);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}
