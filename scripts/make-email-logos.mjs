// E-mail logos (PNG, 2x): the wordmark from public/email-logo.png (white, transparent) recoloured and put on an opaque plate,
// so it never blends into a mail app's dark mode (Gmail iOS inverts the page but never the image).
//   public/email-logo-navy.png  - navy wordmark on white (default, light header)
//   public/email-logo-white.png - white wordmark on navy (Outlook dark-mode swap)
// 400 px wide = 200 px in the HTML at 2x; the wordmark itself is ~180 px wide.
import sharp from "sharp";

const NAVY = { r: 10, g: 14, b: 31 };
const WHITE = { r: 255, g: 255, b: 255 };
const W = 400, PAD_X = 20, PAD_Y = 22;

const src = sharp("public/email-logo.png").ensureAlpha();
const { info } = await src.clone().raw().toBuffer({ resolveWithObject: true });
// trim to the wordmark
const trimmed = await src.clone().trim({ threshold: 1 }).png().toBuffer({ resolveWithObject: true });
const markW = W - 2 * PAD_X;
const alpha = await sharp(trimmed.data).resize({ width: markW }).extractChannel("alpha").raw().toBuffer({ resolveWithObject: true });
const markH = alpha.info.height;
const H = markH + 2 * PAD_Y;
console.log("source", info.width, "x", info.height, "-> mark", markW, "x", markH, "-> image", W, "x", H);

async function make(fg, bg, out) {
  const mark = await sharp({ create: { width: markW, height: markH, channels: 3, background: fg } })
    .joinChannel(alpha.data, { raw: { width: markW, height: markH, channels: 1 } }).png().toBuffer();
  await sharp({ create: { width: W, height: H, channels: 3, background: bg } })
    .composite([{ input: mark, left: PAD_X, top: PAD_Y }]).flatten({ background: bg }).png({ compressionLevel: 9 }).toFile(out);
}
await make(NAVY, WHITE, "public/email-logo-navy.png");
await make(WHITE, NAVY, "public/email-logo-white.png");
