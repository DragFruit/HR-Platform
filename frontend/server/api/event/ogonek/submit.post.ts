import { requireVbiSession } from '../../../utils/session';
import { ogonekNow } from '../../../utils/ogonekClock';
import {
  findOrCreateOgonekPlayer,
  mutateOgonek,
  normalizeOgonekPixels,
  ogonekId,
  pushOgonekFeed,
  OGONEK_LETTER_MAX,
  OGONEK_RECIPE_MAX,
  OGONEK_SNOWFLAKE_SIZE,
  OGONEK_THANKS_MAX,
  OGONEK_TOY_SIZE,
  OGONEK_WISH_MAX
} from '../../../utils/ogonekStore';
import { requireUnlockedDay } from '../../../utils/ogonekGate';
import { readEmployees } from '../../../utils/employeesStore';
import { OGONEK_LETTER_DELIVERY_AT } from '../../../../app/events/ogonek/timeline';

type Body = {
  kind?: string;
  on?: boolean;
  text?: string;
  title?: string;
  wish?: string;
  pixels?: string[];
  x?: number;
  y?: number;
  choice?: string;
  toEmployeeId?: number;
  recipeId?: string;
};

/** Какое окно отвечает за какое действие. Без открытого окна действие нельзя. */
const DAY_OF: Record<string, number> = {
  song: 1,
  hat: 2,
  plug: 4,
  skating: 5,
  toy: 6,
  dresscode: 8,
  snowflake: 12,
  thanks: 13,
  letter: 16,
  recipe: 17,
  recipeVote: 17
};

const clamp01 = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
};

