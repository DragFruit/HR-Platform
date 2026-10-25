# «Синий Ноктюрн»: промпты всех картинок

Готовые промпты на все 44 файла. Стиль, палитра и правила лежат в `sinij-nokturn-art.md`, пути и размеры там же. Эталон стиля: `docs/design-refs/nokturn/LOCKED-style-noir.png`, отдавать референсом в каждую генерацию.

## Как пользоваться

Промпт собирается из трёх кусков: **ПРЕФИКС + строка предмета + НЕГАТИВЫ**. Префикс и негативы ниже, строки предметов в таблицах. Для сцен, портретов и трёх особых файлов промпт дан целиком, собирать ничего не надо.

### ПРЕФИКС обычный (предметы, улики, иконки)

> high-contrast noir illustration, hand-inked, heavy black brush-ink shapes, two-colour screenprint: ink black on bone white paper, visible paper tooth, grain and slight misregistration, flat even lighting, plain background,

### ПРЕФИКС для бумаг (все `doc-*`)

> scan of an aged typewritten document, slightly crumpled paper, soft shadow, flatbed scan look, bone white paper, ink black and cold teal only,

### НЕГАТИВЫ (дописывать всегда)

> no text, no lettering, no title, no caption, no tagline, no typography, no signature, no watermark, no numbers, no readable writing of any kind, no photograph, no photorealistic texture, no 3d render, no colour except teal accent, no rainbow gradients

На документах текста быть не должно: все надписи выводит код поверх подложки. Картинку, пришедшую с текстом, перегенерировать, а не затирать.

---

## Приоритет 1: к понедельнику 10:00 (17 файлов)

Доска, рама, сцена кабинета, 6 предметов, пакет, 7 портретов.

---

## 1. Доска и рама (промпты целиком)

### `board-cork.jpg` — 2560×1440, 16:9

> high-contrast noir illustration of a cork board surface, hand-inked, close-up full-frame texture filling the entire image edge to edge, coarse cork grain drawn with brush ink stippling and hatching, about 25 small dark pin holes clustered near the centre and upper area, holes rendered as dark low-contrast dents, two-colour screenprint: ink black on bone white paper, mid-tone surface value (clearly lighter than black so light paper cards read on top), visible paper tooth, grain and slight misregistration, even flat lighting across the whole surface, empty board

Негативы:

> no frame, no border, no wooden edge, no teal, no cyan, no colour, no photograph, no photorealistic texture, no 3d render, no bright highlights, no pins, no papers, no notes, no strings, no objects, no text, no watermark, no vignette

Главное: средний тон, не чёрный. Поверх лягут светлые карточки, и на чёрной доске они будут выглядеть как дырки.

### `prop-board-frame.png` — 1024×1024, PNG с прозрачностью

> hand-inked illustration of a rectangular wooden picture frame, heavy dark wood with bold simple grain, drawn with black brush ink and coarse hatching, two-colour screenprint look: ink black on bone white, visible paper tooth and grain, the frame forms a closed rectangle with a completely empty transparent centre, band thickness about 90 px, flat even lighting, straight uniform sides, corners clearly drawn, large simple shapes that stay readable when scaled down

Негативы:

> no background, no fill inside the frame, no cork, no board, no picture inside, no colour, no teal, no photograph, no 3d render, no perspective, no tilt, no shadow outside the frame, no fine detail, no thin lines, no text, no watermark

Важно: рама рисуется на экране толщиной 20 px, а на мобильном 10 px. Мелкая штриховка туда не доживёт, поэтому рисунок крупный и простой. Середина должна быть действительно прозрачной, а не белой.

---

## 2. Локации (промпты целиком)

Семь локаций. Пять из них — фоны мини-игр, и у них есть требование, которого нет у остальных картинок: поверх фона код рисует интерактив. Значит в кадре должна быть **спокойная зона** под него, иначе элементы мини-игры утонут в рисунке.

Ко всем локациям: эталон `LOCKED-style-noir.png` референсом, общие негативы, и к ним всегда дописывать:

> no people, no person, no figure, no silhouette, no hands, no body, no corpse, no blood

Людей в локациях нет ни разу: весь квест держится на пустых комнатах.

---

### 2.1 `scene-office.jpg` — кабинет, понедельник, 2048×1152

