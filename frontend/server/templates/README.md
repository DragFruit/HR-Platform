# Шаблон заявления на отпуск

Файл: `server/templates/vacation-application.docx`.  
В CI копируется в `.output/server/templates/` (не кладём в `server/assets` — Nitro OOM на сборке).

Текст: «ежегодный оплачиваемый отпуск»; `с {start_date} по {end_date} на {days_count} дней`.

Плейсхолдеры: `{legal_entity}` `{position}` `{employee_name}` `{start_date}` `{end_date}` `{days_count}` `{return_date}`.
