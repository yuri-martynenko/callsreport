# Журнал деплоев

## Назначение документа

Этот файл фиксирует каждый deploy, который был выполнен в проекте `callsreport`.

Для каждой записи нужно указывать:

- дату и время deploy;
- краткое описание задачи;
- ориентировочную длительность;
- примечания по результату, если это важно для эксплуатации.

## Формат записи

```text
## YYYY-MM-DD HH:MM TZ

- Задача: ...
- Длительность: ...
- Результат: ...
- Примечание: ...
```

## Записи

## 2026-04-22 12:44 VLAT

- Задача: deploy исправления английских текстов в результате анализа звонков через обязательную post-check локализацию новых structured analysis и repair уже сохраненных записей при чтении списка звонков.
- Длительность: около 20 минут.
- Результат: локально подтвержден штатный ответ `/api/calls` после включения repair-hook, production deploy выполнен успешно, шаги `download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck` завершились со статусом `ok`.
- Примечание: если после двух попыток локализации structured result все равно содержит латиницу, backend больше не сохраняет его как полноценный готовый разбор и деградирует до безопасного частичного результата с транскриптом.

## 2026-04-22 12:31 VLAT

- Задача: deploy переработанного UX страницы `Сценарии анализа` с переходом от таблицы к карточной библиотеке сценариев, поиску, summary-метрикам и пошаговому редактору сценария.
- Длительность: около 20 минут.
- Результат: `push` коммита `550f3ad` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production-версии `index.html`, `styles.css` и `app.js` на `127.0.0.1:3000` подтвердили наличие `scenarioSearch`, `scenarioList`, `scenarioFormTitle`, `scenario-overview-grid`, `scenario-card`, `scenario-action-stack`, `filteredScenarios` и `updateScenarioSummaryCards`.

## 2026-04-22 12:18 VLAT

- Задача: deploy увеличения размеров клеток heatmap до значения в 2 раза больше квадратов легенды.
- Длительность: около 10 минут.
- Результат: `push` коммита `6fd47ce` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production `styles.css` на `127.0.0.1:3000` подтвердил `width: calc(var(--columns) * 24px + (var(--columns) - 1) * 2px);`, `grid-template-rows: repeat(7, 24px);`, `width: 24px;`, `height: 24px;` и `border-radius: 4px;`.

## 2026-04-22 12:12 VLAT

- Задача: deploy полного перестроения heatmap на dashboard: перейти с растягиваемой CSS-сетки на фиксированные компактные клетки и отдельные month-group блоки, чтобы реально уменьшить размер квадратов и убрать вертикальные линии внутри карты.
- Длительность: около 15 минут.
- Результат: `push` коммита `57d4960` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production `styles.css` и `app.js` на `127.0.0.1:3000` подтвердили наличие `.heatmap-groups`, `.heatmap-column`, фиксированных клеток `4px`, увеличенного `.line-chart-axis-text.is-medium { font-size: 16px !important; }` и JS-маркеров `heatmap-group`, `heatmap-column`, `monthGroups`.

## 2026-04-22 11:59 VLAT

- Задача: deploy дополнительного уплотнения heatmap за 3 месяца, замены бордер-разделителей месяцев на увеличенные межмесячные отступы и увеличения подписей осей на целевых line-chart графиках.
- Длительность: около 15 минут.
- Результат: `push` коммита `be264b7` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production `styles.css` и `app.js` на `127.0.0.1:3000` подтвердили `--month-gap`, уменьшение heatmap-сетки до `minmax(3px, 1fr)`, увеличение `.line-chart-axis-text.is-medium` до `14px`, отсутствие старого `.heatmap-cell.is-month-divider` и наличие JS-маркеров `--month-gap:6px;` и `is-medium`.

## 2026-04-22 11:52 VLAT

- Задача: deploy компактного отображения двух heatmap за 3 месяца с визуальными разделителями месяцев и дополнительной настройки размеров подписей значений на line-chart графиках.
- Длительность: около 15 минут.
- Результат: `push` коммита `5794f25` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production `styles.css` и `app.js` на `127.0.0.1:3000` подтвердили уменьшение heatmap-сетки до `minmax(5px, 1fr)`, наличие `.heatmap-cell.is-month-divider`, `.line-chart-point-text.is-emphasis { font-size: 18px; }`, `.line-chart-point-text.is-medium { font-size: 15px; }`, `.line-chart-point-text.is-mini { font-size: 7px; }`, а также JS-маркеры `separatorColumns`, `is-month-divider`, `is-medium` и `is-mini`.

