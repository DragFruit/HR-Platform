# Шаблон заявления на отпуск

Файл: `server/assets/templates/vacation-application.docx` (копия в `server/templates/` для правок).

Текст бланка: «Прошу предоставить ежегодный оплачиваемый отпуск» + `с {start_date} по {end_date} на {days_count} дней`.

Плейсхолдеры: `{legal_entity}` `{position}` `{employee_name}` `{start_date}` `{end_date}` `{days_count}` `{return_date}`.

Кнопка: `approved` + ТД + `start > сегодня`. Генерация — `pizzip` + replace.
