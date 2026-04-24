# Журнал деплоев

## Назначение документа

Этот файл фиксирует каждый deploy, который был выполнен в проекте `callsreport`.

Для каждой записи нужно указывать:

- дату и время deploy;
- краткое описание задачи;
- ориентировочную длительность;
- примечания по результату, если это важно для эксплуатации.

## 2026-04-25 08:59 VLAT

- Задача: deploy дополнительной оптимизации dashboard-графиков через новый backend endpoint `GET /api/dashboard-charts` с pre-aggregated series вместо тяжелого per-call dataset для фоновой прогрузки графиков.
- Длительность: около 35 минут.
- Результат: `push` коммита `c072a8d` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, внешний `GET https://app-2f37df5d.vibecode.bitrix24.tech/api/health` вернул `ok=true, configured=true`.
- Примечание: локальный smoke показал сокращение payload для фоновой загрузки графиков примерно с `598 KB` (`/api/dashboard`) до `37.8 KB` (`/api/dashboard-charts`). На production быстрый `GET /api/dashboard-summary` занял около `500 ms`, warm `GET /api/dashboard-charts` после прогрева snapshot занял около `687 ms`; первый cold запрос сразу после restart/deploy был заметно тяжелее, потому что прогревал snapshot и кеш агрегатов.

## 2026-04-25 07:59 VLAT

- Задача: deploy коррекции dashboard после обратной связи: вернуть bar-chart `Средний балл по менеджерам`, удалить именно KPI-карточку `Средний балл` из summary и дополнительно уменьшить точки и толщину линий у графика `Количество вызовов и распознанные вызовы за 3 месяца`.
- Длительность: около 15 минут.
- Результат: `push` коммита `7b2e869` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, внешний `GET https://app-2f37df5d.vibecode.bitrix24.tech/api/health` и локальный `GET http://127.0.0.1:3000/api/health` на сервере вернули `ok=true, configured=true`, а production-файлы в `/opt/app/callsreport-main/public` подтвердили наличие `managerScoreChart`, отсутствие `summaryCard("Средний балл"` в `public/app.js`, а также `pointRadius: 1.35`, `is-thin` и `is-half` для 3-месячного графика вызовов.

## 2026-04-25 07:52 VLAT

- Задача: deploy правок дашборда с удалением графика `Средний балл по менеджерам`, переносом метрики `Без записи` в общий 3-месячный график `Количество вызовов и распознанные вызовы`, уменьшением подписей этого графика и расширением heatmap до `6` месяцев с карточкой шириной `2/3` экрана.
- Длительность: около 25 минут.
- Результат: `push` коммита `9717be5` выполнен в `main`, production deploy после повторного запуска завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, внешний `GET https://app-2f37df5d.vibecode.bitrix24.tech/api/health` и локальный `GET http://127.0.0.1:3000/api/health` на сервере вернули `ok=true, configured=true`, а production-файлы в `/opt/app/callsreport-main/public` подтвердили наличие `chart-panel-heatmap`, `callsVolumeChart`, `buildHeatmapData(..., 184)`, `is-half`, `is-missing` и отсутствие отдельной карточки `Средний балл по менеджерам` в `index.html`.
- Примечание: первый запрос deploy API оборвал соединение и оставил сервис в состоянии `inactive (dead)` после `stop_existing`; повторный deploy тем же source URL завершился штатно и восстановил runtime.

## 2026-04-24 23:02 VLAT

- Задача: deploy возврата heatmap `Тепловая карта вызовов за 3 месяца` к прежнему grouped-виду, удаления heatmap `Распознанные вызовы`, замены блока `Динамика среднего балла` на новый 3-месячный сравнительный график `Количество вызовов и распознанные вызовы`, а также синхронизации `docs/logic.md`.
- Длительность: около 20 минут.
- Результат: `push` коммита `12e2d64` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, внешний `GET https://app-2f37df5d.vibecode.bitrix24.tech/api/health` и локальный `GET http://127.0.0.1:3000/api/health` на сервере вернули `ok=true, configured=true`, а production-файлы в `/opt/app/callsreport-main/public` подтвердили наличие `callsVolumeChart`, `heatmap-groups`, `heatmap-column` и отсутствие отдельных dashboard-блоков `recognizedCallsHeatmap` и `dailyScoreChart`.