## 2026-04-22 11:40 VLAT

- Задача: deploy точечного исправления frontend-ошибки `localizeRiskLevel is not defined` во всех dashboard-графиках.
- Длительность: около 10 минут.
- Результат: `push` коммита `9aa05f4` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production `app.js` на `127.0.0.1:3000` подтвердил использование `localizeRisk(` и отсутствие `localizeRiskLevel(`.

## 2026-04-22 10:24 VLAT

- Задача: deploy исправления графика `Средний балл по менеджерам` с возвратом разбивки по ФИО, добавления 3-месячных графиков по высокому риску, токенам на минуту и нарушаемым checkpoint’ам, а также двух тепловых карт вызовов и распознанных вызовов.
- Длительность: около 20 минут.
- Результат: `push` коммита `cc4079d` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, `GET /api/dashboard` подтвердил `managerRows=4` и `analyses=262`, а production-версии `app.js` и `styles.css` подтвердили наличие `highRiskChart`, `tokensPerMinuteChart`, `violatedCheckpointsChart`, `renderHeatmap`, `dashboardAnalyses`, `.heatmap-grid`, `.line-chart-point-text.is-emphasis` и `.line-chart-point-text.is-compact`.

## 2026-04-22 10:06 VLAT

- Задача: deploy правок дашборда: добавить KPI `Всего звонков` и `Ожидает анализа`, отвязать общие графики от фильтров страницы `Расшифровка`, перевести `Динамика среднего score` на весь период и выровнять bar-chart диаграммы по ширине с переносом длинных подписей.
- Длительность: около 25 минут.
- Результат: `push` коммита `e58371e` выполнен в `main`, production deploy завершился успешно, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, новый `GET /api/dashboard` на `127.0.0.1:3000` вернул `totalCalls=3056`, `pendingCalls=1765`, `analyzedCalls=293`, а production-версии `app.js` и `styles.css` подтвердили наличие `loadDashboardData`, `/api/dashboard`, `awaitingAnalysisCalls`, `buildAverageSeriesByDay`, фиксированной сетки `minmax(148px, 188px)` и переноса подписей `.bar-label`.

## 2026-04-22 00:59 VLAT

- Задача: deploy доработки модалки `Детализация звонка`: убрать тайминги из полного текста `Транскрипт`, показывать общую длительность в плеере до старта проигрывания, выровнять фон карточек фрагментов с фоном полного текста и уменьшить вертикальные отступы ярлыков в шапке детализации.
- Длительность: около 15 минут.
- Результат: `push` коммита `7a1d5f9` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production-версии `app.js` и `styles.css` на `127.0.0.1:3000` подтвердили наличие `transcriptFullTextValue`, использования `sourceCall.durationSeconds`, уменьшенных `padding: 4px 9px` для ярлыков шапки и общего фона `rgba(252, 253, 255, 0.96)` для карточек транскрипта.

## 2026-04-22 00:43 VLAT

- Задача: deploy уточнения модалки `Детализация звонка`: строка `Результат` перенесена под текст `Резюме`, а блок `Транскрипт` перестроен в две колонки с полным текстом слева и текущим плеером с разбитым диалогом справа.
- Длительность: около 15 минут.
- Результат: `push` коммита `868e094` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production-версии `app.js` и `styles.css` на `127.0.0.1:3000` подтвердили наличие `transcriptFullTextMarkup`, `detail-inline-metric`, `transcript-layout`, `transcript-column h4` и `transcript-fulltext-card`.

## 2026-04-22 00:29 VLAT

- Задача: deploy обновления модалки `Детализация звонка` по согласованному стилю: `Резюме` переведено в semantic-card блок, а `Потребность клиента` и `Следующий шаг` вынесены в отдельные выделенные секции сразу после него без изменения остальной композиции.
- Длительность: около 15 минут.
- Результат: `push` коммита `f52e3a8` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production-версии `app.js` и `styles.css` на `127.0.0.1:3000` подтвердили наличие `analysisClientNeed`, `analysisNextStep`, `detail-block-summary`, `detail-block-client-need`, `detail-block-next-step` и `detail-inline-metric`.

