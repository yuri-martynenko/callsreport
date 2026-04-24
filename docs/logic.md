# Логика работы

## Назначение документа

Этот документ описывает прикладную логику системы: как звонок проходит путь от появления в Bitrix24 до сохраненного AI-анализа и отображения в отчете.

## Основной поток обработки звонка

### Шаг 1. Загрузка звонков

Backend получает список звонков из VibeCode API и нормализует каждую запись:

- идентификатор активности;
- тему звонка;
- менеджера;
- направление;
- длительность;
- наличие записи;
- связанные CRM-сущности.

На этом этапе к звонку также подмешиваются:

- последний сохраненный анализ;
- последняя ошибка анализа;
- последний job из очереди.

Для `GET /api/calls` backend больше не отдает весь список звонков целиком на frontend.
Сначала backend собирает расширенную выборку из VibeCode API, затем:

- нормализует звонки;
- применяет фильтры;
- сортирует итоговый список по дате звонка в порядке от новых к старым;
- кратковременно кеширует уже собранный filtered snapshot по ключу фильтров, чтобы переход между страницами не вызывал повторный полный запрос к VibeCode API;
- режет результат на страницу;
- только после этого возвращает данные в интерфейс.

Это сделано по двум причинам:

- в исходной выдаче VibeCode API порядок записей не гарантирует, что первые элементы будут самыми свежими;
- локальная пагинация на frontend приводила к тому, что пользователь видел не последние звонки, а только первый фрагмент неупорядоченной выборки.

Технически запрос списка звонков теперь тоже выполняется полностью внутри Node.js backend. Для `activities/search` больше не требуется внешний `python3`, поэтому local/dev и production используют одинаковый сетевой путь до VibeCode API.

### Шаг 2. Определение статуса анализа

Для каждой строки звонка backend вычисляет эффективный статус:

- `pending` — еще не ставился в обработку;
- `queued` — стоит в очереди;
- `processing` — сейчас обрабатывается;
- `ready` — полный результат готов;
- `partial` — есть частичный результат;
- `technical` — сохранен технический результат без полного AI-разбора;
- `error` — анализ завершился ошибкой;
- `outdated` — сохраненный анализ устарел относительно исходного звонка;
- `missing` — анализа нет.

### Шаг 3. Выбор сценария

При запуске анализа система выбирает сценарий в таком порядке:

1. сценарий, явно выбранный пользователем в таблице;
2. сценарий по правилам автоподбора;
3. сценарий по умолчанию.

В сценарии используются:

- описание скрипта для проверки;
- список индивидуальных метрик;
- правила автоприменения.

UX страницы `Сценарий` устроен так:

- библиотека сценариев показывается в виде таблицы с основными параметрами;
- детальный просмотр и редактирование выполняются в модальном окне по аналогии с детализацией звонка;
- поля автоподбора, где важен выбор из ограниченного набора значений, заполняются через мультиселекты;
- индивидуальные параметры пользователь вводит обычным списком по строкам, а frontend сам сериализует его в payload для backend.
- поле `Сценарий для проверки` тоже заполняется построчно: один этап или checkpoint = одна строка;
- кнопка сохранения сценария активируется только при изменениях формы;
- в модальном окне доступны отдельные действия `Сбросить правила`, `Копировать в новый` и подтверждаемое удаление сценария.
- сценарий по умолчанию в системе всегда ровно один; это правило дополнительно контролируется и в UI, и на backend при сохранении или удалении сценариев.

Автоподбор на странице расшифровки теперь рассчитывается из актуальных правил сценариев при рендере списка звонков. Если раньше звонок был проанализирован по default-сценарию, а позже появился более точный autoApply-сценарий, таблица сразу покажет новый рекомендуемый сценарий и разрешит повторный анализ.

В автоподборе оставлены только надежно определяемые правила:

- направление звонка;
- менеджер;
- тип CRM-сущности;
- ключевые слова в теме;
- минимальная и максимальная длительность.

Поля `Воронки`, `Стадии` и `Номера линий` исключены из формы сценария и из логики подбора, чтобы не утяжелять backend ненадежным CRM-обогащением.