Самая дорогая картинка квеста и единственная, у которой **композиция уже задана кодом**: координаты шести горячих зон зашиты в `frontend/app/events/nokturn/content.ts` (`hotspots` этапа 1). Либо предметы встают в эти клетки, либо после генерации правятся координаты под картинку. Первое дешевле.

Куда должны попасть предметы, в долях кадра от левого верхнего угла:

| Предмет | X | Y | Место в кадре |
|---|---|---|---|
| Задвижка | 0.045–0.145 | 0.355–0.485 | левый край, середина высоты |
| Диктофон | 0.230–0.340 | 0.750–0.850 | левая треть, низ |
| Микрофон | 0.455–0.555 | 0.210–0.330 | центр, верх |
| Требование | 0.545–0.665 | 0.560–0.670 | центр, середина высоты |
| Салфетка | 0.705–0.825 | 0.715–0.815 | правая треть, низ |
| Монтажка | 0.825–0.955 | 0.300–0.410 | правый край, выше середины |

Промпт:

> high-contrast noir illustration, hand-inked, an empty inventor's study on the second floor of a jazz club at night, wide eye-level view of the whole room: an empty leather armchair behind a heavy desk in the centre, a sofa against the wall, a small sink in a corner, a barred window, a massive door on the left, technical drawings pinned to the walls, parts of a medical exoskeleton on a workbench, and six objects placed far apart from each other on clean uncluttered patches of floor, desk and furniture, each object fully visible and unobstructed with clear empty space around it: a massive metal sliding bolt low on the left wall, a small voice recorder on the floor in the lower left, a vintage stage microphone on a shelf high in the centre, a folded official document on the desk in the middle of the frame, a crumpled bar napkin on the floor in the lower right, a crowbar leaning against the right wall at mid height, heavy black brush-ink shapes, hard chiaroscuro, two-colour screenprint, ink black on bone white, visible paper tooth and grain, even readable lighting across the whole room, mid-tone walls and floor so dark objects stay visible against them, empty room

Негативы: общие + «no people» + 

> no clutter, no piles of junk, no overlapping objects, no duplicate objects, no extra tools, no shadow so deep that the objects disappear, no vignette

Главное: предметы не прячутся в темноте. Прятать их должен фон — похожая форма и похожий тон рядом, — а не чернота. На попытку у игрока 90 секунд (`attemptSeconds: 90`), в темноте он не найдёт их и за пять минут.

Резервный путь из арт-дока остаётся в силе: кабинет без предметов плюс наложение шести PNG кодом. Файлы `clue-01`…`clue-06` всё равно генерируются отдельно, так что терять нечего.

---

### 2.2 `scene-archive.png` — дверца архива, вторник, 1200×1200, PNG с прозрачностью

Поверх сетки 3×3 код играет в крестики-нолики. Значит девять квадратов должны быть **равными и геометрически ровными**, строго фронтально, без перспективы и наклона, промежутки одинаковые, сетка по центру кадра с равными полями. Кривая от руки сетка здесь не живость, а баг: кликабельные зоны считаются по ровной сетке.

> high-contrast noir illustration, hand-inked, a metal patent archive cabinet door seen perfectly straight on, flat front view, a combination lock made of nine identical empty square buttons in a precise 3 by 3 grid centred in the frame with equal margins and equal gaps, each square flat and completely blank inside, worn riveted sheet metal around the grid, a small keyhole and a handle near the edge, heavy black brush-ink shapes, two-colour screenprint, ink black on bone white, visible grain, flat even lighting, transparent background around the cabinet door

Негативы: общие + «no people» +

> no perspective, no tilt, no angle, no rotation, no symbols inside the squares, no crosses, no circles, no noughts, no digits, no icons on the buttons, no uneven grid, no missing squares, no background, no wall

Внутри квадратов не должно быть **ничего**. Крестики и нолики ставит код; если генератор нарисует их сам, картинка не годится — перегенерировать.

---

### 2.3 `scene-lab.jpg` — лаборатория, среда, 1920×1080

Мини-игра «Колбы»: переливание, пока цвета не совпадут с эталоном. Сами колбы интерфейса рисует код, а фон — это стол и стена **за** ними. Колбы на фоне нужны для антуража, но по краям кадра: центр остаётся спокойным.

> high-contrast noir illustration, hand-inked, an empty forensic laboratory at night, wide view of a long bench against a tiled wall, glass flasks and test tubes in metal stands grouped at the far left and far right edges of the frame, a burner, coiled glass tubing, handwritten notes and charts pinned to the tiles, the whole centre of the bench clear and empty, one flask at the edge faintly glowing cold teal as the single accent, heavy black brush-ink shapes, two-colour screenprint with a teal accent, ink black on bone white, visible grain, even lighting, empty room