## 2026-04-22 00:20 VLAT

- Задача: deploy точечного исправления фильтра после обратной связи по скриншоту: отделение обычных полей от checkbox-элементов, чтобы `Запись разговора` и пункты dropdown-списков больше не растягивались общим правилом высоты.
- Длительность: около 5 минут.
- Результат: `push` коммита `68bb480` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production CSS на `127.0.0.1:3000` подтвердил правило `.filter-toolbar input:not([type="checkbox"]):not([type="radio"])` и возврат checkbox-элементов фильтра к `height/min-height = 16px`.
- Примечание: это отдельная корректировка поверх предыдущих UI-правок фильтра; backend, API, БД и очередь не изменялись.

## 2026-04-21 23:59 VLAT

- Задача: deploy переноса плеера полного разговора из шапки модалки в блок `Транскрипт` с размещением сразу под заголовком секции.
- Длительность: около 5 минут.
- Результат: `push` коммита `badf413` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production-версия `app.js` на `127.0.0.1:3000` подтвердила наличие `transcript-audio-controls` внутри секции `analysisTranscript`.
- Примечание: изменения ограничены фронтенд-разметкой и стилями модалки детализации звонка без изменения backend, API, БД и логики очереди.

## 2026-04-21 23:42 VLAT

- Задача: deploy обновления модалки `Детализация звонка` с переносом `Статуса` в строку параметров анализа, унификацией стиля кнопок прослушивания и добавлением графического аудиоконтрола для полного разговора с прогрессом и перемоткой.
- Длительность: около 7 минут.
- Результат: `push` коммита `d4b333a` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production-версии `app.js` и `styles.css` на `127.0.0.1:3000` подтвердили наличие `seek-call-audio`, `toggle-full-call-audio`, `.analysis-header-audio-range` и `.analysis-audio-button`.
- Примечание: изменения ограничены фронтенд-модалкой детализации звонка и аудиоуправлением без изменения backend, API, БД и логики очереди.

## 2026-04-21 23:24 VLAT

- Задача: deploy исправления корневой причины завышенной высоты `Запись разговора` и элементов в dropdown-фильтрах через раздельные правила для обычных полей и checkbox-элементов.
- Длительность: около 5 минут.
- Результат: `push` коммита `68bb480` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production CSS на `127.0.0.1:3000` подтвердил правило `.filter-toolbar input:not([type="checkbox"]):not([type="radio"])` и возврат checkbox-элементов `filter-recorded-control` и dropdown-списков к `height/min-height = 16px`.
- Примечание: изменения ограничены фронтенд-CSS фильтра без изменения backend, API, БД и логики очереди.

## 2026-04-21 23:18 VLAT

- Задача: deploy жёсткого выравнивания фильтра с точной высотой `Запись разговора`, уменьшением высоты пунктов выпадающих списков и фиксацией одинаковой ширины кнопок `Применить`/`Сбросить` с `Режим распознавания` при выравнивании по нижней границе блока.
- Длительность: около 5 минут.
- Результат: `push` коммита `aac5a5a` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production CSS на `127.0.0.1:3000` подтвердил `--action-button-width: 212px`, `height: 46px`, `line-height: 46px`, `min-height: 28px` и `justify-content: flex-end` для правого блока фильтра.
- Примечание: изменения ограничены фронтенд-версткой фильтра без изменения backend, API, БД и логики очереди.

## 2026-04-21 23:10 VLAT

- Задача: deploy финальной подстройки фильтра с центрированием правого блока `Применить`/`Сбросить`, возвратом компактной высоты пунктов выпадающих списков и устранением лишнего растягивания поля `Запись разговора`.
- Длительность: около 5 минут.
- Результат: `push` коммита `e0bd465` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production CSS на `127.0.0.1:3000` подтвердил правила `justify-content: center` для правого блока фильтра, компактные `.filter-toolbar .multi-select-menu .multi-select-option` и `text-overflow: ellipsis` для текста в `filter-recorded-control`.
- Примечание: изменения ограничены фронтенд-версткой фильтра без изменения backend, API, БД и логики очереди.

## 2026-04-21 23:05 VLAT

