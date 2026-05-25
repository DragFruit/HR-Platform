# График отпусков

Документация по проекту: демо-интерфейс и модуль Bitrix для учета отпусков, согласования, расчета остатка и уведомлений.

## 1) Что внутри проекта

Проект состоит из двух частей:

- `index.html` — самодостаточная демо-версия интерфейса (руководитель / сотрудник / HR) с данными в JS.
- `bitrix/modules/vacations/` — модуль для Bitrix24 (коробка) с доменной логикой, SQL-схемой и публичными точками входа.

Дополнительно:

- `tools_extract_requests.py` — утилита извлечения отпусков из XLSX в JSON.
- `requests-from-xlsx.json` — выгрузка заявок из исходного файла.
- `nachislenie-zarabotannogo-otpuska-zup.html` — методичка по расчету.

## 2) Быстрый старт

### Демо (`index.html`)

1. Открыть `index.html` в браузере.
2. Использовать переключатель ролей в шапке:
   - Руководитель: согласование + таймлайн,
   - Сотрудник: подача заявок + личный календарь,
   - HR: кадровые параметры, сводка и календари.

Примечание: в текущей демо-конфигурации оставлен отдел `Digital` с тестовыми подразделениями.

### Модуль Bitrix

1. Скопировать модуль в `bitrix/modules/vacations/`.
2. Выполнить SQL из `bitrix/modules/vacations/sql/install.sql`.
3. Подключить страницы:
   - `public/worker.php`,
   - `public/manager.php`,
   - `public/hr.php`.
4. Проверить автозагрузку в `bitrix/modules/vacations/include.php`.

## 3) Структура репозитория

```text
.
├── index.html
├── README.md
├── tools_extract_requests.py
├── requests-from-xlsx.json
├── nachislenie-zarabotannogo-otpuska-zup.html
└── bitrix/modules/vacations/
    ├── .description.php
    ├── version.php
    ├── include.php
    ├── install/index.php
    ├── uninstall/index.php
    ├── sql/
    │   ├── install.sql
    │   ├── uninstall.sql
    │   └── migration_reminder_v1.sql
    ├── lib/
    │   ├── AccessService.php
    │   ├── AccrualService.php
    │   ├── BalanceService.php
    │   ├── HolidayService.php
    │   ├── LeaveCalculator.php
    │   ├── ChainResolver.php
    │   ├── WorkflowService.php
    │   ├── WorkYearService.php
    │   ├── Leave14ReminderService.php
    │   ├── NotificationService.php
    │   ├── LeaveApprovalUseCase.php
    │   ├── Structure/
    │   ├── Domain/
    │   └── Support/
    ├── public/
    │   ├── worker.php
    │   ├── worker_submit.php
    │   ├── manager.php
    │   ├── hr.php
    │   └── reminder_run.php
    ├── docs/
    │   ├── HR_GUIDE.md
    │   └── REMINDER_14_DAYS.md
    └── tests/run.php
```

## 4) Роли и права

Базовые роли:

- `worker` — сотрудник,
- `manager` — согласующий,
- `hr` — администратор HR.

Проверки в `AccessService`:

- просмотр страницы сотрудника: сам сотрудник или HR,
- согласование: manager или HR,
- HR-админка: только HR.

Примечание: в публичных страницах сейчас стоят временные заглушки ролей (`TODO: map Bitrix groups -> vacations roles`).

## 5) Бизнес-логика (ключевые правила)

### Расчет отпуска с учетом праздников

- `LeaveCalculator` + `HolidayService`.
- Подсчет:
  - `daysTotalRequested` — календарные дни в диапазоне,
  - `holidayCount` — праздничные дни в диапазоне,
  - `daysCounted = total - holidays`,
  - `adjustedEndDate = end + holidayCount`.

### Начисление и остаток

- Норма: 28 дней/год.
- Начисление: ежемесячно, только после полного месяца с даты приема (`AccrualService`).
- Округление: усечение до 0.1 дня.
- Баланс (`BalanceService`):
  `initial_balance + accrued - used_approved`.

### Цепочка согласования

- `ChainResolver` + `StructureProviderInterface`.
- Порядок: сотрудник -> группхед (если есть) -> директор отдела.

