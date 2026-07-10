// Genera public/pwa-192x192.png y public/pwa-512x512.png (placeholder de marca:
// "U" blanca sobre rojo UDP) sin dependencias. Ejecutar: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const BG = [0x9d, 0x22, 0x35, 255]
const FG = [255, 255, 255, 255]

function crc32(buf) {
  let c
  const table = []
  for (let n = 0; n < 256; n++) {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function makePng(size) {
  // "U" en bloques, proporciones relativas al lienzo
  const u = (v) => Math.round(v * size)
  const inU = (x, y) => {
    const leftBar = x >= u(0.28) && x <= u(0.4) && y >= u(0.26) && y <= u(0.62)
    const rightBar = x >= u(0.6) && x <= u(0.72) && y >= u(0.26) && y <= u(0.62)
    const bottom = x >= u(0.28) && x <= u(0.72) && y >= u(0.62) && y <= u(0.74)
    return leftBar || rightBar || bottom
  }

  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1)
    raw[rowStart] = 0 // filtro none
    for (let x = 0; x < size; x++) {
      const px = inU(x, y) ? FG : BG
      raw.set(px, rowStart + 1 + x * 4)
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(`public/pwa-${size}x${size}.png`, makePng(size))
  console.log(`public/pwa-${size}x${size}.png ✓`)
}
