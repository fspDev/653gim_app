/** Id del video en cualquier link de YouTube (watch, youtu.be, shorts, embed, m.youtube); `null` si no es de YouTube. */
export function youtubeId(url: string): string | null {
  const t = url.trim()
  if (!t) return null
  let u: URL
  try {
    u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '')
  const ok = (id: string | null | undefined) => (id && /^[\w-]{11}$/.test(id) ? id : null)
  if (host === 'youtu.be') return ok(u.pathname.slice(1).split('/')[0])
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (u.pathname === '/watch') return ok(u.searchParams.get('v'))
    const m = /^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname)
    return ok(m?.[2])
  }
  return null
}

/** Link normalizado para abrir (en el teléfono abre la app de YouTube). */
export function youtubeLink(url: string): string | null {
  const id = youtubeId(url)
  return id ? `https://www.youtube.com/watch?v=${id}` : null
}

export const youtubeThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
