# CallsReport

Приложение для речевой аналитики звонков Bitrix24 через VibeCode API.

Канонический git-репозиторий проекта находится в корне рабочего каталога `C:\!MYA\Project\callsreport`.

## Назначение

Система загружает звонки из Bitrix24, определяет наличие аудиозаписи, ставит звонки в очередь на анализ, выполняет транскрибацию через Whisper и строит AI-разбор разговора:

- транскрипт;
- резюме разговора;
- рекомендации;
- оценку по сценарию;
- индивидуальные метрики;
- сводный отчет и дашборд.

## Основные возможности

- отчет по звонкам с фильтрами;
- дашборд по аналитике звонков;
- библиотека сценариев анализа;
- ручной запуск анализа по отдельному звонку;
- автоматическая постановка звонков в очередь на анализ;
- хранение результатов анализа и очереди в постоянной БД;
- ссылки на CRM-сущности, связанные со звонком.

## Стек

- `Node.js 20`
- `Express`
- `sql.js` как встроенная SQLite-совместимая БД
- frontend без фреймворка на `HTML + CSS + vanilla JS`
- интеграции с `VibeCode API` и `Bitrix24`

## Быстрый старт

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env` на основе `.env.example`.

3. Запустить приложение:

```bash
npm start
```

4. Открыть приложение по адресу:

```text
http://localhost:3000
```

## Переменные окружения

Минимальный набор:

```bash
PORT=3000
VIBE_API_KEY=vibe_api_...
VIBE_API_URL=https://vibecode.bitrix24.tech
BITRIX_PORTAL_URL=https://your-portal.bitrix24.ru
AI_CHAT_MODEL=bitrix/bitrixgpt-5
AI_TRANSCRIPTION_MODEL=bitrix/deepdml/faster-whisper-large-v3-turbo-ct2
APP_DB_PATH=/var/lib/callsreport/callsreport.sqlite
APP_LEGACY_DATA_DIR=/var/lib/callsreport/bootstrap-data
```

Дополнительно поддерживаются:

- `AI_TRANSCRIPTION_RETRIES`
- `ANALYSIS_QUEUE_CONCURRENCY`
- `ANALYSIS_AUTO_SCAN_INTERVAL_MS`
- `ANALYSIS_AUTO_SCAN_BATCH`
- `MAX_CALLS_PER_BATCH`
- `VIBE_REQUEST_TIMEOUT_MS`
- `AI_TRANSCRIPTION_TIMEOUT_MS`

В production при Vibe Deploy канонический env-файл должен лежать в `/var/lib/callsreport/.env`. Backend при старте пытается подхватить `.env` из директории релиза, из `/opt/app/.env` и из `/var/lib/callsreport/.env`, чтобы не терять конфигурацию при разворачивании в `/opt/app/callsreport-main` и при `clean deploy`.

## Где читать документацию

- [Архитектура](./docs/architecture.md)
- [Логика работы](./docs/logic.md)
- [Модель оценки звонка](./docs/scoring.md)
- [Памятка по заполнению сценария анализа](./docs/scenario-writing-guide.md)
- [Модель данных и БД](./docs/database.md)
- [Внутреннее API](./docs/api.md)
- [Деплой](./docs/deployment.md)
- [Эксплуатация](./docs/operations.md)
- [Правила ведения документации](./docs/documentation-policy.md)
- [Архитектурные решения](./docs/adr/001-use-persistent-db.md)

## Важное

- постоянные данные больше не должны храниться внутри директории релиза;
- production-БД должна лежать вне каталога приложения;
- перед любыми изменениями схемы хранения нужно обновлять документацию в `docs/`;
- если меняется архитектурное решение, его нужно фиксировать в `docs/adr/`.