Негативы: общие + «no people» +

> no objects in the centre of the frame, no clutter in the middle of the bench, no liquid colours other than teal, no green, no purple, no orange

---

### 2.4 `scene-basement.jpg` — подвал, четверг, 1920×1080

Мини-игра «Взлом»: поверх фона ляжет окно терминала со светлым текстом. Под него нужна спокойная и именно **тёмная** зона в центре кадра.

> high-contrast noir illustration, hand-inked, an empty club basement server room, wide view: a tall rack of audio equipment on the left, tangled cables running along bare concrete walls, rows of small indicator lights glowing cold teal as the single accent, one bare hanging bulb, pipes near the ceiling, a dark flat empty concrete wall across the centre of the frame, heavy black brush-ink shapes, two-colour screenprint with a teal accent, ink black on bone white, visible grain, empty room

Негативы: общие + «no people» +

> no monitor, no screen, no display, no screen glow in the centre, no readable interface, no clutter in the centre of the frame

Отклонение от арт-дока, сознательное: **монитор на фоне не рисуем**, хотя в таблице локаций он был. Терминал здесь — интерфейс, его рисует код, и нарисованный экран под ним читается как второй монитор рядом с настоящим. Строка в `sinij-nokturn-art.md` поправлена.

---

### 2.5 `scene-desk.jpg` — стол следователя, пятница, 1920×1080

Мини-игра «Пазл»: 12 фрагментов фотографии раскладывает код. Значит на фоне **разбросанных фрагментов быть не должно**, и это второе отклонение от арт-дока: нарисованные обрывки спорят с настоящими и игрок не поймёт, какие из них можно двигать. Нужна пустая середина стола. Строка в арт-доке поправлена.

> high-contrast noir illustration, hand-inked, an investigator's desk seen from directly above, flat top-down view: closed case folders stacked in the top left corner, a desk lamp reaching in from the top right corner, an ashtray and a pencil at the bottom edge, a faint coffee ring, the large central area of the worn wooden desk surface completely empty, heavy black brush-ink shapes, two-colour screenprint, ink black on bone white, visible paper tooth and grain, even flat lighting

Негативы: общие + «no people, no hands» +

> no photographs, no photo fragments, no torn paper, no puzzle pieces, no scattered papers, no objects in the centre, no perspective, no tilt, no horizon

---

### 2.6 `scene-hall.jpg` — зал клуба, 1920×1080

Фон заголовка квеста и экрана развязки. Поверх ляжет текст, и спокойную зону логичнее держать слева: шапка и титры у нас выровнены по левому краю.

> high-contrast noir illustration, hand-inked, the empty hall of a closed jazz club at night, wide cinematic view: a small stage with a single standing microphone on the right, round tables with chairs stacked upside down on them in the middle distance, a saxophone on a stand beside the stage, heavy velvet curtains, cold teal stage light falling on the empty stage as the single accent, the left third of the frame quiet and simple with deep flat shadow, heavy black brush-ink shapes, two-colour screenprint with a teal accent, ink black on bone white, visible grain, empty room

Негативы: общие + «no people» +

> no audience, no band, no musicians, no silhouettes, no busy detail in the left third, no spotlight glare, no stage lettering

---

### 2.7 `cover.jpg` — обложка, 1200×630

Карточка квеста и пункт меню. В маленьком размере кадр узнаётся только за счёт одной крупной формы, поэтому дверь берётся фронтально и во весь кадр.

> high-contrast noir illustration, hand-inked, a single closed heavy office door seen straight on at the end of a dark corridor, the door filling most of the frame, a thin bright strip of cold teal light spilling out from underneath it across the floor, a massive sliding bolt visible on the door, deep flat black shadow all around, very simple bold composition that stays readable at small size, heavy black brush-ink shapes, two-colour screenprint with a teal accent, ink black on bone white, visible grain, empty corridor

Негативы: общие + «no people» +

> no fine detail, no multiple doors, no corridor clutter, no sign, no room number, no name plate, no text on the door

---

### Приёмка локации перед укладкой в `public/events/nokturn/`