### Шаг 4. Постановка в очередь

Вместо немедленного выполнения анализ кладется в очередь jobs.

Это нужно, чтобы:

- не блокировать HTTP-запрос;
- корректно отображать промежуточные статусы;
- обрабатывать много звонков последовательно или с ограниченной конкуренцией;
- поддерживать автоматическую фоновую постановку.

При ручном запуске действует дополнительное правило защиты от лишнего прогона:

- если у звонка уже есть актуальный готовый анализ;
- и пользователь не менял сценарий;
- и не менялись входные параметры анализа;

то звонок повторно в очередь не ставится, а frontend получает уже существующий результат.

В текущей реализации worker теперь сначала атомарно забирает job из состояния `queued` в состояние `processing`, и только после этого начинает фактический анализ.

Это нужно, чтобы:

- одна и та же задача не подхватывалась повторно;
- статусы не “откатывались” назад на frontend;
- очередь корректно работала при `ANALYSIS_QUEUE_CONCURRENCY > 1`.

Дополнительно backend автоматически очищает зависшие активные jobs:

- если задача слишком долго остаётся в `queued` или `processing`;
- и не была завершена штатно;

она переводится в `error` с техническим сообщением о таймауте фоновой обработки. Это нужно, чтобы звонки не зависали бесконечно в статусе «В работе» или «В очереди» после сбоя worker-процесса или перезапуска приложения.

### Шаг 5. Скачивание записи

Worker очереди скачивает аудиофайл звонка через VibeCode files API.

Если у звонка нет записи, анализ не запускается и фиксируется ошибка.

### Шаг 6. Транскрибация

Аудио отправляется в VibeCode Whisper endpoint.

Результат транскрибации включает:

- текст;
- сегменты;
- тайминги;
- служебные поля;
- usage по токенам, если провайдер их отдает.

На основе сегментов система строит:

- человекочитаемый транскрипт;
- роли участников;
- интервалы по времени.

### Шаг 7. AI-анализ

Транскрипт, сценарий и индивидуальные метрики передаются в чат-модель.

Модель должна вернуть структурированный JSON с блоками:

- overview;
- summary;
- recommendations;
- scriptAnalysis;
- customMetrics;
- nextStep.

Если первый structured AI-ответ оказался пустым или невалидным, backend выполняет дополнительную recovery-попытку с более жестким требованием вернуть заполненный JSON только на русском языке.

После успешного structured-разбора backend дополнительно проверяет текстовые поля на латиницу:

- если в результате остались английские формулировки, backend делает обязательную попытку локализации на русский язык до сохранения;
- если локализация все равно не очистила structured result от английского текста, такой результат не сохраняется как полноценный готовый разбор и деградирует до безопасного частичного результата с транскриптом;
- для уже сохраненных записей с английскими полями backend выполняет best-effort repair локализации при чтении списка звонков и пересохраняет исправленный результат.

Если structured AI-разбор не удался, вернулся пустым или пришел невалидный JSON, транскрипт не должен теряться:

- транскрипт сохраняется как частичный результат;
- звонок получает статус `partial` или `technical`, а не `error`, если проблема была только на этапе structured-разбора;
- текст технической причины сохраняется в служебных полях результата для отображения в детализации.

### Шаг 8. Локализация и нормализация

После получения результата backend:

- нормализует названия полей;
- приводит статусы и тональности к согласованному виду;
- при необходимости пытается локализовать результат на русский язык;
- объединяет токены транскрибации и анализа.

### Шаг 9. Сохранение результата

Результат сохраняется в БД как анализ по ключу:

- `activityId`
- `signature`

`signature` нужен для версионирования результата относительно:

- версии исходного звонка;
- выбранного сценария;
- текста сценария;
- списка кастомных метрик;
- используемых моделей.

Приоритет сохранения такой:

- если транскрибация и structured-анализ успешны, сохраняется полный результат;
- если транскрибация успешна, но structured-анализ пустой или сломан, сохраняется частичный результат с транскриптом;
- если не удалась сама транскрибация, фиксируется ошибка анализа.

