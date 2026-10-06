/** Компактная телеметрия круга для античита (клиент → сервер). */

export const RACE_TOKEN_STORAGE_KEY = 'vbi-pit-stop-race-token-v1';

export type LapKeyEdge = {
  t: number;
  key: 'up' | 'down' | 'left' | 'right';
  down: boolean;
  trusted: boolean;
};

export type LapStickSample = { t: number; x: number; y: number };
export type LapPathPoint = { t: number; x: number; y: number };

export type LapTelemetry = {
  keyEdges: LapKeyEdge[];
  stickSamples: LapStickSample[];
  path: LapPathPoint[];
  /** Время первого касания каждой зоны от старта круга; null — не задели. */
  zoneAtMs: Array<number | null>;
  wallBumps: number;
  /** Длительность круга по клиентскому таймеру (должна ≈ ms в POST). */
  durationMs: number;
};

export const TELEMETRY_LIMITS = {
  keyEdges: 400,
  stickSamples: 200,
  path: 120
} as const;

export function emptyLapTelemetry(): LapTelemetry {
  return {
    keyEdges: [],
    stickSamples: [],
    path: [],
    zoneAtMs: [null, null, null, null, null],
    wallBumps: 0,
    durationMs: 0
  };
}