1. Текста нет нигде, включая мелкие надписи на приборах, табличках и корешках папок. Пришёл текст — перегенерировать, не затирать.
2. Бирюза акцентом в одном месте кадра, а не залита по фону.
3. Людей нет, тела нет, рук в кадре нет.
4. Спокойная зона на месте: у кабинета — вокруг каждого из шести предметов; у лаборатории, подвала и стола — в центре; у зала — левая треть.
5. Локация темнее карточек улик. Светлый фон съедает улику, которая ляжет поверх него.
6. Для кабинета отдельно: открыть мини-игру на localhost и проверить, что все шесть зон попадают по нарисованным предметам. Не попадают — правятся `hotspots`, а не картинка.

---

## 3. Портреты (промпты целиком)

**Общая часть для всех шести подозреваемых**, меняется только описание человека:

> high-contrast noir poster portrait, chest-up crop filling the frame, [ЧЕЛОВЕК], neutral calm expression, three-quarter key light from the left with a soft shadow on the right third of the face, both eyes clearly lit and readable, heavy black brush-ink shapes, two-colour screenprint, ink black on bone white, visible paper tooth and grain, plain flat background, 1950s crime film poster

**Негативы для всех портретов:**

> no text, no lettering, no title, no caption, no typography, no watermark, no photograph, no 3d render, no smirk, no wink, no glamour pose, no half of the face in blackness, no heavy shadow over the eyes, no fear expression, no tears, no menacing look

Размер 1024×1280, 4:5.

**Правило равной вины:** свет, кроп и мимика одинаковы у всех шестерых. Если на двух портретах рядом один выглядит подозрительнее другого, свет надо выравнивать. Иначе картинка решит детектив за игрока и ловушка понедельника развалится.

| Файл | Подставить вместо `[ЧЕЛОВЕК]` |
|---|---|
| `person-roman.jpg` | a man of about 45 in an expensive but worn wool overcoat, tired heavy-lidded eyes, receding hair |
| `person-fedor.jpg` | a pale meticulous young man in a classic bartender waistcoat and bow tie, perfect side parting |
| `person-lara.jpg` | a woman of about 35, a nightclub singer in an evening dress, smudged lipstick, one hand near her throat |
| `person-timur.jpg` | a man of about 40 in a crumpled raincoat, three-day stubble, a camera strap across his chest |
| `person-ilya.jpg` | a man of about 28 in a hoodie with headphones around his neck, untidy hair |
| `person-anna.jpg` | a woman of about 50 in a severe business suit, a folder under her arm, straight back |

**Два портрета вне правила равной вины:**

`person-fedor-android.jpg` (1024×1280) — тот же кадр и тот же свет, что у `person-fedor.jpg`, но:

> the same pale young man in a bartender waistcoat, but bio-mechanical structure showing faintly through the skin: joints, fibres and a dim cold teal glow under the cheekbone, same three-quarter key light from the left, same crop, high-contrast noir poster portrait, heavy black brush-ink shapes, two-colour screenprint with a teal accent, ink black on bone white, visible grain, plain flat background

`person-solovyova.jpg` (1024×1280) — она не подозреваемая, свет мягче и светлее, чтобы отделяться от доски:

> high-contrast noir poster portrait, chest-up crop, a woman of about 40 in a plain jacket with her hair tied back, very tired, a stack of case folders in front of her, soft even frontal light with little shadow, lighter overall value than the suspect portraits, heavy black brush-ink shapes, two-colour screenprint, ink black on bone white, visible grain, plain flat background

---

## 4. Улики-предметы

Префикс обычный + строка ниже + негативы. Все PNG с прозрачностью, 600×600, **без пакета**: пакет накладывается кодом отдельно.

| Файл | Строка предмета |
|---|---|
| `clue-01-latch.png` | a massive metal sliding door bolt, dusted fingerprints visible on its surface, isolated on transparent background |
| `clue-02-napkin.png` | a crumpled bar napkin with handwritten lines and one line circled, isolated on transparent background |
| `clue-03-microphone.png` | a vintage stage microphone lying on its side, its cable snaking away, isolated on transparent background |
| `clue-04-recorder.png` | a small magnetic voice recorder with dust stuck to it, isolated on transparent background |
| `clue-05-crowbar.png` | a crowbar with fresh scratches and a few offcuts of shielded cable beside it, isolated on transparent background |
| `clue-06-claim.png` | a folded official document with a wax seal and a handwritten note in the corner, isolated on transparent background |
| `clue-07-glass.png` | a whisky tumbler, wet, a lipstick mark on the rim and a faint bluish-teal residue on the inside walls, isolated on transparent background |
| `clue-10-flash-drive.png` | a cheap USB flash drive without its cap, a small sticker on the body, isolated on transparent background |