- Задача: deploy возврата блока кнопок фильтра вправо, выравнивания высоты `Запись разговора` с остальными полями фильтра и унификации стилей кнопок на страницах `Расшифровка`, `Сценарии` и в модалках.
- Длительность: около 5 минут.
- Результат: `push` коммита `eae38a6` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production CSS на `127.0.0.1:3000` подтвердил наличие правил для `filter-actions`, `filter-toolbar .filter-recorded-control span` и единого кнопочного набора для `.calls-panel button`, `.scenario-editor-panel button`, `.settings-modal-panel button`, `.analysis-drawer-panel button`.
- Примечание: изменения ограничены фронтенд-версткой и визуальным стилем кнопок без изменения backend, API, БД и логики очереди.

## 2026-04-21 22:57 VLAT

- Задача: deploy выравнивания высоты полей фильтра по эталону `Период с`, переноса кнопок `Применить`/`Сбросить` на отдельную строку под фильтрами и добавления отступа после заголовка `Транскрипт` в модалке детализации звонка.
- Длительность: около 5 минут.
- Результат: `push` коммита `3219e93` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production CSS на `127.0.0.1:3000` подтвердил новые правила `grid-row: 3` для `filter-actions`, `min-height: 46px` для контролов фильтра и `detail-block h3` для отступа в блоке транскрипта.
- Примечание: изменения ограничены фронтенд-версткой без изменения backend, API, БД и логики очереди.

## 2026-04-21 22:48 VLAT

- Задача: deploy выравнивания поля `Запись разговора` по высоте с остальными фильтрами, более органичной компоновки кнопок `Применить`/`Сбросить`, уменьшения и усиления видимости кнопок `Действия`, а также корректировки типографики заголовков графиков и подписей значений на дашборде.
- Длительность: около 5 минут.
- Результат: `push` коммита `a19db61` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production CSS на `127.0.0.1:3000` подтвердил наличие обновлённых правил для `filter-actions`, `filter-recorded-control`, `call-action-icon`, `chart-panel .section-head-main h2`, `bars-vertical strong`, `bar-value` и `line-chart-point-text`.
- Примечание: изменения ограничены фронтенд-версткой и типографикой без изменения backend, API, БД и логики очереди.

## 2026-04-21 22:34 VLAT

- Задача: deploy укороченной шапки без лишнего текста, улучшения читаемости активной кнопки меню, фикса компактной типографики графиков после загрузки данных и выравнивания размеров текста в модалке детализации звонка.
- Длительность: около 5 минут.
- Результат: `push` коммита `55809c4` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production HTML/CSS на `127.0.0.1:3000` подтвердили отсутствие лишнего текста в шапке, наличие правила `.topbar-nav .menu-link.primary-action` и компактных правил для `line-chart` и `analysis-detail`.
- Примечание: изменения ограничены фронтенд-типографикой и визуальными состояниями без изменения backend, API, БД и логики очереди.

## 2026-04-21 22:18 VLAT

- Задача: deploy удаления блока `Обзор системы`, упрощения кнопок шапки без теней и уменьшения типографики для более плотного отображения интерфейса, особенно в таблице звонков.
- Длительность: около 5 минут.
- Результат: `push` коммита `0f1ba6f` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production HTML/CSS на `127.0.0.1:3000` подтвердил отсутствие блока `dashboard-hero`, наличие кнопок `menu-link` в шапке и новых компактных правил `box-shadow: none`, `font-size: 12px`, `font-size: 11px`.
- Примечание: изменения ограничены фронтенд-версткой и типографикой без изменения backend, API, БД и логики очереди.

## 2026-04-21 22:01 VLAT

- Задача: deploy облегчённого и более компактного UI с обновлённой шапкой, light/minimal палитрой и новым hero-блоком на дашборде.
- Длительность: около 5 минут.
- Результат: `push` коммита `d3f927b` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production HTML на `127.0.0.1:3000` подтвердил наличие `topbar-kicker`, `topbar-subtitle` и `dashboard-hero`.
- Примечание: изменения ограничены фронтенд-дизайном (`public/index.html`, `public/styles.css`) без изменения backend, API, БД и логики очереди.

## 2026-04-20 01:46 VLAT

