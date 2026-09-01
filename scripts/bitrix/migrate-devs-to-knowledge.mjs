import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import * as cheerio from 'cheerio';

const REPO_ROOT = process.cwd();

const FRONTEND_PUBLIC_KNOWLEDGE = join(REPO_ROOT, 'frontend', 'public', 'knowledge');
const KNOWLEDGE_DATA_FILE = join(REPO_ROOT, 'frontend', 'server', 'data', 'knowledge-articles.json');

const SCRAPE_TMP_ROOT = join(REPO_ROOT, 'scripts', 'bitrix', 'tmp');

const DEV_SCRAPE_DIR_PREFIX = 'devs-scrape-';

function getNewestScrapeDir() {
  const dirs = readdirSync(SCRAPE_TMP_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(DEV_SCRAPE_DIR_PREFIX))
    .map((d) => d.name);
  if (!dirs.length) throw new Error(`Нет папки ${DEV_SCRAPE_DIR_PREFIX}* в ${SCRAPE_TMP_ROOT}`);

  dirs.sort((a, b) => {
    const na = Number(a.replace(DEV_SCRAPE_DIR_PREFIX, ''));
    const nb = Number(b.replace(DEV_SCRAPE_DIR_PREFIX, ''));
    return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
  });
  return join(SCRAPE_TMP_ROOT, dirs[dirs.length - 1]);
}

