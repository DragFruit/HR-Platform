<template>
  <div class="vpn-page">
    <section class="vpn-chat" aria-label="Помощник VPN">
      <header class="vpn-chat__head">
        <p class="vpn-chat__head-label">Помощник · доступ в сеть</p>
        <span class="vpn-chat__status" aria-hidden="true">онлайн</span>
      </header>

      <div ref="threadRef" class="vpn-chat__thread" role="log" aria-live="polite">
        <div class="vpn-chat__thread-pin">
          <article
            v-for="(msg, index) in messages"
            :key="`${msg.id}-${index}`"
            class="vpn-bubble"
            :class="`vpn-bubble--${msg.from}`"
          >
            <p class="vpn-bubble__text">{{ msg.text }}</p>
            <ul v-if="msg.bullets?.length" class="vpn-bubble__bullets">
              <li v-for="(b, i) in msg.bullets" :key="i">{{ b }}</li>
            </ul>
            <div v-if="msg.keyCards?.length" class="vpn-key-cards">
              <article v-for="(card, ci) in msg.keyCards" :key="`${card.clientName}-${ci}`" class="vpn-key-card">
                <p class="vpn-key-card__name">{{ card.clientName }}</p>
                <img
                  class="vpn-key-card__qr"
                  :src="svgToDataUrl(card.qrcodeSvg)"
                  alt="QR-код для добавления конфига"
                  width="180"
                  height="180"
                  @load="scrollThreadToBottom"
                />
                <a
                  class="button primary vpn-key-card__download"
                  :href="configDataUrl(card.configuration)"
                  :download="card.fileName"
                >
                  Скачать конфиг
                </a>
              </article>
            </div>
          </article>
        </div>
      </div>

      <footer class="vpn-chat__composer">
        <div v-if="step === 'need'" class="vpn-actions" role="group" aria-label="Что нужно">
          <button type="button" class="vpn-chip vpn-chip--lime" @click="pickNeed('vpn')">
            <span class="vpn-chip__label">VPN</span>
            <span class="vpn-chip__hint">{{ copy.vpnHint }}</span>
          </button>
          <button type="button" class="vpn-chip vpn-chip--purple" @click="pickNeed('proxy')">
            <span class="vpn-chip__label">Прокси</span>
            <span class="vpn-chip__hint">{{ copy.proxyHint }}</span>
          </button>
          <button type="button" class="vpn-chip vpn-chip--chatgpt" @click="pickNeed('chatgpt')">
            <span class="vpn-chip__label">Код ChatGPT</span>
            <span class="vpn-chip__hint">{{ copy.chatgptHint }}</span>
          </button>
        </div>

        <div v-else-if="step === 'chatgpt'" class="vpn-actions vpn-actions--stack">
          <button
            type="button"
            class="button primary vpn-cta"
            :disabled="chatgptLoading"
            @click="fetchChatgptCode(false)"
          >
            {{ chatgptLoading ? 'Ищем код…' : 'Проверить почту ещё раз' }}
          </button>
          <button
            v-if="offeredCodes.length"
            type="button"
            class="button vpn-cta vpn-cta--ghost"
            :disabled="chatgptLoading"
            @click="fetchChatgptCode(true)"
          >
            Код не подошёл
          </button>
          <button type="button" class="vpn-link" @click="reset">← Начать сначала</button>
        </div>

        <div v-else-if="step === 'vpn-device'" class="vpn-actions" role="group" aria-label="Устройство">
          <button type="button" class="vpn-chip" @click="pickDevice('mac')">
            <span class="vpn-chip__label">Mac</span>
            <span class="vpn-chip__hint">WireGuard</span>
          </button>
          <button type="button" class="vpn-chip" @click="pickDevice('iphone')">
            <span class="vpn-chip__label">iPhone</span>
            <span class="vpn-chip__hint">AmneziaWG · App Store</span>
          </button>
          <button type="button" class="vpn-chip" @click="pickDevice('windows')">
            <span class="vpn-chip__label">Windows</span>
            <span class="vpn-chip__hint">AmneziaVPN · GitHub</span>
          </button>
          <button type="button" class="vpn-chip" @click="pickDevice('android')">
            <span class="vpn-chip__label">Android</span>
            <span class="vpn-chip__hint">AmneziaVPN · GitHub</span>
          </button>
          <button type="button" class="vpn-link" @click="backToNeed">← Назад</button>
        </div>

        <div v-else-if="step === 'proxy'" class="vpn-actions vpn-actions--stack">
          <a
            class="button primary vpn-cta"
            :href="proxyWindowsUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            Скачать для Windows
          </a>
          <button type="button" class="vpn-link" @click="reset">← Начать сначала</button>
        </div>

        <div v-else-if="step === 'vpn-client'" class="vpn-actions vpn-actions--client">
          <div class="vpn-actions__main">
            <a
              class="button primary vpn-cta"
              :href="clientDownloadUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ clientCtaLabel }}
            </a>
            <button
              v-if="showKeyRequestButton"
              type="button"
              class="button vpn-cta vpn-cta--ghost"
              :disabled="keyRequestLoading"
              @click="requestKey"
            >
              {{ keyRequestLoading ? 'Выдаём ключ…' : keyRequestLabel }}
            </button>
            <p v-if="keyRequestError" class="vpn-error" role="alert">{{ keyRequestError }}</p>
          </div>
          <button type="button" class="vpn-help" @click="explainSimply">
            <span class="vpn-help__label">Я ничего не понимаю</span>
            <span class="vpn-help__hint">Объясните по-человечески</span>
          </button>
          <div class="vpn-actions__row">
            <button type="button" class="vpn-link" @click="backToDevice">← Сменить устройство</button>
            <button type="button" class="vpn-link" @click="reset">Начать сначала</button>
          </div>
        </div>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { VPN_LIMITS } from '~/data/vpnLimits';

