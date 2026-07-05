import { test, expect, Page } from '@playwright/test';
import fs from 'node:fs';

// Start every test from a clean browser (no persisted layout) for isolation.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
});

const items = (page: Page) => page.locator('#room-canvas-container .room-item');

async function addItem(page: Page, name: RegExp) {
  const btn = page.getByRole('button', { name });
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
}

test('starts with an empty room', async ({ page }) => {
  await expect(page.getByText('Your room is empty')).toBeVisible();
  await expect(items(page)).toHaveCount(0);
});

test('adds an item from the palette', async ({ page }) => {
  await addItem(page, /Pinball \(Stern\)/);
  await expect(items(page)).toHaveCount(1);
  await expect(page.getByText('Your room is empty')).toHaveCount(0);
});

test('adds an item by dragging it from the library onto the room', async ({ page }) => {
  const source = page.getByRole('button', { name: /Pinball \(Stern\)/ });
  const target = page.locator('#room-canvas-container');
  const box = await target.boundingBox();
  await source.dragTo(target, { targetPosition: { x: box!.width * 0.6, y: box!.height * 0.6 } });
  await expect(items(page)).toHaveCount(1);
  // dropped item should be near the drop point, not the top-left default
  const itemBox = await items(page).first().boundingBox();
  expect(itemBox!.x + itemBox!.width / 2).toBeGreaterThan(box!.x + box!.width * 0.35);
});

test('shows a floating rotate menu and rotating flips the footprint', async ({ page }) => {
  await addItem(page, /Pinball \(Stern\)/); // portrait: taller than wide
  const item = items(page).first();
  const before = await item.boundingBox();
  expect(before!.height).toBeGreaterThan(before!.width);

  const rotate = page.getByRole('button', { name: /Rotate \+90/ });
  await expect(rotate).toBeVisible();
  await rotate.click();
  await page.waitForTimeout(500); // rotation spring settles

  const after = await item.boundingBox();
  expect(after!.width).toBeGreaterThan(after!.height);
});

test('removes the selected block from the floating menu', async ({ page }) => {
  await addItem(page, /Pinball \(Stern\)/);
  await expect(items(page)).toHaveCount(1);
  await page.getByRole('button', { name: /Remove \(Delete\)/ }).click();
  await expect(items(page)).toHaveCount(0);
  await expect(page.getByText('Your room is empty')).toBeVisible();
});

test('dragging a rotated block moves it accurately (no jump)', async ({ page }) => {
  await addItem(page, /Pinball \(Stern\)/);
  const item = items(page).first();
  // Move to the middle first so wall-clamping doesn't confound the measurement.
  const b = await item.boundingBox();
  await page.mouse.move(b!.x + b!.width / 2, b!.y + b!.height / 2);
  await page.mouse.down();
  await page.mouse.move(900, 460, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);

  await page.getByRole('button', { name: /Rotate \+90/ }).click();
  await page.waitForTimeout(400);

  const b0 = await item.boundingBox();
  const gx = b0!.x + b0!.width / 2, gy = b0!.y + b0!.height / 2;
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(gx + 80, gy + 60, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const b1 = await item.boundingBox();
  // It follows the cursor (~80,60), not a wild jump.
  expect(Math.abs((b1!.x - b0!.x) - 80)).toBeLessThan(20);
  expect(Math.abs((b1!.y - b0!.y) - 60)).toBeLessThan(20);
});

test('the rectangular clearance block renders as a dashed zone', async ({ page }) => {
  await page.getByPlaceholder('Search items…').fill('rect');
  await page.getByRole('button', { name: /Clearance \(Rect\)/ }).click();
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).last().locator('.border-dashed').first()).toBeVisible();
});

test('doors and windows render as structural symbols', async ({ page }) => {
  await page.getByPlaceholder('Search items…').fill('door');
  await page.getByRole('button', { name: /Door \(Swing L\)/ }).click();
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first().locator('svg')).toBeVisible();
  await page.getByPlaceholder('Search items…').fill('window');
  await page.getByRole('button', { name: /^Window/ }).click();
  await expect(items(page)).toHaveCount(2);
  await expect(items(page).last().locator('svg')).toBeVisible();
});

test('the circular clearance block renders as a round dashed zone', async ({ page }) => {
  await page.getByPlaceholder('Search items…').fill('circle');
  await page.getByRole('button', { name: /Clearance \(Circle\)/ }).click();
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).last().locator('.border-dashed.rounded-full')).toBeVisible();
});

test('loads a bundled example layout', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Pool & Play/ }).click();
  await expect(items(page)).toHaveCount(7);
  await expect(page.locator('input[type="number"]').first()).toHaveValue('20'); // room width ft
});

test('resizing a block persists its size (state + export) and does not move it', async ({ page }) => {
  await page.getByPlaceholder('Search items…').fill('bump');
  await page.getByRole('button', { name: /Bump Out/ }).click();
  await page.getByPlaceholder('Search items…').fill('');
  const item = items(page).first();
  const before = await item.boundingBox();

  const handle = page.locator('.cursor-se-resize').first();
  const hb = await handle.boundingBox();
  await page.mouse.move(hb!.x + hb!.width / 2, hb!.y + hb!.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb!.x + 140, hb!.y + 100, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);

  const after = await item.boundingBox();
  expect(after!.width).toBeGreaterThan(before!.width + 60); // it grew
  expect(Math.abs(after!.x - before!.x)).toBeLessThan(6);   // it did NOT move

  // The new size is saved to the export JSON.
  await page.getByRole('button', { name: 'Settings' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ]);
  const data = JSON.parse(fs.readFileSync(await download.path(), 'utf-8'));
  expect(data.items[0].overrideWidth).toBeGreaterThan(30);
  expect(data.items[0].overrideHeight).toBeGreaterThan(30);
});

