import type { NokturnStageId } from '../../app/events/nokturn/types';
import { NOKTURN_STAGE_IDS } from '../../app/events/nokturn/timeline';

export function parseStageId(raw: unknown): NokturnStageId {
  const n = Number(raw);
  const found = NOKTURN_STAGE_IDS.find((id) => id === n);
  if (!found) throw createError({ statusCode: 400, statusMessage: 'stageId 1..5 required' });
  return found;
}
