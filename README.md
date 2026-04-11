# CallsReport

Приложение для речевой аналитики звонков в Bitrix24 через VibeCode API.

## Что умеет

- загружать звонки из Bitrix24 `activities` с фильтрами по менеджеру, периоду и направлению;
- определять, у каких звонков есть запись;
- скачивать аудио через VibeCode Disk API;
- транскрибировать запись через `Whisper Large v3 Turbo`;
- строить AI-анализ: резюме, рекомендации, проверка по сценарию, индивидуальные метрики;
- показывать сводный отчёт и список уже проанализированных звонков;
- кэшировать результаты анализа на сервере, чтобы не гонять Whisper и LLM повторно без необходимости.

## Переменные окружения

Скопируйте `.env.example` в `.env` и заполните:

```bash
PORT=3000
VIBE_API_KEY=vibe_api_...
VIBE_API_URL=https://vibecode.bitrix24.tech
AI_CHAT_MODEL=bitrix/bitrixgpt-5
AI_TRANSCRIPTION_MODEL=bitrix/deepdml/faster-whisper-large-v3-turbo-ct2
MAX_CALLS_PER_BATCH=20
```

## Локальный запуск

```bash
npm install
npm start
```

## Деплой на VibeCode

Используйте архив GitHub ветки `main` как source и передайте `VIBE_API_KEY` в `env`.

```json
{
  "source": {
    "url": "https://github.com/yuri-martynenko/callsreport/archive/refs/heads/main.tar.gz"
  },
  "runtime": "node20",
  "install": "cd /opt/app && npm install --production",
  "start": "cd /opt/app && node server.js",
  "port": 3000,
  "env": {
    "NODE_ENV": "production",
    "PORT": "3000",
    "VIBE_API_KEY": "vibe_api_...",
    "VIBE_API_URL": "https://vibecode.bitrix24.tech",
    "AI_CHAT_MODEL": "bitrix/bitrixgpt-5",
    "AI_TRANSCRIPTION_MODEL": "bitrix/deepdml/faster-whisper-large-v3-turbo-ct2"
  }
}
```

## Важные замечания

- приложение ожидает запись звонка в поле `FILES` у CRM activity;
- звонки без записи показываются в списке, но не отправляются на транскрибацию;
- результаты сохраняются в `data/analyses.json`.