type Need = 'vpn' | 'proxy' | 'chatgpt';
type Device = 'mac' | 'iphone' | 'windows' | 'android';
type Step = 'need' | 'proxy' | 'vpn-device' | 'vpn-client' | 'chatgpt';
type VpnKind = 'wireguard' | 'amnezia';

type KeyCard = {
  clientName: string;
  configuration: string;
  qrcodeSvg: string;
  fileName: string;
};

type BotMessage = {
  id: string;
  from: 'bot' | 'user';
  text: string;
  bullets?: string[];
  keyCards?: KeyCard[];
};

type VpnKeyRow = {
  clientName: string;
  configuration: string | null;
  qrcodeSvg: string | null;
  kind: VpnKind;
  unavailable?: boolean;
};

type VpnKeyApiResponse = {
  ok: boolean;
  created: boolean;
  atLimit: boolean;
  message: string;
  key: VpnKeyRow & { configuration: string; qrcodeSvg: string };
  keys?: VpnKeyRow[];
};

type VpnKeysListResponse = {
  ok: boolean;
  keys: VpnKeyRow[];
};

type ChatgptCodeResponse = {
  ok: boolean;
  status: 'found' | 'none' | 'exhausted';
  code: string | null;
  message: string;
};

const copy = {
  vpnHint: 'Для входа в ChatGPT, Инстаграмм, Ютуб, PornHub и тд',
  proxyHint:
    'Идеально подходит для Тегерамма, позволяет одновременно использовать Тегерамм и Битрикс',
  chatgptHint: 'Код из письма OpenAI на корпоративную почту',
  welcome: 'Привет! Чем я могу помочь?',
  askDevice:
    'Отлично, VPN. Вам доступны 1 WireGuard и 2 AmneziaWG — одного ключа хватит на разные устройства. Какое именно устройство?',
  proxyBot:
    'Для прокси — клиент под Windows. По кнопке откроется страница загрузок: берите TgWsProxy_windows_7_64bit.exe из свежего релиза.',
  proxyAutostart:
    'Чтобы прокси всегда работал, в настройках программы включите автовключение вместе с включением компьютера.',
  chatgptIntro:
    'Сейчас проверю корпоративную почту на свежий код от OpenAI (за последний час).',
  chatgptNoCode: 'Код не пришёл',
  chatgptExhausted: 'Больше кодов не приходило',
  chatgptWrongAsk: 'Код не подошёл',
  chatgptRetryAsk: 'Проверить почту ещё раз',
  macReady: 'Mac — через WireGuard. Два шага:',
  iphoneReady: 'iPhone — через AmneziaWG. Два шага:',
  windowsReady: 'Windows — через AmneziaVPN. Два шага:',
  androidReady: 'Android — через AmneziaVPN. Два шага:',
  macBullets: [
    'Установите WireGuard из App Store (кнопка внизу)',
    'Запросите ключ — скачайте конфиг или отсканируйте QR и добавьте в WireGuard'
  ],
  iphoneBullets: [
    'Установите AmneziaWG из App Store (кнопка внизу)',
    'Запросите ключ — скачайте конфиг или отсканируйте QR и добавьте в AmneziaWG'
  ],
  windowsBullets: [
    'Откройте релизы Amnezia на GitHub (кнопка внизу)',
    'Скачайте файл AmneziaVPN_*_x64.exe из свежего релиза (например AmneziaVPN_4.8.19.0_x64.exe)',
    'Установите, затем запросите ключ — добавьте конфиг в приложение из файла или по QR'
  ],
  androidBullets: [
    'Откройте релизы Amnezia на GitHub (кнопка внизу)',
    'На большинстве телефонов берите AmneziaVPN_*_android9+_arm64-v8a.apk',
    'Реже нужны armeabi-v7a / x86 / x86_64 — смотрите модель в настройках телефона',
    'Установите APK, затем запросите ключ — добавьте конфиг в приложение из файла или по QR'
  ],
  multiDeviceTip:
    'Один и тот же ключ можно поставить на телефон и ноутбук/ПК — просто не включайте VPN на двух устройствах сразу',
  existingWireguard: 'Ваш WireGuard-ключ — скачайте конфиг или отсканируйте QR.',
  existingAmneziaOne:
    'Ваш AmneziaWG-ключ — скачайте конфиг или отсканируйте QR. Можно запросить ещё один.',
  existingAmneziaBoth: 'Ваши AmneziaWG-ключи — скачайте конфиг или отсканируйте QR.',
  explainAsk: 'Я ничего не понимаю — объясните по-человечески',
  explainLead: 'Ок, без лишних слов. Делайте по порядку:',
  explainWindows: [
    'Нажмите кнопку «Открыть загрузки AmneziaVPN»',
    'На открывшейся странице чуть прокрутите вниз до заголовка Assets',
    'Найдите файл с названием вроде AmneziaVPN_…_x64.exe (цифры в середине могут отличаться — это нормально)',
    'Нажмите на этот файл — он скачается. Откройте скачанный файл и установите программу',
    'Вернитесь сюда и нажмите «Запросить ключ», затем «Скачать конфиг»',
    'Откройте AmneziaVPN → нажмите «+» → добавьте VPN из файла → выберите скачанный конфиг в папке «Загрузки»',
    'Нажмите «Подключить»'
  ],
  explainAndroid: [
    'Нажмите кнопку «Открыть загрузки AmneziaVPN»',
    'На открывшейся странице чуть прокрутите вниз до заголовка Assets',
    'На большинстве телефонов берите файл AmneziaVPN_…_android9+_arm64-v8a.apk',
    'Скачайте его и откройте — разрешите установку, если телефон спросит',
    'Вернитесь сюда и нажмите «Запросить ключ», затем «Скачать конфиг»',
    'Откройте AmneziaVPN → «+» → добавить из файла → выберите конфиг из «Загрузок»',
    'Нажмите «Подключить»'
  ],
  explainIphone: [
    'Нажмите «Открыть AmneziaWG в App Store» и установите приложение',
    'Вернитесь сюда и нажмите «Запросить ключ»',
    'Либо нажмите «Скачать конфиг» и откройте файл в AmneziaWG, либо наведите камеру на QR в чате',
    'В AmneziaWG добавьте туннель и включите переключатель «Подключить»'
  ],
  explainMac: [
    'Нажмите «Открыть WireGuard в App Store» и установите приложение',
    'Вернитесь сюда и нажмите «Запросить ключ»',
    'Скачайте конфиг или отсканируйте QR камерой Mac / телефоном',
    'В WireGuard нажмите «+» → «Импорт туннелей из файла» (или добавьте по QR)',
    'Включите туннель — готово'
  ]
};

