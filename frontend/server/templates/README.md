# Шаблон заявления на отпуск (Word)

Файл **`vacation-application.docx`** — бланк HR с таблицей в шапке (чтобы строки адресата не «уезжали»).  
Исходник: `Заявление на отпуск (3).docx`. Пересборка:

```bash
cd frontend
node scripts/prepare-vacation-application-template.mjs "/path/to/Заявление на отпуск (3).docx"
```

Копия для Nitro: `server/assets/templates/vacation-application.docx`.

## Плейсхолдеры docxtemplater

| Плейсхолдер | Источник | Пример |
|-------------|----------|--------|
| `{legal_entity}` | `employees.json` → `legal_entity` | `Высокие Бизнес Идеи`, `ВиБиАй` |
| `{position}` | `title` | `HR-специалист` |
| `{employee_name}` | `name` | `Драго Станислава` |
| `{vacation_type}` | фиксировано | `ежегодный` |
| `{start_date}` | заявка → `start` | `1 июня 2026 г.` |
| `{end_date}` | заявка → `end` | `14 июня 2026 г.` |
| `{days_count}` | календарные дни `start`…`end` | `14` |
| `{return_date}` | первый рабочий день после `end` | `15 июня 2026 г.` |

Даты — прописью на русском с « г.». Число дней — **календарные**.

## Не заполняются автоматически

- Приказ № / дата приказа  
- Дата написания, подпись сотрудника  
- Дата согласования, подпись руководителя  

## Типографика

Подстановки в шапке/датах — **Times New Roman**, кегль как в бланке (**12 pt**, `w:sz=24` у адресата/дат).

## Генерация

Детерминированная подстановка через **docxtemplater** (`server/utils/vacationApplicationDocx.ts`). Без нейросети. После конвертации скрипт гоняет `xmllint` — битый XML не уйдёт в репозиторий.

## API

`GET /api/vacations/requests/:id/application` — скачивание для владельца заявки (`approved` + **ТД**) или admin/HR.
