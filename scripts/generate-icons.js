const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function inRoundedRect(px, py, x, y, w, h, r) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function backgroundColor(px, py, size) {
  const t = Math.min(1, Math.max(0, (px / size) * 0.55 + (py / size) * 0.45));
  return [
    lerp(52, 4, t),
    lerp(211, 120, t),
    lerp(153, 87, t),
  ];
}

function drawIcon(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4);
  const ss = 4;
  const inset = maskable ? 0 : size * 0.015;
  const radius = maskable ? 0 : size * 0.22;
  const inner = maskable ? size * 0.14 : 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < ss; sy += 1) {
        for (let sx = 0; sx < ss; sx += 1) {
          const px = x + (sx + 0.5) / ss;
          const py = y + (sy + 0.5) / ss;

          const inBackground = maskable
            ? true
            : inRoundedRect(px, py, inset, inset, size - inset * 2, size - inset * 2, radius);
          if (!inBackground) continue;

          let color = backgroundColor(px, py, size);
          let alpha = 255;

          const scale = (value) => inner + value * (size - inner * 2);
          const roof = inTriangle(
            px, py,
            scale(0.5), scale(0.2),
            scale(0.12), scale(0.52),
            scale(0.88), scale(0.52)
          );
          const body = inRoundedRect(
            px, py,
            scale(0.24), scale(0.48),
            scale(0.52), scale(0.34),
            size * 0.025
          );
          const door = inRoundedRect(
            px, py,
            scale(0.43), scale(0.6),
            scale(0.14), scale(0.22),
            size * 0.015
          );

          if (roof || body) {
            color = [255, 255, 255];
            alpha = 255;
          }
          if (door) {
            color = [4, 120, 87];
            alpha = 255;
          }

          r += color[0] * (alpha / 255);
          g += color[1] * (alpha / 255);
          b += color[2] * (alpha / 255);
          a += alpha;
        }
      }

      const samples = ss * ss;
      const index = (y * size + x) * 4;
      const alpha = a / samples;
      if (alpha <= 0) {
        rgba[index] = 0;
        rgba[index + 1] = 0;
        rgba[index + 2] = 0;
        rgba[index + 3] = 0;
      } else {
        const alphaFactor = a / 255;
        rgba[index] = Math.round(r / alphaFactor);
        rgba[index + 1] = Math.round(g / alphaFactor);
        rgba[index + 2] = Math.round(b / alphaFactor);
        rgba[index + 3] = Math.round(alpha);
      }
    }
  }

  return encodePng(size, size, rgba);
}

const targets = [
  { name: 'icon-192.png', size: 192, maskable: false },
  { name: 'icon-512.png', size: 512, maskable: false },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
];

for (const target of targets) {
  const png = drawIcon(target.size, { maskable: target.maskable });
  fs.writeFileSync(path.join(outDir, target.name), png);
  console.log(`Generated ${target.name} (${png.length} bytes)`);
}