test('exports the current layout as valid JSON', async ({ page }) => {
  await addItem(page, /Pinball \(Stern\)/);
  await page.getByRole('button', { name: 'Settings' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ]);
  const path = await download.path();
  const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
  expect(data.app).toBe('gameroom-designer');
  expect(data.version).toBe(1);
  expect(Array.isArray(data.items)).toBe(true);
  expect(data.items.length).toBe(1);
});

test('imports a layout file (round-trips)', async ({ page }) => {
  const layout = {
    app: 'gameroom-designer',
    version: 1,
    roomWidthFt: 14,
    roomLengthFt: 18,
    templates: [],
    items: [
      { instanceId: 'imp-1', templateId: 'pinball', x: 30, y: 30, rotation: 0 },
      { instanceId: 'imp-2', templateId: 'air-hockey', x: 200, y: 200, rotation: 0 },
    ],
  };
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'layout.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(layout)),
  });
  await expect(items(page)).toHaveCount(2);
  await expect(page.locator('input[type="number"]').first()).toHaveValue('14');
});

test('rejects an invalid import with an error message', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ hello: 'world' })),
  });
  await expect(page.getByText(/no "items" list/i)).toBeVisible();
  await expect(items(page)).toHaveCount(0);
});

test('clears all saved data after confirmation', async ({ page }) => {
  await addItem(page, /Pinball \(Stern\)/);
  await addItem(page, /Air Hockey/);
  await expect(items(page)).toHaveCount(2);

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Clear all saved data' }).click();
  await page.getByRole('button', { name: 'Erase everything' }).click();

  await expect(items(page)).toHaveCount(0);
  await expect(page.getByText('Your room is empty')).toBeVisible();
  await expect(page.locator('input[type="number"]').first()).toHaveValue('16'); // back to default room
});

test('zoom controls change the zoom level', async ({ page }) => {
  const pct = page.locator('button[title="Reset to 100%"]');
  const before = await pct.textContent();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await page.getByRole('button', { name: 'Zoom in' }).click();
  await expect(pct).not.toHaveText(before ?? '');
  await pct.click(); // reset
  await expect(pct).toHaveText('100%');
});

test('multi-select shows a group panel and distribute evens the spacing', async ({ page }) => {
  await addItem(page, /Pinball \(Stern\)/);
  await addItem(page, /Pinball \(Stern\)/);
  await addItem(page, /Pinball \(Stern\)/);
  const boxes = await items(page).evaluateAll((els) =>
    els.map((e) => { const b = e.getBoundingClientRect(); return { cx: b.left + b.width / 2, cy: b.top + b.height / 2 }; })
  );
  await page.mouse.click(boxes[0].cx, boxes[0].cy);
  await page.keyboard.down('Shift');
  await page.mouse.click(boxes[1].cx, boxes[1].cy);
  await page.mouse.click(boxes[2].cx, boxes[2].cy);
  await page.keyboard.up('Shift');

  await expect(page.getByText('3 items selected')).toBeVisible();

  await page.getByRole('button', { name: 'Distribute horizontally (even gaps)' }).click();
  await page.waitForTimeout(300);
  const gaps = await items(page).evaluateAll((els) => {
    const r = els.map((e) => e.getBoundingClientRect()).sort((a, b) => a.left - b.left);
    const g: number[] = [];
    for (let i = 1; i < r.length; i++) g.push(Math.round(r[i].left - (r[i - 1].left + r[i - 1].width)));
    return g;
  });
  expect(gaps.length).toBe(2);
  expect(Math.abs(gaps[0] - gaps[1])).toBeLessThanOrEqual(2);
});

test('added items do not overlap (smart placement)', async ({ page }) => {
  await addItem(page, /Pool Table \(8ft\)/);
  await addItem(page, /Pool Table \(8ft\)/);
  await expect(items(page)).toHaveCount(2);
  const boxes = await items(page).evaluateAll((els) =>
    els.map((el) => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; })
  );
  const [a, b] = boxes;
  const overlap = !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  expect(overlap).toBe(false);
});

test('palette search filters the item list', async ({ page }) => {
  await page.getByPlaceholder('Search items…').fill('pool');
  await expect(page.getByRole('button', { name: /Pool Table/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Pinball \(Stern\)/ })).toHaveCount(0);
  await page.getByPlaceholder('Search items…').fill('zzzznope');
  await expect(page.getByText(/No items match/)).toBeVisible();
});

test('the "r" keyboard shortcut rotates the selected block', async ({ page }) => {
  await addItem(page, /Pinball \(Stern\)/); // auto-selected, portrait
  const item = items(page).first();
  const before = await item.boundingBox();
  expect(before!.height).toBeGreaterThan(before!.width);
  await page.keyboard.press('r');
  await page.waitForTimeout(500);
  const after = await item.boundingBox();
  expect(after!.width).toBeGreaterThan(after!.height);
});

test('the Help / About modal lists keyboard shortcuts', async ({ page }) => {
  await page.getByRole('button', { name: /Help \/ About/ }).click();
  await expect(page.getByText('Keyboard shortcuts', { exact: false })).toBeVisible();
  await expect(page.getByRole('term').filter({ hasText: 'Undo' })).toBeVisible();
});

test('toggling "show grid" removes the grid background', async ({ page }) => {
  const container = page.locator('#room-canvas-container');
  await expect(container).toHaveCSS('background-image', /url\(/);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Show grid' }).click();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(container).toHaveCSS('background-image', 'none');
});