## 2026-04-24 22:54 VLAT

- Задача: deploy переработки модалки `Детализация звонка` с выносом `Результат` в отдельный блок и раскладкой блоков `Резюме`, `Результат` и `Потребность клиента` в одну строку.
- Длительность: около 6 минут.
- Результат: `push` коммита `1c49dfd` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production-версии `app.js` и `styles.css` на `127.0.0.1:3000` подтвердили наличие `detail-top-grid`, `analysisOutcome` и `.detail-block-outcome`.
- Примечание: изменения ограничены фронтенд-разметкой и стилями модалки детализации звонка без изменения backend, API, БД и логики очереди.

## 2026-04-24 19:00 VLAT

- Задача: deploy исправления страницы `Расшифровка`: после create/update/delete сценария сразу обновлять селект `Сценарий` в таблице звонков и очищать зависшие временные выборы удалённых сценариев.
- Длительность: около 15 минут.
- Результат: `push` коммита `aab870e` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, server-side exec подтвердил фактический `ExecStart` с `APP_ENV_FILE=/var/lib/callsreport/.env node server.js`, локальный `GET /api/health` на `127.0.0.1:3000` вернул `ok=true, configured=true`, а production `public/app.js` подтвердил наличие `validScenarioIds`, очистки `clearScenarioSelectionOverride(...)` и немедленного `renderCalls()` после `loadScenarios()`.

## 2026-04-24 19:55 VLAT

- Задача: deploy правок дашборда с удалением KPI `Высокий риск`, переименованием `Средний score` в `Средний балл`, переносом `Топ нарушений` в верхнюю группу графиков и переводом обеих heatmap на три горизонтальные строки по месяцам с вертикальным стеком `Все вызовы` / `Распознанные вызовы`.
- Длительность: около 20 минут.
- Результат: `push` коммита `47ee95f` выполнен в `main`, production deploy завершился успешно со статусом `running`, внешний `GET https://app-2f37df5d.vibecode.bitrix24.tech/api/health` вернул `{"ok":true,"configured":true,...}`, локальный `GET http://127.0.0.1:3000/api/health` на сервере вернул тот же healthy-ответ, `systemctl status app` подтвердил `active (running)`, а production-файлы в `/opt/app/callsreport-main/public` подтвердили наличие `heatmap-row`, `heatmap-day-line`, `Топ нарушений`, `Средний балл`, `callsHeatmap`, `recognizedCallsHeatmap`, `dailyScoreChart` и отсутствие отдельного KPI `Высокий риск` в dashboard summary.

## 2026-04-24 19:40 VLAT

- Задача: deploy фактической коррекции дашборда: убрать акцентный gradient у панели `Тональность звонков`, удалить summary-блок `Позитив / нейтрал / негатив`, заменить `Динамика высокого риска` на график `Количество звонков без записи`, добавить отдельный bar-chart `Риски звонков`, упростить строку месяцев у heatmap до одной горизонтальной линии и переименовать `Топ нарушаемых checkpoint’ов` в `Топ нарушений`.
- Длительность: около 20 минут.
- Результат: `push` коммита `bd5f711` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production `app.js`, `styles.css` и HTML на `127.0.0.1:3000` подтвердили наличие `renderRiskChart`, `renderNoRecordingChart`, `riskChart`, `noRecordingChart`, отсутствие старого блока `Динамика высокого риска`, plain-стиль `.chart-panel-accent { background: var(--panel); }` и упрощённую строку `.heatmap-month-label`.

## 2026-04-24 19:29 VLAT

- Задача: deploy синхронизации документации с текущими правилами dashboard bar-chart после унификации отображения значений, шкалы и подписей.
- Длительность: около 10 минут.
- Результат: `push` коммита `ca58296` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production `app.js` и `styles.css` на `127.0.0.1:3000` подтвердили отсутствие `hintFormatter`, наличие `usePercentScale: true`, `totalAnalyzedCalls` и `.bar-label { min-width: 0; color: var(--text); font-weight: 400; }`.

## 2026-04-24 18:53 VLAT

