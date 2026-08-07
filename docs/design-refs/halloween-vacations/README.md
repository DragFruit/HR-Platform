# Halloween — полоски отпусков

## 🔒 Единственный эталон кота

`LOCKED-cat-etalon.png` — только этот кот.

## Нарезка

`sprites/` и копия `frontend/public/halloween/`:

| Файл | Размер | Роль |
|------|--------|------|
| `cat-start.png` | 308×234 | голова, лапы, костюм |
| `cat-middle.png` | 270×176 | тайлинг по X |
| `cat-end.png` | 223×231 | круп + хвост |
| `cat-seam-proof*.png` | — | проверка S+M…+E |
| `meta.json` | — | `seam_top_y` для выравнивания |

Стык: высота сечения ~167–173px; выравнивать по `seam_top_y`.
