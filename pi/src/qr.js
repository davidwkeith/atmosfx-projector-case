// Turn matter.js's text QR code (QrCode.get) into an SVG for the web page.
// The text packs two module rows per line with half blocks. Block characters are
// the LIGHT modules (it is drawn for dark terminals) around an uneven quiet zone.

const HALVES = { "█": [1, 1], "▀": [1, 0], "▄": [0, 1] };

/** The QR symbol as rows of booleans (true = dark), cropped to the symbol itself. */
export function qrTextToMatrix(text) {
  const light = [];
  for (const line of text.split("\n").filter((l) => l.trim().length)) {
    const halves = [...line].map((ch) => HALVES[ch] ?? [0, 0]);
    light.push(halves.map((h) => !!h[0]), halves.map((h) => !!h[1]));
  }
  // An odd row count leaves a half row with nothing drawn at the top or bottom.
  // The quiet zone is light, so an edge row with no light cells is padding.
  while (light.length && !light[0].some(Boolean)) light.shift();
  while (light.length && !light.at(-1).some(Boolean)) light.pop();
  // Crop to the bounding box of the dark modules; the SVG adds its own quiet zone.
  const dark = light.map((r) => r.map((v) => !v));
  const ys = dark.flatMap((r, y) => (r.some(Boolean) ? [y] : []));
  const xs = dark.flatMap((r) => r.flatMap((v, x) => (v ? [x] : [])));
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return dark.slice(y0, y1 + 1).map((r) => r.slice(x0, x1 + 1));
}

export function qrTextToSvg(text, quiet = 4) {
  const rows = qrTextToMatrix(text);
  const size = rows.length;
  let d = "";
  rows.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x} ${y}h1v1h-1z`)));
  const box = `${-quiet} ${-quiet} ${size + 2 * quiet} ${size + 2 * quiet}`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" shape-rendering="crispEdges">` +
    `<rect x="${-quiet}" y="${-quiet}" width="100%" height="100%" fill="#fff"/><path fill="#000" d="${d}"/></svg>`
  );
}
