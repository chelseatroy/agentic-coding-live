const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

// Verification loop for agent-tools/context-history/plans/2026-09-01-slide-deck-generalization-plan.md
//
// This spec is expected to be RED until Phase 1 of that plan is implemented
// (mechanics/mechanics.css, mechanics/mechanics.js, and build.js don't exist
// yet). It drives real built output in a real browser, per the CLAUDE.md
// verify-loop requirement, rather than asserting on file contents alone.

const repoRoot = path.resolve(__dirname, '..');
const buildScript = path.join(repoRoot, 'build.js');
const fixtureA = path.join(repoRoot, 'tests/fixtures/deck-fixture-a');
const fixtureB = path.join(repoRoot, 'tests/fixtures/deck-fixture-b');

function build(deckDir, outFile) {
  execFileSync('node', [buildScript, deckDir, outFile], { stdio: 'pipe' });
}

function isolatedCopy(builtFile) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-portability-'));
  const dest = path.join(dir, 'deck.html');
  fs.copyFileSync(builtFile, dest);
  return dest;
}

test.describe('build produces a self-contained, portable file', () => {
  let builtA;

  test.beforeAll(() => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-build-'));
    builtA = path.join(outDir, 'fixture-a.html');
    build(fixtureA, builtA);
  });

  test('output has no external <link> or <script src> references', () => {
    const html = fs.readFileSync(builtA, 'utf8');
    expect(html).not.toMatch(/<link[^>]+rel=["']stylesheet["']/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });

  test('output opens and works with zero sibling files present', async ({ page }) => {
    const isolated = isolatedCopy(builtA);
    await page.goto('file://' + isolated);
    await expect(page.locator('.slide.active')).toHaveCount(1);
    await expect(page.locator('#nav button', { hasText: 'prev' })).toBeVisible();
    await expect(page.locator('#nav button', { hasText: 'next' })).toBeVisible();
  });
});

test.describe('priority-3 functionality survives the build, in isolation', () => {
  let deckPath;

  test.beforeAll(() => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-build-'));
    const built = path.join(outDir, 'fixture-a.html');
    build(fixtureA, built);
    deckPath = 'file://' + isolatedCopy(built);
  });

  test('counter shows "1 / N" and updates on arrow keys', async ({ page }) => {
    await page.goto(deckPath);
    const counter = page.locator('#counter');
    await expect(counter).toHaveText('1 / 3');
    await page.keyboard.press('ArrowRight');
    await expect(counter).toHaveText('2 / 3');
    await page.keyboard.press('ArrowLeft');
    await expect(counter).toHaveText('1 / 3');
  });

  test('N toggles the notes panel', async ({ page }) => {
    await page.goto(deckPath);
    await expect(page.locator('body')).not.toHaveClass(/notes-visible/);
    await page.keyboard.press('n');
    await expect(page.locator('body')).toHaveClass(/notes-visible/);
    await page.keyboard.press('n');
    await expect(page.locator('body')).not.toHaveClass(/notes-visible/);
  });

  test('P hides nav/counter/notes button but keeps the timer visible', async ({ page }) => {
    await page.goto(deckPath);
    await expect(page.locator('#nav')).toBeVisible();
    await expect(page.locator('#slide-time')).toBeVisible();

    await page.keyboard.press('p');

    await expect(page.locator('#nav')).toBeHidden();
    await expect(page.locator('#counter')).toBeHidden();
    await expect(page.locator('#notes-btn')).toBeHidden();
    await expect(page.locator('#slide-time')).toBeVisible();

    await page.keyboard.press('p');
    await expect(page.locator('#nav')).toBeVisible();
  });

  test('timer updates between slides and drops to the corner when chrome hides', async ({ page }) => {
    await page.goto(deckPath);
    const slideTime = page.locator('#slide-time');
    const boxBefore = await slideTime.boundingBox();
    const textAtSlideOne = await slideTime.textContent();

    await page.keyboard.press('ArrowRight');
    const textAtSlideTwo = await slideTime.textContent();
    expect(textAtSlideTwo).not.toBe(textAtSlideOne);

    await page.keyboard.press('p');
    await expect(page.locator('#nav')).toBeHidden();
    // #slide-time animates via a CSS transition, so poll until it has moved
    // rather than reading the bounding box once mid-transition.
    await expect.poll(async () => (await slideTime.boundingBox()).y).toBeGreaterThan(boxBefore.y);
  });

  test('arrow keys and N still work while chrome is hidden', async ({ page }) => {
    await page.goto(deckPath);
    await page.keyboard.press('p');
    await expect(page.locator('#nav')).toBeHidden();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('p');
    await expect(page.locator('#counter')).toHaveText('2 / 3');

    await page.keyboard.press('p');
    await page.keyboard.press('n');
    await expect(page.locator('body')).toHaveClass(/notes-visible/);
  });
});

test.describe('theme swaps without touching mechanics', () => {
  test('two decks with different theme.css render different accent colors but identical mechanics', async ({ page }) => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-build-'));
    const builtA = path.join(outDir, 'fixture-a.html');
    const builtB = path.join(outDir, 'fixture-b.html');
    build(fixtureA, builtA);
    build(fixtureB, builtB);

    await page.goto('file://' + builtA);
    const colorA = await page.locator('.section-label').first().evaluate(
      el => getComputedStyle(el).color
    );

    await page.goto('file://' + builtB);
    const colorB = await page.locator('.section-label').first().evaluate(
      el => getComputedStyle(el).color
    );

    expect(colorA).not.toBe(colorB);

    const scriptA = extractInlineScript(fs.readFileSync(builtA, 'utf8'));
    const scriptB = extractInlineScript(fs.readFileSync(builtB, 'utf8'));
    expect(scriptA).toBe(scriptB);
    expect(scriptA.length).toBeGreaterThan(0);
  });
});

test.describe('mechanics is shared, not forked per deck', () => {
  test('two different decks embed byte-identical mechanics script', () => {
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deck-build-'));
    const builtA = path.join(outDir, 'fixture-a.html');
    const builtB = path.join(outDir, 'fixture-b.html');
    build(fixtureA, builtA);
    build(fixtureB, builtB);

    const scriptA = extractInlineScript(fs.readFileSync(builtA, 'utf8'));
    const scriptB = extractInlineScript(fs.readFileSync(builtB, 'utf8'));
    expect(scriptA).toBe(scriptB);
    expect(scriptA.length).toBeGreaterThan(0);
  });
});

function extractInlineScript(html) {
  const match = html.match(/<script>([\s\S]*?)<\/script>/);
  return match ? match[1].trim() : '';
}
