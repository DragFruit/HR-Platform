import { requireVbiSession } from '../utils/session';
import { readIdeas, votesForUser } from '../utils/ideasStore';

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const state = await readIdeas();
  return {
    ideas: state.ideas,
    myVotes: votesForUser(state, session.id)
  };
});
