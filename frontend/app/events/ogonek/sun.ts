/**
 * Восход, заход и долгота дня — строчка внизу отрывного листка, как на
 * настоящем календаре. Считается для Москвы: адвент живёт по МСК.
 *
 * Упрощённая астрономическая формула с поправкой на уравнение времени.
 * Точности до минуты для декабря хватает с запасом.
 */

const LAT = 55.7558;
const LNG = 37.6173;
const TZ_HOURS = 3;

export type OgonekSun = { rise: string; set: string; len: string };

const hhmm = (minutes: number) => {
  const m = Math.round(minutes);
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
};

/** dateIso — `YYYY-MM-DD`. */
export function ogonekSun(dateIso: string): OgonekSun {
  const [y, mo, d] = dateIso.split('-').map(Number);
  const start = Date.UTC(y!, 0, 1);
  const N = Math.round((Date.UTC(y!, mo! - 1, d!) - start) / 86400000) + 1;

  const lat = (LAT * Math.PI) / 180;
  const B = (2 * Math.PI * (N - 81)) / 365;
  const decl = (23.44 * Math.sin(B) * Math.PI) / 180;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const H =
    (Math.acos(
      (Math.sin((-0.833 * Math.PI) / 180) - Math.sin(lat) * Math.sin(decl)) /
        (Math.cos(lat) * Math.cos(decl))
    ) *
      180) /
    Math.PI;
  const noon = 720 - 4 * LNG - eot + TZ_HOURS * 60;

  return { rise: hhmm(noon - 4 * H), set: hhmm(noon + 4 * H), len: hhmm(8 * H) };
}
