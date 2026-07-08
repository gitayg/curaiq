import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

// Dependency-free PNG writer — a dark tile with an accent "shield" diamond (RAISEME mark).
const S = 1024;
const bg = [14, 17, 22, 255];
const accent = [76, 141, 255, 255];
const light = [230, 237, 243, 255];

const px = Buffer.alloc(S * (S * 4 + 1));
let o = 0;
for (let y = 0; y < S; y++) {
  px[o++] = 0;
  for (let x = 0; x < S; x++) {
    const d = Math.abs(x - S / 2) + Math.abs(y - S / 2);
    let c = bg;
    if (d < 380) c = accent;
    if (d < 360 && d > 300) c = light;
    px[o++] = c[0]; px[o++] = c[1]; px[o++] = c[2]; px[o++] = c[3];
  }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
ihdr[8] = 8; ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(px)),
  chunk("IEND", Buffer.alloc(0))
]);

writeFileSync("scripts/icon-source.png", png);
console.log("wrote scripts/icon-source.png", png.length, "bytes");
