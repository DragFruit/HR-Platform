import {
  LAP_ZONES,
  MIN_LAP_MS
} from '../../app/events/pit-stop-14/trackDrive';
import {
  TELEMETRY_LIMITS,
  type LapKeyEdge,
  type LapPathPoint,
  type LapStickSample,
  type LapTelemetry
} from '../../app/events/pit-stop-14/raceTelemetry';

export const BOT_FLAG_SCORE_THRESHOLD = 60;

export type CheatScoreResult = {
  score: number;
  reasons: string[];
};

const clampInt = (n: unknown, min: number, max: number) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null;
  const v = Math.round(n);
  if (v < min || v > max) return null;
  return v;
};

const stddev = (vals: number[]): number => {
  if (vals.length < 2) return 0;
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const v = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  return Math.sqrt(v);
};

function parseKeyEdges(raw: unknown): LapKeyEdge[] {
  if (!Array.isArray(raw)) return [];
  const out: LapKeyEdge[] = [];
  for (const item of raw.slice(0, TELEMETRY_LIMITS.keyEdges)) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const t = clampInt(o.t, 0, MAX_TELEMETRY_T);
    const key = o.key;
    if (t == null) continue;
    if (key !== 'up' && key !== 'down' && key !== 'left' && key !== 'right') continue;
    out.push({
      t,
      key,
      down: Boolean(o.down),
      trusted: o.trusted !== false
    });
  }
  return out;
}

const MAX_TELEMETRY_T = 10 * 60 * 1000;

function parseSamples(raw: unknown, limit: number): LapStickSample[] {
  if (!Array.isArray(raw)) return [];
  const out: LapStickSample[] = [];
  for (const item of raw.slice(0, limit)) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const t = clampInt(o.t, 0, MAX_TELEMETRY_T);
    const x = typeof o.x === 'number' && Number.isFinite(o.x) ? o.x : null;
    const y = typeof o.y === 'number' && Number.isFinite(o.y) ? o.y : null;
    if (t == null || x == null || y == null) continue;
    out.push({ t, x, y });
  }
  return out;
}

function parsePath(raw: unknown): LapPathPoint[] {
  return parseSamples(raw, TELEMETRY_LIMITS.path);
}

/** Санитизация тела телеметрии с клиента. */
export function sanitizeLapTelemetry(raw: unknown, claimedMs: number): LapTelemetry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const durationMs = clampInt(o.durationMs, 0, MAX_TELEMETRY_T) ?? claimedMs;
  const wallBumps = clampInt(o.wallBumps, 0, 500) ?? 0;
  const zoneAtMs: Array<number | null> = [];
  const zones = Array.isArray(o.zoneAtMs) ? o.zoneAtMs : [];
  for (let i = 0; i < LAP_ZONES.length; i++) {
    const z = zones[i];
    if (z == null) zoneAtMs.push(null);
    else zoneAtMs.push(clampInt(z, 0, MAX_TELEMETRY_T));
  }
  return {
    keyEdges: parseKeyEdges(o.keyEdges),
    stickSamples: parseSamples(o.stickSamples, TELEMETRY_LIMITS.stickSamples),
    path: parsePath(o.path),
    zoneAtMs,
    wallBumps,
    durationMs
  };
}

function keyHoldDurations(edges: LapKeyEdge[]): number[] {
  const downAt = new Map<string, number>();
  const holds: number[] = [];
  for (const e of edges) {
    if (e.down) {
      downAt.set(e.key, e.t);
    } else {
      const start = downAt.get(e.key);
      if (start != null) {
        const d = e.t - start;
        if (d > 0 && d < 30000) holds.push(d);
        downAt.delete(e.key);
      }
    }
  }
  return holds;
}

/** Скоринг подозрения на бота за рулём. Круг не отклоняем — только флаг. */
export function scoreLapBotSuspicion(input: {
  ms: number;
  telemetry: LapTelemetry | null;
}): CheatScoreResult {
  const reasons: string[] = [];
  let score = 0;
  const { ms, telemetry } = input;

  if (!telemetry) {
    return { score: 80, reasons: ['missing_telemetry'] };
  }

  const edges = telemetry.keyEdges;
  const stick = telemetry.stickSamples;
  const path = telemetry.path;

  if (edges.length === 0 && stick.length < 4 && path.length < 4) {
    score += 70;
    reasons.push('missing_telemetry');
  }

  if (Math.abs(telemetry.durationMs - ms) > 400) {
    score += 35;
    reasons.push('duration_mismatch');
  }

  const zonesHit = telemetry.zoneAtMs.filter((z) => z != null).length;
  if (zonesHit < LAP_ZONES.length) {
    score += 40;
    reasons.push('zones_incomplete');
  }

  if (path.length >= 3) {
    const last = path[path.length - 1]!;
    if (Math.abs(last.t - ms) > 1500) {
      score += 25;
      reasons.push('path_time_mismatch');
    }
  } else if (ms >= MIN_LAP_MS) {
    score += 20;
    reasons.push('path_too_short');
  }

  if (edges.length >= 6) {
    const untrusted = edges.filter((e) => !e.trusted).length;
    const ratio = untrusted / edges.length;
    if (ratio >= 0.3) {
      score += 55;
      reasons.push('untrusted_keys');
    } else if (ratio >= 0.1) {
      score += 25;
      reasons.push('untrusted_keys_partial');
    }
  }

  const holds = keyHoldDurations(edges);
  if (holds.length >= 6) {
    const sd = stddev(holds);
    const mean = holds.reduce((a, b) => a + b, 0) / holds.length;
    if (mean > 40 && sd < 12) {
      score += 40;
      reasons.push('metronome_keys');
    }
  }

  if (edges.length >= 8) {
    const intervals: number[] = [];
    for (let i = 1; i < edges.length; i++) {
      const d = edges[i]!.t - edges[i - 1]!.t;
      if (d > 0 && d < 5000) intervals.push(d);
    }
    if (intervals.length >= 8) {
      const sd = stddev(intervals);
      const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (mean > 20 && sd / mean < 0.05) {
        score += 35;
        reasons.push('regular_input_cadence');
      }
    }
  }

  if (stick.length >= 12) {
    const angles: number[] = [];
    for (const s of stick) {
      const mag = Math.hypot(s.x, s.y);
      if (mag < 0.2) continue;
      angles.push(Math.atan2(s.y, s.x));
    }
    if (angles.length >= 10) {
      const deltas: number[] = [];
      for (let i = 1; i < angles.length; i++) {
        let d = angles[i]! - angles[i - 1]!;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        deltas.push(Math.abs(d));
      }
      const sd = stddev(deltas);
      if (sd < 0.02) {
        score += 45;
        reasons.push('stick_no_jitter');
      }
    }
  }

  const inputChanges = edges.length + stick.length;
  if (ms >= 20000 && inputChanges < 6) {
    score += 35;
    reasons.push('too_few_inputs');
  }

  if (telemetry.wallBumps === 0 && ms <= MIN_LAP_MS + 2500) {
    score += 30;
    reasons.push('perfect_fast_lap');
  }

  return { score: Math.min(100, score), reasons: [...new Set(reasons)] };
}

export function shouldFlagCheat(score: number): boolean {
  return score >= BOT_FLAG_SCORE_THRESHOLD;
}
