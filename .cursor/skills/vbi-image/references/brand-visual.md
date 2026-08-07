# Визуальный язык VBI — reference

## Палитра (канон)

| Токен | Hex | Роль |
|-------|-----|------|
| Page / card | `#eeeee8` | Фон платформы |
| Lime | `#ddf365` | Акцент, тень, bullet |
| Purple | `#7451f4` | Primary, ITMO-рамка |
| Black | `#111` / near-black | Обводка, текст |
| White | `#fff` | Поля, карточки |
| Coral (редко) | pill согласований | Не злоупотреблять |

Шрифты продукта (для текста *в* UI, не обязательно в растере): **Unbounded** (display), **Golos Text** (body).

## Стиль

- Neo-brutalist / ITMO: толстая чёрная рамка, тень `Npx Npx 0` лайм или фиолет, мало скруглений или крупные «таблетки» осознанно.
- Плоские заливки, минимум градиентов. Если градиент — из токенов платформы, не «космос».
- Квадратики на рамке ITMO — только по правилу `itmo-carousel-frame` (8 штук, 2 на сторону), не гирлянда.

## Anti-slop (запрещено в артах «под платформу»)

Даже если модель любит это по умолчанию:

1. Тёплый крем `#F4F1EA` + терракота + антиква-serif «editorial».
2. Фиолетово-индиго soft glow / mesh gradient на белом (не путать с плоским `#7451f4`).
3. Photoreal «человек с ноутбуком в офисе».
4. 3D clay / plasticine cute без запроса.
5. Мелкий текст по дуге, водяные знаки, стоковые watermark.
6. Слишком много объектов в одном кадре (больше 3 смысловых — обычно плохо).

## Эталоны в репо

Смотри README и PNG:

- `docs/design-refs/knowledge-base/`
- `docs/design-refs/employee-visiting-card/`
- `docs/design-refs/halloween-vacations/`
- `docs/design-refs/itmo-frame-squares-etalon.png` (если есть)
- tenure gift: `frontend/public/store/tenure-gift-banner-5y.png`

LOCKED-файлы — не перегенерировать «на вкус», пока заказчик не попросит новый вариант.