### Шаг 10. Отображение в интерфейсе

После сохранения:

- таблица звонков должна получить новый статус;
- детализация звонка должна обновиться;
- отчет и дашборд должны пересчитать агрегаты.

## Автоматическая обработка

Система поддерживает режимы:

- отключено;
- все звонки;
- только входящие;
- только исходящие.

Фоновый сканер периодически:

1. читает настройки;
2. выбирает подходящие звонки;
3. исключает уже обработанные или активные задачи;
4. ставит найденные звонки в очередь.

## Агрегация данных для отчета

Для отчета используются:

- список звонков с объединенным состоянием;
- summary по сохраненным анализам;
- breakdown по статусам;
- фильтрация по менеджерам, направлениям, статусам, сценариям, периоду и наличию записи.

Дополнительно для скорости открытия отчета список звонков теперь загружается постранично через backend.
Это уменьшает размер первого ответа `/api/calls`, снижает объем DOM-рендера на frontend и не требует держать в браузере весь массив звонков ради листания таблицы.
При этом breakdown по статусам для блока статистики считается backend по всему отфильтрованному набору и отдается отдельно от текущей страницы, чтобы переключение страниц не искажало общую статистику.

## Модель оценки звонка

Подробное описание того, как формируются:

- сентимент;
- риск;
- общий score;
- соблюдение скрипта,

вынесено в отдельный документ:

- `docs/scoring.md`

Важно: в текущей архитектуре эти показатели в основном приходят из structured AI-ответа и затем нормализуются backend, а не вычисляются по жесткой локальной формуле.

## Основные риски логики

- отсутствие записи у звонка;
- временные ошибки Whisper;
- невалидный ответ AI-модели;
- HTML вместо JSON от платформы;
- частичный результат без полного structured analysis;
- расхождение сохраненного анализа и актуального состояния звонка.

## Performance Notes

- Report opening uses a hot in-memory cache for persisted stores (`analyses`, `scenarios`, `settings`) to avoid reparsing the full `sql.js` payload on every read request.
- `GET /api/calls` uses a short-lived in-memory cache for the filtered and sorted call snapshot, so adjacent page requests with the same filters reuse the prepared dataset instead of refetching and resorting everything. The cache is invalidated only on real changes in analyses/settings/scenarios, not on every page click.
- `GET /api/calls` now also returns `nextCursor`, and frontend uses cursor-based pagination for forward navigation so deep browsing does not depend on growing `offset`.
- Frontend keeps a small in-memory cache of already opened pages and prefetches the next page after rendering the current one, so the first forward page switch usually does not wait for a new network roundtrip.
- Calls table rendering uses row virtualization inside the scroll container, so increasing `pageSize` no longer forces the browser to keep every row of the current page mounted in the DOM at once.
- Frontend initial loading now requests managers, settings, scenarios, calls, and summary in parallel instead of waiting for them sequentially.
- Frontend pagination no longer forces an extra dashboard rerender, because dashboard aggregates come from `GET /api/reports/summary` and are independent from the current calls page.
- `GET /api/reports/summary` is optimized for dashboard rendering and returns only the aggregate `summary` block unless `includeAnalyses=true` is requested explicitly.
- Dashboard cards and charts that should ignore report-page filters now read from a dedicated `GET /api/dashboard` endpoint, which returns the full normalized call history plus dashboard-level aggregates for the whole period.
- `GET /api/dashboard` also returns `latest analyses` independently from the calls payload so manager aggregates and other analysis-only dashboard charts are not distorted by incomplete fields inside nested `call.analysis`.
- The report page still uses filtered `GET /api/reports/summary`, so dashboard metrics and report metrics are intentionally separated.
- Dashboard now shows a combined 3-month line chart for `Количество вызовов`, `Распознанные вызовы`, and `Без записи`, while the compact recognition/tokens/minutes charts remain limited to the latest 7 days.
- Horizontal bar charts on the dashboard use a fixed label column with word wrapping, so chart track widths no longer depend on the length of manager or sentiment labels.
- Dashboard additionally shows a single 6-month heatmap for all calls, 3-month dynamics for tokens-per-minute, and a bar chart for the most frequently violated scenario checkpoints.
- Dashboard now uses separate charts for call sentiment and risk distribution, folds `calls without recordings` into the combined 3-month call-volume chart, and uses the original grouped heatmap layout with weekly columns split by month.
- The dashboard bar charts `Тональность звонков`, `Средний процент по сценариям`, and `Топ нарушений` now follow one display rule: no secondary hint line, non-bold labels, a 0–100 scale, and right-side values shown as `count + percent`.

