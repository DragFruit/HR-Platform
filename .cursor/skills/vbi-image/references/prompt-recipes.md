# Рецепты промптов VBI

Копируй каркас, подставляй subject. Пиши промпт **на английском** для модели, бренд-hex оставляй как есть.

## UI banner / карточка магазина

```
Flat neo-brutalist product banner for HR platform, subject: [SUBJECT],
centered composition with clear negative space for UI crop,
background fill #eeeee8, thick black outlines, hard drop shadow offset in #ddf365,
accent shapes in #7451f4 and #ddf365, minimal geometry, no photorealism,
no soft glow, no stock photo, high contrast, 16:9
```

## Стикер / ачивка (прозрачный или простой фон)

```
Die-cut sticker illustration, subject: [SUBJECT],
bold black contour, flat fills #ddf365 #7451f4 #eeeee8,
neo-brutalist, chunky, readable at 128px, single iconic object,
no tiny text, no photoreal, transparent or plain #eeeee8 background, 1:1
```

## Персонаж / маскот (например сезонный кот)

```
Character mascot sticker, [CHARACTER DESCRIPTION],
side view or 3/4, flat neo-brutalist, thick outline, palette limited to
#ddf365 #7451f4 #eeeee8 black white, seamless-friendly edges if tile,
no soft shading, no 3D render, no extra props unless listed
```

## ITMO slide background (контент потом в вёрстке)

```
Wide presentation slide background #eeeee8, thick black rectangular frame,
eight small corner squares on the frame (lime and purple alternating per side),
empty center for text, ITMO neo-brutalist, no illustrations inside, 16:9
```

## Когда текст на картинке

Добавь в конец:

```
Large bold sans-serif wordmark "[WORD]", high contrast black on lime or white on purple,
max 3 words, no paragraph text
```

Текст длиннее 3 слов — **не** рисовать: отдать `vbi-copy` + UI.

## Итерация

Второй промпт = исходный + **одна** правка («more lime shadow», «simpler silhouette», «remove background clutter»). Не переписывай всё с нуля без причины.
