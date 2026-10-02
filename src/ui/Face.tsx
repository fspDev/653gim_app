/** Las 5 caras de esfuerzo / sensación (SVG propios, no emojis del sistema). 0 = mejor, 4 = peor. */
const DOTS = 'M11.5 12.8v.4M20.5 12.8v.4'
const FACES = [
  { eyes: DOTS, mouth: 'M10 18.5c1.6 3 3.6 4.5 6 4.5s4.4-1.5 6-4.5' },
  { eyes: DOTS, mouth: 'M11 19.5c1.5 1.6 3.2 2.4 5 2.4s3.5-.8 5-2.4' },
  { eyes: DOTS, mouth: 'M11 20.5h10' },
  { eyes: DOTS, mouth: 'M11 22.5c1.5-1.6 3.2-2.4 5-2.4s3.5.8 5 2.4' },
  { eyes: 'M9.5 11.5l3 1.8M22.5 11.5l-3 1.8', mouth: 'M10 21.5c1-1 2-1 3 0s2 1 3 0 2-1 3 0 2 1 3 0' },
]


export function Face({ level, size = 34 }: { level: number; size?: number }) {
  const f = FACES[level]
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="16" cy="16" r="13" />
      <path d={f.eyes} />
      <path d={f.mouth} />
    </svg>
  )
}
