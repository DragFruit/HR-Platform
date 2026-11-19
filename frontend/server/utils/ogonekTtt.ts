import { createHmac } from 'node:crypto';
import { getDeployAppEnv } from './appEnv';
import { mutateOgonek, readOgonekState, type OgonekTttMatch } from './ogonekStore';

/**
 * Крестики-нолики «Огонька» (окно 10) — связка с сайтом игры.
 *
 * Ссылка «Играть» ведёт на /api/vibe/enter игры с подписанным токеном
 * сотрудника; игра кладёт его в куку и помнит, кто в каком слоте комнаты.
 * Результаты онлайн-партий платформа забирает сама (pull), не чаще раза в
 * минуту: подписанный запрос /api/vibe/results?env&since&ts&sig. Партии
 * складываются в ogonek.json без повторов (по id комнаты).
 *
 * Секрет — OGONEK_TTT_SECRET (у игры тот же в VIBE_TTT_SECRET). Без секрета
 * ссылка ведёт просто на игру, а рейтинг не наполняется.
 */

const SYNC_EVERY_MS = 60_000;
const TOKEN_DAYS = 30;

function secret(): string {
  return String(process.env.OGONEK_TTT_SECRET || '').trim();
}

export function ogonekTttBase(): string {
  return String(process.env.OGONEK_TTT_URL || 'https://ultimate-tic-tac-toe.ru').replace(/\/+$/, '');
}

/** Окружение в токене: партии стейджа и боя не смешиваются. */
function tttEnv(): string {
  const env = getDeployAppEnv();
  return env === 'production' ? 'prod' : env === 'staging' ? 'staging' : 'local';
}

const b64 = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Ссылка «Играть» для сотрудника: с токеном, если связка настроена. */
export function ogonekTttEnterUrl(userId: number, name: string): string {
  const key = secret();
  if (!key) return `${ogonekTttBase()}/`;
  const payload = b64(
    Buffer.from(
      JSON.stringify({
        env: tttEnv(),
        uid: String(userId),
        name: name.slice(0, 64),
        exp: Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400
      })
    )
  );
  const sig = b64(createHmac('sha256', key).update(payload).digest());
  return `${ogonekTttBase()}/api/vibe/enter?t=${encodeURIComponent(`${payload}.${sig}`)}`;
}

let lastSyncAt = 0;
let syncing: Promise<void> | null = null;

/** Забрать новые партии с сайта игры. Тихо пропускает сбои сети. */
export async function syncOgonekTtt(): Promise<void> {
  const key = secret();
  if (!key || Date.now() - lastSyncAt < SYNC_EVERY_MS) return;
  if (syncing) return syncing;
  lastSyncAt = Date.now();
  syncing = (async () => {
    try {
      const state = await readOgonekState();
      const since = state.ttt?.since ?? '';
      const env = tttEnv();
      const ts = Math.floor(Date.now() / 1000);
      const sig = createHmac('sha256', key).update(`${env}|${since}|${ts}`).digest('hex');
      const qs = new URLSearchParams({ env, since, ts: String(ts), sig });
      const res = await $fetch<{ matches: OgonekTttMatch[] & { finished_at?: string }[] }>(
        `${ogonekTttBase()}/api/vibe/results?${qs}`,
        { timeout: 5000 }
      );
      const incoming = (res.matches ?? []) as unknown as {
        id: number;
        finished_at: string;
        winner: string;
        p1: { uid: string; name: string };
        p2: { uid: string; name: string };
      }[];
      if (!incoming.length) return;
      await mutateOgonek((s) => {
        const ttt = s.ttt ?? { since: '', matches: [] };
        const known = new Set(ttt.matches.map((m) => m.id));
        for (const m of incoming) {
          if (!m.id || known.has(m.id)) continue;
          ttt.matches.push({
            id: m.id,
            at: m.finished_at,
            winner: m.winner === 'player1' || m.winner === 'player2' ? m.winner : 'draw',
            p1: { uid: String(m.p1.uid), name: String(m.p1.name || '') },
            p2: { uid: String(m.p2.uid), name: String(m.p2.name || '') }
          });
          known.add(m.id);
          if (m.finished_at > ttt.since) ttt.since = m.finished_at;
        }
        s.ttt = ttt;
      });
    } catch {
      // Игра недоступна — попробуем через минуту, данные догонятся
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

export type OgonekTttRow = { uid: string; name: string; wins: number; draws: number; losses: number; games: number };

/** Таблица лидеров: больше побед выше, при равенстве — меньше поражений. */
export function ogonekTttLeaders(matches: OgonekTttMatch[], nameOf: (uid: string) => string | undefined): OgonekTttRow[] {
  const by = new Map<string, OgonekTttRow>();
  const row = (p: { uid: string; name: string }) => {
    let r = by.get(p.uid);
    if (!r) {
      r = { uid: p.uid, name: nameOf(p.uid) || p.name || 'Игрок', wins: 0, draws: 0, losses: 0, games: 0 };
      by.set(p.uid, r);
    }
    return r;
  };
  for (const m of matches) {
    const a = row(m.p1);
    const b = row(m.p2);
    a.games++;
    b.games++;
    if (m.winner === 'draw') { a.draws++; b.draws++; }
    else if (m.winner === 'player1') { a.wins++; b.losses++; }
    else { b.wins++; a.losses++; }
  }
  return [...by.values()].sort((x, y) => y.wins - x.wins || x.losses - y.losses || y.draws - x.draws || x.name.localeCompare(y.name, 'ru'));
}
