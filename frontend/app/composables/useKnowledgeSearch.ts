import {
  emptyKnowledgeFilters,
  KNOWLEDGE_PAGE_SIZE,
  searchKnowledgeArticles,
  type KnowledgeSearchFilters
} from '~/utils/knowledgeSearch';

const draftQuery = ref('');
const draftFilters = ref<KnowledgeSearchFilters>(emptyKnowledgeFilters());
const committedQuery = ref('');
const committedFilters = ref<KnowledgeSearchFilters>(emptyKnowledgeFilters());
const hasSearched = ref(false);
const visibleCount = ref(KNOWLEDGE_PAGE_SIZE);

export function useKnowledgeSearch() {
  const { articles } = useKnowledgeArticles();

  const hits = computed(() => {
    if (!hasSearched.value) return [];
    return searchKnowledgeArticles(articles.value, committedQuery.value, committedFilters.value);
  });

  const visibleHits = computed(() => hits.value.slice(0, visibleCount.value));
  const hasMore = computed(() => visibleCount.value < hits.value.length);

  const runSearch = () => {
    committedQuery.value = draftQuery.value.trim();
    committedFilters.value = { ...draftFilters.value };
    hasSearched.value = true;
    visibleCount.value = KNOWLEDGE_PAGE_SIZE;
  };

  const loadMore = () => {
    if (!hasMore.value) return;
    visibleCount.value += KNOWLEDGE_PAGE_SIZE;
  };

  return {
    draftQuery,
    draftFilters,
    hasSearched,
    hits,
    visibleHits,
    hasMore,
    runSearch,
    loadMore
  };
}
