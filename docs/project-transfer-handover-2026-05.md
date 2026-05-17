# Handover For Transfer And Full Bitrix24 REST Migration

## Назначение документа

Этот документ нужен как единая точка передачи проекта `callsreport` на другой ПК и как стартовая база для следующего этапа: полного отказа от `VibeCode API` в пользу `Bitrix24 REST API`.

Документ фиксирует:

- текущее состояние проекта;
- фактическую архитектуру;
- бизнес-процессы, которые уже реализованы;
- важные технические решения и ограничения;
- что нужно для запуска на новом ПК;
- что нужно учесть при полном переносе интеграции на `Bitrix24 REST`.

## 1. Что это за проект

`callsreport` — внутреннее web-приложение для аналитики звонков Bitrix24.

Основной пользовательский сценарий:

1. backend получает список звонков;
2. показывает их в отчете и на dashboard;
3. позволяет выбрать сценарий анализа;
4. ставит звонок в очередь;
5. скачивает запись звонка;
6. делает транскрибацию;
7. выполняет AI-разбор;
8. сохраняет результат;
9. показывает детализацию, метрики, статусы и агрегаты.

## 2. Текущее фактическое состояние

На дату передачи проект работает на:

- `Node.js 20`
- `Express`
- `better-sqlite3`
- frontend без framework: `HTML + CSS + vanilla JS`

Текущая ключевая внешняя зависимость:

- `VibeCode API` используется как транспортный и AI-шлюз.

Фактически через `VibeCode API` сейчас решаются задачи:

- получение списка звонков;
- скачивание аудиозаписей;
- получение списка portal users;
- транскрибация аудио;
- AI chat / structured analysis.

Bitrix24 сейчас используется как бизнес-контекст:

- ссылки на CRM-сущности;
- портал;
- контекст запуска пользователя;
- логическая принадлежность звонков к Bitrix24.

## 3. Каноническая структура проекта

Корень репозитория:

- `server.js` — backend API, бизнес-логика, очередь, интеграции;
- `db.js` — storage layer;
- `env.js` — единая загрузка `.env`;
- `public/index.html` — shell интерфейса;
- `public/app.js` — весь frontend;
- `public/styles.css` — стили;
- `docs/*` — эксплуатационная и архитектурная документация.

Основные документы:

- [README.md](/C:/!MYA/Project/callsreport/README.md)
- [docs/architecture.md](/C:/!MYA/Project/callsreport/docs/architecture.md)
- [docs/logic.md](/C:/!MYA/Project/callsreport/docs/logic.md)
- [docs/api.md](/C:/!MYA/Project/callsreport/docs/api.md)
- [docs/database.md](/C:/!MYA/Project/callsreport/docs/database.md)
- [docs/deployment.md](/C:/!MYA/Project/callsreport/docs/deployment.md)
- [docs/operations.md](/C:/!MYA/Project/callsreport/docs/operations.md)

## 4. Фактическая архитектура

Слои:

1. `public/*`
   - UI;
   - переключение разделов;
   - вызовы backend API;
   - рендер dashboard, таблицы звонков, сценариев, настроек, прав доступа.

2. `server.js`
   - HTTP API для frontend;
   - интеграция с внешними API;
   - нормализация звонков;
   - выбор сценария;
   - очередь анализа;
   - фоновые циклы;
   - агрегации для dashboard и report;
   - контроль доступа.

3. `db.js`
   - инициализация SQLite;
   - `main.db` и `cache.db`;
   - backup rotation;
   - append-only export analyses;
   - чтение/запись stores.

4. `env.js`
   - единая загрузка env для `server.js` и `db.js`;
   - fallback-поиск `.env`;
   - ранняя проверка обязательных переменных.

## 5. Storage layout

Текущее правильное хранение:

- `main.db` — основной источник истины;
- `cache.db` — восстановимый кэш;
- `backups/` — ротационные backup `main.db`;
- `analysis-exports/` — append-only `jsonl` экспорт измененных analyses.

Рекомендуемый production layout:

- `/var/lib/callsreport/main.db`
- `/var/lib/callsreport/cache.db`
- `/var/lib/callsreport/backups`
- `/var/lib/callsreport/analysis-exports`
- `/var/lib/callsreport/.env`

