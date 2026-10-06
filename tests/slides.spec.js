const { test, expect } = require('@playwright/test');
const path = require('path');

const deckPath = 'file://' + path.resolve(__dirname, '../unbounded_contexts_slides/unbounded_contexts_slides.html');

test.describe('existing deck behavior (baseline, pre-presenter-mode)', () => {
  test('loads on the first slide and shows nav buttons', async ({ page }) => {
    await page.goto(deckPath);
    await expect(page.locator('.slide.active')).toHaveCount(1);
    await expect(page.locator('#nav button', { hasText: 'prev' })).toBeVisible();
    await expect(page.locator('#nav button', { hasText: 'next' })).toBeVisible();
  });

  test('arrow keys navigate slides', async ({ page }) => {
    await page.goto(deckPath);
    const counter = page.locator('#counter');
    await expect(counter).toHaveText('1 / ' + await page.locator('.slide').count());
    await page.keyboard.press('ArrowRight');
    await expect(counter).toHaveText('2 / ' + await page.locator('.slide').count());
    await page.keyboard.press('ArrowLeft');
    await expect(counter).toHaveText('1 / ' + await page.locator('.slide').count());
  });

  test('N key toggles the notes panel', async ({ page }) => {
    await page.goto(deckPath);
    await expect(page.locator('body')).not.toHaveClass(/notes-visible/);
    await page.keyboard.press('n');
    await expect(page.locator('body')).toHaveClass(/notes-visible/);
    await page.keyboard.press('n');
    await expect(page.locator('body')).not.toHaveClass(/notes-visible/);
  });
});

test.describe('audience/presenter mode toggle (P key)', () => {
  test('P hides nav buttons, counter, and notes button, but keeps the slide timer visible', async ({ page }) => {
    await page.goto(deckPath);
    await expect(page.locator('#nav')).toBeVisible();
    await expect(page.locator('#slide-time')).toBeVisible();

    await page.keyboard.press('p');

    await expect(page.locator('#nav')).toBeHidden();
    await expect(page.locator('#nav button', { hasText: 'prev' })).toBeHidden();
    await expect(page.locator('#nav button', { hasText: 'next' })).toBeHidden();
    await expect(page.locator('#notes-btn')).toBeHidden();
    await expect(page.locator('#counter')).toBeHidden();
    await expect(page.locator('#slide-time')).toBeVisible();

    await page.keyboard.press('p');
    await expect(page.locator('#nav')).toBeVisible();
    await expect(page.locator('#slide-time')).toBeVisible();
  });

  test('slide timer stays visible and keeps updating while in presenter mode', async ({ page }) => {
    await page.goto(deckPath);
    const slideTime = page.locator('#slide-time');

    await page.keyboard.press('p');
    await expect(slideTime).toBeVisible();
    const textAtSlideOne = await slideTime.textContent();

    await page.keyboard.press('ArrowRight');
    await expect(slideTime).toBeVisible();
    const textAtSlideTwo = await slideTime.textContent();

    expect(textAtSlideTwo).not.toBe(textAtSlideOne);
  });

  test('slide timer drops down to the corner once the nav bar is gone', async ({ page }) => {
    await page.goto(deckPath);
    const slideTime = page.locator('#slide-time');

    const boxBefore = await slideTime.boundingBox();

    await page.keyboard.press('p');
    await expect(page.locator('#nav')).toBeHidden();
    // #slide-time animates via a CSS transition, so poll until it has moved
    // rather than reading the bounding box once mid-transition.
    await expect.poll(async () => (await slideTime.boundingBox()).y).toBeGreaterThan(boxBefore.y);
  });

  test('navigation keys still work while chrome is hidden', async ({ page }) => {
    await page.goto(deckPath);
    const slideCount = await page.locator('.slide').count();
    const counter = page.locator('#counter');

    await page.keyboard.press('p');
    await expect(page.locator('#nav')).toBeHidden();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('p');

    await expect(counter).toHaveText('2 / ' + slideCount);
  });

  test('N still toggles the notes panel while chrome is hidden', async ({ page }) => {
    await page.goto(deckPath);
    await page.keyboard.press('p');
    await expect(page.locator('body')).not.toHaveClass(/notes-visible/);

    await page.keyboard.press('n');
    await expect(page.locator('body')).toHaveClass(/notes-visible/);

    await page.keyboard.press('n');
    await expect(page.locator('body')).not.toHaveClass(/notes-visible/);
  });
});
