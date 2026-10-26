/**
 * Серверный шлюз квеста: кто какой этап видит, что открыто, сколько баллов.
 * Клиенту отдаём только открытые этапы — улики пятницы не должны уехать
 * в браузер в понедельник.
 */

import type {
  NokturnMinigameButtonState,
  NokturnStageId,
  NokturnStageView
} from '../../app/events/nokturn/types';
import {
  NOKTURN_STAGE_IDS,
  nokturnStageFullRateUntil,
  nokturnStageOpensAt,
  nokturnStageScheduleOpen
} from '../../app/events/nokturn/timeline';
import {
  nokturnEvidenceForStage,
  nokturnStageById,
  nokturnTestimoniesForStage,
  NOKTURN_FIXTURES,
  NOKTURN_STAGES
} from '../../app/events/nokturn/content';
import { NOKTURN_MINIGAME_ATTEMPTS, type NokturnPlayer } from './nokturnStore';
import { getDeployAppEnv } from './appEnv';

/**
 * Отладочный режим: все этапы и мини-игры открыты сразу, расписание и цепочка
 * «сначала реши предыдущий» не действуют. Нужен, чтобы прогонять дни квеста
 * до их наступления.
 *
 * Работает на localhost и стейдже, на бою игнорируется — там этапы открывает
 * только календарь. Выключается переменной `NOKTURN_DEBUG_OPEN_ALL=0`.
 */
export function nokturnDebugOpenAll(): boolean {
  if (getDeployAppEnv() === 'production') return false;
  return String(process.env.NOKTURN_DEBUG_OPEN_ALL ?? '1').trim() !== '0';
}

/** Правильные ответы живут только на сервере. */
export const NOKTURN_CULPRIT = 'roman' as const;
export const NOKTURN_MECHANICS_CORRECT_OPTION = 2;

/** Календарный день МСК. */
export function moscowDateIso(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

export function hasDecision(player: NokturnPlayer, id: NokturnStageId): boolean {
  return Boolean(player.stages[String(id)]?.vote);
}

/**
 * Календарь догоняющего: этап N держит первый предыдущий этап без решения.
 * Вперёд календаря уйти нельзя — 10:00 дня N проверяется отдельно.
 */
export function blockingStage(
  player: NokturnPlayer,
  id: NokturnStageId
): NokturnStageId | null {
  for (const prev of NOKTURN_STAGE_IDS) {
    if (prev >= id) break;
    if (!hasDecision(player, prev)) return prev;
  }
  return null;
}

export function isStageOpen(
  player: NokturnPlayer,
  id: NokturnStageId,
  now: Date
): boolean {
  if (nokturnDebugOpenAll()) return true;
  if (!nokturnStageScheduleOpen(id, now)) return false;
  return blockingStage(player, id) === null;
}

function minigameState(
  player: NokturnPlayer,
  id: NokturnStageId,
  now: Date
): NokturnMinigameButtonState {
  const debug = nokturnDebugOpenAll();
  if (!debug && !nokturnStageScheduleOpen(id, now)) return 'locked';
  if (!debug && blockingStage(player, id) !== null) return 'blocked-by-stage';
  const p = player.stages[String(id)];
  if (p?.released) return 'done';
  if (debug) return 'available';
  const today = moscowDateIso(now);
  return nokturnStageById(id).dateIso === today ? 'available' : 'catch-up';
}

/**
 * Этапы для клиента. Закрытый этап приходит без брифа, улик, показаний
 * и без координат мини-игры — только расписание и состояние кнопки.
 */
export function buildStageViews(player: NokturnPlayer, now: Date): NokturnStageView[] {
  return NOKTURN_STAGES.map((stage) => {
    const id = stage.id;
    const scheduleOpen = nokturnDebugOpenAll() || nokturnStageScheduleOpen(id, now);
    const open = isStageOpen(player, id, now);
    const progress = player.stages[String(id)];
    const state = minigameState(player, id, now);
    const evidenceReleased = Boolean(progress?.released);

    return {
      id,
      dateIso: stage.dateIso,
      weekday: stage.weekday,
      title: stage.title,
      briefing: open ? stage.briefing : [],
      stake: stage.stake,
      open,
      scheduleOpen,
      opensAt: nokturnStageOpensAt(id),
      fullRateUntil: nokturnStageFullRateUntil(id),
      blockedByStage: nokturnDebugOpenAll() || !scheduleOpen ? null : blockingStage(player, id),
      minigame: {
        slug: stage.minigame.slug,
        kind: stage.minigame.kind,
        title: stage.minigame.title,
        background: stage.minigame.background,
        attemptSeconds: stage.minigame.attemptSeconds ?? 0,
        hotspots: open ? (stage.minigame.hotspots ?? []) : [],
        state,
        attempts: progress?.attempts ?? 0,
        solved: Boolean(progress?.solved),
        released: evidenceReleased
      },
      vote: progress?.vote ?? null,
      // Улики дня приходят только после выдачи (мини-игра или 3 попытки);
      // пакет дня без мини-игры — сразу, как только этап открыт.
      evidence: open
        ? nokturnEvidenceForStage(id).filter((e) => (e.fromMinigame ? evidenceReleased : true))
        : [],
      testimonies: open ? nokturnTestimoniesForStage(id) : []
    };
  });
}

/**
 * Что игроку разрешено держать на доске: выданные улики плюс постоянная
 * обстановка (карточка дела и шесть портретов).
 */
export function allowedBoardIds(player: NokturnPlayer, now: Date): Set<string> {
  const ids = new Set<string>(NOKTURN_FIXTURES.map((f) => f.id));
  for (const view of buildStageViews(player, now)) {
    for (const e of view.evidence) ids.add(e.id);
  }
  return ids;
}

export function attemptsLeft(player: NokturnPlayer, id: NokturnStageId): number {
  const used = player.stages[String(id)]?.attempts ?? 0;
  return Math.max(0, NOKTURN_MINIGAME_ATTEMPTS - used);
}
