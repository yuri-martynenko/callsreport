# Transfer Checklist

## Назначение

Этот чеклист нужен для безопасного переноса `callsreport` на другой ПК и для подготовки к удалению старого сервера.

Использовать вместе с:

- [docs/project-transfer-handover-2026-05.md](/C:/!MYA/Project/callsreport/docs/project-transfer-handover-2026-05.md)
- [docs/deployment.md](/C:/!MYA/Project/callsreport/docs/deployment.md)
- [docs/database.md](/C:/!MYA/Project/callsreport/docs/database.md)

## 1. Что обязательно сохранить до удаления сервера

- production `.env`
- основную production БД
- кэш-БД
- `bootstrap-data`
- `analysis-exports`
- каталог `backups`
- поврежденные и архивные БД, если они есть
- точные server metadata
- точную deploy-команду и app URL

## 2. Production data set

Для текущего проекта канонически нужно сохранить все из `/var/lib/callsreport`:

- `.env`
- `main.db`, если проект уже переведен на новый layout
- `cache.db`
- `backups/`
- `analysis-exports/`
- `bootstrap-data/`

Если в runtime еще используется legacy layout, дополнительно обязательно сохранить:

- `callsreport.sqlite`
- `callsreport.sqlite-wal`
- `callsreport.sqlite-shm`
- `callsreport.sqlite.malformed-*`, если есть

## 3. Что нужно сохранить вне GitHub

В GitHub нельзя класть:

- production `.env`
- production SQLite-файлы
- архивы с данными
- ключи API
- любые raw backup-файлы с персональными данными

Это нужно хранить отдельно:

- локальный защищенный backup-каталог;
- дополнительная offline-копия;
- по возможности отдельное encrypted-хранилище.

## 4. Что нужно сохранить в GitHub

В репозиторий нужно сохранить:

- handover-документ
- transfer checklist
- финальное описание архитектуры
- все актуальные docs по запуску, deploy, storage и API
- инструкцию по переходу на `Bitrix24 REST API`

## 5. Минимальный набор для запуска на новом ПК

- репозиторий `callsreport`
- `Node.js 20+`
- `npm install`
- локальный `.env`
- production backup-данные или осознанно подготовленный пустой старт

Если нужен полноценный перенос рабочего состояния, а не пустой запуск, обязательно нужны:

- production `.env`
- production database archive
- `bootstrap-data`
- `analysis-exports`

## 6. Что проверить сразу после переноса

1. `GET /api/health`
2. открывается dashboard
3. открывается report
4. читаются scenarios
5. читаются settings
6. видны звонки
7. открывается карточка звонка
8. доступны записи звонков
9. работает ручной анализ
10. работает очередь

## 7. Что отдельно проверить перед удалением сервера

1. Есть ли минимум две копии backup-архива.
2. Сходится ли SHA256 локального архива.
3. Сохранен ли production `.env`.
4. Сохранены ли БД вместе с `-wal` и `-shm`, если runtime еще использует legacy SQLite.
5. Сохранены ли `bootstrap-data`, `analysis-exports` и `backups`.
6. Зафиксированы ли `server id`, `appUrl`, provider, mode, localPort.
7. Зафиксирована ли deploy-команда.
8. Зафиксировано ли, где теперь лежит backup.

## 8. Что желательно сделать после спасения данных

- распаковать архив в отдельный каталог только для проверки структуры;
- не работать напрямую из backup-архива как из production-каталога;
- сделать копию архива перед любыми восстановительными действиями;
- подготовить отдельный recovery-plan для нового окружения;
- перед началом миграции на `Bitrix24 REST` зафиксировать baseline-ветку.

## 9. Критическое замечание по текущему проекту

Исторически в проекте уже была проблема с повреждением SQLite.

Поэтому нельзя считать достаточным только один из следующих вариантов:

- только GitHub-репозиторий без данных;
- только `.env` без БД;
- только `callsreport.sqlite` без `bootstrap-data`, `analysis-exports` и `backups`.

Нужен полный комплект:

- код
- docs
- env
- production data archive
- recovery metadata

## 10. Итоговое правило

Сервер можно удалять только после того, как:

1. сохранен код;
2. сохранена документация;
3. сохранены env и production data;
4. проверена целостность backup;
5. известно, как поднять проект на новом ПК или новом сервере.
