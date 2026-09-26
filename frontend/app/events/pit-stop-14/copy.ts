import type { PitStopCheckpointId } from './types';

const withPartner = (text: string, partnerName: string) =>
  text.replaceAll('{Partner_Name}', partnerName || 'напарник');

export type PitStopCopyBlock = {
  title: string;
  body: string;
  /** Доп. строки под роль (точка 4) */
  roleHint?: string;
};

export function pitStopCopy(
  id: PitStopCheckpointId,
  partnerName: string,
  opts?: { blindRole?: 'navigator' | 'pilot' }
): PitStopCopyBlock {
  switch (id) {
    case 1:
      return {
        title: 'Чек-поинт 1: Ключ от гаража',
        body: withPartner(
          'Болид заперт. Твоя половина шифра — на бирке. Вторая — у {Partner_Name}. Скинь код в чат, собери полный ключ и открой бокс.',
          partnerName
        )
      };
    case 2:
      return {
        title: 'Чек-поинт 2: Скоростной Пит-стоп',
        body: withPartner(
          'Бокс открыт, но болид разобран! Скооперируйтесь с {Partner_Name} и поочередно установите гоночные детали, чтобы подготовить машину к заезду.',
          partnerName
        )
      };
    case 3:
      return {
        title: 'Чек-поинт 3: Синхронное зажигание',
        body: withPartner(
          'Болид готов к старту! Чтобы завести мотор 14-го круга, нужно синхронное давление на тумблеры зажигания. Зайдите сюда одновременно с {Partner_Name} и запустите двигатель.',
          partnerName
        )
      };
    case 4:
      if (opts?.blindRole === 'pilot') {
        return {
          title: 'Чек-поинт 4: Слепой пилот',
          body: withPartner(
            'Ты — ПИЛОТ. Твой экран заблокирован помехами. Слушай команды навигатора {Partner_Name} и жми стрелки!',
            partnerName
          ),
          roleHint: 'ПИЛОТ'
        };
      }
      return {
        title: 'Чек-поинт 4: Слепой пилот',
        body: withPartner(
          'Ты — НАВИГАТОР. Твой пилот {Partner_Name} едет вслепую сквозь туман! Диктуй ему дорогу в созвоне или чате. Доведи болид до финишного торта!',
          partnerName
        ),
        roleHint: 'НАВИГАТОР'
      };
    case 5:
      return {
        title: 'Чек-поинт 5: Дозаправка пилотов',
        body: withPartner(
          'Гонки гонками, а дозаправка по расписанию! Сделайте паузу. Поймайте друг друга в офисе или созвонитесь по видео с {Partner_Name}. Сделайте совместное photo/скриншот с чашками чая или кофе в знак виртуального тоста за 14-летие компании!',
          partnerName
        )
      };
    case 6:
      return {
        title: 'Чек-поинт 6: Пасхалка на трассе',
        body: 'Датчик телеметрии потеряли где-то на платформе. Найди гоночный флаг, кликни — и введи код сюда.'
      };
    case 7:
      return {
        title: 'Чек-поинт 7: Общий пазл',
        body: withPartner(
          'Радар в помехах. Свяжись с {Partner_Name}: кликай ячейки, которые горят у напарника — восстановите карту трека.',
          partnerName
        )
      };
    case 8:
      return {
        title: 'Чек-поинт 8: Клетчатый флаг',
        body: 'Финиш корпоратива! Офис — сканируй QR на картодроме. Удалёнка — смотри праздничное видео и поймай кодовое слово в титрах.'
      };
    default:
      return { title: 'Чек-поинт', body: '' };
  }
}

export const PIT_STOP_ASSEMBLY_PARTS = [
  'УСТАНОВИТЬ КОЛЁСА',
  'УСТАНОВИТЬ МОТОР',
  'УСТАНОВИТЬ КРЫЛО',
  'УСТАНОВИТЬ АНТЕННУ',
  'УСТАНОВИТЬ БАК',
  'УСТАНОВИТЬ ЛИВРЕЮ «14 Years on Track»'
] as const;

export const PIT_STOP_EASTER_CODE = 'VIBE_14_LEGEND';

export const PIT_STOP_HUB_TITLE = 'Pit Stop 14';
export const PIT_STOP_HUB_LEAD =
  'Восемь чек-поинтов: дозаправка → пасхалка → пазл → финиш. Играй в паре — курс на 9 октября.';
