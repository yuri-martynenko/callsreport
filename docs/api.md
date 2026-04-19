# Внутреннее API

## Назначение документа

Этот документ описывает внутренние HTTP endpoint'ы backend, которые используются frontend-приложением.

## Общие принципы

- все endpoint'ы обслуживаются из `server.js`;
- frontend работает только через эти endpoint'ы;
- backend уже сам ходит во внешние VibeCode API;
- ответы, как правило, имеют вид:

```json
{
  "success": true,
  "data": {}
}
```

## Endpoint'ы

### `GET /api/health`

Проверка состояния приложения.

Возвращает:

- `ok`
- `configured`
- `updatedAt`

### `GET /api/managers`

Возвращает список менеджеров для фильтров и отображения звонков.

### `GET /api/scenarios`

Возвращает библиотеку сценариев анализа.

### `POST /api/scenarios`

Создает или обновляет сценарий.

Используется для:

- сохранения формы сценария;
- обновления правил автоподбора;
- установки сценария по умолчанию.

### `DELETE /api/scenarios/:id`

Удаляет сценарий.

Если удаляется default-сценарий, backend назначает новый default из оставшихся.

### `GET /api/settings`

Возвращает настройки приложения.

Сейчас основной параметр:

- `autoTranscriptionMode`

### `POST /api/settings`

Сохраняет настройки приложения.

После сохранения может немедленно запускать автоматическую постановку подходящих звонков в очередь.

### `GET /api/calls`

Возвращает список звонков для таблицы отчета.

Поддерживает фильтры:

- менеджеры;
- период;
- направления;
- статусы анализа;
- сценарии;
- наличие записи.

Поддерживает серверную пагинацию:

- `page` — номер страницы, начиная с `1`;
- `pageSize` — размер страницы;
- legacy-совместимые `limit` и `offset`, если вызывающая сторона еще не перешла на `page/pageSize`.

Поведение endpoint:

- backend сначала получает расширенную выборку звонков из VibeCode API;
- затем нормализует записи, применяет фильтры и сортирует результат по `startTime`/`createdAt` в порядке убывания;
- backend кратковременно кеширует уже отфильтрованный и отсортированный набор по ключу фильтров, чтобы переключение страниц не пересобирало одну и ту же выборку на каждый клик;
- только после этого режет результат на страницу;
- в ответ frontend получает уже готовую страницу последних звонков, а не полный список для локальной пагинации.

Основные поля ответа:

- `calls` — массив звонков текущей страницы;
- `total` — общее количество звонков после фильтрации;
- `statusBreakdown` — breakdown по статусам анализа для всего отфильтрованного набора, а не только для текущей страницы;
- `page` — фактическая текущая страница;
- `pageSize` — фактический размер страницы;
- `totalPages` — общее число страниц;
- `hasMore` — есть ли следующая страница.

### `GET /api/analyze/jobs`

Возвращает список jobs очереди анализа.

Используется для синхронизации статусов на frontend.

### `POST /api/analyze`

Ставит один звонок в очередь на анализ.

Параметры:

- `activityId`
- `scriptChecklist`
- `customMetrics`
- `scenarioId`

Особенность поведения:

- если для звонка уже есть актуальный готовый анализ с тем же набором входных параметров, backend не создает новую job;
- в этом случае endpoint возвращает `existing = true` и причину `reason = up_to_date`, а frontend должен показать уже сохраненный результат.

### `POST /api/analyze-batch`

Ставит пачку звонков в очередь по текущим фильтрам.

### `GET /api/reports/summary`

Возвращает агрегированную аналитику для отчета и дашборда.

Включает:

- summary KPI;
- суммарное количество использованных токенов по отфильтрованным анализам;
- значения для графиков и карточек.

## Что не является публичным API

Не считаются внешним контрактом:

- внутренние форматы хранения в `payload`;
- промежуточные внутренние helper-функции;
- прямой доступ к таблицам БД.

Любые изменения в endpoint'ах должны отражаться:

- в этом файле;
- в `docs/logic.md`, если меняется поведение;
- в ADR, если меняется архитектурный подход.

## Summary Response Notes

`GET /api/reports/summary` now returns only `data.summary` by default for dashboard and report rendering.

If a caller needs the full filtered analyses array, it must request it explicitly with:

- `includeAnalyses=true`

## 2026-04 Transcript Playback Note

`GET /api/calls` may include an internal `recordingUrl` for calls that have an attached recording.

### `GET /api/calls/:id/recording`

This internal endpoint proxies the source call recording by `activityId`.

Usage:

- the call detail modal uses it to play individual transcript fragments;
- the browser never receives `VIBE_API_KEY` directly;
- if the call has no recording, the endpoint returns `404`;
- on success it returns the original audio stream with the source content type.

## 2026-04 Settings Save Note

`POST /api/settings` now returns immediately after persisting settings.

The automatic rescan of eligible calls for auto-transcription is scheduled in the background and no longer blocks the HTTP response.
