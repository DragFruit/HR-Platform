/** CSP frame-ancestors для карты кликов и Вебвизора (iframe на metrika.yandex.*). */
export const YANDEX_METRIKA_FRAME_ANCESTORS_CSP = [
  "frame-ancestors 'self'",
  'https://metrika.yandex.ru',
  'https://metrika.yandex.by',
  'https://metrika.yandex.com',
  'https://metrika.yandex.com.tr',
  'https://metrica.yandex.ru',
  'https://metrica.yandex.by',
  'https://metrica.yandex.com',
  'https://webvisor.com',
  'https://*.webvisor.com',
  'https://*.metrika.yandex.ru',
  'https://*.metrika.yandex.by'
].join(' ');

/** Сниппет Яндекс Метрики для вставки в <head> (ранняя загрузка, SPA + SSR). */
export const YANDEX_METRIKA_DEFAULT_ID = '110244372';

export const resolveYandexMetrikaId = (raw?: string) =>
  String(raw || YANDEX_METRIKA_DEFAULT_ID).trim();

export const buildYandexMetrikaHead = (counterId: string) => {
  const id = resolveYandexMetrikaId(counterId);
  if (!/^\d+$/.test(id)) return { script: [], noscript: [] };

  const tagSrc = `https://mc.yandex.ru/metrika/tag.js?id=${id}`;

  const loader = [
    '(function(m,e,t,r,i,k,a){',
    'm[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};',
    'm[i].l=1*new Date();',
    'for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}',
    'k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)',
    `})(window,document,"script","${tagSrc}","ym");`,
    `ym(${id},"init",{`,
    'ssr:true,',
    'webvisor:true,',
    'clickmap:true,',
    'ecommerce:"dataLayer",',
    'accurateTrackBounce:true,',
    'trackLinks:true,',
    'defer:true',
    '});'
  ].join('');

  return {
    script: [
      {
        key: 'yandex-metrika',
        type: 'text/javascript' as const,
        tagPriority: 'critical' as const,
        innerHTML: loader
      }
    ],
    noscript: [
      {
        key: 'yandex-metrika-noscript',
        innerHTML: `<div><img src="https://mc.yandex.ru/watch/${id}" style="position:absolute; left:-9999px;" alt="" /></div>`
      }
    ]
  };
};
