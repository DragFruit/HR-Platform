import { requireRole } from '../../utils/requireRole';
import { sessionActorEmployeeId } from '../../utils/employeesStore';
import {
  mutateOrgStructure,
  normalizeOrgStructureState,
  type OrgStructureState
} from '../../utils/orgStructureStore';

export default defineEventHandler(async (event) => {
  const session = await requireRole(event, ['admin', 'hr']);
  const body = await readBody<Partial<OrgStructureState>>(event);
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Ожидается объект оргструктуры' });
  }
  return mutateOrgStructure(() => normalizeOrgStructureState(body), {
    actorEmployeeId: await sessionActorEmployeeId(session),
    reason: 'org-editor'
  });
});
