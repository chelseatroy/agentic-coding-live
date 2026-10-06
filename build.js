#!/usr/bin/env node
// Inlines a deck's linked stylesheets, scripts, and local <img> sources
// (as base64 data URIs) into a single self-contained HTML file with no
// external references. Fails if a local image is missing.
//
// Usage: node build.js <deckDir> <outFile>

const fs = require('fs');
const path = require('path');

const IMAGE_MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

function build(deckDir, outFile) {
  const indexPath = path.join(deckDir, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  html = html.replace(
    /<link[^>]+rel=["']stylesheet["'][^>]*>/gi,
    (tag) => {
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      if (!hrefMatch) return tag;
      const cssPath = path.resolve(deckDir, hrefMatch[1]);
      const css = fs.readFileSync(cssPath, 'utf8');
      return `<style>\n${css}\n</style>`;
    }
  );

  html = html.replace(
    /<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/gi,
    (tag, src) => {
      const jsPath = path.resolve(deckDir, src);
      const js = fs.readFileSync(jsPath, 'utf8');
      return `<script>\n${js}\n</script>`;
    }
  );

  html = html.replace(
    /(<img\b[^>]*?\bsrc=)(["'])([^"']+)\2/gi,
    (tag, prefix, quote, src) => {
      if (/^(data:|https?:|\/\/)/i.test(src)) return tag;
      const imgPath = path.resolve(deckDir, src);
      if (!fs.existsSync(imgPath)) {
        throw new Error(`Image not found: ${src} (resolved to ${imgPath})`);
      }
      const mime = IMAGE_MIME_TYPES[path.extname(imgPath).toLowerCase()];
      if (!mime) {
        throw new Error(`Unsupported image type: ${src}`);
      }
      const data = fs.readFileSync(imgPath).toString('base64');
      return `${prefix}${quote}data:${mime};base64,${data}${quote}`;
    }
  );

  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, html, 'utf8');
}

function main() {
  const [, , deckDir, outFile] = process.argv;
  if (!deckDir || !outFile) {
    console.error('Usage: node build.js <deckDir> <outFile>');
    process.exit(1);
  }
  build(deckDir, outFile);
}

main();