#### Фактические правила интеграции с оргструктурой Bitrix (утверждено)

- Источник правды по структуре: раздел `Структура компании` в Bitrix.
- Узлы Digital-групп (например, `Группа 1`, `Группа 3`) считаются отдельным уровнем согласования.
- Для сотрудников в `Digital` и внутри `Группа X` маршрут всегда двухшаговый:
  1) руководитель группы,
  2) Digital Director.
- Если руководитель группы не найден (редкий fallback) — сразу Digital Director.
- Для `Digital / SMM`:
  - обычный сотрудник -> руководитель SMM,
  - если заявитель сам руководитель SMM -> Digital Director.
- Для `Digital / Analytics`: сразу Digital Director.
- `Digital / PPC`: сотрудников нет (в маршрут не закладывается).
- Для остальных отделов:
  - Разработка -> руководитель разработки,
  - Продажи -> Владислав Лашин,
  - Маркетинг -> руководитель маркетинга,
  - Дирекция -> генеральный директор,
  - Бухгалтерия -> главный бухгалтер,
  - SEO/SERM -> Head of SEO/SERM,
  - Отдел реализации внутренних проектов -> Дарья Грошева.
- Self-approval правило:
  - если согласующий совпал с заявителем, эскалировать:
    - для руководителя группы Digital и руководителя SMM -> Digital Director,
    - в остальных случаях -> генеральный директор.
- Если в структуре не найден/неактивен обязательный согласующий:
  - заявка отправляется в HR для ручной корректировки.
- HR имеет право вручную переопределять маршрут согласования и корректировать данные сотрудника.

### Workflow согласования

- `WorkflowService`.
- Статусы шагов: `waiting`, `pending`, `approved`, `rejected`.
- Логика:
  - первый шаг активен (`pending`),
  - после `approved` активируется следующий,
  - `rejected` завершает заявку отказом.

### Напоминание про 14 дней

- `Leave14ReminderService`.
- Срабатывает, когда:
  - до конца текущего рабочего года < 3 месяцев,
  - нет блока отпуска >= 14 календарных дней (в `approved` или `pending`),
  - напоминание за этот рабочий год еще не отправлялось.
- Доставка: уведомления Bitrix (`im`).

## 6) База данных (таблицы)

Создаются в `sql/install.sql`:

- `vac_leave_request` — заявки,
- `vac_approval_step` — шаги согласования,
- `vac_employee_account` — кадровые данные и стартовый остаток,
- `vac_accrual_ledger` — начисления,
- `vac_usage_ledger` — списания,
- `vac_holidays` — праздничные дни,
- `vac_reminder_sent` — журнал отправленных reminder.

Удаляются в `sql/uninstall.sql`.

## 7) Публичные точки входа модуля

- `public/worker.php` — страница сотрудника.
- `public/worker_submit.php` — обработчик отправки заявки (сейчас с TODO по сохранению в БД).
- `public/manager.php` — страница согласующего.
- `public/hr.php` — страница HR-администратора.
- `public/reminder_run.php` — запуск напоминаний (cron/agent/web с токеном).

## 8) Демо-интерфейс (`index.html`)

Ключевые особенности:

- таймлайн отпусков по дням и сотрудникам,
- фиксация шапки дат в режиме руководителя при вертикальной прокрутке,
- отдельный нижний фиксированный горизонтальный скролл для таймлайна руководителя,
- визуальные полосы отпусков с округленными краями сегментов,
- быстрый tooltip по полосам с диапазоном дат,
- подсветка текущего месяца и дня.

## 9) Тесты

Скрипт: `bitrix/modules/vacations/tests/run.php`.

Покрывает:

- праздники в диапазоне,
- начисление/баланс,
- цепочку согласования и workflow.

Запуск (локально):

```bash
php bitrix/modules/vacations/tests/run.php
```

Ожидаемый результат: `OK: all tests passed`.

## 10) Скрипт импорта из XLSX

`tools_extract_requests.py`:

- читает лист `2026` из файла `График отпусков (HR) .xlsx`,
- определяет статусы отпусков по fill-стилям ячеек,
- собирает непрерывные интервалы и сохраняет JSON.

Выход: `requests-from-xlsx.json`.

## 11) Известные ограничения / TODO