const proxyWindowsUrl = 'https://github.com/Flowseal/tg-ws-proxy/releases';
const wireguardMacUrl =
  'https://apps.apple.com/us/app/wireguard/id1451685025?l=ru&mt=12';
const amneziaIphoneUrl = 'https://apps.apple.com/us/app/amneziawg/id6478942365?l=ru';
const amneziaClientReleasesUrl = 'https://github.com/amnezia-vpn/amnezia-client/releases';

const deviceLabel: Record<Device, string> = {
  mac: 'Mac',
  iphone: 'iPhone',
  windows: 'Windows',
  android: 'Android'
};

const step = ref<Step>('need');
const device = ref<Device | null>(null);
const messages = ref<BotMessage[]>([{ id: 'welcome', from: 'bot', text: copy.welcome }]);
const threadRef = ref<HTMLElement | null>(null);
const keyRequestLoading = ref(false);
const keyRequestError = ref('');
const issuedCount = ref(0);
const chatgptLoading = ref(false);
/** Коды, уже показанные в этом заходе (стек: «не подошёл» → более старый). */
const offeredCodes = ref<string[]>([]);

const clientDownloadUrl = computed(() => {
  if (device.value === 'mac') return wireguardMacUrl;
  if (device.value === 'iphone') return amneziaIphoneUrl;
  return amneziaClientReleasesUrl;
});
const clientCtaLabel = computed(() => {
  if (device.value === 'mac') return 'Открыть WireGuard в App Store';
  if (device.value === 'iphone') return 'Открыть AmneziaWG в App Store';
  return 'Открыть загрузки AmneziaVPN';
});
const vpnKind = computed<VpnKind>(() => (device.value === 'mac' ? 'wireguard' : 'amnezia'));
const kindLimit = computed(() =>
  vpnKind.value === 'wireguard' ? VPN_LIMITS.wireguardPerUser : VPN_LIMITS.amneziaPerUser
);
const showKeyRequestButton = computed(() => issuedCount.value < kindLimit.value);
const keyRequestLabel = computed(() => {
  if (vpnKind.value === 'amnezia' && issuedCount.value === 1) return 'Запросить ключ №2';
  return 'Запросить ключ';
});