- Задача: deploy фикса верстки шапки блока `Список звонков`, где текст статусов и режима авторасшифровки выталкивался за границы панели.
- Длительность: около 10 минут.
- Результат: `push` коммита `906da5a` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production `styles.css` подтвердил отсутствие старого правила с `order: -1; width: 100%` и наличие нового правила `.report-section-head .section-head-actions { flex: 0 0 auto; margin-left: auto; }`.
- Примечание: исправление выполнено только на уровне CSS layout шапки `Список звонков`; backend и API не изменялись.

## 2026-04-20 01:38 VLAT

- Задача: deploy возврата компактного отображения блока статусов звонков, переноса кнопки режима распознавания выше строки статусов, внедрения виртуализации строк таблицы и cursor-based pagination в `GET /api/calls`.
- Длительность: около 30 минут.
- Результат: локально подтверждены `nextCursor` в `/api/calls`, корректное открытие второй страницы по cursor и сохранение общих агрегатов; production deploy выполнен успешно, шаги `download/runtime/install/systemd/start/healthcheck` завершились со статусом `ok`.
- Примечание: backend сохранил совместимость с существующими полями `page/pageSize/totalPages`, а frontend теперь использует page-cache, prefetch и виртуализацию строк внутри scroll-контейнера для просмотра больших списков.

## 2026-04-20 01:21 VLAT

- Задача: deploy ускорения первого переключения пагинации через frontend cache страниц списка звонков и фоновый prefetch следующей страницы после загрузки текущей.
- Длительность: около 20 минут.
- Результат: код задеплоен успешно, шаги `download/runtime/install/systemd/start/healthcheck` завершились со статусом `ok`; первое переключение по пагинации больше не обязано ждать новый roundtrip к `/api/calls`, если следующая страница уже prefetched.
- Примечание: для больших выборок это снижает субъективную задержку просмотра списка без изменения API-контракта; следующими кандидатами на ускорение остаются виртуализация строк и cursor-based pagination на backend.

## 2026-04-20 01:08 VLAT

- Задача: deploy ускорения сохранения режима авторасшифровки, удаления статуса `В работе` из фильтра, переименования пункта отключения расшифровки и корректировки ширин колонок `Звонок`/`Сотрудник`.
- Длительность: около 20 минут.
- Результат: `push` коммита `895fe50` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а локальный `POST /api/settings` на production runtime ответил примерно за `52 ms`.
- Примечание: автоматический перескан подходящих звонков после `POST /api/settings` теперь запускается асинхронно в фоне, поэтому UI больше не ждёт завершения полной фоновой постановки в очередь.

## 2026-04-20 00:53 VLAT