- В `public/*` используется упрощенная ролевая модель (нужен маппинг групп Bitrix -> роли).
- `worker_submit.php` пока не сохраняет заявку и workflow в БД (есть TODO).
- В демо (`index.html`) данные хранятся в JS/`localStorage`, это не серверная реализация.

## 12) Связанные документы

- `bitrix/modules/vacations/docs/HR_GUIDE.md` — памятка для HR.
- `bitrix/modules/vacations/docs/REMINDER_14_DAYS.md` — настройка напоминаний.

## 13) Context Recovery (после очистки контекста)

Ниже — сжатая карта проекта, чтобы быстро восстановить понимание системы в новой сессии Cursor.

### Читать в таком порядке (5-10 минут)

1. Этот `README.md`.
2. `index.html`:
   - блок CSS таймлайна/баров,
   - блок данных `departments` и `state`,
   - функции `createHeader`, `createBody`, `renderCalendar`,
   - функции фиксации шапки менеджерского таймлайна и синхронизации нижнего скролла.
3. `bitrix/modules/vacations/include.php` (карта классов).
4. Бизнес-ядро:
   - `lib/LeaveCalculator.php`
   - `lib/AccrualService.php`
   - `lib/BalanceService.php`
   - `lib/ChainResolver.php`
   - `lib/WorkflowService.php`
   - `lib/WorkYearService.php`
   - `lib/Leave14ReminderService.php`
5. `bitrix/modules/vacations/sql/install.sql` (фактическая модель данных).
6. `bitrix/modules/vacations/tests/run.php` (контрольные сценарии).

### Текущее состояние демо (важно помнить)

- Демо монолитное: HTML + CSS + JS в одном `index.html`.
- Для демо оставлен отдел `Digital` с тестовыми подразделениями.
- Часть данных в демо может храниться в `localStorage`; при инициализации выполняется фильтрация заявок под текущий список сотрудников из `departments`.
- У менеджерского таймлайна:
  - шапка дат фиксируется при вертикальной прокрутке скриптом (не только CSS sticky),
  - есть отдельный фиксированный горизонтальный скролл внизу экрана, синхронизированный с таблицей,
  - полосы отпусков имеют сегменты (start/mid/end/single) со скруглениями,
  - tooltip на полосе быстрый (кастомный) и показывает диапазон дат.

### Где искать, если “что-то сломалось”

- Не фиксируется шапка дат у менеджера:
  - проверить функции фиксации `thead` и слушатели scroll/resize,
  - убедиться, что активен `panel-manager`.
- Не работает нижний горизонтальный скролл:
  - проверить `#mgrBottomScrollbar` и синхронизацию `scrollLeft` с `.timeline-scroll-x`,
  - проверить, что есть горизонтальный overflow у таблицы.
- Пропали сотрудники/заявки:
  - проверить `departments`,
  - проверить фильтрацию состояния под roster при `init`.
- Изменился расчет дней:
  - сначала смотреть `LeaveCalculator`, `AccrualService`, `BalanceService`,
  - затем прогнать `tests/run.php`.

### Инварианты (не нарушать при правках)

- Подсчет отпуска: праздничные дни не списываются, конец сдвигается вперед на число праздников в диапазоне.
- Начисление: только после полного месяца от `hire_date`, усечение до 0.1.
- Workflow: только текущий `pending`-согласующий может принять решение.
- Цепочка согласования: group head (если есть) -> director.
- Reminder 14 дней: проверка в рамках рабочего года от даты приема + защита от повторной отправки.
- Оргструктура/маршруты: для Digital-групп обязателен двухэтапный маршрут (группа -> Digital Director), при ошибках резолва fallback в HR.

### Мини-чеклист после любых заметных изменений

1. Открыть `index.html` и проверить роли: manager / employee / hr.
2. В manager:
   - шапка дат фиксируется при вертикальном скролле,
   - нижний fixed-скролл двигает таблицу по X,
   - полосы отпусков скруглены с обеих сторон сегмента.
3. Проверить tooltip на полосе: отображается быстро и показывает диапазон дат.
4. Прогнать `php bitrix/modules/vacations/tests/run.php`.
5. Если трогали БД-логику — сверить с `sql/install.sql` и `docs/REMINDER_14_DAYS.md`.