const deviceReadyCopy = (value: Device) => {
  if (value === 'mac') return { text: copy.macReady, bullets: copy.macBullets };
  if (value === 'iphone') return { text: copy.iphoneReady, bullets: copy.iphoneBullets };
  if (value === 'windows') return { text: copy.windowsReady, bullets: copy.windowsBullets };
  return { text: copy.androidReady, bullets: copy.androidBullets };
};

const explainBulletsFor = (value: Device) => {
  if (value === 'mac') return copy.explainMac;
  if (value === 'iphone') return copy.explainIphone;
  if (value === 'windows') return copy.explainWindows;
  return copy.explainAndroid;
};

const explainSimply = () => {
  if (!device.value) return;
  push({ id: `explain-ask-${Date.now()}`, from: 'user', text: copy.explainAsk });
  push({
    id: `explain-${device.value}-${Date.now()}`,
    from: 'bot',
    text: copy.explainLead,
    bullets: explainBulletsFor(device.value)
  });
};

const svgToDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const configDataUrl = (configuration: string) =>
  `data:text/plain;charset=utf-8,${encodeURIComponent(configuration)}`;

const toKeyCard = (row: {
  clientName: string;
  configuration: string;
  qrcodeSvg: string;
}): KeyCard => ({
  clientName: row.clientName,
  configuration: row.configuration,
  qrcodeSvg: row.qrcodeSvg,
  fileName: `${row.clientName || 'vbi-vpn'}.conf`
});