Что хранится в `main.db`:

- analyses;
- failures;
- jobs;
- scenarios;
- settings;
- metadata.

Что хранится в `cache.db`:

- `crm_client_cache`;
- `activity_snapshot_cache`.

Критически важно:

- production data не должна лежать в каталоге релиза;
- `cache.db` считается disposable;
- `main.db` — основной state проекта;
- перед любыми миграциями БД нужен backup.

## 6. Реализованные бизнес-процессы

### 6.1 Список звонков

Реализовано:

- загрузка списка звонков;
- нормализация полей звонка;
- определение наличия записи;
- привязка менеджера и CRM-контекста;
- серверная пагинация;
- cursor-based pagination;
- фильтрация по менеджерам, датам, направлениям, статусам, сценариям, наличию записи;
- сортировка по свежести.

Важные детали:

- список звонков собирается на backend;
- frontend не пагинирует локально полный dataset;
- breakdown статусов считается по всему отфильтрованному набору, а не по текущей странице;
- для ускорения используется snapshot cache и filtered cache.

### 6.2 Детализация звонка

Реализовано:

- просмотр карточки звонка;
- просмотр transcript;
- просмотр AI-анализа;
- просмотр результата, потребности клиента, next step, рекомендаций;
- проигрывание сегментов transcript через запись звонка.

### 6.3 Сценарии анализа

Реализовано:

- список сценариев;
- создание сценария;
- редактирование;
- удаление;
- копирование;
- сценарий по умолчанию;
- auto-apply rules;
- rule-based recommended scenario в таблице звонков.

Текущие reliable rules:

- направление звонка;
- менеджер;
- тип CRM-сущности;
- ключевые слова темы;
- диапазон длительности.

Исключено из auto-apply как ненадежное:

- воронки;
- стадии;
- номера линий.

### 6.4 Анализ звонка

Реализовано:

- ручной запуск анализа;
- batch-анализ;
- очередь jobs;
- защита от лишнего повторного анализа при актуальном результате;
- транскрибация;
- structured AI analysis;
- локализация анализа на русский;
- fallback и partial result;
- повторный прогон, если analysis outdated.

### 6.5 Автоматическая обработка

Реализовано:

- режим `autoTranscriptionMode`;
- background scheduler;
- auto scan;
- auto enqueue;
- cleanup stale jobs;
- фоновая обработка живет на backend и не зависит от открытого браузера.

### 6.6 Dashboard

Реализовано:

- summary cards;
- breakdown по статусам;
- агрегированные bar charts;
- monthly/3-month/6-month charts;
- heatmap;
- token metrics;
- recognized calls / minutes;
- violations и scenario-level metrics.

Производительность dashboard уже оптимизировалась:

- быстрый `GET /api/dashboard-summary`;
- отдельный `GET /api/dashboard-charts`;
- pre-aggregated charts payload;
- startup split между быстрыми карточками и тяжелыми графиками;
- raw activity snapshot cache;
- stale-while-revalidate refresh.

### 6.7 Контроль доступа

Реализовано:

- роли на уровне приложения;
- права на разделы и действия;
- backend permission checks;
- список пользователей портала для назначения ролей;
- fallback-admin поведение для владельца API key.

## 7. Текущие внутренние API для frontend

Ключевые endpoint'ы:

