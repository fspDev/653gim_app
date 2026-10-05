// Genera public/descanso.mp4: la cuenta regresiva de la ventana flotante del iPhone (Safari no deja poner en flotante un video
// dibujado en vivo, sí un archivo). Necesita ffmpeg. Uso: node scripts/video-descanso.mjs
//
// Línea de tiempo (1 cuadro por segundo, todos clave para poder saltar a cualquier segundo):
//   0 → 600 s   cuenta regresiva de 10:00 a 0:01 (en t muestra 600 - t)
//   600 → 605 s "¡VAMOS!" (terminó la cuenta)
//   605 → 610 s "A ENTRENAR" (sin cuenta regresiva, p. ej. durante la serie, el video queda quieto acá)
// Si se cambian estos números, actualizar IOS_* en src/pip/pipEngine.ts.
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const FONT = 'C\\:/Windows/Fonts/impact.ttf'
const LIME = '0xC6F135'
const filter = [
  // Cuenta regresiva.
  `drawtext=fontfile='${FONT}':fontsize=160:fontcolor=${LIME}:x=(w-tw)/2:y=(h-th)/2+8:enable='lt(t,600)':text='%{eif\\:floor((600-t)/60)\\:d}\\:%{eif\\:mod(600-t\\,60)\\:d\\:2}'`,
  // Fin del descanso.
  `drawtext=fontfile='${FONT}':fontsize=110:fontcolor=${LIME}:x=(w-tw)/2:y=(h-th)/2:enable='between(t,600,604.99)':text='¡VAMOS!'`,
  // Entre descansos.
  `drawtext=fontfile='${FONT}':fontsize=84:fontcolor=white:x=(w-tw)/2:y=(h-th)/2-10:enable='gte(t,605)':text='A ENTRENAR'`,
  `drawtext=fontfile='${FONT}':fontsize=26:fontcolor=white@0.6:x=(w-tw)/2:y=h-70:enable='gte(t,605)':text='Seguí en la app'`,
  // Marca.
  `drawtext=fontfile='${FONT}':fontsize=26:fontcolor=white:x=24:y=20:text='A'`,
  `drawtext=fontfile='${FONT}':fontsize=26:fontcolor=${LIME}:x=40:y=20:text='M'`,
].join(',')

const dir = mkdtempSync(join(tmpdir(), 'am-video-'))
const script = join(dir, 'filter.txt')
writeFileSync(script, filter)
try {
  execFileSync(
    'ffmpeg',
    ['-y', '-f', 'lavfi', '-i', 'color=c=0x121212:s=480x360:r=1:d=610', '-/vf', script, '-c:v', 'libx264', '-preset', 'veryslow', '-crf', '30', '-g', '1', '-pix_fmt', 'yuv420p', '-profile:v', 'baseline', '-movflags', '+faststart', '-an', 'public/descanso.mp4'],
    { stdio: 'inherit' },
  )
} finally {
  rmSync(dir, { recursive: true, force: true })
}
console.log('public/descanso.mp4 listo')
