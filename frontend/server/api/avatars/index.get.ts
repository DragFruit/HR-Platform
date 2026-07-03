import { requireVbiSession } from '../../utils/session';
import { readUserAvatars } from '../../utils/userAvatarsStore';

export default defineEventHandler(async (event) => {
  await requireVbiSession(event);
  const avatars = await readUserAvatars();
  return { avatars };
});