- `GET /api/health`
- `GET /api/access`
- `GET /api/access/users`
- `POST /api/access`
- `GET /api/managers`
- `GET /api/scenarios`
- `POST /api/scenarios`
- `DELETE /api/scenarios/:id`
- `GET /api/scenario-options`
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/calls`
- `GET /api/calls/:id/recording`
- `GET /api/analyze/jobs`
- `POST /api/analyze`
- `POST /api/analyze-batch`
- `GET /api/reports/summary`
- `GET /api/dashboard-summary`
- `GET /api/dashboard-charts`
- `GET /api/dashboard`

Frontend должен работать только через эти backend endpoint'ы.

## 8. Текущие внешние интеграции

### 8.1 Что сейчас завязано на VibeCode API

Нужно считать, что именно это подлежит замене при полном переходе на `Bitrix24 REST`:

1. получение activities / calls;
2. загрузка записи звонка;
3. список пользователей;
4. AI transcription;
5. AI structured analysis;
6. возможные launch identity / gateway headers, если они завязаны на Vibe runtime.

### 8.2 Что уже относится к Bitrix24 domain

- звонки как сущность бизнеса;
- CRM entity context;
- portal URL;
- business semantics сценариев и отчетов;
- переходы в карточки CRM.

## 9. Что нужно учесть при полном переходе на Bitrix24 REST API

Это главный блок для следующего этапа.

### 9.1 Нельзя делать прямую механическую замену endpoint-to-endpoint

Причина:

- текущая архитектура использует `VibeCode API` как единый gateway сразу для calls, files, users и AI;
- у `Bitrix24 REST` другая модель данных, pagination и ограничения;
- часть AI-функций может вообще отсутствовать в Bitrix24 REST и потребует отдельного провайдера.

### 9.2 Целевой принцип миграции

Нужно сначала отделить в коде слои:

1. `CallSourceProvider`
   - получение звонков;
   - получение записи;
   - получение менеджеров и user lookup;
   - CRM context enrichment.

2. `AIProvider`
   - transcription;
   - chat analysis;
   - localization / repair.

3. `LaunchIdentityProvider`
   - кто открыл приложение;
   - роли;
   - portal user mapping.

Только после этого безопасно менять источник звонков с `Vibe` на `Bitrix24 REST`.

### 9.3 Практический план миграции

Рекомендуемый порядок:

1. вынести всю интеграцию с внешними calls/users/files API из `server.js` в отдельный adapter layer;
2. ввести интерфейс `VibeProvider` и `BitrixRestProvider`;
3. перевести backend на использование интерфейса, а не прямых Vibe helper-функций;
4. отдельно решить, кто будет AI provider:
   - оставить Vibe только как AI provider;
   - перейти на другой AI provider;
   - разделить `Bitrix24 REST` для calls и отдельный AI backend для analysis;
5. после этого включать `BitrixRestProvider` для звонков;
6. только потом вычищать Vibe-specific code.

### 9.4 Что обязательно перепроверить при миграции

- формат и полноту полей звонка;
- доступность записей;
- стабильность времени звонка и timezone;
- manager/user ids;
- CRM owner type / owner id;
- фильтрацию по датам;
- pagination limit;
- recent calls order;
- наличие webhooks или polling strategy;
- rate limits Bitrix24 REST.

### 9.5 Что почти наверняка потребует отдельного решения

- transcription;
- AI structured scoring;
- Russian localization post-processing;
- user directory / role source, если текущий `/v1/users` больше недоступен;
- безопасный launch context в standalone runtime.

## 10. Ключевые технические решения, которые нельзя потерять

### 10.1 Единая env-загрузка

`server.js` и `db.js` уже приведены к общей логике через `env.js`.

Порядок поиска `.env`:

1. `APP_ENV_FILE`
2. локальный `.env` рядом с backend
3. локальный `.env` в `process.cwd()`
4. `/var/lib/callsreport/.env`
5. `/opt/app/.env`

### 10.2 Разделение `main.db` и `cache.db`

Это сделано после реальной production-проблемы с повреждением SQLite.

Нельзя возвращаться к модели, где весь state и cache лежат в одном fragile storage without backups.

### 10.3 Backup и append-only export

В проекте уже заложена идея:

- backup main database;
- хранить историю analyses отдельно;
- считать cache восстановимым.

Это нужно сохранить и при любой крупной миграции.

### 10.4 Server-side pagination и агрегация

Это критично для объема звонков.

Нельзя возвращаться к:

- локальной пагинации полного списка на frontend;
- пересчету тяжелых графиков в браузере по полному call dataset;
- синхронному полному CRM enrichment на каждый запрос.

### 10.5 Background processing

Очередь уже встроена в backend.

Важно сохранить:

- jobs store;
- stale cleanup;
- idempotency;
- reuse existing up-to-date analysis;
- независимость обработки от открытого browser tab.

## 11. Известные риски и ограничения

### Архитектурные

- сервис предполагает один активный экземпляр backend;
- очередь встроенная, без Redis/RabbitMQ;
- SQLite остается файловой БД;
- cold-start после restart может быть тяжелее из-за прогрева snapshot.

### Интеграционные

- проект до сих пор сильно завязан на `VibeCode API`;
- доступность внешних API напрямую влияет на UX;
- возможны расхождения между runtime и внешним app routing.

### Эксплуатационные

- deploy не должен перетирать `/var/lib/callsreport`;
- `.env` должен жить вне каталога релиза;
- любые изменения storage/API/queue требуют синхронного обновления docs.

## 12. Что нужно для запуска проекта на другом ПК

### 12.1 Базовые требования

- `git`
- `Node.js 20+`
- доступ к репозиторию `https://github.com/yuri-martynenko/callsreport.git`
- свои рабочие env-переменные