const usableCards = (rows: VpnKeyRow[] | undefined): KeyCard[] =>
  (rows || [])
    .filter((k): k is VpnKeyRow & { configuration: string; qrcodeSvg: string } =>
      Boolean(k.configuration && k.qrcodeSvg)
    )
    .map(toKeyCard);

const scrollThreadToBottom = async () => {
  await nextTick();
  const pin = () => {
    const el = threadRef.value;
    if (!el) return;
    // Только лента чата — не трогаем window / предков
    el.scrollTop = el.scrollHeight;
  };
  pin();
  requestAnimationFrame(pin);
  window.setTimeout(pin, 120);
};

const push = (msg: BotMessage) => {
  messages.value = [...messages.value, msg];
  void scrollThreadToBottom();
};

const friendlyVpnError = (raw: string, _kind: VpnKind) => {
  const lower = raw.toLowerCase();
  if (lower.includes('404') || lower.includes('не найден') || lower.includes('лимит')) {
    return 'Ваш ключ уже выдан — он в переписке выше. Скачайте конфиг или отсканируйте QR.';
  }
  return raw;
};

const existingKeysMessage = (kind: VpnKind, count: number) => {
  if (kind === 'wireguard') return copy.existingWireguard;
  if (count >= 2) return copy.existingAmneziaBoth;
  return copy.existingAmneziaOne;
};

const loadExistingKeys = async (kind: VpnKind) => {
  try {
    const res = await $fetch<VpnKeysListResponse>('/api/vpn/keys', {
      query: { kind }
    });
    const cards = usableCards(res.keys);
    issuedCount.value = cards.length;
    if (!cards.length) return;
    push({
      id: `existing-${kind}-${Date.now()}`,
      from: 'bot',
      text: existingKeysMessage(kind, cards.length),
      keyCards: cards
    });
  } catch {
    issuedCount.value = 0;
  }
};

const pickNeed = (value: Need) => {
  const label = value === 'vpn' ? 'VPN' : value === 'proxy' ? 'Прокси' : 'Код ChatGPT';
  push({
    id: `need-${value}-${Date.now()}`,
    from: 'user',
    text: label
  });
  if (value === 'proxy') {
    step.value = 'proxy';
    push({ id: 'proxy-bot', from: 'bot', text: copy.proxyBot });
    push({ id: 'proxy-autostart', from: 'bot', text: copy.proxyAutostart });
    return;
  }
  if (value === 'chatgpt') {
    step.value = 'chatgpt';
    offeredCodes.value = [];
    push({ id: `chatgpt-intro-${Date.now()}`, from: 'bot', text: copy.chatgptIntro });
    void fetchChatgptCode(false);
    return;
  }
  step.value = 'vpn-device';
  push({ id: 'device-bot', from: 'bot', text: copy.askDevice });
};

