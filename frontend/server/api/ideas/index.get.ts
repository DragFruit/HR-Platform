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
  const { public: pub } = useRuntimeConfig();
  const isProduction =
    pub?.appEnv === 'production' || String(process.env.NODE_ENV || '').toLowerCase() === 'production';

  if (isProduction) {
    state.ideas = state.ideas.filter((idea) => !isTestLikeIdea(idea));
  }

  return {
    ideas: state.ideas,
    myVotes: votesForUser(state, session.id)
  };
});
