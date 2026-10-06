const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

// Verify loop for inlining local <img src> files as base64 data URIs in
// build.js. Each build writes into a fresh temp dir that contains only the
// built file, so an image can only render if it was inlined.

const repoRoot = path.resolve(__dirname, '..');
const buildScript = path.join(repoRoot, 'build.js');
const imagesFixture = path.join(repoRoot, 'tests/fixtures/deck-fixture-images');
const missingImageFixture = path.join(repoRoot, 'tests/fixtures/deck-fixture-missing-image');
const unboundedDeck = path.join(repoRoot, 'decks/unbounded-contexts');

function buildIsolated(deckDir, name) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-images-'));
  const built = path.join(outDir, name);
  execFileSync('node', [buildScript, deckDir, built], { stdio: 'pipe' });
  return built;
}

test.describe('local images are inlined as data URIs', () => {
  let built;

  test.beforeAll(() => {
    built = buildIsolated(imagesFixture, 'images.html');
  });

  test('a local image renders from the built file with no sibling files', async ({ page }) => {
    await page.goto('file://' + built);
    const img = page.locator('#local-img');
    await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/);
    await expect.poll(() => img.evaluate(el => el.naturalWidth)).toBe(3);
  });

  test('the inlined bytes match the source file exactly', () => {
    const html = fs.readFileSync(built, 'utf8');
    const expected = fs.readFileSync(path.join(imagesFixture, 'pixel.png')).toString('base64');
    expect(html).toContain(`src="data:image/png;base64,${expected}"`);
  });

  test('existing data: URIs and remote URLs are left untouched', () => {
    const html = fs.readFileSync(built, 'utf8');
    expect(html).toMatch(/id="data-img" src="data:image\/png;base64,iVBORw0KGgo/);
    expect(html).toContain('src="https://example.com/remote.png"');
  });
});

test.describe('a missing local image fails the build', () => {
  test('build exits non-zero, names the missing file, and writes no output', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-images-'));
    const out = path.join(outDir, 'missing.html');
    const result = spawnSync('node', [buildScript, missingImageFixture, out], { encoding: 'utf8' });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('does-not-exist.png');
    expect(fs.existsSync(out)).toBe(false);
  });
});

test.describe('real deck: the QR code survives the build in isolation', () => {
  test('speaker-page QR on the final slide renders with no sibling files', async ({ page }) => {
    const built = buildIsolated(unboundedDeck, 'unbounded-contexts.html');
    await page.goto('file://' + built);
    const qr = page.locator('#s23 img[alt="QR code"]');
    await expect(qr).toHaveAttribute('src', /^data:image\/png;base64,/);
    await expect.poll(() => qr.evaluate(el => el.naturalWidth)).toBeGreaterThan(0);
  });
});
