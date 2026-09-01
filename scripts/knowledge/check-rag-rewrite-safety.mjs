#!/usr/bin/env node
/**
 * Локальная проверка правил переформулировки (без Yandex / индекса).
 * Полный прогон по статьям: POST /api/admin/knowledge/rag-eval на стейдже (под сессией admin).
 *
 *   node scripts/knowledge/check-rag-rewrite-safety.mjs
 */
import assert from 'node:assert/strict';

const STOP = new Set(['и', 'в', 'на', 'по', 'для', 'как', 'что', 'это', 'или', 'из']);

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP.has(t));
}

function isRewriteSafe(original, rewrite) {
  const a = new Set(tokenize(original));
  const b = new Set(tokenize(rewrite));
  if (!a.size || !b.size) return false;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const recall = inter / a.size;
  const precision = inter / b.size;
  if (recall < 0.4) return false;
  if (precision < 0.35 && b.size > a.size * 1.5) return false;
  const lenRatio = rewrite.trim().length / Math.max(1, original.trim().length);
  if (lenRatio < 0.4 || lenRatio > 2.5) return false;
  return true;
}

assert.equal(isRewriteSafe('как уйти в отпуск в digital', 'как оформить отпуск в digital'), true);
assert.equal(isRewriteSafe('как уйти в отпуск в digital', 'как настроить рекламу в Яндекс Директ'), false);
assert.equal(isRewriteSafe('доступы AFINA', 'доступы к афине CRM'), true);
assert.equal(isRewriteSafe('контакты', 'погода в Москве завтра вечером'), false);

// Синонимы увольнения (зеркало knowledgeRagLexical SYNONYM_GROUPS)
const RESIGN = [
  'увольнение',
  'увольнения',
  'увольнении',
  'уволиться',
  'уволится',
  'уволюсь',
  'увольняюсь',
  'процесс увольнения',
  'регламент увольнения',
  'как уволиться',
  'как уволится',
  'хочу уволиться',
  'хочу уволится',
  'что нужно чтобы уволиться'
];
function expandResign(q) {
  const lower = q.toLowerCase();
  const hit = RESIGN.some((t) => lower.includes(t.toLowerCase()));
  if (!hit) return q;
  const extra = RESIGN.filter((t) => !lower.includes(t.toLowerCase()));
  return `${q} ${extra.join(' ')}`;
}
for (const q of ['как уволиться', 'хочу уволится что нужно', 'процесс увольнения', 'увольнение']) {
  const expanded = expandResign(q);
  assert.ok(expanded.toLowerCase().includes('увольнение'), q);
  assert.ok(expanded.toLowerCase().includes('уволиться') || q.includes('увольнен'), q);
}

console.log('ok: rewrite safety checks passed');
console.log('ok: resignation synonym expansion');
console.log('Полный eval на перефразах: POST /api/admin/knowledge/rag-eval (admin/hr, индекс должен быть собран).');
