/** 90 -> "1:30" */
export function fmtTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const sec = s % 60
  return `${Math.floor(s / 60)}:${sec < 10 ? '0' : ''}${sec}`
}

/** 42.5 -> "42,5" */
export function fmtKg(kg: number): string {
  return kg.toLocaleString('es-AR', { maximumFractionDigits: 1 })
}
