import { requireVbiSession } from '../../../utils/session';
import { ogonekClock } from '../../../utils/ogonekClock';
import { getDeployAppEnv } from '../../../utils/appEnv';
import {
  findOrCreateOgonekPlayer,
  markOgonekDone,
  mutateOgonek,
  normalizeOgonekPixels,
  ogonekId,
  pushOgonekFeed,
  OGONEK_LETTER_MAX,
  OGONEK_RECIPE_MAX,
  OGONEK_THANKS_MAX,
  OGONEK_TOY_SIZE,
  OGONEK_WISH_MAX
} from '../../../utils/ogonekStore';
import { requireUnlockedDay } from '../../../utils/ogonekGate';
import { readEmployees } from '../../../utils/employeesStore';
import { ogonekDemoAllowed } from '../../../utils/ogonekDemo';
import { OGONEK_LETTER_DELIVERY_AT } from '../../../../app/events/ogonek/timeline';
import { ogonekDayById } from '../../../../app/events/ogonek/content';
import { isOgonekFlakeQuarter } from '../../../../app/events/ogonek/snowflake';

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
  dayId?: number;
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

/**
 * Окна, где своего действия нет (ждут материалы заказчика) или где действие
 * само по себе прочтение, засчитываются кнопкой «Прочитал». Финал — тоже:
 * там кнопка «Зажечь огонёк».
 */
function completesByReading(dayId: number): boolean {
  const day = ogonekDayById(dayId);
  return Boolean(day.awaiting) || day.kind === 'final';
}

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
  const clock = ogonekClock(event);

  // Сброс своего прогресса из панели отладки — только вне боя.
  if (kind === 'devReset') {
    if (getDeployAppEnv() === 'production') {
      throw createError({ statusCode: 403, statusMessage: 'недоступно на бою' });
    }
    return mutateOgonek((state) => {
      const player = findOrCreateOgonekPlayer(state, session.id, session.name || 'Сотрудник', session.department || '');
      // Сбрасываются только листки и огоньки. Игрушка, снежинка, письмо и
      // открытки остаются — это видимые другим артефакты.
      player.opened = [];
      player.done = [];
      return { ok: true };
    });
  }

  // Открытку можно отправить и из финала (окно 19): без ограничения по числу.
  const fromFinal = kind === 'thanks' && Number(body.dayId) === 19;
  const dayId = kind === 'complete' ? Number(body.dayId) : fromFinal ? 19 : DAY_OF[kind];
  if (!dayId || !Number.isInteger(dayId) || dayId < 1 || dayId > 19) {
    throw createError({ statusCode: 400, statusMessage: 'unknown kind' });
  }
  if (kind === 'complete' && !completesByReading(dayId)) {
    throw createError({ statusCode: 400, statusMessage: 'это окно засчитывается своим действием' });
  }
  // Получателя «спасибо» проверяем по справочнику до входа в очередь мутаций.
  const employees = kind === 'thanks' ? await readEmployees() : [];

  return mutateOgonek((state) => {
    const player = findOrCreateOgonekPlayer(
      state,
      session.id,
      session.name || 'Сотрудник',
      session.department || ''
    );
    requireUnlockedDay(player, dayId, clock);
    const who = { name: player.name, department: player.department };

    const done = () => markOgonekDone(player, dayId);

    switch (kind) {
      case 'complete': {
        done();
        return { ok: true, done: player.done };
      }
      case 'song': {
        player.song = String(body.text || '').trim().slice(0, 160);
        if (!player.song) throw createError({ statusCode: 400, statusMessage: 'text required' });
        done();
        // В ленту песню не пишем: плейлист — сюрприз до вечера (спека, раздел 3).
        return { ok: true, song: player.song };
      }
      case 'hat': {
        player.hat = Boolean(body.on);
        if (player.hat) done();
        return { ok: true, hat: player.hat };
      }
      case 'plug': {
        const next = Boolean(body.on);
        const changed = next !== player.plugged;
        player.plugged = next;
        if (changed && next) pushOgonekFeed(state, 'plug', 'вилка в розетке, декор горит', who);
        if (next) done();
        return { ok: true, plugged: player.plugged };
      }
      case 'skating': {
        player.skating = Boolean(body.on) || undefined;
        if (player.skating) {
          pushOgonekFeed(state, 'skating', 'записались на каток', who);
          done();
        }
        return { ok: true, skating: Boolean(player.skating) };
      }
      case 'dresscode': {
        player.dresscode = String(body.choice || '').trim().slice(0, 80) || undefined;
        if (player.dresscode) done();
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
        done();
        return { ok: true, toy };
      }
      case 'snowflake': {
        // Четверть 5×5: остальное отражается само.
        if (!isOgonekFlakeQuarter(body.pixels)) {
          throw createError({ statusCode: 400, statusMessage: 'закрасьте хотя бы одну клетку' });
        }
        const pixels = [...body.pixels];
        const existing = state.snowflakes.find((s) => s.id === player.snowflakeId);
        if (existing) {
          existing.pixels = pixels;
          done();
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
        done();
        return { ok: true, snowflake: flake };
      }
      case 'thanks': {
        const text = String(body.text || '').trim().slice(0, OGONEK_THANKS_MAX);
        if (!text) throw createError({ statusCode: 400, statusMessage: 'нужен текст открытки' });
        const target = employees.find((e) => e.id === Number(body.toEmployeeId));
        if (!target) throw createError({ statusCode: 400, statusMessage: 'адресат не найден' });
        const toUserId = Number(target.platform_user_id) || 0;
        if (!toUserId) {
          // Иначе открытка легла бы с toUserId 0 и не нашла адресата никогда,
          // а отправителю отрапортовали бы «отправлено».
          throw createError({ statusCode: 400, statusMessage: 'у коллеги нет учётной записи на платформе' });
        }
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
        // Финал засчитывается своей кнопкой, открытка его не закрывает.
        if (!fromFinal) done();
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
        done();
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
          done();
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
        done();
        return { ok: true, recipeId: recipe.id };
      }
      case 'recipeVote': {
        const id = String(body.recipeId || '');

        // Прошлый голос снимаем всегда и первым делом — иначе голос за
        // демо-рецепт оставлял бы висеть голос за настоящий и завышал итоги.
        const prev = state.recipes.find((r) => r.id === player.recipeVote);
        if (prev && prev.voters.includes(player.userId)) {
          prev.voters = prev.voters.filter((v) => v !== player.userId);
          prev.votes = prev.voters.length;
        }

        // Демо-рецепты живут вне файла данных: голос за них не сохраняем,
        // иначе голоса показа попали бы в настоящие итоги. На бою демо нет,
        // поэтому такой id там просто не существует.
        if (id.startsWith('demo-')) {
          if (!ogonekDemoAllowed()) {
            throw createError({ statusCode: 400, statusMessage: 'рецепт не найден' });
          }
          player.recipeVote = id;
          done();
          return { ok: true, recipeVote: id, demo: true };
        }
        const recipe = state.recipes.find((r) => r.id === id);
        if (!recipe) throw createError({ statusCode: 400, statusMessage: 'рецепт не найден' });
        if (recipe.userId === player.userId) {
          throw createError({ statusCode: 400, statusMessage: 'за свой рецепт голосовать нельзя' });
        }
        if (!recipe.voters.includes(player.userId)) recipe.voters.push(player.userId);
        recipe.votes = recipe.voters.length;
        player.recipeVote = recipe.id;
        done();
        return { ok: true, recipeVote: recipe.id };
      }
      default:
        throw createError({ statusCode: 400, statusMessage: 'unknown kind' });
    }
  });
});