- Задача: deploy правок `Расшифровка` с badge-отображением текущего режима авторасшифровки, сокращением кнопки сохранения до `Сохранить`, добавлением отступа перед ней и ускорением закрытия модалки после сохранения настройки.
- Длительность: около 15 минут.
- Результат: `push` коммита `ee0862c` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`.
- Примечание: post-deploy проверка динамических клиентских изменений ограничена server-side `exec`, поэтому визуальные правки подтверждались синтаксической проверкой `public/app.js`, успешным релизом и наличием обновлённой frontend-разметки в production HTML там, где она рендерится сервером статически.

## 2026-04-20 00:42 VLAT

- Задача: deploy правок страницы `Расшифровка` с вертикальным стеком кнопок фильтра, переносом настройки режима распознавания в модальное окно из блока `Список звонков` и удалением этой настройки со страницы `Настройки`.
- Длительность: около 20 минут.
- Результат: `push` коммита `2cfe1dc` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production HTML подтвердил наличие `openAutoTranscriptionSettings`, `autoTranscriptionModal` и `filter-actions`.
- Примечание: проверка текстовых русскоязычных меток в HTML через серверный `exec` ограничена кодировкой stdout, поэтому post-deploy фронтенд подтверждался по id/class новых элементов и рабочему `health`.

## 2026-04-20 00:27 VLAT

- Задача: deploy правок страницы `Расшифровка` с удалением верхнего блока над списком звонков и переводом фильтра на явное применение через кнопку `Применить`.
- Длительность: около 20 минут.
- Результат: `push` коммита `24317d9` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а `GET /api/calls?page=1&pageSize=1&onlyRecorded=true` подтвердил рабочий backend после релиза.
- Примечание: внешний `appUrl` без portal-сессии по-прежнему отвечает `401 BH_LOGIN_REQUIRED`, поэтому post-deploy проверка приложения подтверждалась через локальный runtime `127.0.0.1:3000` на сервере.

## 2026-04-20 00:09 VLAT

- Задача: deploy исправления медленной пагинации списка звонков за счет устранения ложной инвалидции `filteredCallsCache` на каждом `GET /api/calls` и увеличения времени жизни snapshot cache.
- Длительность: около 20 минут.
- Результат: локальный smoke-тест показал первое построение страницы около 10.4 с, а повторные страницы с тем же фильтром уже около 0.12-0.27 с; production deploy выполнен успешно, шаги `download/runtime/install/systemd/start/healthcheck` завершились со статусом `ok`.
- Примечание: корневая причина была в том, что `cleanupStaleActiveJobs()` раньше всегда проходил через `mutateAnalysisStore()` и тем самым сбрасывал cache списка звонков даже без реальных изменений в очереди.

## 2026-04-19 15:17 VLAT

- Задача: deploy оптимизации пагинации списка звонков с кратковременным backend-cache для отфильтрованной выборки, исключением лишних dashboard rerender на frontend и восстановлением `statusBreakdown` по всему отфильтрованному набору.
- Длительность: около 25 минут.
- Результат: локально подтверждены корректный ответ `/api/calls` со свежими звонками, `statusBreakdown` и серверной пагинацией; production deploy выполнен успешно, шаги `download/runtime/install/systemd/start/healthcheck` завершились со статусом `ok`.
- Примечание: в ходе smoke-проверки найден и сразу исправлен runtime-дефект `normalizeDisplayAnalysisState is not defined`, после чего backend стартовал штатно и deploy прошел без ошибок.

## 2026-04-19 14:49 VLAT

- Задача: deploy очистки локального репозитория от служебных артефактов выкладки и удаления зависимости `GET /api/calls` от внешнего `python3` с переводом `activities/search` на прямой Node.js запрос.
- Длительность: около 20 минут.
- Результат: локально подтвержден старт backend без `python3`, `GET /api/calls?page=1&pageSize=5&onlyRecorded=true` вернул свежие звонки за 2026-04-19 и корректные поля пагинации, production deploy выполнен успешно со статусами `download/runtime/install/systemd/start/healthcheck = ok`.
- Примечание: из корня репозитория удалены только локальные deploy-артефакты `*.b64`, `*.deploy.json`, `*.upload.json`, `upload-index.json`, `sample-call.bin`; production данные и runtime-файлы не затрагивались.

## 2026-04-19 14:13 VLAT

- Задача: deploy правок дашборда с выравниванием оформления графика распознанных звонков, сужением трех 7-дневных графиков и восстановлением графика динамики среднего score.
- Длительность: около 15 минут.
- Результат: deploy выполнен успешно, `download/install/start/healthcheck` завершились со статусом `ok`, локальный `/api/health` на сервере вернул `ok=true`, а production HTML на `127.0.0.1:3000` подтвердил наличие `dailyScoreChart`, `chart-panel-slim`, `recognizedCallsChart`, `tokensUsageChart`, `recognizedMinutesChart`.
- Примечание: post-deploy `exec` кратковременно возвращал `EXEC_BUSY`, поэтому финальная проверка runtime выполнялась после короткой паузы.

## 2026-04-19 13:53 VLAT

- Задача: deploy правок дашборда с корректной шкалой тональности, средним процентом по сценариям и тремя 7-дневными графиками по звонкам, токенам и минутам.
- Длительность: около 20 минут.
- Результат: deploy выполнен успешно, `download/install/start/healthcheck` завершились со статусом `ok`, локальный `/api/health` на сервере вернул `ok=true`, а HTML приложения на `127.0.0.1:3000` подтвердил наличие новых блоков `scenarioAverageChart`, `recognizedCallsChart`, `tokensUsageChart`, `recognizedMinutesChart`.
- Примечание: внешний `appUrl` без portal-сессии по-прежнему отдает Black Hole-страницу авторизации, поэтому post-deploy проверка фронтенда подтверждалась через локальный runtime на сервере.

## 2026-04-19 03:08 VLAT

- Задача: deploy объединения блоков `Результат`, `Потребность клиента`, `Следующий шаг` в единый блок `Резюме`, добавления действия `Прослушать разговор` в шапку и ручной прокрутки по якорям внутри drawer.
- Длительность: около 20 минут.
- Результат: deploy выполнен успешно, `/api/health` после завершения post-deploy операций отвечает корректно.
- Примечание: deploy снова выполнен через `codeload.github.com`; после завершения требовалась короткая дополнительная пауза, пока Vibe снимет `EXEC_BUSY` с сервера.

## 2026-04-19 02:53 VLAT

- Задача: deploy правок якорей детализации, удаления лишних элементов из блока `Резюме` и корректировки смещения переходов.
- Длительность: около 15 минут.
- Результат: deploy выполнен успешно, локальный `/api/health` на сервере вернул `ok=true`.
- Примечание: для стабильности сразу использован `codeload.github.com`, так как обычный GitHub tarball уже давал сбой `download -> HTTP 504`.

## 2026-04-19 02:41 VLAT

- Задача: deploy правок шапки детализации, строки статуса и поведения кнопок проигрывания сегментов.
- Длительность: около 15 минут.
- Результат: итоговый deploy выполнен успешно, `/api/health` подтвердил рабочее состояние приложения.
- Примечание: стандартный source URL GitHub archive дважды завершился `DEPLOY_FAILED` на шаге `download` с `HTTP 504`; успешный deploy был выполнен после переключения source URL на `https://codeload.github.com/...`.

