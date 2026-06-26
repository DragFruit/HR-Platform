<template>
  <footer class="app-site-footer" aria-label="Ссылки агентства VBI">
    <div class="app-site-footer__inner">
      <span class="app-site-footer__logo" aria-hidden="true">VBI</span>

      <span class="app-site-footer__rule" aria-hidden="true" />

      <div class="app-site-footer__social">
        <span class="app-site-footer__tagline">Следите за нами</span>
        <div class="app-site-footer__icons">
          <a
            v-if="socialVkUrl"
            :href="socialVkUrl"
            class="app-site-footer__icon-link"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="VBI во ВКонтакте"
          >
            <svg class="app-site-footer__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.426.132-.426s-.02-1.306.587-1.498c.598-.188 1.366 1.257 2.182 1.812.616.422 1.084.33 1.084.33l2.181-.03s1.14-.071.6-.972c-.044-.073-.314-.66-1.618-1.867-1.366-1.262-1.183-1.058.462-3.242.998-1.332 1.397-2.145 1.272-2.493-.118-.332-.848-.244-.848-.244l-2.462.015s-.183-.025-.318.056c-.132.078-.216.26-.216.26s-.388 1.034-.904 1.912c-1.09 1.854-1.527 1.952-1.705 1.836-.414-.268-.31-1.078-.31-1.653 0-1.798.272-2.548-.53-2.742-.266-.064-.462-.106-1.143-.113-.874-.009-1.612.003-2.03.208-.278.136-.492.44-.362.458.162.022.528.099.722.363.251.342.242 1.11.242 1.11s.145 2.134-.337 2.4c-.331.18-.784-.187-1.756-1.862-.498-.856-.874-1.804-.874-1.804s-.072-.177-.201-.272c-.156-.115-.374-.151-.374-.151l-2.34.015s-.351.01-.48.162c-.115.136-.009.417-.009.417s1.834 4.316 3.908 6.492c1.902 1.998 4.062 1.867 4.062 1.867h.973z"
              />
            </svg>
          </a>
          <a
            v-if="socialTelegramUrl"
            :href="socialTelegramUrl"
            class="app-site-footer__icon-link"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="VBI в Telegram"
          >
            <svg class="app-site-footer__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="currentColor"
                d="M9.78 15.29 9.55 19.3c.39 0 .56-.17.76-.37l1.83-1.75 3.79 2.78c.7.39 1.2.18 1.38-.64l2.49-11.68h.01c.22-1.03-.37-1.43-1.05-1.18L3.6 10.36c-1 .39-1 .95-.17 1.2l4.47 1.4 10.38-6.55c.49-.32.93-.14.57.18L9.78 15.29z"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
const { public: publicConfig } = useRuntimeConfig();

const socialVkUrl = publicConfig.socialVkUrl as string;
const socialTelegramUrl = publicConfig.socialTelegramUrl as string;
</script>
