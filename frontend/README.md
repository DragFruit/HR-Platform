# Frontend (Nuxt 4)

Клиентская часть **VIBE VBI**. Общее описание проекта — в [корневом README](../README.md).

## Команды

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production → .output/
npm run preview  # превью сборки
```

## Структура `app/`

| Папка | Содержимое |
|-------|------------|
| `pages/` | Файловый роутинг Nuxt |
| `components/` | Vue-компоненты |
| `composables/` | Состояние и бизнес-логика |
| `assets/main.css` | Глобальные стили |
| `plugins/` | Client-only инициализация |
| `data/` | JSON-сиды (отпуска) |

## Документация

- [Архитектура](../docs/ARCHITECTURE.md)
- [Changelog](../docs/CHANGELOG.md)

При добавлении страниц или composables обновляйте документацию в корне `docs/`.
