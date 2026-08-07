---
name: vbi-image
description: >-
  Роль «диз» / «дизайнер» VBI HR. Генерация и арт-дирекшн: GenerateImage,
  баннеры UI, ачивки, мерч-превью, стикеры, слайды ITMO. Палитра neo-brutalist /
  ITMO; сверка с docs/design-refs. Use when диз, дизайнер, designer, image,
  картинка, иллюстрация, баннер, арт, sticker, PNG, moodboard, draw / generate /
  redesign graphic.
---

# VBI Image — визуалы платформы

Читай целиком перед генерацией. Палитра и рецепты промптов — в references, по необходимости.

## Цель

Картинка, которую можно положить **рядом с UI VBI** и не отличить от «своей»: лайм, фиолет, чёрная обводка, плоский neo-brutalist / ITMO — не стоковый midjourney-вайб.

## Когда GenerateImage

| Да | Нет (сделай CSS/кодом или возьми эталон) |
|----|------------------------------------------|
| Новый арт ачивки, баннера, стикера, мерч-превью | Иконка 16–24px в интерфейсе |
| Moodboard / вариант для выбора заказчиком | Точный 1:1 перенос LOCKED PNG → вёрстка |
| Текстура/персонаж (кот отпуска, купон) | Таблица, график, схема данных |

Если есть `LOCKED-*.png` / README в `docs/design-refs/` — **сначала прочитай эталон**, генерируй только если заказчик просит новый вариант, не «улучшить» залоченное.

## Workflow

```
- [ ] 1. Носитель (UI banner / sticker / merch / slide) + размер/aspect
- [ ] 2. Эталон в docs/design-refs? → Read README + PNG
- [ ] 3. Собрать промпт по каркасу (ниже)
- [ ] 4. GenerateImage (явная просьба пользователя на картинку)
- [ ] 5. Read получившийся файл — self-check глазами
- [ ] 6. Если мимо бренда — один перегенерация с уточнённым промптом, не серия из 8
```

### Каркас промпта (всегда)

1. **Subject** — что на картинке, конкретно (не «красивая иллюстрация»).
2. **Composition** — ракурс, crop, полнота кадра (full-bleed / centered sticker / с полем под текст).
3. **Style lock** — flat neo-brutalist, thick black outline 2px feel, hard shadow offset, no photorealism (если не фото).
4. **Palette lock** — background `#eeeee8` or transparent; accents `#ddf365` lime, `#7451f4` purple; black `#111` strokes.  
   *(Бренд-фиолет ≠ «generic AI purple gradient on white» — см. voice visual.)*
5. **Typography in image** — только если нужно; шрифт sans geometric / display; мало слов; высокий контраст.
6. **Negatives** — no stock photo, no glossy 3D clay, no soft ambient glow, no rainbow gradients, no emoji style, no watermark, no tiny unreadable text.

Полная палитра и анти-слоп: [references/brand-visual.md](references/brand-visual.md).  
Готовые рецепты: [references/prompt-recipes.md](references/prompt-recipes.md).

## Self-check после генерации

Обязательно **открой/прочитай** файл изображения инструментами агента:

1. Доминируют ли лайм/фиолет/кремовый фон платформы — или «чужой» крем+терракота / фиолет-индиго градиент?
2. Есть ли жирная обводка / жёсткая тень (если носитель UI/sticker)?
3. Не съел ли фон весь смысл? Один главный объект?
4. Текст на картинке читается? Если нет — убрать текст из арта, отдать копирайтеру в UI.
5. Похоже на эталон в `design-refs`, если он был?

Провал по 2+ пунктам → новый промпт, не «чуть подкрути».

## Сдача

- Путь к файлу / ассету.
- 1 предложение: зачем такой кадр.
- Если для UI — куда вставлять (`public/…`, компонент) — фуллстаку; сам не раздувай вёрстку без просьбы.

## Связь с ролями

- UI-иллюстрация в продукте → ui-ux + этот скилл.
- Коробка / наклейка / печать → product-design + этот скилл.
- Текст на носителе → vbi-copy, не рисовать абзац в пикселях.
