import { requireRole } from '../../utils/requireRole';
import {
  mutateOrgStructure,
  normalizeOrgStructureState,
  type OrgStructureState
} from '../../utils/orgStructureStore';

export default defineEventHandler(async (event) => {
  await requireRole(event, ['admin', 'hr']);
  const body = await readBody<Partial<OrgStructureState>>(event);
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Ожидается объект оргструктуры' });
  }
  return mutateOrgStructure(() => normalizeOrgStructureState(body));
});