### 2026-04 Startup Optimization

- The application now opens with dashboard-only data. The report tab loads `/api/calls` and `/api/reports/summary` lazily on first open instead of blocking the initial screen.
- Frontend startup no longer waits for managers, settings, scenarios, and scenario rule options before the first dashboard render. These datasets are warmed in background and loaded on demand when the user opens report/scenario/settings views.
- Dashboard startup is split into two phases: a fast summary request for cards and status counters, then a separate background request for the heavier chart dataset.
- `/api/dashboard` now returns a lightweight chart-oriented call projection instead of the full report-grade nested analysis payload with transcript and recommendation details.
- `/api/dashboard-summary` is optimized for fast first paint and does not include the per-call dashboard dataset.
- Backend snapshot building now deduplicates concurrent identical filter requests in memory, so matching cold requests reuse one in-flight `buildCallsSnapshot()` operation.
- Backend also persists the latest raw Vibe activities snapshot in SQLite and serves startup/report/dashboard reads from that local cache first.
- The raw activities cache uses `stale-while-revalidate`: fresh snapshot is returned immediately, stale snapshot can still be returned fast while the server refreshes it in background, and only a cold empty cache still waits for the external Vibe fetch.
- Background raw-activity refresh now invalidates the filtered calls cache only when the activity snapshot actually changed. This avoids sporadic slow pagination after a no-op background refresh.
- Date filtering for calls is now applied locally on the normalized snapshot, so report filters no longer force a new external activities search.

## 2026-04 Transcript Segment Playback

The call detail modal now supports playback for each transcript line:

- backend exposes an internal `recordingUrl` for calls with recordings;
- frontend loads the full recording through `/api/calls/:id/recording`;
- the browser player seeks to the selected segment `start` timestamp and stops automatically at `end`;
- if the transcript line has no reliable timing or the call has no recording, the segment button stays unavailable.

## 2026-04 Settings Apply Performance

Saving `autoTranscriptionMode` no longer waits for the full automatic queue rescan to finish.

After `/api/settings` persists the new mode, backend schedules the auto-enqueue refresh in the background so the UI can close the modal immediately and continue with lightweight data reloads.

## 2026-04 Scenario Rerun and Status

The calls table keeps a temporary UI selection for the scenario dropdown. If the operator switches the scenario for an already recognized call, the rerun action becomes available immediately without waiting for a full data reload.

If transcription exists but structured AI analysis or Russian localization fails, backend now exposes that result as `outdated`, so the UI shows `Нужен повтор` instead of `Готово`.

After any scenario create, update, or delete operation, frontend reloads the scenario registry and immediately re-renders the calls table so the `Сценарий` selector on the `Расшифровка` page always uses the current scenario list.

## 2026-04 Localization Fallback

Russian localization of the structured AI result is now best-effort. If the extra localization pass cannot fully remove Latin fragments, backend keeps the meaningful structured analysis instead of wiping it and degrading the whole call to an empty retry-only result.
## 2026-04 Storage Resilience

- The storage layer now uses native SQLite with separate `main.db` and `cache.db`.
- `main.db` is the source of truth for application state; `cache.db` only accelerates call browsing and CRM name hydration.
- Cache corruption is treated as recoverable: the backend may quarantine and recreate `cache.db`.
- Main database writes now trigger rotating SQLite backups and append-only JSONL export of changed analyses for additional recovery options.
