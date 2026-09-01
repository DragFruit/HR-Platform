/**
 * Scrapes all Bitrix /devs/ knowledge articles after interactive login.
 *
 * Usage (from repo root):
 *   node scripts/bitrix/scrape-devs-articles.mjs
 *   node scripts/bitrix/scrape-devs-articles.mjs --only-missing
 *
 * Then:
 *   node scripts/bitrix/migrate-devs-to-knowledge.mjs
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');
const KNOWLEDGE_DATA_FILE = join(REPO_ROOT, 'frontend', 'server', 'data', 'knowledge-articles.json');

const START_URL = 'https://crm.vbi.ru/devs/20520/';
const OUT_DIR = join(__dirname, 'tmp', `devs-scrape-${Date.now()}`);
mkdirSync(OUT_DIR, { recursive: true });

const onlyMissing = process.argv.includes('--only-missing');

function alreadyMigratedIds() {
  if (!existsSync(KNOWLEDGE_DATA_FILE)) return new Set();
  try {
    const data = JSON.parse(readFileSync(KNOWLEDGE_DATA_FILE, 'utf8'));
    return new Set(
      (data.articles || [])
        .map((a) => String(a.id || '').match(/^kb-(\d+)$/)?.[1])
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

const browser = await chromium.launch({
  headless: false,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  channel: 'chrome'
});

const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();

console.log('Открываю Bitrix /devs/ — залогинься в Chrome, если попросит…');
await page.goto(START_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

await page.waitForFunction(
  () => {
    const hasPw = !!document.querySelector('input[type="password" i]');
    const hasLogin = !!document.querySelector(
      'input[name*="login" i], input[placeholder*="Логин" i]'
    );
    const hasNav = !!document.querySelector('.devsNav a[href*="/devs/"]');
    const hasH2 = !!document.querySelector('h2');
    return (!hasPw && !hasLogin) && (hasNav || hasH2);
  },
  undefined,
  { timeout: 15 * 60 * 1000 }
);

console.log('Логин ок. Собираю дерево статей из меню…');

const discovered = await page.evaluate(() => {
  const urls = new Set();
  for (const a of document.querySelectorAll('a[href*="/devs/"]')) {
    const href = a.getAttribute('href') || '';
    const abs = href.startsWith('http') ? href : `https://crm.vbi.ru${href}`;
    const m = abs.match(/\/devs\/(\d+)\/?/);
    if (m) urls.add(`https://crm.vbi.ru/devs/${m[1]}/`);
  }
  return [...urls].sort();
});

console.log(`Найдено ссылок /devs/<id>/: ${discovered.length}`);

const migrated = alreadyMigratedIds();
let urls = discovered;
if (onlyMissing) {
  urls = discovered.filter((u) => {
    const id = u.match(/\/devs\/(\d+)\//)?.[1];
    return id && !migrated.has(id);
  });
  console.log(`Режим --only-missing: к скрапингу ${urls.length} (уже в KB: ${migrated.size})`);
}

if (!urls.length) {
  console.log('Нечего скрапить.');
  await browser.close();
  process.exit(0);
}

const results = [];

for (const url of urls) {
  const id = url.match(/\/devs\/(\d+)\//)?.[1];
  console.log(`\nСкрапинг ${url} ...`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);

  const stillOnAuth = await page.evaluate(() => {
    const hasPw = !!document.querySelector('input[type="password" i]');
    const hasLogin = !!document.querySelector(
      'input[name*="login" i], input[placeholder*="Логин" i]'
    );
    return hasPw && hasLogin;
  });
  if (stillOnAuth) {
    console.log('Снова авторизация — залогинься…');
    await page.waitForFunction(
      () => {
        const hasNav = !!document.querySelector('.devsNav a[href*="/devs/"]');
        const hasH2 = !!document.querySelector('h2');
        return hasNav || hasH2;
      },
      undefined,
      { timeout: 5 * 60 * 1000 }
    );
  }

  // Full page HTML — migrate script needs .devsNav + h2.
  const fullHtml = await page.content();
  writeFileSync(join(OUT_DIR, `devs-${id}.html`), fullHtml, 'utf8');

  const meta = await page.evaluate(() => {
    const title =
      document.querySelector('h2')?.textContent?.trim() ||
      document.querySelector('h1')?.textContent?.trim() ||
      document.title;
    const imgs = [...document.querySelectorAll('.landing-main img, .devs-content img, img')].length;
    return { title, imgs };
  });

  results.push({ id, url, title: meta.title, imagesApprox: meta.imgs });
  console.log(`  OK: ${meta.title} (imgs~${meta.imgs})`);
}

writeFileSync(join(OUT_DIR, 'devs-index.json'), JSON.stringify(results, null, 2), 'utf8');
console.log(`\nГотово: ${results.length} статей → ${OUT_DIR}`);
console.log('Дальше: node scripts/bitrix/migrate-devs-to-knowledge.mjs');

await browser.close();
