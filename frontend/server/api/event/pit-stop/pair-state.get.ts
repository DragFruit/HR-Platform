import { requireVbiSession } from '../../../utils/session';
import {
  findPair,
  findPlayer,
  partnerOf,
  readPitStopForRequest
} from '../../../utils/pitStopStore';
import { PIT_STOP_ASSEMBLY_PARTS } from '../../../../app/events/pit-stop-14/copy';

/** Polling-состояние пары для точек 2–4, 6. */
export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const state = await readPitStopForRequest();
  const me = findPlayer(state, session.id);
  if (!me?.pairId) {
    return { pair: null };
  }
  const pair = findPair(state, me.pairId);
  if (!pair) return { pair: null };
  const { role, partnerName } = partnerOf(pair, session.id);
  const blindRole =
    role === 'A'
      ? pair.blindRoleA
      : pair.blindRoleA === 'navigator'
        ? 'pilot'
        : 'navigator';

  return {
    pair: {
      id: pair.id,
      role,
      partnerName,
      assemblyStep: pair.assemblyStep,
      assemblyTurn: pair.assemblyTurn,
      assemblyMyTurn: pair.assemblyTurn === role,
      assemblyLabel: PIT_STOP_ASSEMBLY_PARTS[pair.assemblyStep] ?? null,
      assemblyDone: pair.assemblyStep >= PIT_STOP_ASSEMBLY_PARTS.length,
      ignitionHeldBy: pair.ignitionHeldBy,
      ignitionIHold: pair.ignitionHeldBy.includes(session.id),
      ignitionPartnerHolds: pair.ignitionHeldBy.includes(
        role === 'A' ? pair.userIdB : pair.userIdA
      ),
      blindRole,
      blindX: pair.blindX,
      blindY: pair.blindY,
      blindStartedAt: pair.blindStartedAt,
      puzzleMyGlow: role === 'A' ? pair.puzzleGlowA : pair.puzzleGlowB,
      puzzlePartnerGlow: role === 'A' ? pair.puzzleGlowB : pair.puzzleGlowA,
      puzzleMyPressed: role === 'A' ? pair.puzzlePressedA : pair.puzzlePressedB,
      puzzlePartnerPressed: role === 'A' ? pair.puzzlePressedB : pair.puzzlePressedA
    }
  };
});
