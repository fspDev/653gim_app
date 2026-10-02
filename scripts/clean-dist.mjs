// Vacía dist/ antes de cada build.
// fs.rmSync (y por eso también `emptyOutDir` de Vite) no borra nada en Node 24 / Windows cuando la ruta
// tiene caracteres no ASCII ("Juego Natán"): devuelve sin error y deja los archivos viejos, que el
// service worker después cachea. Se borra a mano con unlinkSync / rmdirSync, que sí funcionan.
import { existsSync, lstatSync, readdirSync, rmdirSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

function remove(path) {
  if (lstatSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) remove(join(path, entry))
    rmdirSync(path)
  } else {
    unlinkSync(path)
  }
}

if (existsSync('dist')) remove('dist')
if (existsSync('dist')) {
  console.error('No se pudo vaciar dist/')
  process.exit(1)
}