const fetchChatgptCode = async (didNotFit: boolean) => {
  if (chatgptLoading.value) return;
  chatgptLoading.value = true;
  if (didNotFit) {
    push({
      id: `chatgpt-wrong-${Date.now()}`,
      from: 'user',
      text: copy.chatgptWrongAsk
    });
  } else if (offeredCodes.value.length) {
    push({
      id: `chatgpt-retry-${Date.now()}`,
      from: 'user',
      text: copy.chatgptRetryAsk
    });
    // Полный пересмотр почты — стек сбрасываем
    offeredCodes.value = [];
  }
  try {
    const res = await $fetch<ChatgptCodeResponse>('/api/vpn/chatgpt-code', {
      method: 'POST',
      body: { excludeCodes: offeredCodes.value }
    });
    if (res.status === 'found' && res.code) {
      offeredCodes.value = [...offeredCodes.value, res.code];
      push({
        id: `chatgpt-code-${Date.now()}`,
        from: 'bot',
        text: res.message || `Код ChatGPT: ${res.code}`
      });
    } else if (res.status === 'exhausted') {
      push({
        id: `chatgpt-ex-${Date.now()}`,
        from: 'bot',
        text: res.message || copy.chatgptExhausted
      });
    } else {
      push({
        id: `chatgpt-none-${Date.now()}`,
        from: 'bot',
        text: res.message || copy.chatgptNoCode
      });
    }
  } catch (err: unknown) {
    const status =
      typeof err === 'object' && err && 'statusCode' in err
        ? Number((err as { statusCode?: number }).statusCode)
        : 0;
    const msg =
      typeof err === 'object' &&
      err &&
      'data' in err &&
      typeof (err as { data?: { statusMessage?: string } }).data?.statusMessage === 'string'
        ? (err as { data: { statusMessage: string } }).data.statusMessage
        : 'Не удалось проверить почту. Попробуйте ещё раз.';
    push({
      id: `chatgpt-err-${Date.now()}`,
      from: 'bot',
      text: status === 401 ? 'Чтобы получить код, войдите в платформу.' : msg
    });
  } finally {
    chatgptLoading.value = false;
  }
};

const pickDevice = async (value: Device) => {
  device.value = value;
  issuedCount.value = 0;
  keyRequestError.value = '';
  push({
    id: `device-${value}`,
    from: 'user',
    text: deviceLabel[value]
  });
  step.value = 'vpn-client';
  const ready = deviceReadyCopy(value);
  push({
    id: 'client-bot',
    from: 'bot',
    text: ready.text,
    bullets: ready.bullets
  });
  push({ id: 'multi-device-tip', from: 'bot', text: copy.multiDeviceTip });
  await loadExistingKeys(value === 'mac' ? 'wireguard' : 'amnezia');
};

const requestKey = async () => {
  if (!device.value || keyRequestLoading.value || !showKeyRequestButton.value) return;
  keyRequestError.value = '';
  keyRequestLoading.value = true;
  push({
    id: `req-${Date.now()}`,
    from: 'user',
    text: keyRequestLabel.value
  });
  try {
    const res = await $fetch<VpnKeyApiResponse>('/api/vpn/keys', {
      method: 'POST',
      body: { kind: vpnKind.value }
    });
    const cards = res.created
      ? usableCards(res.key ? [res.key] : [])
      : usableCards(res.keys?.length ? res.keys : res.key ? [res.key] : []);
    if (res.created) {
      issuedCount.value = Math.min(kindLimit.value, issuedCount.value + 1);
    } else if (res.keys?.length) {
      issuedCount.value = usableCards(res.keys).length;
    }
    push({
      id: `key-${Date.now()}`,
      from: 'bot',
      text: res.message || 'Ключ готов.',
      keyCards: cards
    });
  } catch (err: unknown) {
    const status = typeof err === 'object' && err && 'statusCode' in err ? Number((err as { statusCode?: number }).statusCode) : 0;
    const msg =
      typeof err === 'object' && err && 'data' in err && typeof (err as { data?: { statusMessage?: string } }).data?.statusMessage === 'string'
        ? (err as { data: { statusMessage: string } }).data.statusMessage
        : typeof err === 'object' && err && 'statusMessage' in err
          ? String((err as { statusMessage?: string }).statusMessage)
          : 'Не удалось выдать ключ. Попробуйте ещё раз.';
    keyRequestError.value = friendlyVpnError(msg, vpnKind.value);
    push({
      id: `key-err-${Date.now()}`,
      from: 'bot',
      text:
        status === 401
          ? 'Чтобы получить ключ, войдите в платформу.'
          : friendlyVpnError(msg, vpnKind.value)
    });
  } finally {
    keyRequestLoading.value = false;
  }
};

