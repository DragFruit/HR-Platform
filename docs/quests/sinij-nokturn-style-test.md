# «Синий Ноктюрн»: пробники стиля

Три направления на один и тот же кадр, чтобы сравнение было честным. Кадр для пробы: портрет Романа в деле. Портрет выбран потому, что от него зависят 8 файлов из 38 и потому, что стиль ломается в первую очередь на лицах.

Результаты складывать в `docs/design-refs/nokturn/`. Выбранный переименовать в `LOCKED-style-<имя>.png`, он станет эталоном для остальных 38 картинок.

Формат пробника: 4:5, 1024×1280.

---

## A. Карандаш и чернила, акцент в синем

Стиль платформы, сдвинутый под название клуба. Самый безопасный вариант: квест не будет выглядеть вклеенным из другого продукта.

**Промпт:**

> hand-drawn pencil and ink portrait, chest-up, a cynical arrogant man of about 45 in an expensive but worn wool overcoat, tired heavy-lidded eyes, looking slightly past the viewer, cross-hatching and graphite shading, aged off-white paper texture with a soft fold, muted desaturated palette, a single cold blue-violet accent in the collar shadow, plain neutral background, case-file portrait framing, 1950s detective mood

**Негативы:**

> no text, no lettering, no watermark, no photorealism, no glossy 3D clay, no soft ambient glow, no rainbow gradients, no stock photo look, no smiling

**Плюс:** родной платформе, дешевле всего размножить на 38 файлов.
**Минус:** меньше всего хеллоуина, на фоне обычных экранов платформы квест будет выделяться слабо.

---

## B. Нуар-постер, густая тушь и три цвета

Киношный вариант: половина лица в тени, жёсткий контраст, печать с лёгким сдвигом цветов.

**Промпт:**

> high-contrast noir poster portrait, chest-up, a cynical arrogant man of about 45 in a worn expensive overcoat, half of his face lost in deep shadow, hard chiaroscuro, heavy black brush-ink shapes, silkscreen print texture with slight colour misregistration, strictly three-colour palette: bone white, ink black, cold teal, visible paper tooth and grain, 1950s crime film poster, plain flat background

**Негативы:**

> no text, no lettering, no watermark, no photorealism, no neon, no cyberpunk glow, no large halftone dots, no rainbow gradients, no smiling

**Плюс:** максимум атмосферы, лучше всех работает на хеллоуин, отлично ляжет на тёмную доску.
**Минус:** сильнее всех спорит со стилем платформы, и лица в глубокой тени хуже узнаются в маленьких аватарках бюллетеня.

---

## C. Патентный чертёж, гравюра и синька

Тематический вариант: всё дело построено на патентах, экзокостюме и андроиде, поэтому персонажи нарисованы как технические иллюстрации из заявки.

**Промпт:**

> vintage technical illustration portrait, chest-up, a man of about 45 in a worn overcoat, rendered as fine engraved line art in the manner of a patent drawing, thin uniform ink lines and stippling, overlaid on a faint cyan blueprint grid with dimension lines, sepia ink on bluish drafting paper, aged folds and the shadow of a rubber stamp, no shading washes except pale cyan, archival document feel

**Негативы:**

> no readable text, no numbers, no legend, no watermark, no photorealism, no glossy 3D, no rainbow gradients, no smiling

**Плюс:** самый оригинальный и точнее всех попадает в суть дела, улики-документы в нём получатся сами собой.
**Минус:** холодный и «неживой», эмоции персонажей читаются хуже всего, а финал у нас эмоциональный.

---

## Что делать после выбора

Не заказывать все 38 картинок сразу. Сначала на выбранном стиле прогнать ещё два кадра и посмотреть, держится ли стиль:

1. `board-cork.jpg` - фактура, а не персонаж, ломается иначе.
2. `person-lara.jpg` - второй человек, видно, одинаковые ли лица по манере.

Если оба держатся, фиксировать сид или отдавать выбранный пробник референсом в каждую следующую генерацию, иначе 38 картинок разъедутся по манере и доска будет выглядеть как сборная солянка.

---

## Итог: выбран B

Заказчик прогнал направление B и принял его 25 октября. Эталон: `docs/design-refs/nokturn/LOCKED-style-noir.png`.

Стиль идёт на все 38 файлов, портреты в том числе. Моя исходная идея разводить портреты и фоны по двум манерам отменяется: на пробнике лицо читается даже при половине в глубокой тени, так что второй стиль не нужен, а один стиль на весь квест дешевле и собраннее.

Два следствия из пробника, перенесены в `sinij-nokturn-art.md`:

1. Генератор дорисовал заголовок и слоган поверх портрета вопреки негативу «no text». Негативы усилены, картинки с текстом перегенерировать, а не затирать.
2. На пробнике персонаж вышел обаятельным и ухмыляющимся, то есть читался как герой постера. Для портретов подозреваемых введено правило равной вины: одинаковый свет, кроп и мимика у всех шестерых, иначе картинка решает детектив за игрока.
