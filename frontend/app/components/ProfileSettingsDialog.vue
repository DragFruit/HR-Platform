<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="org-confirm-overlay profile-settings-overlay"
      role="presentation"
      @click.self="close"
    >
      <div
        class="card profile-settings"
        role="dialog"
        aria-modal="true"
        aria-label="Настройки профиля"
      >
        <header class="profile-settings__head">
          <h2 class="profile-settings__title">Настройки профиля</h2>
          <button
            type="button"
            class="admin-notifications-bell__dismiss"
            aria-label="Закрыть"
            @click="close"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4 4 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          </button>
        </header>

        <div class="profile-settings__layout">
          <nav class="profile-settings__nav" role="tablist" aria-label="Разделы настроек">
            <button
              v-for="section in sections"
              :id="`profile-settings-tab-${section.id}`"
              :key="section.id"
              type="button"
              role="tab"
              class="profile-settings__tab"
              :class="[`profile-settings__tab--${section.id}`, { 'is-active': activeTab === section.id }]"
              :aria-selected="activeTab === section.id"
              :aria-controls="`profile-settings-panel-${section.id}`"
              @click="selectTab(section.id)"
            >
              <span class="profile-settings__tab-icon" aria-hidden="true">{{ section.icon }}</span>
              <span class="profile-settings__tab-text">
                <span class="profile-settings__tab-label">{{ section.label }}</span>
                <span class="profile-settings__tab-hint">{{ section.hint }}</span>
              </span>
            </button>
          </nav>

          <div
            :id="`profile-settings-panel-${activeTab}`"
            class="profile-settings__panel"
            :class="`profile-settings__panel--${activeTab}`"
            role="tabpanel"
            :aria-labelledby="`profile-settings-tab-${activeTab}`"
          >
            <ProfileVibeCredentialsPanel v-if="activeTab === 'login'" @busy="busy = $event" />
            <ProfileWishlistEditor
              v-else-if="activeTab === 'wishlist'"
              @busy="busy = $event"
              @dirty="wishlistDirty = $event"
            />
            <section v-else class="profile-settings__avatar" aria-labelledby="profile-settings-avatar-title">
              <h3 id="profile-settings-avatar-title" class="profile-settings__section-title">Аватар</h3>
              <p class="muted profile-settings__section-hint">
                Персонаж виден в профиле, визитке и календаре отпусков.
              </p>
              <div class="avatar-picker-grid profile-settings__avatar-grid">
                <button
                  v-for="characterId in AVATAR_CHARACTER_IDS"
                  :key="characterId"
                  type="button"
                  class="avatar-picker-item"
                  :class="{ selected: currentAvatarId === characterId }"
                  :aria-pressed="currentAvatarId === characterId"
                  @click="pickAvatar(characterId)"
                >
                  <img :src="avatarImageUrl(characterId)" :alt="`Персонаж ${characterId}`" loading="lazy" />
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { AvatarCharacterId } from '~/composables/useAvatars';

type ProfileSettingsTab = 'login' | 'wishlist' | 'avatar';

const props = defineProps<{ open: boolean; tab?: ProfileSettingsTab }>();
const emit = defineEmits<{
  'update:open': [value: boolean];
  'update:tab': [value: ProfileSettingsTab];
}>();

const sections: { id: ProfileSettingsTab; icon: string; label: string; hint: string }[] = [
  { id: 'login', icon: '🔑', label: 'Вход в Вайб', hint: 'логин и пароль' },
  { id: 'wishlist', icon: '🎁', label: 'Вишлист', hint: 'что тебя порадует' },
  { id: 'avatar', icon: '🙂', label: 'Аватар', hint: 'персонаж профиля' }
];

const { user } = useAuth();
const { AVATAR_CHARACTER_IDS, avatarImageUrl, getAvatarId, setAvatarId } = useAvatars();

const activeTab = ref<ProfileSettingsTab>(props.tab ?? 'login');
const busy = ref(false);
const wishlistDirty = ref(false);

watch(
  () => [props.open, props.tab] as const,
  ([isOpen, tab]) => {
    if (isOpen && tab) activeTab.value = tab;
  }
);