Два «фотографических» файла, 1920×1080 и 1200×900 соответственно, без прозрачности:

| Файл | Промпт целиком |
|---|---|
| `clue-08-server-photo.jpg` | high-contrast noir illustration of a photograph taken secretly: a server monitor screen shot from an angle, slightly blurred, the edge of the photographer's hand in frame, lamp glare on the screen, cold teal screen glow as the single accent, ink black on bone white, grain |
| `clue-09-registry.jpg` | high-contrast noir illustration of a stern corporate database screen, a table of empty rows with one row highlighted in cold teal, ink black on bone white, screen glare, grain |

Пятница, 1200×900:

| Файл | Промпт целиком |
|---|---|
| `clue-11-photo-torn.jpg` | high-contrast noir illustration of an old photograph: two men standing in a workshop with an early exoskeleton prototype between them, one noticeably older than the other, both in work clothes, aged print with worn corners, ink black on bone white, heavy grain. Картинка целая, на фрагменты её режет код |
| `clue-11-photo-back.jpg` | the blank reverse side of an old photograph, aged paper, worn corners, a faint rectangular discolouration, completely empty surface with room for a handwritten line. Надпись выводит код |

---

## 5. Документы

Префикс для бумаг + строка ниже + негативы. Все без читаемого текста, 900×1200.

| Файл | Строка |
|---|---|
| `doc-expertise.jpg` | a forensic medical report form with two paper clips and a rubber stamp mark in the corner, blurred placeholder lines instead of words |
| `doc-patent.jpg` | an old patent application on yellowed paper, in the applicants field the second line heavily crossed out by hand in ink, blurred placeholder lines instead of words |
| `doc-lab-report.jpg` | a laboratory report with a small chart and a table of values, clipped together, blurred placeholder lines instead of words |
| `doc-fedor-protocol.jpg` | an interrogation protocol on a typewritten form, one line in the middle underlined by hand, blurred placeholder lines instead of words |
| `doc-expense-report.jpg` | an accounting expense report form with a small till receipt stapled to it, blurred placeholder lines instead of words |

---

## 6. Антураж и иконки

Префикс обычный + строка + негативы.

| Файл | Размер | Строка |
|---|---|---|
| `prop-evidence-bag.png` | 700×700 | a transparent ziplock evidence bag, highlights on the plastic film, a white label strip across the bottom, the centre of the bag fully transparent, isolated on transparent background |
| `prop-pin-red.png` | 128×128 | a red push pin seen from slightly above with a small drop shadow, isolated on transparent background |
| `prop-pin-blue.png` | 128×128 | a cold teal push pin seen from slightly above with a small drop shadow, isolated on transparent background |
| `prop-thread.png` | 256×32 | a horizontal strip of red woollen thread texture, tileable left to right, isolated on transparent background |
| `prop-paper-01.jpg` | 900×1200 | a blank sheet of aged paper with creases and a soft shadow |
| `prop-paper-02.jpg` | 900×1200 | a blank sheet of aged paper with a different crease and a coffee ring stain |
| `prop-tape.png` | 300×120 | a torn piece of adhesive tape, isolated on transparent background |
| `prop-clip.png` | 150×150 | a metal paper clip, isolated on transparent background |
| `icon-case.png` | 256×256 | a case folder with a cold teal seal, simple bold shapes, isolated on transparent background |
| `icon-minigame.png` | 256×256 | a magnifying glass with a cold teal glint, simple bold shapes, isolated on transparent background |

Красная нить и красная булавка это единственные тёплые цвета во всём квесте. Больше красного нигде не появляется.

---

## Порядок генерации

1. Сначала два проверочных: `board-cork.jpg` и один портрет. Если стиль держится на фактуре и на лице, идти дальше.
2. Зафиксировать сид или отдавать эталон референсом в каждую следующую генерацию, иначе 44 картинки разъедутся по манере.
3. Шесть портретов подозреваемых генерировать подряд, одной серией, и смотреть их рядом: правило равной вины проверяется только сравнением.
4. `scene-office.jpg` делать последней из приоритета 1: она самая сложная. Если не выходит, резервный путь — пустой кабинет плюс наложение 6 предметов кодом.
