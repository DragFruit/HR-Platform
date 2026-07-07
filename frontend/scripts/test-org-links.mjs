import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function login(page) {
  const res = await page.request.post(`${BASE}/api/auth/session`, {
    data: { email: 'stas@vbi.local', password: 'admin123' }
  });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
  await page.goto(BASE);
  await page.waitForSelector('.app-shell', { timeout: 20000 });
}

const ORG_SEED = {
  executives: [{ id: 'exec-1', title: 'CEO', person: 'Тест', order: 0, x: 100, y: 0 }],
  units: [
    {
      id: 'unit-a',
      executiveId: 'exec-1',
      name: 'Отдел A',
      head: '',
      order: 0,
      stackId: null,
      groupId: null,
      x: 50,
      y: 200,
      employees: 0,
      members: []
    },
    {
      id: 'unit-b',
      executiveId: 'exec-1',
      name: 'Отдел B',
      head: '',
      order: 1,
      stackId: null,
      groupId: null,
      x: 250,
      y: 350,
      employees: 0,
      members: []
    }
  ],
  groups: [],
  links: []
};

async function seedOrg(page) {
  await page.addInitScript((data) => {
    localStorage.setItem('vbi-welcomed-users', JSON.stringify([1]));
    localStorage.setItem('vbi-org-structure-v1', JSON.stringify(data));
  }, ORG_SEED);
}

async function getState(page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('vbi-org-structure-v1');
    const data = raw ? JSON.parse(raw) : { links: [] };
    const ports = document.querySelectorAll('.org-port').length;
    const savedPaths = document.querySelectorAll('.org-link-path:not(.org-link-path--draft)').length;
    const draftPaths = document.querySelectorAll('.org-link-path--draft').length;
    const linking = document.querySelector('.org-chart-canvas--linking') !== null;
    return {
      linksInStorage: data.links?.length ?? 0,
      links: data.links ?? [],
      ports,
      savedPaths,
      draftPaths,
      linking
    };
  });
}

async function portCenter(page, unitId, side) {
  const el = page.locator(
    `[data-org-node-kind="unit"][data-org-node-id="${unitId}"] .org-port--${side}`
  );
  await el.waitFor({ state: 'attached', timeout: 5000 });
  const box = await el.boundingBox();
  if (!box) throw new Error(`no box for ${unitId} ${side}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

const results = [];

async function testClickClick(page) {
  await page.goto(`${BASE}/admin/organization`);
  await page.waitForSelector('.org-chart-canvas--edit', { timeout: 15000 });
  await page.waitForTimeout(800);

  const nodeCount = await page.locator('[data-org-node]').count();
  const portCount = await page.locator('.org-port').count();

  const portA = page.locator('[data-org-node-id="unit-a"] .org-port--bottom');
  const portB = page.locator('[data-org-node-id="unit-b"] .org-port--top');

  await portA.click({ force: true });
  await page.waitForTimeout(250);
  const mid1 = await getState(page);

  await portB.click({ force: true });
  await page.waitForTimeout(400);
  const after = await getState(page);

  results.push({
    test: 'click_click',
    url: page.url(),
    hasEditCanvas: await page.locator('.org-chart-canvas--edit').count(),
    nodeCount,
    portCount,
    midLinking: mid1.linking,
    midDraft: mid1.draftPaths,
    afterLinks: after.linksInStorage,
    afterSavedPaths: after.savedPaths,
    afterDraftPaths: after.draftPaths,
    pointerTest: await page.evaluate(() => {
      const port = document.querySelector('[data-org-node-id="unit-a"] .org-port--bottom');
      if (!port) return { err: 'no port' };
      port.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, clientX: 10, clientY: 10 })
      );
      return {
        linking: document.querySelector('.org-chart-canvas--linking') !== null,
        draft: document.querySelectorAll('.org-link-path--draft').length
      };
    }),
    ok: after.linksInStorage >= 1 && after.savedPaths >= 1
  });
}

async function testDrag(page) {
  await page.evaluate(() => {
    const raw = localStorage.getItem('vbi-org-structure-v1');
    const data = raw ? JSON.parse(raw) : {};
    data.links = [];
    localStorage.setItem('vbi-org-structure-v1', JSON.stringify(data));
  });
  await page.reload();
  await page.waitForSelector('.org-chart-canvas--edit', { timeout: 15000 });
  await page.waitForTimeout(800);

  const portA = page.locator('[data-org-node-id="unit-a"] .org-port--right');
  const portB = page.locator('[data-org-node-id="unit-b"] .org-port--left');
  const a = await portA.boundingBox();
  const b = await portB.boundingBox();
  if (!a || !b) throw new Error('port boxes missing');

  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;

  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.waitForTimeout(80);
  await page.mouse.move(bx, by, { steps: 15 });
  await page.waitForTimeout(120);
  const during = await getState(page);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await getState(page);

  results.push({
    test: 'drag',
    duringDraft: during.draftPaths,
    duringLinking: during.linking,
    duringHover: during.linking,
    afterLinks: after.linksInStorage,
    afterSavedPaths: after.savedPaths,
    ok: after.linksInStorage >= 1 && after.savedPaths >= 1
  });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('pageerror', (err) => results.push({ test: 'pageerror', error: String(err) }));

try {
  await seedOrg(page);
  await login(page);
  await testClickClick(page);
  await testDrag(page);
} catch (e) {
  results.push({ test: 'fatal', error: String(e), stack: e.stack });
  try {
    await page.screenshot({ path: '/tmp/org-link-fail.png', fullPage: true });
    results.push({ test: 'debug', nodes: await page.locator('[data-org-node]').count(), ports: await page.locator('.org-port').count() });
  } catch {}
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
process.exit(results.some((r) => r.ok === false || r.test === 'fatal' || r.test === 'pageerror') ? 1 : 0);
