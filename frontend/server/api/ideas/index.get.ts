import { requireVbiSession } from '../../utils/session';
import { readIdeas, votesForUser } from '../../utils/ideasStore';

function isTestLikeIdea(idea: { title: string; description?: string; authorName: string }) {
  const haystack = `${idea.title} ${idea.description ?? ''} ${idea.authorName}`.toLowerCase();
  return haystack.includes('тест') || haystack.includes('qa') || haystack.includes('demo');
}

export default defineEventHandler(async (event) => {
  const session = await requireVbiSession(event);
  const state = await readIdeas();

  // На production показываем только “боевые” идеи.
  // Тестовые/QA идеи иногда остаются в ideas.json (исторически), но в UI они должны исчезать.
  const host = String(event.node.req.headers.host || '').toLowerCase();
  // На проде URL вида: 45.12.74.25/vacations (см. скрин).
  const isProduction = host.includes('45.12.74.25');

  if (isProduction) {
    state.ideas = state.ideas.filter((idea) => !isTestLikeIdea(idea));
  }

  return {
    ideas: state.ideas,
    myVotes: votesForUser(state, session.id)
  };
});
