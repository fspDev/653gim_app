// Publica en GitHub Pages (rama gh-pages).
//   npm run deploy -- v2     → versión de prueba en /653gim_app/v2/ (la app publicada sigue igual)
//   npm run deploy -- prod   → reemplaza la app publicada en /653gim_app/
// Baja la rama publicada, cambia solo lo que corresponde y sube con un commit nuevo (sin --force).
import { execSync } from 'node:child_process'
import { copyFileSync, cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const target = process.argv[2]
if (target !== 'v2' && target !== 'prod') {
  console.error('Uso: npm run deploy -- v2 | prod')
  process.exit(1)
}

const base = target === 'prod' ? '/653gim_app/' : '/653gim_app/v2/'
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts })
const out = (cmd, opts = {}) => execSync(cmd, { encoding: 'utf8', ...opts }).trim()

run('npm run build', { env: { ...process.env, BASE: base } })

const remote = out('git remote get-url origin')
const tmp = mkdtempSync(join(tmpdir(), '653-pages-'))
run(`git clone --quiet --branch gh-pages --depth 1 "${remote}" "${tmp}"`)

if (target === 'prod') {
  // Fuera la app anterior (y la de prueba): queda solo la nueva en la raíz.
  for (const entry of readdirSync(tmp)) if (entry !== '.git') rmSync(join(tmp, entry), { recursive: true, force: true })
  cpSync('dist', tmp, { recursive: true })
  // GitHub Pages devuelve 404.html para las rutas de la app (/progreso, /panel…): es la misma app.
  copyFileSync('dist/index.html', join(tmp, '404.html'))
} else {
  rmSync(join(tmp, 'v2'), { recursive: true, force: true })
  cpSync('dist', join(tmp, 'v2'), { recursive: true })
  // El 404.html de la raíz es de la app publicada: no se toca (la de prueba se abre desde /v2/).
}
// Sin esto, GitHub Pages corre Jekyll y descarta las carpetas que empiezan con "_".
writeFileSync(join(tmp, '.nojekyll'), '')

const sha = out('git rev-parse --short HEAD')
run('git add -A', { cwd: tmp })
const changed = out('git status --porcelain', { cwd: tmp })
if (!changed) {
  console.log('Nada para publicar: ya estaba igual.')
} else {
  run(`git -c user.name="653 Deploy" -c user.email="deploy@653gym.local" commit --quiet -m "Publicar ${target} (${sha})"`, { cwd: tmp })
  run('git push --quiet origin gh-pages', { cwd: tmp })
  console.log(`Publicado: https://fspdev.github.io${base}`)
}
rmSync(tmp, { recursive: true, force: true })