- Задача: deploy унификации однотипных dashboard-графиков `Тональность звонков`, `Средний процент по сценариям`, `Средний балл по менеджерам`, `Топ нарушаемых checkpoint’ов`: убрать нижние подписи, показывать количество прямо в значении рядом с процентом, перевести шкалу на 100% и снять жирность у названий.
- Длительность: около 25 минут.
- Результат: `push` коммита `7864c9c` выполнен в `main`, production runtime после deploy потребовал ручного восстановления, так как `callsreport.sqlite` не открывался с ошибкой `database disk image is malformed`; поврежденный файл сохранён как `/var/lib/callsreport/callsreport.sqlite.malformed-2026-04-24T0858Z`, после чего приложение было поднято повторно из `bootstrap-data`. Итоговый `GET /api/health` на сервере вернул `ok=true, configured=true`, а production `app.js` и `styles.css` на `127.0.0.1:3000` подтвердили отсутствие `hintFormatter`, наличие `usePercentScale: true`, `totalAnalyzedCalls`, `.bar-label { ... font-weight: 400; }` и отсутствие старого правила `.bars-vertical strong,`.

## 2026-04-23 14:25 VLAT

- Задача: deploy доработок по странице `Сценарий` и пайплайну AI-разбора: ужать служебные колонки `#`/`Автоподбор`/`По умолчанию` через `colgroup` и компактные toggle-ячейки, а также убрать потерю содержательного structured-анализа при сбое отдельного шага локализации на русский язык.
- Длительность: около 30 минут.
- Результат: `push` коммита `17bcdb0` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, server-side exec подтвердил фактический `ExecStart` с `APP_ENV_FILE=/var/lib/callsreport/.env node server.js`, локальный `GET /api/health` на `127.0.0.1:3000` вернул `ok=true, configured=true`, а production-файлы подтвердили наличие `colgroup`, `.scenario-flag-column`, `localizationSourceAnalysis` и снятие принудительного обнуления structured-результата.
- Примечание: на момент проверки в production хранилось `294` анализов, из них `7` уже сохранены со старым флагом localization issue; новый код предотвращает повторение этой потери результата для следующих запусков, а старые записи можно отдельно переобработать.

## 2026-04-23 14:04 VLAT

- Задача: deploy правок страницы `Сценарий` и `Расшифровка`: сильнее сузить служебные колонки `#`/`Автоподбор`/`По умолчанию`, разрешить повторный запуск уже распознанного звонка после выбора другого сценария и переводить частично сохранённые результаты с ошибкой AI-разбора или локализации в статус `Нужен повтор`.
- Длительность: около 25 минут.
- Результат: `push` коммита `c4ffc7e` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, server-side exec подтвердил фактический `ExecStart` с `APP_ENV_FILE=/var/lib/callsreport/.env node server.js`, локальный `GET /api/health` на `127.0.0.1:3000` вернул `ok=true, configured=true`, а production-файлы на сервере подтвердили наличие `.scenario-flag-column`, `scenarioSelections` и backend-ветки `return "outdated"`.
- Примечание: выбор сценария в таблице звонков теперь хранится как временное UI-состояние до перезагрузки данных, поэтому кнопка повторного анализа разблокируется сразу после смены сценария.

## 2026-04-23 13:50 VLAT

- Задача: deploy финальной полировки таблицы `Сценарий`: сузить служебные колонки `#`/`Чек-лист`/`Метрики`, переставить `Автоподбор` и `По умолчанию` сразу после номера, перевести `По умолчанию` в radio и сохранить позицию сценария в таблице при inline-изменениях без повторной пересортировки.
- Длительность: около 20 минут.
- Результат: `push` коммита `09a6937` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на `127.0.0.1:3000` вернул `ok=true, configured=true`, а production-файлы на сервере подтвердили наличие `.scenario-count-column`, radio `scenarioDefaultTable` и backend-логики `splice(existingIndex, 0, scenario)` для сохранения позиции сценария при обновлении.
- Примечание: отступ перед полем `Сценарий для проверки` увеличен отдельным классом `scenario-checklist-field`, чтобы блок в модалке визуально совпадал с остальными секциями формы.

## 2026-04-23 13:40 VLAT

