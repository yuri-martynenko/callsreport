# База данных

## Назначение документа

Этот документ описывает постоянное хранение данных приложения: где лежит БД, какие таблицы существуют и какие данные считаются источником истины.

## Текущая реализация

Система использует встроенную SQLite-совместимую БД через `sql.js`.

Файл БД задается переменной:

```text
APP_DB_PATH=/var/lib/callsreport/callsreport.sqlite
```

Важно:

- БД должна лежать вне директории релиза;
- директория релиза может пересоздаваться при деплое;
- файл БД должен переживать пересборку приложения.

## Источник истины

После миграции источником истины являются таблицы БД.

Legacy JSON-файлы больше не должны использоваться как рабочее хранилище. Они могут использоваться только:

- для разовой миграции;
- как временный backup старого состояния.

## Таблицы

### `metadata`

Служебная таблица.

Хранит:

- timestamps обновления stores;
- источник legacy-миграции;
- другие технические признаки состояния БД.

### `analyses`

Хранит успешные результаты анализа звонков.

Ключ:

- `activity_id`
- `signature`

Поля:

- `activity_id`
- `signature`
- `updated_at`
- `payload`

`payload` содержит полный JSON анализа.

### `failures`

Хранит ошибки анализа.

Ключ:

- `activity_id`
- `signature`

Нужно для:

- отображения ошибок по звонкам;
- диагностики;
- различения ситуации "не анализировался" и "анализ завершился ошибкой".

### `jobs`

Хранит очередь анализа и её состояния.

Примеры статусов:

- `queued`
- `processing`
- `ready`
- `partial`
- `technical`
- `error`

Используется для:

- фоновой обработки;
- отслеживания прогресса;
- предотвращения повторной параллельной обработки одного звонка.

### `scenarios`

Хранит сценарии анализа.

Каждая запись содержит:

- идентификатор;
- дату обновления;
- JSON payload сценария.

Сценарий включает:

- имя;
- описание;
- script checklist;
- custom metrics;
- match rules;
- признаки `autoApply` и `isDefault`.

### `settings`

Хранит настройки приложения.

Сейчас используется singleton-запись с настройками:

- `autoTranscriptionMode`

В будущем сюда можно добавлять:

- параметры очереди;
- выбор моделей;
- режимы интеграции с CRM;
- правила автообогащения.

## Почему отказались от JSON-файлов

Старый подход хранил результаты в файлах внутри релиза приложения.

Проблемы такого подхода:

- данные терялись при пересборке;
- неудобно сопровождать очередь;
- риск гонок записи;
- нет четкой структуры хранения;
- сложно делать дальнейшие миграции.

## Миграция

При первом старте нового DB-слоя выполняется:

1. создание схемы;
2. проверка, есть ли данные в БД;
3. если БД пустая, попытка импорта из:
   - `APP_LEGACY_DATA_DIR`
   - `./data`
4. заполнение дефолтных записей, если нужно.

## Правила эксплуатации

- не хранить production-данные внутри `/opt/app/...`;
- регулярно делать backup файла БД;
- перед изменением структуры хранения фиксировать ADR;
- перед миграциями документировать сценарий rollback.

## Что желательно улучшить дальше

- добавить явную версию схемы;
- добавить таблицу миграций;
- вынести payload-поля в частично нормализованную структуру, если потребуется сложная аналитика;
- подготовить путь перехода на внешнюю СУБД, если появится несколько экземпляров сервиса.
## 2026-04 Activity Snapshot Cache

- SQLite now stores a persistent raw activity snapshot in `activity_snapshot_cache`.
- The cache keeps the latest unfiltered calls payload received from Vibe API and survives restart and deploy.
- Application startup and dashboard loading now read this local snapshot first and refresh it in background when it becomes stale.
- This table is an acceleration layer for call browsing. It does not replace `analyses`, `failures`, `jobs`, `scenarios`, or `settings` as the source of truth.
## 2026-04 Native SQLite Storage

- The runtime now uses native SQLite via `better-sqlite3` instead of the in-process `sql.js` image export model.
- Persistent storage is split into two databases:
  - `main.db` for analyses, failures, jobs, scenarios, settings, and metadata
  - `cache.db` for `crm_client_cache` and `activity_snapshot_cache`
- `main.db` is opened with `WAL` mode, `synchronous = FULL`, and `busy_timeout`.
- `cache.db` is opened with `WAL` mode and `synchronous = NORMAL`; if it becomes corrupted, it can be recreated from scratch.
- On startup the backend attempts to migrate from the previous single-file SQLite database or from `bootstrap-data` if the new main database is empty.
- The backend keeps rotation backups of `main.db` and appends changed analyses into daily JSONL export files in `analysis-exports`.

## 2026-04 Access Settings Payload

- No new table is required for application roles.
- Access configuration is stored inside the singleton `settings` payload as `settings.appAccess.roles`.
- Each role has:
  - `id`
  - `name`
  - `permissions`
  - `userIds`
  - `updatedAt`
- Permission keys are `viewDashboard`, `viewReport`, `viewScenarios`, `changeAutoTranscription`, `manualAnalyze`, and `manageScenarios`.
