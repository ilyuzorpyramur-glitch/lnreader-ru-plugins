<h1 align="center">📖 LNReader · Русские плагины ранобэ</h1>

<p align="center">
  <img src="https://img.shields.io/badge/language-Русский-8ca9ff" alt="RU">
  <img src="https://img.shields.io/badge/приложение-LNReader-a98cff" alt="LNReader">
  <img src="https://img.shields.io/github/last-commit/ilyuzorpyramur-glitch/lnreader-ru-plugins/plugins/v3.0.0?label=обновлён&branch=plugins/v3.0.0" alt="last commit">
</p>

> Плагины источников ранобэ для **LNReader**.
> Русские платформы: Author.Today, Ranobelib, Ficbook, Ranobes, Jaomix и другие.

---

## ✨ Особенности

- 🇷🇺 **20 русских источников** ранобэ и веб-новелл
- 🧩 **Один плагин = один файл** — TypeScript-модуль в `plugins/russian/`
- 🖼 **Иконки подтягиваются автоматически** — `download-plugin-icons.js`
- 🔍 **Фильтры поиска и статусы новелл** на каждом источнике
- 🤖 **Полная автоматизация** — push в `main` → сборка → публикация в ветку `plugins/v3.0.0`

## 📲 Установка

**Шаг 1.** Откройте LNReader → **Расширения** → нажмите ➕ и добавьте плагин-источник:

```
https://raw.githubusercontent.com/ilyuzorpyramur-glitch/lnreader-ru-plugins/plugins/v3.0.0/
```

**Шаг 2.** Обновите список источников и выберите нужный.

<details>
<summary>Совместимость с приложениями</summary>

| Приложение | Работает |
|---|:---:|
| LNReader | ✅ |
| Mihon | ❌ (это плагины ранобэ) |
| Aniyomi | ❌ |

Для манги используйте [mihon-ru-manga-repo](https://github.com/ilyuzorpyramur-glitch/mihon-ru-manga-repo),
для аниме — [aniyomi-ru-anime-repo](https://github.com/ilyuzorpyramur-glitch/aniyomi-ru-anime-repo).
</details>

## 📖 Каталог плагинов

**Платформы:** Author.Today · Ranobelib · Ficbook · Ranobes · Jaomix · Ranobehub · BookRiver · NeoBook · TopLiba · Zelluloza · Renovels · NovelTL · Литнет · ЛибКат

**Мультисорсовые:** Rulate (Bllate / Erolate) · ifreedom (Bookhamster / СвободныйМирРанобэ) · MTLNovel · NovelCool

*Полный актуальный список — в `plugins/russian/`.*

## 🔧 Сборка (для разработчиков)

Публикация идёт в GitHub Actions при пуше в `main`
(триггер — изменения в `plugins/`, `scripts/`, `src/`):

1. `npm run build:multisrc` — генерация мультисорсовых плагинов
2. `tsc` — компиляция TypeScript
3. `build-plugin-manifest.js` — манифест всех плагинов
4. Публикация собранных файлов в ветку **`plugins/v3.0.0`**

Локально:

```bash
npm install
npm run build:full
```

### Формат плагина

```ts
// plugins/russian/<источник>.ts
class MySource implements Plugin.PluginBase {
  id = 'MySource';
  name = 'My Source';
  icon = 'src/ru/mysource/icon.png';
  site = 'https://example.com';
  version = '1.0.0';           // версия плагина

  async popularNovels(...) { ... }
  async parseNovel(...)       { ... }
  async parseChapter(...)     { ... }
}
```

## 🛠 Генератор плагинов

Новые источники создаются автоматическим генератором
**[extension-forge](https://github.com/ilyuzorpyramur-glitch/extension-forge)**:
шаблоны плагинов с иконками, настройками и автоинкрементом версии,
плюс ежемесячный сторож, который проверяет плагины на работоспособность.

## 📜 Лицензия

[MIT License](LICENSE). Исходная архитектура плагинов принадлежит проекту
[LNReader](https://github.com/LNReader/lnreader-plugins) и его контрибьюторам.

---
<p align="center">Часть экосистемы <a href="https://github.com/ilyuzorpyramur-glitch/extension-forge">extension-forge</a> · аниме · манга · ранобэ</p>

---

## 🤖 Как я пишу код

<p align="center">
  <img src=".github/assets/ai-pair-coding.jpg" alt="AI пишет код, я проверяю" width="100%">
</p>

Не секрет: код в этих репозиториях я делаю не вручную. Основную работу — разбор
сайтов, генерацию расширений, починку селекторов и сборку — выполняет AI,
а я ставлю задачи, проверяю результат и отвечаю за то, что уходит в релиз.

- AI пишет код и готовит APK, GitHub Actions собирает и подписывает
- я проверяю источники, тестирую расширения на устройстве и решаю, что публиковать
- ошибки, регрессии и спорные решения — на мне

Так проект живёт быстрее: больше источников, чаще обновления, меньше рутины.

## ❤️ Поддержать проект

<p align="center">
  <img src=".github/assets/donate-banner.jpg" alt="Поддержать проект" width="100%">
</p>

Расширения бесплатные и без рекламы. Если они экономят твоё время —
можно отправить донат через Tribute:

<p align="center">
  <a href="https://web.tribute.tg/d/T6v"><img src="https://img.shields.io/badge/%D0%9E%D1%82%D0%BA%D1%80%D1%8B%D1%82%D1%8C%20%D0%B2%20%D0%B1%D1%80%D0%B0%D1%83%D0%B7%D0%B5%D1%80%D0%B5-Tribute-ff4d6d?style=for-the-badge&logoColor=white" alt="Поддержать в браузере"></a>
  <a href="https://t.me/tribute/app?startapp=dT6v"><img src="https://img.shields.io/badge/Telegram-Tribute-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Поддержать в Telegram"></a>
</p>

<p align="center"><sub>Спасибо, что пользуешься и поддерживаешь ❤️</sub></p>