/**
 * Единая точка для действий внутри окон. Одна ручка вместо десятка: проверка
 * «окно открыто» делается ровно один раз и не может разъехаться между
 * эндпоинтами.
 */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const body = await readBody<Body>(event).catch(() => ({} as Body));
  const kind = String(body.kind || '');
  const dayId = DAY_OF[kind];
  if (!dayId) throw createError({ statusCode: 400, statusMessage: 'unknown kind' });

  const now = ogonekNow();
  // Получателя «спасибо» проверяем по справочнику до входа в очередь мутаций.
  const employees = kind === 'thanks' ? await readEmployees() : [];

  return mutateOgonek((state) => {
    const player = findOrCreateOgonekPlayer(
      state,
      session.id,
      session.name || 'Сотрудник',
      session.department || ''
    );
    requireUnlockedDay(player, dayId, now);
    const who = { name: player.name, department: player.department };

    switch (kind) {
      case 'song': {
        player.song = String(body.text || '').trim().slice(0, 160);
        if (!player.song) throw createError({ statusCode: 400, statusMessage: 'text required' });
        // В ленту песню не пишем: плейлист — сюрприз до вечера (спека, раздел 3).
        return { ok: true, song: player.song };
      }
      case 'hat': {
        player.hat = Boolean(body.on);
        return { ok: true, hat: player.hat };
      }
      case 'plug': {
        const next = Boolean(body.on);
        const changed = next !== player.plugged;
        player.plugged = next;
        if (changed && next) pushOgonekFeed(state, 'plug', 'вилка в розетке, декор горит', who);
        return { ok: true, plugged: player.plugged };
      }
      case 'skating': {
        player.skating = Boolean(body.on) || undefined;
        if (player.skating) pushOgonekFeed(state, 'skating', 'записались на каток', who);
        return { ok: true, skating: Boolean(player.skating) };
      }
      case 'dresscode': {
        player.dresscode = String(body.choice || '').trim().slice(0, 80) || undefined;
        return { ok: true, dresscode: player.dresscode ?? '' };
      }
      case 'toy': {
        const pixels = normalizeOgonekPixels(body.pixels, OGONEK_TOY_SIZE);
        if (!pixels) throw createError({ statusCode: 400, statusMessage: 'пустая или кривая сетка игрушки' });
        const wish = String(body.wish || '').trim().slice(0, OGONEK_WISH_MAX);
        if (!wish) throw createError({ statusCode: 400, statusMessage: 'нужно пожелание на будущий год' });
        const existing = state.toys.find((t) => t.id === player.toyId);
        const toy = existing ?? {
          id: ogonekId('toy'),
          userId: player.userId,
          name: player.name,
          department: player.department,
          pixels,
          wish,
          x: clamp01(body.x),
          y: clamp01(body.y),
          createdAt: new Date().toISOString()
        };
        toy.pixels = pixels;
        toy.wish = wish;
        toy.name = player.name;
        toy.department = player.department;
        toy.x = clamp01(body.x);
        toy.y = clamp01(body.y);
        if (!existing) {
          state.toys.push(toy);
          pushOgonekFeed(state, 'toy', 'новая игрушка на ёлке', who);
        }
        player.toyId = toy.id;
        return { ok: true, toy };
      }
      case 'snowflake': {
        const pixels = normalizeOgonekPixels(body.pixels, OGONEK_SNOWFLAKE_SIZE);
        if (!pixels) throw createError({ statusCode: 400, statusMessage: 'пустая или кривая сетка снежинки' });
        const existing = state.snowflakes.find((s) => s.id === player.snowflakeId);
        if (existing) {
          existing.pixels = pixels;
          return { ok: true, snowflake: existing };
        }
        const flake = {
          id: ogonekId('flake'),
          userId: player.userId,
          name: player.name,
          pixels,
          createdAt: new Date().toISOString()
        };
        state.snowflakes.push(flake);
        player.snowflakeId = flake.id;
        pushOgonekFeed(state, 'snowflake', 'снежинка улетела в метель', who);
        return { ok: true, snowflake: flake };
      }
      case 'thanks': {
        const text = String(body.text || '').trim().slice(0, OGONEK_THANKS_MAX);
        if (!text) throw createError({ statusCode: 400, statusMessage: 'нужен текст открытки' });
        const target = employees.find((e) => e.id === Number(body.toEmployeeId));
        if (!target) throw createError({ statusCode: 400, statusMessage: 'адресат не найден' });
        const toUserId = Number(target.platform_user_id) || 0;
        if (toUserId === player.userId) {
          throw createError({ statusCode: 400, statusMessage: 'это открытка коллеге, не себе' });
        }
        state.thanks.push({
          id: ogonekId('th'),
          toUserId,
          toName: target.name,
          text,
          createdAt: new Date().toISOString()
        });
        player.thanksSent += 1;
        // Имени отправителя нет и в хранилище: открытка анонимна.
        pushOgonekFeed(state, 'thanks', 'кто-то сказал спасибо коллеге', null);
        return { ok: true, thanksSent: player.thanksSent };
      }
      case 'letter': {
        const text = String(body.text || '').trim().slice(0, OGONEK_LETTER_MAX);
        if (!text) throw createError({ statusCode: 400, statusMessage: 'письмо пустое' });
        if (player.letterId) {
          throw createError({ statusCode: 409, statusMessage: 'письмо уже запечатано' });
        }
        const letter = {
          id: ogonekId('lt'),
          userId: player.userId,
          name: player.name,
          text,
          createdAt: new Date().toISOString(),
          deliverAt: OGONEK_LETTER_DELIVERY_AT,
          delivered: false
        };
        state.letters.push(letter);
        player.letterId = letter.id;
        pushOgonekFeed(state, 'letter', 'письмо себе запечатано', who);
        return { ok: true, letter: { sealedAt: letter.createdAt, deliverAt: letter.deliverAt } };
      }
      case 'recipe': {
        const title = String(body.title || '').trim().slice(0, 120);
        const text = String(body.text || '').trim().slice(0, OGONEK_RECIPE_MAX);
        if (!title || !text) throw createError({ statusCode: 400, statusMessage: 'нужны название и рецепт' });
        const existing = state.recipes.find((r) => r.id === player.recipeId);
        if (existing) {
          existing.title = title;
          existing.text = text;
          return { ok: true, recipeId: existing.id };
        }
        const recipe = {
          id: ogonekId('rc'),
          userId: player.userId,
          name: player.name,
          department: player.department,
          title,
          text,
          votes: 0,
          voters: [] as number[],
          createdAt: new Date().toISOString()
        };
        state.recipes.push(recipe);
        player.recipeId = recipe.id;
        pushOgonekFeed(state, 'recipe', 'рецепт оливье выложен', who);
        return { ok: true, recipeId: recipe.id };
      }
      case 'recipeVote': {
        const id = String(body.recipeId || '');
        // Демо-рецепты живут вне файла данных: голос за них не сохраняем,
        // иначе голоса показа попадут в настоящие итоги.
        if (id.startsWith('demo-')) {
          player.recipeVote = id;
          return { ok: true, recipeVote: id, demo: true };
        }
        const recipe = state.recipes.find((r) => r.id === id);
        if (!recipe) throw createError({ statusCode: 400, statusMessage: 'рецепт не найден' });
        if (recipe.userId === player.userId) {
          throw createError({ statusCode: 400, statusMessage: 'за свой рецепт голосовать нельзя' });
        }
        const prev = state.recipes.find((r) => r.id === player.recipeVote);
        if (prev && prev.voters.includes(player.userId)) {
          prev.voters = prev.voters.filter((v) => v !== player.userId);
          prev.votes = prev.voters.length;
        }
        if (!recipe.voters.includes(player.userId)) recipe.voters.push(player.userId);
        recipe.votes = recipe.voters.length;
        player.recipeVote = recipe.id;
        return { ok: true, recipeVote: recipe.id };
      }
      default:
        throw createError({ statusCode: 400, statusMessage: 'unknown kind' });
    }
  });
});