function stripHtmlTags(input) {
  return String(input || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanBreadcrumbLabel(raw) {
  const noTags = stripHtmlTags(raw);
  return noTags.replace(/\s*\d+\s*$/, '').trim();
}

function extractBreadcrumbsFromDevsHtml(html, devsId) {
  const $ = cheerio.load(html);
  const nav = $('.devsNav').first();
  if (!nav.length) return [];

  const activeLink = nav
    .find(`a[href="/devs/${devsId}/"]`)
    .filter((_, el) => ($(el).attr('class') || '').split(/\s+/).includes('active'))
    .first();

  const link = activeLink.length ? activeLink : nav.find(`a[href="/devs/${devsId}/"]`).first();
  if (!link.length) return [];

  const labels = [];
  let node = link[0];
  while (node && node !== nav[0]) {
    node = node.parent;
    if (!node || node === nav[0]) break;

    if (node.type === 'tag' && node.name === 'li') {
      const srChild = $(node).children('div.sr').first();
      if (srChild.length) {
        const cleaned = cleanBreadcrumbLabel(srChild.text());
        if (cleaned && !/поиск/i.test(cleaned)) labels.push(cleaned);
      }
    }
  }

  const breadcrumbs = labels.reverse();
  return breadcrumbs.slice(-3);
}

function extractTitleFromDevsHtml(html) {
  const m = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (!m) return 'Без названия';
  return stripHtmlTags(m[1]);
}

function extractBodyFromDevsHtml(html) {
  const m = html.match(/<h2[^>]*>[\s\S]*?<\/h2>/i);
  if (!m) return stripHtmlTags(html);
  const idx = html.search(/<h2[^>]*>[\s\S]*?<\/h2>/i);
  if (idx < 0) return stripHtmlTags(html);
  let body = html.slice(idx + m[0].length).trim();

  // Cut Bitrix page chrome / footer that follows article HTML.
  const chromeMarkers = [
    /<link\b[^>]*\bhref=["'][^"']*\/devs\/(?:bootstrap|asset)/i,
    /<link\b[^>]*\bhref=["']https?:\/\/daneden\.github\.io/i,
    /<div id="footer"/i,
    /class="bx-layout-inner-center"/i
  ];
  for (const re of chromeMarkers) {
    const cut = body.search(re);
    if (cut >= 0) body = body.slice(0, cut);
  }

  body = body
    .replace(/<link\b[^>]*\bhref=["']\/devs\/[^"']*["'][^>]*\/?>/gi, '')
    .replace(/<script\b[^>]*\bsrc=["']\/devs\/[^"']*["'][^>]*>\s*<\/script>/gi, '')
    .replace(/<script\b[^>]*\bsrc=["']\/devs\/[^"']*["'][^>]*\/>/gi, '')
    .replace(/<\/?div[^>]*>\s*$/g, '')
    .trim();

  return body;
}

function decodeSrc(src) {
  return String(src || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .trim();
}

function isContentImageSrc(src) {
  const s = decodeSrc(src);
  if (!s || s.startsWith('data:')) return false;
  // UI avatars / bitrix chrome
  if (/\/upload\/resize_cache\//i.test(s)) return false;
  if (/\/bitrix\//i.test(s)) return false;
  if (/\/devs\/asset\//i.test(s)) return false;
  if (/\.js(\?|$)/i.test(s)) return false;
  return true;
}

function extractImageSrcsFromBody(bodyHtml) {
  const srcs = new Set();
  const imgRe = /<img[^>]*\bsrc="([^"]+)"[^>]*>/gi;
  for (const m of bodyHtml.matchAll(imgRe)) {
    const src = decodeSrc(m[1]);
    if (!isContentImageSrc(src)) continue;
    srcs.add(src);
  }
  return [...srcs];
}

function localFileNameForSrc(src) {
  const clean = decodeSrc(src).split('?')[0];
  const base = basename(clean) || 'image.bin';
  const ext = extname(base) || '.png';
  const stem = basename(base, ext).replace(/[^\w.\-()\u0400-\u04FF]+/g, '_') || 'image';
  // Avoid collisions when several paths share content-img.png
  const hash = createHash('sha1').update(clean).digest('hex').slice(0, 8);
  if (/^content-img/i.test(stem) || stem === 'image') {
    return `${stem}-${hash}${ext}`;
  }
  // Still uniquify if basename is generic
  if (/^(img|image|photo|screenshot)\d*$/i.test(stem)) {
    return `${stem}-${hash}${ext}`;
  }
  return `${stem}${ext}`;
}

async function downloadAndSaveImage(remoteUrl, localAbsPath) {
  const res = await fetch(remoteUrl, {
    headers: { 'User-Agent': 'VBI-HR-Knowledge-Migrate/1.0' },
    redirect: 'follow'
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${remoteUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(dirname(localAbsPath), { recursive: true });
  writeFileSync(localAbsPath, buf);
}

async function migrate() {
  const scrapeDir = getNewestScrapeDir();
  console.log(`Скрап-папка: ${scrapeDir}`);
  const files = readdirSync(scrapeDir, { withFileTypes: true })
    .filter((f) => f.isFile() && f.name.startsWith('devs-') && f.name.endsWith('.html'))
    .map((f) => f.name);

  const nowIso = new Date().toISOString();

  let knowledgeStateRaw = '{ "articles": [], "nextId": 1 }';
  if (existsSync(KNOWLEDGE_DATA_FILE)) {
    knowledgeStateRaw = readFileSync(KNOWLEDGE_DATA_FILE, 'utf8');
  }

  const knowledgeState = JSON.parse(knowledgeStateRaw);
  knowledgeState.articles = Array.isArray(knowledgeState.articles) ? knowledgeState.articles : [];
  knowledgeState.nextId = typeof knowledgeState.nextId === 'number' ? knowledgeState.nextId : 1;

  const existingById = new Map(knowledgeState.articles.map((a) => [a.id, a]));

  let ok = 0;
  let imgFail = 0;

  for (const file of files) {
    const devsId = file.match(/^devs-(\d+)\.html$/)?.[1];
    if (!devsId) continue;

    const devsIdNum = Number(devsId);
    const kbId = `kb-${devsId}`;

    const html = readFileSync(join(scrapeDir, file), 'utf8');
    const title = extractTitleFromDevsHtml(html);
    if (!title || title === 'Без названия') {
      console.log(`Пропуск ${kbId}: пустой заголовок (раздел меню, не статья)`);
      continue;
    }
    const breadcrumbs = extractBreadcrumbsFromDevsHtml(html, devsIdNum);

    let body = extractBodyFromDevsHtml(html);

    const uniqueImgSrcs = extractImageSrcsFromBody(body);
    const localDir = join(FRONTEND_PUBLIC_KNOWLEDGE, `article-${devsId}`);

    for (const src of uniqueImgSrcs) {
      const decoded = decodeSrc(src);
      const absRemote = decoded.startsWith('http') ? decoded : `https://crm.vbi.ru${decoded}`;
      const fileName = localFileNameForSrc(decoded);
      const localAbs = join(localDir, fileName);
      const localPublicSrc = `/knowledge/article-${devsId}/${fileName}`;

      try {
        if (!existsSync(localAbs)) {
          console.log(`Скачиваю ${fileName} для ${devsId} ...`);
          await downloadAndSaveImage(absRemote, localAbs);
        }
        body = body.replaceAll(`src="${src}"`, `src="${localPublicSrc}"`);
        body = body.replaceAll(`src="${decoded}"`, `src="${localPublicSrc}"`);
        // HTML may still have &amp; form
        const ampForm = decoded.replace(/&/g, '&amp;');
        if (ampForm !== decoded) {
          body = body.replaceAll(`src="${ampForm}"`, `src="${localPublicSrc}"`);
        }
      } catch (err) {
        imgFail += 1;
        console.warn(`  ! image fail ${devsId}: ${absRemote} — ${String(err?.message || err)}`);
      }
    }

    const plainSummary = stripHtmlTags(body).slice(0, 240);
    const summary = plainSummary.length ? plainSummary : `Статья из Bitrix devs/${devsId}/`;

    const existing = existingById.get(kbId);
    const createdAt = existing?.createdAt || nowIso;
    const authorName = existing?.authorName || 'Администратор';

    const nextArticle = {
      id: kbId,
      title,
      summary,
      body,
      tags: [],
      breadcrumbs,
      status: 'published',
      createdAt,
      updatedAt: nowIso,
      authorName
    };

    if (existing) {
      const idx = knowledgeState.articles.findIndex((a) => a.id === kbId);
      if (idx >= 0) knowledgeState.articles[idx] = nextArticle;
    } else {
      knowledgeState.articles.push(nextArticle);
      existingById.set(kbId, nextArticle);
    }

    ok += 1;
    console.log(`Мигрировал ${kbId}: ${title.slice(0, 70)} | ${breadcrumbs.join(' / ') || '(empty)'}`);
  }

  const numericIds = knowledgeState.articles
    .map((a) => {
      const m = String(a.id || '').match(/^kb-(\d+)$/);
      return m ? Number(m[1]) : NaN;
    })
    .filter((n) => Number.isFinite(n));

  const maxNumeric = numericIds.length ? Math.max(...numericIds) : 0;
  knowledgeState.nextId = Math.max(knowledgeState.nextId, maxNumeric + 1);

  const tmpPath = `${KNOWLEDGE_DATA_FILE}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(knowledgeState, null, 2), 'utf8');
  renameSync(tmpPath, KNOWLEDGE_DATA_FILE);

  console.log(`Готово. Статей в сиде: ${knowledgeState.articles.length} (обработано файлов: ${ok}, image fail: ${imgFail})`);
  console.log(`Файл: ${KNOWLEDGE_DATA_FILE}`);
}

migrate().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
