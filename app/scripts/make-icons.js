// Draws the app icon (Pulse Runner's cube jumping a spike, as 16x16 pixel art) and writes every size needed:
// the Android launcher icons, and the web app icons in ../icons for adding to an iPhone or Android home screen.
// No image libraries: it writes the PNG files itself with Node's zlib.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ART = [
  '................',
  '................',
  '................',
  '................',
  '...CCCCCC.......',
  '...CCCCCC.......',
  '...CNCCNC...M...',
  '...CNCCNC..MMM..',
  '...CCCCCC.MMMMM.',
  '...CCCCCC.MMMMM.',
  'GGGGGGGGGGGGGGGG',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const COLORS = { C: [0x7f, 0xd7, 0xff], N: [0x0b, 0x0b, 0x1a], M: [0xff, 0x7b, 0xd6], G: [0x44, 0x44, 0x7a] };
const BG = [0x0b, 0x0b, 0x1a];

// size: image size in px. pad: fraction of the image left empty around the art. bg: fill the background or leave it clear.
function render(size, pad, bg) {
  const px = Buffer.alloc(size * size * 4);
  const inner = size * (1 - pad * 2), cell = inner / 16, off = size * pad;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const ax = Math.floor((x - off) / cell), ay = Math.floor((y - off) / cell);
    const k = ax >= 0 && ax < 16 && ay >= 0 && ay < 16 ? ART[ay][ax] : '.';
    const rgb = COLORS[k] || (bg ? BG : null), i = (y * size + x) * 4;
    if (rgb) { px[i] = rgb[0]; px[i + 1] = rgb[1]; px[i + 2] = rgb[2]; px[i + 3] = 255; }
  }
  return png(size, px);
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4), crc = Buffer.alloc(4), td = Buffer.concat([Buffer.from(type), data]);
  len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, px) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(size, 0); head.writeUInt32BE(size, 4);
  head[8] = 8; head[9] = 6;   // 8-bit RGBA
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) px.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}

const root = path.resolve(__dirname, '..', '..');
const res = path.resolve(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const write = (file, buf) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, buf); };

// Android: legacy icons have the background baked in; the adaptive foreground leaves room for the phone's mask
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
if (fs.existsSync(res)) {
  for (const [d, k] of Object.entries(DENSITIES)) {
    write(path.join(res, `mipmap-${d}`, 'ic_launcher.png'), render(48 * k, 0.06, true));
    write(path.join(res, `mipmap-${d}`, 'ic_launcher_round.png'), render(48 * k, 0.14, true));
    write(path.join(res, `mipmap-${d}`, 'ic_launcher_foreground.png'), render(108 * k, 0.22, false));
  }
  write(path.join(res, 'values', 'ic_launcher_background.xml'),
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0B0B1A</color>\n</resources>\n');

  // Start-up screen: Capacitor's default is its own logo. Swap it for plain dark blue with the app icon,
  // which leads straight into the ULT Arcade loading screen.
  const plain = png(64, Buffer.alloc(64 * 64 * 4).map((_, i) => [...BG, 255][i % 4]));
  for (const d of fs.readdirSync(res)) if (d.startsWith('drawable') && fs.existsSync(path.join(res, d, 'splash.png'))) write(path.join(res, d, 'splash.png'), plain);
  const styles = path.join(res, 'values', 'styles.xml');
  let xml = fs.readFileSync(styles, 'utf8');
  if (!xml.includes('windowSplashScreenBackground')) {
    xml = xml.replace('<item name="android:background">@drawable/splash</item>',
      '<item name="android:background">@drawable/splash</item>\n' +
      '        <item name="windowSplashScreenBackground">#0B0B1A</item>\n' +
      '        <item name="windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>\n' +
      '        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>');
    fs.writeFileSync(styles, xml);
  }
}
// web app icons, used when the games are added to a home screen from the browser
write(path.join(root, 'icons', 'icon-192.png'), render(192, 0.08, true));
write(path.join(root, 'icons', 'icon-512.png'), render(512, 0.08, true));
write(path.join(root, 'icons', 'apple-touch-icon.png'), render(180, 0.08, true));
console.log('icons written');
