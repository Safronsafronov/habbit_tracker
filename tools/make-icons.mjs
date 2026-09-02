// Dependency-free PNG icon generator. Draws an --accent rounded square with a
// 5×5 white dot grid. Run: node tools/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function draw(size, { bleed }) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = [0x4f, 0x46, 0xe5];
  const radius = bleed ? 0 : size * 0.18;
  const grid = 5;
  const margin = size * 0.22;
  const span = size - margin * 2;
  const step = span / (grid - 1);
  const dotR = size * 0.055;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const cornerOut = radius > 0 && (
        (x < radius && y < radius && Math.hypot(radius - x, radius - y) > radius) ||
        (x > size - radius && y < radius && Math.hypot(x - (size - radius), radius - y) > radius) ||
        (x < radius && y > size - radius && Math.hypot(radius - x, y - (size - radius)) > radius) ||
        (x > size - radius && y > size - radius && Math.hypot(x - (size - radius), y - (size - radius)) > radius)
      );
      if (cornerOut) { buf[i + 3] = 0; continue; }
      buf[i] = bg[0]; buf[i + 1] = bg[1]; buf[i + 2] = bg[2]; buf[i + 3] = 255;
      for (let gy = 0; gy < grid; gy++) {
        for (let gx = 0; gx < grid; gx++) {
          if (Math.hypot(x - (margin + gx * step), y - (margin + gy * step)) <= dotR) {
            buf[i] = 255; buf[i + 1] = 255; buf[i + 2] = 255; buf[i + 3] = 255;
          }
        }
      }
    }
  }
  return buf;
}

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', png(192, draw(192, { bleed: false })));
writeFileSync('icons/icon-512.png', png(512, draw(512, { bleed: false })));
writeFileSync('icons/icon-maskable-512.png', png(512, draw(512, { bleed: true })));
writeFileSync('icons/apple-touch-icon.png', png(180, draw(180, { bleed: true })));
console.log('icons written');