const backToNeed = () => {
  step.value = 'need';
  device.value = null;
  issuedCount.value = 0;
  keyRequestError.value = '';
  offeredCodes.value = [];
  chatgptLoading.value = false;
  messages.value = [{ id: 'welcome', from: 'bot', text: copy.welcome }];
  void scrollThreadToBottom();
};

const backToDevice = () => {
  step.value = 'vpn-device';
  device.value = null;
  issuedCount.value = 0;
  keyRequestError.value = '';
  messages.value = [
    { id: 'welcome', from: 'bot', text: copy.welcome },
    { id: 'need-vpn', from: 'user', text: 'VPN' },
    { id: 'device-bot', from: 'bot', text: copy.askDevice }
  ];
  void scrollThreadToBottom();
};

const reset = () => {
  step.value = 'need';
  device.value = null;
  issuedCount.value = 0;
  keyRequestError.value = '';
  offeredCodes.value = [];
  chatgptLoading.value = false;
  messages.value = [{ id: 'welcome', from: 'bot', text: copy.welcome }];
  void scrollThreadToBottom();
};

onMounted(() => {
  void scrollThreadToBottom();
});
</script>

<style scoped>
.vpn-page {
  --vpn-ink: #111;
  --vpn-lime: #ddf365;
  --vpn-purple: #7451f4;
  --vpn-face: #eeeee8;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  width: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.vpn-chat {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  width: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border: 2px solid var(--vpn-ink);
  border-radius: 14px;
  background: #fff;
  box-shadow: 4px 4px 0 var(--vpn-ink);
  overflow: hidden;
}

.vpn-chat__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 2px solid var(--vpn-ink);
  background: var(--vpn-face);
  flex: 0 0 auto;
}

.vpn-chat__head-label {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #3a3a3a;
}

.vpn-chat__status {
  flex: 0 0 auto;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 4px 7px;
  border: 1.5px solid var(--vpn-ink);
  background: var(--vpn-lime);
}

.vpn-chat__thread {
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  padding: 12px 14px 8px;
  background: #fafaf7;
}

/* Прижимает переписку к низу: старт слева снизу, новые смс снизу, старые уходят вверх */
.vpn-chat__thread-pin {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.vpn-bubble {
  max-width: min(92%, 480px);
  padding: 9px 12px;
  border: 1.5px solid var(--vpn-ink);
  border-radius: 14px;
  font-size: 0.9rem;
  line-height: 1.35;
  flex: 0 0 auto;
  animation: vpn-bubble-in 0.18s ease-out;
}

.vpn-bubble--bot {
  align-self: flex-start;
  background: #fff;
  border-bottom-left-radius: 4px;
}

.vpn-bubble--user {
  align-self: flex-end;
  background: var(--vpn-lime);
  border-bottom-right-radius: 4px;
  font-weight: 700;
}

.vpn-bubble__text {
  margin: 0;
}

.vpn-bubble__bullets {
  margin: 6px 0 0;
  padding-left: 1.1rem;
  display: grid;
  gap: 3px;
  font-size: 0.84rem;
}

@keyframes vpn-bubble-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.vpn-chat__composer {
  flex: 0 0 auto;
  border-top: 2px solid var(--vpn-ink);
  background: #fff;
  padding: 10px 12px 12px;
}

.vpn-actions {
  display: grid;
  gap: 8px;
}

@media (min-width: 560px) {
  .vpn-actions:not(.vpn-actions--stack):not(.vpn-actions--client) {
    grid-template-columns: 1fr 1fr;
  }

  .vpn-actions:not(.vpn-actions--stack):not(.vpn-actions--client) .vpn-link {
    grid-column: 1 / -1;
  }
}

.vpn-actions--stack {
  grid-template-columns: 1fr;
}

.vpn-actions--client {
  grid-template-columns: minmax(0, 1fr) 112px;
  align-items: start;
}

.vpn-actions--client .vpn-actions__main {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.vpn-actions--client .vpn-actions__row {
  grid-column: 1 / -1;
}

.vpn-actions__row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
}

.vpn-help {
  appearance: none;
  cursor: pointer;
  border: 2px solid var(--vpn-ink);
  border-radius: 10px;
  background: color-mix(in srgb, var(--vpn-purple) 14%, white);
  box-shadow: 2px 2px 0 var(--vpn-ink);
  padding: 8px 7px;
  display: grid;
  gap: 4px;
  align-content: center;
  justify-items: center;
  text-align: center;
  width: 112px;
  height: 112px;
  min-height: 112px;
  box-sizing: border-box;
  transition: transform 0.12s ease, box-shadow 0.12s ease, background-color 0.12s ease;
}

.vpn-help:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--vpn-ink);
  background: color-mix(in srgb, var(--vpn-purple) 22%, white);
}