- Задача: deploy доработок страницы `Сценарий`: убрать статус из шапки детализации, добавить номер сценария и inline-переключатели `Автоподбор`/`По умолчанию` прямо в таблицу, а также зафиксировать правило ровно одного default-сценария на frontend и backend.
- Длительность: около 25 минут.
- Результат: `push` коммита `8687afb` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на `127.0.0.1:3000` вернул `ok=true, configured=true`, а production-файлы на сервере подтвердили отсутствие `scenarioSelectedBadge`, наличие колонки `#`, inline-toggle `toggle-scenario-default`, backend-хелпера `ensureSingleDefaultScenario` и CSS для `.scenario-index-column`.
- Примечание: теперь единственный сценарий по умолчанию гарантируется даже при inline-редактировании таблицы и после удаления сценариев.

## 2026-04-23 13:25 VLAT

- Задача: deploy доработок UX страницы `Сценарий`: убрать лишний текст над реестром, сократить таблицу до актуальных полей, добавить явные инструкции по заполнению чек-листа, отдельный блок режима сценария, сброс правил автоподбора, копирование в новый, подтверждение удаления и активацию сохранения только при изменениях.
- Длительность: около 35 минут.
- Результат: `push` коммита `3b00090` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на `127.0.0.1:3000` вернул `ok=true, configured=true`, а production-файлы на сервере подтвердили наличие `resetScenarioRules`, `copyScenario`, `scenarioSummaryPill` и усиленных правил `.scenario-registry-table .scenario-link`.
- Примечание: количественные показатели сценария в шапке модалки теперь рендерятся как бейджи, а название сценария в таблице больше не должно наследовать button/pill-оформление.

## 2026-04-22 19:39 VLAT

- Задача: deploy упрощения страницы `Сценарий` после обратной связи: убрать неподдерживаемые поля `Воронки`/`Стадии`/`Номера линий`, не усложнять CRM-обогащение, сохранить закрытие модалки после сохранения и корректный автоподбор по надежным правилам.
- Длительность: около 30 минут.
- Результат: `push` коммита `411e788` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, server-side exec подтвердил наличие `/var/lib/callsreport/.env`, фактический `ExecStart` с `APP_ENV_FILE=/var/lib/callsreport/.env node server.js`, локальный `GET /api/health` на `127.0.0.1:3000` вернул `ok=true, configured=true`, а `GET /api/scenario-options` теперь возвращает только `entityTypes`.
- Примечание: поля `Воронки`, `Стадии` и `Номера линий` исключены из UX и логики автоподбора как ненадежно определяемые; smoke на production также подтвердил наличие `scenarioEntityTypeIdsDropdown` в `index.html` и вызовы `setScenarioModalOpen(false)` в `public/app.js`.

## 2026-04-22 18:59 VLAT

- Задача: deploy правок страницы `Сценарий` с удалением градиентного фона, переименованием раздела, переводом правил автоподбора на мультиселекты, упрощением ввода индивидуальных параметров и добавлением backend endpoint `/api/scenario-options`.
- Длительность: около 25 минут.
- Результат: `push` коммита `11dbf67` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production-версии `index.html`, `styles.css` и `app.js` на `127.0.0.1:3000` подтвердили наличие `scenarioManagerIdsDropdown`, `scenario-toggle-grid`, `background: #f3f7fb;`, `loadScenarioRuleOptions`, `scenario-entity-type` и `selectedScenarioRuleValues`.
- Примечание: внешний `appUrl` без portal-сессии по-прежнему отдает Black Hole-страницу авторизации, поэтому финальная smoke-проверка frontend и нового `/api/scenario-options` выполнялась через локальный runtime `127.0.0.1:3000` на сервере.

## 2026-04-22 18:29 VLAT

- Задача: deploy полного пересмотра страницы `Сценарии анализа` с возвратом библиотеки сценариев в табличный реестр и переносом детального просмотра и редактирования в модальное окно по аналогии с `Детализацией звонка`.
- Длительность: около 20 минут.
- Результат: `push` коммита `2942ba6` выполнен в `main`, production deploy завершился успешно со статусами `stop_existing/clean/download/normalize_windows_paths/cleanup_metadata/runtime/install/systemd/start/healthcheck = ok`, локальный `GET /api/health` на сервере вернул `ok=true, configured=true`, а production-версии `index.html`, `styles.css` и `app.js` на `127.0.0.1:3000` подтвердили наличие `scenario-registry-table`, `scenarioModal`, `scenarioModalTitle`, `closeScenarioModal`, `scenario-modal-panel`, `scenario-library-toolbar` и `setScenarioModalOpen`.

