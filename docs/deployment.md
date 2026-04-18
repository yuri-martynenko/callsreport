# Деплой

## Назначение документа

Этот документ описывает, как приложение разворачивается на сервере и какие части окружения считаются постоянными.

## Базовый принцип

Код приложения и данные должны быть разделены.

### Эфемерные данные

Можно пересоздавать при каждом деплое:

- директорию релиза приложения;
- `node_modules`;
- статические файлы сборки;
- временные файлы.

### Постоянные данные

Не должны теряться при деплое:

- файл БД;
- legacy backup-файлы;
- production `.env`;
- при необходимости логи.

## Текущее размещение

### Код приложения

Пример каталога:

```text
/opt/app/callsreport-main
```

### Production env

Пример:

```text
/var/lib/callsreport/.env
```

Backend при старте использует единый bootstrap загрузки env для `server.js` и `db.js`.
Порядок поиска `.env` такой:

1. `APP_ENV_FILE`
2. локальный `.env` в директории backend-проекта
3. локальный `.env` в `process.cwd()`
4. `/var/lib/callsreport/.env`
5. legacy fallback `/opt/app/.env`

Для production канонический файл должен лежать в постоянном каталоге `/var/lib/callsreport/.env`. Это важно, потому что Vibe Deploy по умолчанию выполняет `clean` для `/opt/app`, и файлы внутри каталога релиза или рядом с ним не считаются постоянными.
Если `APP_ENV_FILE` не передан и `--env-file` не используется, backend все равно должен подняться за счет встроенного fallback-механизма.

### Постоянное хранилище

```text
/var/lib/callsreport/callsreport.sqlite
/var/lib/callsreport/bootstrap-data
```

## Обязательные переменные окружения

- `VIBE_API_KEY`
- `VIBE_API_URL`
- `BITRIX_PORTAL_URL`
- `AI_CHAT_MODEL`
- `AI_TRANSCRIPTION_MODEL`
- `APP_DB_PATH`
- `APP_LEGACY_DATA_DIR`

При старте backend пишет в лог:

- загружен `.env` или нет;
- из какого файла он был взят;
- какие обязательные переменные отсутствуют.

## Последовательность деплоя

1. Обновить код приложения из репозитория.
2. Установить зависимости.
3. Убедиться, что production `.env` сохранен в `/var/lib/callsreport/.env`.
4. Убедиться, что `APP_DB_PATH` указывает на постоянную директорию.
5. Убедиться, что `VIBE_API_KEY` и остальные обязательные переменные доступны приложению через `/var/lib/callsreport/.env` или уже экспортированы в окружение процесса.
6. Перезапустить backend.
7. Проверить `/api/health`.
8. Проверить, что доступны:
   - `/api/settings`
   - `/api/scenarios`
   - `/api/calls`

## Корректный Vibe Deploy

Для этого проекта рабочая схема Deploy API использует официальный endpoint `POST /v1/infra/servers/:id/deploy?stream=false`, но с запуском из каталога распакованного архива репозитория:

```text
source.url = https://github.com/yuri-martynenko/callsreport/archive/refs/heads/main.tar.gz
runtime = node20
install = cd /opt/app/callsreport-main && npm install --omit=dev
start = cd /opt/app/callsreport-main && APP_ENV_FILE=/var/lib/callsreport/.env node server.js
port = 3000
```

Важно:

- для этого репозитория код после deploy находится не в `/opt/app`, а в `/opt/app/callsreport-main`;
- попытка запускать `npm install` из `/opt/app` приводит к ошибке `ENOENT: no such file or directory, open '/opt/app/package.json'`;
- deploy по умолчанию очищает `/opt/app`, поэтому production `.env` нельзя хранить в каталоге релиза или рядом с ним;
- корректная стартовая команда должна явно указывать canonical env через `APP_ENV_FILE=/var/lib/callsreport/.env`;
- успешный deploy должен завершаться статусами `install = ok`, `start = ok`, `healthcheck = ok`.

## Текущий внешний риск

На 2026-04-18 подтверждено следующее поведение:

- `deploy` завершается успешно;
- локальный healthcheck на сервере проходит;
- приложение стартует и слушает `PORT=3000`;
- внешний `appUrl` сервера в некоторых случаях продолжает отдавать платформенную страницу Black Hole вместо проксирования в приложение.

Это означает, что после deploy нужно проверять не только локальный healthcheck, но и внешний маршрут приложения через `appUrl`. Если `appUrl` отдает HTML-страницу Black Hole вместо приложения, проблема находится на уровне Black Hole routing / gateway, а не в Node.js процессе приложения.

## Что нужно проверять после деплоя

- приложение поднимается без ошибок;
- health endpoint отвечает;
- БД не пересоздана в каталоге релиза;
- сценарии и настройки читаются из БД;
- очередь запускается;
- frontend загружается.

Дополнительно по env/runtime:

- существует ли `/var/lib/callsreport/.env`;
- совпадает ли фактическая `ExecStart` с ожидаемой стартовой командой;
- видит ли процесс Node.js обязательные env-переменные;
- не теряются ли env-переменные после `systemctl restart`;
- если `EnvironmentFile` в systemd указывает на старый путь, backend все равно поднимается за счет fallback-поиска `.env`.

## Диагностика env-проблем

Симптом: сервис стартовал, но ключей нет.

- проверить `journalctl -u app -n 100 --no-pager`;
- найти строки `Env bootstrap ...` и `Required env missing at startup: ...`;
- проверить наличие `/var/lib/callsreport/.env`;
- проверить, не указывает ли `EnvironmentFile` на устаревший путь `/opt/app/.env`.

Симптом: deploy прошел, но приложение не может ходить в Vibe API.

- проверить `VIBE_API_KEY` в `/var/lib/callsreport/.env`;
- проверить фактическую `ExecStart`;
- проверить `/api/health` и признак `configured`;
- отдельно проверить вызов Vibe API изнутри сервера.

Симптом: новый runtime поднялся без env.

- сначала проверить `ExecStart`;
- затем проверить наличие `/var/lib/callsreport/.env`;
- затем проверить startup-лог backend;
- если `APP_ENV_FILE` или `--env-file` не переданы, backend должен подняться за счет встроенного fallback-поиска.

## Риски деплоя

### Потеря данных

Происходит, если:

- хранить БД внутри релизной директории;
- случайно перезаписать файл БД;
- использовать старую JSON-модель хранения в production.

### Несовместимость кода и хранилища

Происходит, если:

- меняется формат payload без миграции;
- меняется логика чтения статусов;
- меняются поля сценариев без нормализации.

## Рекомендуемый операционный стандарт

- после успешного обновления кода фиксировать изменения в Git;
- каждую миграцию хранения описывать в `docs/adr`;
- перед изменением схемы хранения делать backup БД;
- не выполнять ручные правки в production-БД без документирования.