.vpn-help:focus-visible {
  outline: 3px solid var(--vpn-purple);
  outline-offset: 2px;
}

.vpn-help__label {
  font-family: 'Unbounded', 'Golos Text', system-ui, sans-serif;
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1.15;
  color: var(--vpn-ink);
}

.vpn-help__hint {
  font-size: 0.62rem;
  line-height: 1.2;
  color: #3a3a3a;
  font-weight: 600;
}

@media (max-width: 559px) {
  .vpn-actions--client {
    grid-template-columns: 1fr;
  }

  .vpn-help {
    width: 100%;
    height: auto;
    min-height: 0;
    justify-items: start;
    text-align: left;
    padding: 10px 12px;
  }
}

.vpn-chip {
  appearance: none;
  text-align: left;
  cursor: pointer;
  border: 2px solid var(--vpn-ink);
  border-radius: 10px;
  background: #fff;
  padding: 10px 12px;
  box-shadow: 2px 2px 0 var(--vpn-ink);
  transition: transform 0.12s ease, box-shadow 0.12s ease, background-color 0.12s ease;
  display: grid;
  gap: 2px;
  min-width: 0;
}

.vpn-chip:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--vpn-ink);
}

.vpn-chip:focus-visible {
  outline: 3px solid var(--vpn-purple);
  outline-offset: 2px;
}

.vpn-chip--lime:hover {
  background: var(--vpn-lime);
}

.vpn-chip--purple:hover {
  background: color-mix(in srgb, var(--vpn-purple) 16%, white);
}

.vpn-chip--chatgpt:hover {
  background: color-mix(in srgb, #10a37f 14%, white);
}

.vpn-chip__label {
  font-family: 'Unbounded', 'Golos Text', system-ui, sans-serif;
  font-size: 0.92rem;
  font-weight: 800;
  color: var(--vpn-ink);
}

.vpn-chip__hint {
  font-size: 0.74rem;
  line-height: 1.25;
  color: #4a4a4a;
}

.vpn-cta {
  justify-self: stretch;
  text-align: center;
  text-decoration: none;
}

.vpn-cta--soon,
.vpn-cta:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.vpn-cta--ghost {
  background: #fff;
  color: var(--vpn-ink);
  border: 2px solid var(--vpn-ink);
  box-shadow: 2px 2px 0 var(--vpn-ink);
}

.vpn-error {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: #b42318;
}

.vpn-key-cards {
  margin-top: 10px;
  display: grid;
  gap: 10px;
}

.vpn-key-card {
  display: grid;
  gap: 8px;
  justify-items: start;
  padding: 10px;
  border: 1.5px dashed var(--vpn-ink);
  border-radius: 10px;
  background: var(--vpn-face);
}

.vpn-key-card__name {
  margin: 0;
  font-size: 0.78rem;
  font-weight: 800;
  word-break: break-all;
}

.vpn-key-card__qr {
  width: 180px;
  height: 180px;
  border: 1.5px solid var(--vpn-ink);
  background: #fff;
  image-rendering: pixelated;
}

.vpn-key-card__download {
  text-decoration: none;
  font-size: 0.82rem;
  padding: 8px 12px;
}

.vpn-link {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 2px 0;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--vpn-purple);
  cursor: pointer;
  text-align: left;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.vpn-link:hover {
  color: var(--vpn-ink);
}
</style>
