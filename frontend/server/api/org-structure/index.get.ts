import { requireVbiSession } from '../../utils/session';
import { readOrgStructure } from '../../utils/orgStructureStore';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  return readOrgStructure();
});