## 2026-04-22 17:04 VLAT

- Задача: ускорение первого открытия приложения; убрана preload-загрузка report на старте, облегчён payload `/api/dashboard`, добавлена дедупликация одинаковых snapshot-запросов.
- Длительность: около 55 минут.
- Примечание: локальный smoke показал сокращение payload `/api/dashboard` примерно с 1.9 MB до 0.57 MB; production deploy выполнен с коммита `8942a82`, шаги `stop_existing`, `clean`, `download`, `normalize_windows_paths`, `cleanup_metadata`, `runtime`, `install`, `systemd`, `start`, `healthcheck` завершились со статусом `ok`.

## 2026-04-22 17:13 VLAT

- Задача: устранение остаточной медленной загрузки после рестарта; добавлен persistent activity snapshot cache в SQLite и чтение стартового списка звонков из локального snapshot вместо обязательного внешнего full-fetch к Vibe API.
- Длительность: около 35 минут.
- Примечание: локальный smoke показал `dashboard` около `8.8 s` на полностью пустом cache и около `2.0 s` после рестарта с уже сохранённым snapshot; warm path `managers/settings/scenarios/dashboard` составил примерно `88 ms / 11 ms / 9 ms / 352 ms`. Production deploy выполнен с коммита `6ea9400`, шаги `stop_existing`, `clean`, `download`, `normalize_windows_paths`, `cleanup_metadata`, `runtime`, `install`, `systemd`, `start`, `healthcheck` завершились со статусом `ok`.

## 2026-04-24 19:15 VLAT

- Задача: переход на native SQLite storage с разделением `main.db` и `cache.db`, включением `WAL`, ротационных backup и append-only export для analyses.
- Длительность: около 95 минут.
- Примечание: локально проверены создание `main.db`, `cache.db`, каталога backup и `analysis-exports`, а также запись analysis через новый storage-слой. Production deploy выполнен с коммита `99146ce`, шаги `stop_existing`, `clean`, `download`, `normalize_windows_paths`, `cleanup_metadata`, `runtime`, `install`, `systemd`, `start`, `healthcheck` завершились со статусом `ok`; внешний `https://app-2f37df5d.vibecode.bitrix24.tech/api/health` ответил `{\"ok\":true,...}`.

## 2026-04-24 20:18 VLAT

- Задача: ускорение первого открытия приложения и устранение эпизодически медленной пагинации.
- Длительность: около 45 минут.
- Примечание: frontend startup перестал ждать managers/settings/scenarios/rule-options перед первым dashboard render, а backend перестал сбрасывать filtered calls cache после фонового refresh activity snapshot без фактического изменения данных. Локальный smoke показал `dashboard ~605 ms`, `calls page1 ~172 ms`, `page2 ~118 ms`. Production deploy выполнен с коммита `40b30ba`, шаги `stop_existing`, `clean`, `download`, `normalize_windows_paths`, `cleanup_metadata`, `runtime`, `install`, `systemd`, `start`, `healthcheck` завершились со статусом `ok`; внешний `/api/health` ответил `{\"ok\":true,...}`.

## 2026-04-25 08:42 VLAT

- Задача: ускорение первого появления данных на дашборде, когда пользователь видит пустой экран до полной загрузки звонков.
- Длительность: около 40 минут.
- Примечание: dashboard startup split implemented: быстрый `/api/dashboard-summary` теперь отдает только summary/statusBreakdown, а тяжелый `/api/dashboard` с per-call dataset догружается отдельно в фоне для графиков. Локальный smoke показал `dashboard-summary ~136 ms`, `dashboard ~529 ms`, `calls page1 ~147 ms`. Production deploy выполнен с коммита `b39f217`, шаги `stop_existing`, `clean`, `download`, `normalize_windows_paths`, `cleanup_metadata`, `runtime`, `install`, `systemd`, `start`, `healthcheck` завершились со статусом `ok`; внешний `/api/health` ответил `{\"ok\":true,...}`.

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