## 2026-04-19 02:27 VLAT

- Задача: deploy правок с покомпонентным проигрыванием сегментов транскрипта и новым internal endpoint `/api/calls/:id/recording`.
- Длительность: около 20 минут.
- Результат: deploy выполнен успешно, локально на сервере подтверждены `recordingUrl` в `/api/calls` и ответ `200 audio/mpeg` от `/api/calls/:id/recording`.
- Примечание: вместе с deploy обновлены `docs/api.md` и `docs/logic.md`, так как изменился внутренний API и поведение детализации.

## 2026-04-20 02:08 VLAT

- Задача: убрать внутренний скролл у таблицы списка звонков и переименовать заголовки колонок `Статус анализа` -> `Статус`, `Всего токенов` -> `Токены`.
- Длительность: около 20 минут.
- Результат: изменения задеплоены успешно, `deploy` завершился со статусами `install = ok`, `start = ok`, `healthcheck = ok`, локальный `/api/health` на production отвечает штатно.
- Примечание: при выполнении deploy подтвержден актуальный Vibe endpoint `https://vibecode.bitrix24.tech/v1` с авторизацией через `X-Api-Key`; внешний `appUrl` без авторизации по-прежнему показывает Black Hole-страницу, что ожидаемо для текущей политики доступа.

## 2026-04-19 02:06 VLAT

- Задача: deploy правок модалки детализации звонка по выравниванию шапки, переносу ссылки Bitrix24 в ряд якорей и перестановке блоков детализации.
- Длительность: около 15 минут.
- Результат: deploy выполнен успешно, `/api/health` на сервере отвечает штатно.
- Примечание: это был первый production deploy серии UI-правок модалки после стабилизации env-bootstrap.

## 2026-04-19 01:53 VLAT

- Задача: deploy системной правки env-bootstrap с единым `env.js`, fallback-поиском `.env` и новой стартовой командой через `APP_ENV_FILE=/var/lib/callsreport/.env`.
- Длительность: около 35 минут.
- Результат: код задеплоен, фактический `ExecStart` обновлен, `systemctl restart app` сохраняет env, `/api/health` отвечает `configured=true`.
- Примечание: Deploy API вернул `DEPLOY_FAILED` на healthcheck, но сервис фактически поднялся и стал healthy через несколько секунд; по этому расхождению отправлен feedback в VibeCode.

## 2026-04-19 01:10 VLAT

- Задача: deploy изменений по ускорению открытия приложения и отчета, включая облегченный summary endpoint, параллельную начальную загрузку и in-memory cache stores.
- Длительность: около 25 минут.
- Результат: deploy выполнен, backend и основные API endpoints проверены.
- Примечание: в ходе проверки был отдельно восстановлен production runtime через передачу env в deploy, так как на сервере отсутствовал ожидаемый `/opt/app/.env`.
