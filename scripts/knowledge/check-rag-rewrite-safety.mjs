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

console.log('ok: rewrite safety checks passed');
console.log('Полный eval на перефразах: POST /api/admin/knowledge/rag-eval (admin/hr, индекс должен быть собран).');