### 12.2 Шаги запуска

1. Клонировать репозиторий.
2. Перейти в корень проекта.
3. Выполнить `npm install`.
4. Создать `.env` на базе `.env.example`.
5. Проверить пути БД для локальной машины.
6. Выполнить `npm start`.
7. Открыть `http://localhost:3000`.

### 12.3 Минимальный локальный `.env`

Нужны как минимум:

- `PORT`
- `VIBE_API_KEY`
- `VIBE_API_URL`
- `BITRIX_PORTAL_URL`
- `AI_CHAT_MODEL`
- `AI_TRANSCRIPTION_MODEL`
- `APP_MAIN_DB_PATH`
- `APP_CACHE_DB_PATH`
- `APP_DB_BACKUP_DIR`
- `APP_ANALYSIS_EXPORT_DIR`
- `APP_LEGACY_DATA_DIR`

### 12.4 Что не переносить как есть

- production `.env` с секретами;
- production `main.db` без отдельного осознанного backup/restore решения;
- временные локальные файлы;
- рабочие артефакты smoke-тестов.

## 13. Что проверить после первого запуска на новом ПК

1. `GET /api/health`
2. открывается dashboard
3. открывается отчет
4. грузится список звонков
5. читаются сценарии
6. читаются настройки
7. создаются `main.db` и `cache.db`
8. создаются каталоги backup/export

Дополнительно:

- проверить ручной анализ одного звонка;
- проверить открытие записи звонка;
- проверить сохранение сценария;
- проверить смену `autoTranscriptionMode`.

## 14. Что проверить перед началом полной миграции на Bitrix24 REST

1. Зафиксировать текущий рабочий baseline в отдельной ветке.
2. Снять матрицу соответствия:
   - текущая функция;
   - текущий Vibe endpoint/helper;
   - целевой Bitrix24 REST method;
   - отсутствующие поля;
   - workaround.
3. Отделить calls provider от AI provider.
4. Подготовить feature flag для выбора provider.
5. Сначала переключить только чтение звонков.
6. Отдельно переключить скачивание записи.
7. Отдельно решить AI path.

## 15. Рекомендуемый формат следующего этапа работ

Следующий разработчик не должен начинать сразу с массового переписывания `server.js`.

Правильнее идти так:

1. выделить adapter layer;
2. покрыть его smoke-проверками;
3. внедрить `BitrixRestProvider` рядом с текущим `Vibe`-путем;
4. включать новый provider по частям;
5. обновлять `docs/architecture.md`, `docs/api.md`, `docs/logic.md`, `docs/deployment.md` по мере миграции.

## 16. Итог передачи

Проект находится в рабочем состоянии и уже содержит:

- устойчивый storage layer;
- backend queue;
- dashboard/report/scenarios/settings/access;
- server-side pagination;
- dashboard performance optimizations;
- production deploy discipline;
- документационную базу для сопровождения.

Главный технический долг и следующий большой этап:

- вынести текущую tight coupling с `VibeCode API`;
- перейти на архитектуру с явными provider abstraction;
- затем перевести source звонков на `Bitrix24 REST API`.

Для нового ПК и нового разработчика этот документ нужно использовать как стартовую точку, а остальные документы в `docs/` — как детализацию по отдельным подсистемам.
