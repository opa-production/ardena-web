/**
 * Optimizes every raster image in assets/.
 *
 * - Downscales anything wider than MAX_WIDTH (never upscales).
 * - Re-encodes JPEG with mozjpeg and PNG with palette quantisation.
 * - Writes a .webp sibling for each image so pages can use <picture>.
 *
 * Originals are overwritten in place; git history is the backup.
 * Run: npm run optimize:images  (add --dry-run to preview)
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS = path.join(__dirname, '..', 'assets');
const MAX_WIDTH = 1920;
// Folders whose images only ever render small (avatars, partner logos).
const MAX_WIDTH_BY_DIR = { team: 800, partners: 800 };
const JPEG_QUALITY = 80;
const WEBP_QUALITY = 78;
const DRY_RUN = process.argv.includes('--dry-run');

const kb = (n) => (n / 1024).toFixed(0) + 'K';

(async () => {
  // Walk assets/ recursively, returning paths relative to ASSETS.
  const walk = (dir) =>
    fs.readdirSync(path.join(ASSETS, dir), { withFileTypes: true }).flatMap((e) => {
      const rel = dir ? path.join(dir, e.name) : e.name;
      if (e.isDirectory()) return walk(rel);
      return /\.(jpe?g|png)$/i.test(e.name) ? [rel] : [];
    });
  const files = walk('');

  let before = 0;
  let after = 0;

  for (const name of files) {
    const src = path.join(ASSETS, name);
    const isPng = /\.png$/i.test(name);
    const topDir = name.includes(path.sep) ? name.split(path.sep)[0] : '';
    const maxWidth = MAX_WIDTH_BY_DIR[topDir] || MAX_WIDTH;
    const startSize = fs.statSync(src).size;
    before += startSize;

    try {
      const meta = await sharp(src).metadata();
      const resize =
        meta.width > maxWidth ? { width: maxWidth, withoutEnlargement: true } : null;

      const base = () => {
        let s = sharp(src, { animated: false }).rotate();
        if (resize) s = s.resize(resize);
        return s;
      };

      // Re-encode the original in place, via a temp file.
      const tmp = path.join(ASSETS, name.replace(/(\.[^.]+)$/, '-tmp$1'));
      const encoder = isPng
        ? base().png({ compressionLevel: 9, palette: true })
        : base().jpeg({ quality: JPEG_QUALITY, mozjpeg: true });

      if (!DRY_RUN) {
        await encoder.toFile(tmp);
        // Only keep the new file if it is actually smaller.
        if (fs.statSync(tmp).size < startSize) {
          fs.renameSync(tmp, src);
        } else {
          fs.unlinkSync(tmp);
        }
      }

      // WebP sibling. Some flat-colour logos encode larger as WebP than as
      // PNG, so only keep the sibling when it actually saves bytes.
      const webp = path.join(ASSETS, name.replace(/\.[^.]+$/, '.webp'));
      if (!DRY_RUN) {
        await base().webp({ quality: WEBP_QUALITY }).toFile(webp);
        if (fs.statSync(webp).size >= fs.statSync(src).size) fs.unlinkSync(webp);
      }

      const endSize = DRY_RUN ? startSize : fs.statSync(src).size;
      const webpSize = DRY_RUN || !fs.existsSync(webp) ? 0 : fs.statSync(webp).size;
      after += endSize;

      const pct = Math.round((1 - endSize / startSize) * 100);
      console.log(
        `${name.padEnd(26)} ${kb(startSize).padStart(6)} -> ${kb(endSize).padStart(6)}` +
          `${pct > 0 ? ` (${pct}% smaller)` : ''}` +
          `${webpSize ? `  webp ${kb(webpSize)}` : ''}`
      );
    } catch (err) {
      console.error(`Error optimizing ${name}: ${err.message}`);
    }
  }

  console.log(
    `\nTotal: ${kb(before)} -> ${kb(after)} (${Math.round((1 - after / before) * 100)}% smaller)`
  );
})();
