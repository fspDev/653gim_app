import { describe, expect, it } from 'vitest'
import { youtubeId, youtubeLink } from './youtube'

describe('links de YouTube', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('%s', (url, id) => {
    expect(youtubeId(url)).toBe(id)
  })

  it('descarta lo que no es un video de YouTube', () => {
    expect(youtubeId('https://vimeo.com/123')).toBeNull()
    expect(youtubeId('hola')).toBeNull()
    expect(youtubeId('')).toBeNull()
    expect(youtubeId('https://www.youtube.com/watch?v=corto')).toBeNull()
  })

  it('normaliza el link', () => {
    expect(youtubeLink('youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })
})
