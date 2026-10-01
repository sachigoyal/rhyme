import color from 'tinycolor2'

export async function generateGradient(username: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-1', new TextEncoder().encode(username)),
  )
  const hue = digest.reduce((sum, value) => sum + value, 0) % 360
  const base = color({ h: hue, s: 0.95, l: 0.5 })
  return {
    fromColor: base.toHexString(),
    toColor: base.triad()[1].toHexString(),
    digest,
  }
}

export async function generateAvatar(userId: string) {
  const { fromColor, toColor, digest } = await generateGradient(userId)
  const from = color.mix('#75648f', fromColor, 28).toHexString()
  const to = color.mix('#c4b6da', toColor, 24).toHexString()
  const pixels = Array.from({ length: 256 }, (_, i) => {
    const value =
      digest[i % digest.length]! ^
      digest[(i * 7 + Math.floor(i / 16)) % digest.length]!
    return `<rect x="${(i % 16) * 4}" y="${Math.floor(i / 16) * 4}" width="4" height="4" fill="${value % 2 ? '#fff' : '#241b35'}" opacity="${0.04 + (value % 5) * 0.025}"/>`
  }).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/>${pixels}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
