/**
 * Tamaño de fuente para que un texto en mayúsculas de una sola línea entre en el ancho útil.
 * Barlow Condensed 800 mide ≈ 0,48 em por letra; el ancho útil es ≈ 88 % del contenedor.
 */
export function fitFont(text: string, maxPx: number): string {
  return `min(${maxPx}px, ${(183 / Math.max(text.length, 1)).toFixed(2)}cqw)`
}