const confirmLeaveWishlist = () =>
  activeTab.value !== 'wishlist' ||
  !wishlistDirty.value ||
  window.confirm('В вишлисте есть несохранённые правки. Закрыть без сохранения?');

const selectTab = (tab: ProfileSettingsTab) => {
  if (tab === activeTab.value || busy.value) return;
  if (!confirmLeaveWishlist()) return;
  wishlistDirty.value = false;
  activeTab.value = tab;
  emit('update:tab', tab);
};

const close = () => {
  if (busy.value) return;
  if (!confirmLeaveWishlist()) return;
  wishlistDirty.value = false;
  emit('update:open', false);
};

const currentAvatarId = computed(() => (user.value ? getAvatarId(user.value.id) : null));

const pickAvatar = (characterId: AvatarCharacterId) => {
  if (!user.value) return;
  setAvatarId(user.value.id, characterId);
};

const onKey = (e: KeyboardEvent) => {
  if (props.open && e.key === 'Escape') close();
};
onMounted(() => window.addEventListener('keydown', onKey));
onUnmounted(() => window.removeEventListener('keydown', onKey));
</script>

<style scoped>
.profile-settings {
  display: flex;
  flex-direction: column;
  width: min(820px, calc(100vw - 32px));
  max-height: min(760px, calc(100vh - 32px));
  padding: 18px 20px 20px;
  border: 2px solid #202020;
  border-radius: 20px;
  box-shadow: 5px 5px 0 #ddf365;
  overflow: hidden;
}

.profile-settings__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 12px;
}

.profile-settings__title {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
}

.profile-settings__layout {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr);
  gap: 18px;
  min-height: 0;
  flex: 1 1 auto;
}

.profile-settings__nav {
  display: grid;
  align-content: start;
  gap: 8px;
}

.profile-settings__tab {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  font: inherit;
  text-align: left;
  color: #202020;
  background: #fff;
  border: 2px solid transparent;
  border-radius: 14px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.12s ease;
}

.profile-settings__tab:hover {
  background: #f5f5f0;
}

.profile-settings__tab.is-active {
  background: #f5f5f0;
  border-color: #202020;
  box-shadow: 3px 3px 0 #7451f4;
}

.profile-settings__tab--wishlist.is-active {
  background: #fff6e8;
  box-shadow: 3px 3px 0 #f3b33e;
}

.profile-settings__tab:focus-visible {
  outline: 2px solid #7451f4;
  outline-offset: 2px;
}

.profile-settings__tab-icon {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  font-size: 18px;
  background: #eeeee8;
  border-radius: 10px;
}

.profile-settings__tab--wishlist .profile-settings__tab-icon {
  background: #ddf365;
}

.profile-settings__tab-text {
  display: grid;
  min-width: 0;
}

.profile-settings__tab-label {
  font-size: 0.92rem;
  font-weight: 700;
}

.profile-settings__tab-hint {
  font-size: 0.76rem;
  color: #838383;
}

.profile-settings__panel {
  min-height: 0;
  padding: 4px 4px 4px 18px;
  overflow-y: auto;
  border-left: 1.5px solid #e4e4de;
}

.profile-settings__section-title {
  margin: 0 0 0.5rem;
  font-size: 1.125rem;
}

.profile-settings__section-hint {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
}

.profile-settings__avatar-grid {
  max-height: none;
}

@media (max-width: 720px) {
  .profile-settings {
    padding: 14px 14px 16px;
  }

  .profile-settings__layout {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .profile-settings__nav {
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 6px;
  }

  .profile-settings__tab {
    justify-content: center;
    padding: 8px 6px;
  }

  .profile-settings__tab-hint {
    display: none;
  }

  .profile-settings__tab-icon {
    width: 28px;
    height: 28px;
    font-size: 15px;
  }

  .profile-settings__tab-label {
    font-size: 0.8rem;
  }

  .profile-settings__panel {
    padding: 0;
    border-left: 0;
  }
}

@media (max-width: 420px) {
  .profile-settings__tab-icon {
    display: none;
  }
}
</style>
