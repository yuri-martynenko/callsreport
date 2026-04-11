const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const VIBE_API_URL = process.env.VIBE_API_URL || "https://vibecode.bitrix24.tech";
const VIBE_API_KEY = process.env.VIBE_API_KEY || "";
const AI_CHAT_MODEL = process.env.AI_CHAT_MODEL || "bitrix/bitrixgpt-5";
const AI_TRANSCRIPTION_MODEL =
  process.env.AI_TRANSCRIPTION_MODEL || "bitrix/deepdml/faster-whisper-large-v3-turbo-ct2";
const MAX_CALLS_PER_BATCH = Number(process.env.MAX_CALLS_PER_BATCH || 20);

const DATA_DIR = path.join(__dirname, "data");
const ANALYSES_FILE = path.join(DATA_DIR, "analyses.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function requireConfig() {
  if (!VIBE_API_KEY) {
    const error = new Error("VIBE_API_KEY is not configured");
    error.statusCode = 500;
    throw error;
  }
}

async function ensureDataFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(ANALYSES_FILE);
  } catch {
    await fs.writeFile(
      ANALYSES_FILE,
      JSON.stringify({ analyses: [], updatedAt: new Date().toISOString() }, null, 2),
      "utf8",
    );
  }
}

async function readAnalysisStore() {
  await ensureDataFiles();
  return JSON.parse(await fs.readFile(ANALYSES_FILE, "utf8"));
}

async function writeAnalysisStore(store) {
  await ensureDataFiles();
  store.updatedAt = new Date().toISOString();
  await fs.writeFile(ANALYSES_FILE, JSON.stringify(store, null, 2), "utf8");
}

function vibeHeaders(extra = {}) {
  return { "X-Api-Key": VIBE_API_KEY, ...extra };
}

async function vibeJson(pathname, options = {}) {
  requireConfig();
  const response = await fetch(`${VIBE_API_URL}${pathname}`, {
    ...options,
    headers: vibeHeaders({
      "Content-Type": "application/json",
      ...(options.headers || {}),
    }),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok || payload.success === false) {
    const error = new Error(
      payload?.error?.message || payload?.message || `Vibe API request failed with ${response.status}`,
    );
    error.statusCode = response.status || 500;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function listManagers() {
  const payload = await vibeJson("/v1/users?limit=500");
  return payload.data
    .filter((user) => user.active)
    .map((user) => ({
      id: user.id,
      fullName: [user.lastName, user.name, user.secondName].filter(Boolean).join(" ").trim(),
      position: user.workPosition || "",
      departmentIds: user.departmentId || [],
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
}

function buildCallFilter(query) {
  const filter = { typeId: 2 };
  if (query.managerId) filter.responsibleId = Number(query.managerId);
  if (query.dateFrom || query.dateTo) {
    filter.startTime = {};
    if (query.dateFrom) filter.startTime.$gte = new Date(`${query.dateFrom}T00:00:00`).toISOString();
    if (query.dateTo) filter.startTime.$lte = new Date(`${query.dateTo}T23:59:59`).toISOString();
  }
  if (query.direction === "incoming") filter.direction = 1;
  if (query.direction === "outgoing") filter.direction = 2;
  if (query.onlyRecorded === "true") filter.PROVIDER_ID = "VOXIMPLANT_CALL";
  return filter;
}

function normalizeCall(activity, managersById, analysis) {
  const manager = managersById.get(activity.responsibleId) || null;
  const files = Array.isArray(activity.FILES) ? activity.FILES : [];
  const start = activity.startTime || activity.createdAt;
  const end = activity.endTime || activity.updatedAt || start;
  const durationSeconds = Math.max(0, Math.round((new Date(end) - new Date(start)) / 1000));

  return {
    id: activity.id,
    subject: activity.subject,
    managerId: activity.responsibleId,
    managerName: manager?.fullName || `User #${activity.responsibleId}`,
    managerPosition: manager?.position || "",
    direction: activity.direction === 1 ? "incoming" : "outgoing",
    startTime: start,
    endTime: end,
    durationSeconds,
    completed: activity.completed,
    status: activity.STATUS,
    ownerId: activity.ownerId,
    ownerTypeId: activity.ownerTypeId,
    missedCall: Boolean(activity.SETTINGS?.MISSED_CALL),
    hasRecording: files.length > 0,
    recordingFileId: files[0]?.id || null,
    analysis:
      analysis && analysis.sourceUpdatedAt === activity.updatedAt
        ? {
            updatedAt: analysis.updatedAt,
            summary: analysis.summary,
            score: analysis.scriptAnalysis?.overallScore ?? null,
            sentiment: analysis.overview?.sentiment ?? null,
          }
        : null,
  };
}

async function fetchCalls(query) {
  const [managers, analysisStore] = await Promise.all([listManagers(), readAnalysisStore()]);
  const managersById = new Map(managers.map((manager) => [manager.id, manager]));
  const analysesByActivityId = new Map(
    analysisStore.analyses.map((analysis) => [String(analysis.activityId), analysis]),
  );

  const payload = await vibeJson("/v1/activities/search", {
    method: "POST",
    body: JSON.stringify({
      filter: buildCallFilter(query),
      limit: Math.min(Number(query.limit || 100), 500),
      offset: Number(query.offset || 0),
    }),
  });

  let calls = payload.data.map((activity) =>
    normalizeCall(activity, managersById, analysesByActivityId.get(String(activity.id))),
  );

  if (query.search) {
    const search = query.search.toLowerCase();
    calls = calls.filter(
      (call) =>
        call.subject?.toLowerCase().includes(search) ||
        call.managerName?.toLowerCase().includes(search),
    );
  }

  if (query.onlyRecorded === "true") {
    calls = calls.filter((call) => call.hasRecording);
  }

  return { managers, calls, total: calls.length };
}

async function downloadCallAudio(fileId) {
  requireConfig();
  const response = await fetch(`${VIBE_API_URL}/v1/files/${fileId}/download`, {
    headers: vibeHeaders(),
  });
  if (!response.ok) throw new Error(`Failed to download audio file ${fileId}`);

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "audio/mpeg";
  const fileName =
    response.headers.get("content-disposition")?.match(/filename="?([^"]+)"?/)?.[1] ||
    `call-${fileId}.mp3`;

  return { buffer: Buffer.from(arrayBuffer), contentType, fileName };
}

async function transcribeAudio(audio) {
  requireConfig();
  const form = new FormData();
  form.append("model", AI_TRANSCRIPTION_MODEL);
  form.append("response_format", "verbose_json");
  form.append("file", new Blob([audio.buffer], { type: audio.contentType }), audio.fileName);

  const response = await fetch(`${VIBE_API_URL}/v1/ai/audio/transcriptions`, {
    method: "POST",
    headers: vibeHeaders(),
    body: form,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload?.error?.message || "Audio transcription failed");
  return payload;
}

function analysisPrompt({ transcriptText, scriptChecklist, customMetrics, call }) {
  return `
You are a senior QA analyst for sales calls. Analyze the transcript and return only valid JSON.

Response shape:
{
  "overview": {
    "sentiment": "positive|neutral|negative|mixed",
    "callOutcome": "string",
    "clientNeed": "string",
    "riskLevel": "low|medium|high"
  },
  "summary": "string",
  "recommendations": ["string"],
  "scriptAnalysis": {
    "overallScore": 0,
    "compliancePercent": 0,
    "strengths": ["string"],
    "violations": ["string"],
    "checkpoints": [
      {
        "name": "string",
        "status": "passed|partial|failed|not_applicable",
        "comment": "string"
      }
    ]
  },
  "customMetrics": [
    {
      "name": "string",
      "score": 0,
      "status": "good|warning|critical",
      "comment": "string"
    }
  ],
  "nextStep": "string"
}

Write the values in Russian.

Call context:
${JSON.stringify(
    {
      subject: call.subject,
      direction: call.direction,
      managerName: call.managerName,
      startTime: call.startTime,
      durationSeconds: call.durationSeconds,
    },
    null,
    2,
  )}

Script checklist:
${scriptChecklist?.trim() || "Base sales flow: greeting, need discovery, value presentation, objection handling, clear next step."}

Custom metrics:
${JSON.stringify(customMetrics || [], null, 2)}

Transcript:
${transcriptText}
  `.trim();
}

async function analyzeTranscript({ transcriptText, scriptChecklist, customMetrics, call }) {
  const payload = await vibeJson("/v1/ai/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: AI_CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return only JSON. No markdown." },
        { role: "user", content: analysisPrompt({ transcriptText, scriptChecklist, customMetrics, call }) },
      ],
    }),
  });

  return JSON.parse(payload?.choices?.[0]?.message?.content || "{}");
}

async function analyzeCall(activityId, scriptChecklist, customMetrics) {
  const [callPayload, managers, store] = await Promise.all([
    vibeJson(`/v1/activities/${activityId}`),
    listManagers(),
    readAnalysisStore(),
  ]);

  const managersById = new Map(managers.map((manager) => [manager.id, manager]));
  const rawCall = callPayload.data;
  const call = normalizeCall(rawCall, managersById, null);

  if (!call.hasRecording || !call.recordingFileId) {
    const error = new Error("У звонка нет записи для транскрибации");
    error.statusCode = 400;
    throw error;
  }

  const signature = JSON.stringify({
    sourceUpdatedAt: rawCall.updatedAt,
    scriptChecklist: scriptChecklist || "",
    customMetrics: customMetrics || [],
    transcriptionModel: AI_TRANSCRIPTION_MODEL,
    chatModel: AI_CHAT_MODEL,
  });

  const existing = store.analyses.find(
    (item) => String(item.activityId) === String(activityId) && item.signature === signature,
  );
  if (existing) return { cached: true, analysis: existing };

  const audio = await downloadCallAudio(call.recordingFileId);
  const transcription = await transcribeAudio(audio);
  const transcriptText =
    transcription.text || transcription?.segments?.map((segment) => segment.text).join(" ") || "";

  const analysis = await analyzeTranscript({ transcriptText, scriptChecklist, customMetrics, call });

  const record = {
    activityId,
    recordingFileId: call.recordingFileId,
    sourceUpdatedAt: rawCall.updatedAt,
    signature,
    updatedAt: new Date().toISOString(),
    subject: call.subject,
    managerId: call.managerId,
    managerName: call.managerName,
    direction: call.direction,
    durationSeconds: call.durationSeconds,
    transcriptText,
    transcriptMeta: {
      language: transcription.language || "unknown",
      duration: transcription.duration || null,
      model: AI_TRANSCRIPTION_MODEL,
    },
    ...analysis,
  };

  store.analyses = store.analyses.filter(
    (item) => !(String(item.activityId) === String(activityId) && item.signature === signature),
  );
  store.analyses.unshift(record);
  await writeAnalysisStore(store);

  return { cached: false, analysis: record };
}

function summarizeAnalyses(analyses) {
  const totals = {
    analyzedCalls: analyses.length,
    averageScore: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
    mixed: 0,
    highRisk: 0,
    managers: {},
  };

  let scoreSum = 0;
  let scoreCount = 0;

  for (const item of analyses) {
    const sentiment = item?.overview?.sentiment;
    if (sentiment && Object.hasOwn(totals, sentiment)) totals[sentiment] += 1;
    if (item?.overview?.riskLevel === "high") totals.highRisk += 1;
    if (typeof item?.scriptAnalysis?.overallScore === "number") {
      scoreSum += item.scriptAnalysis.overallScore;
      scoreCount += 1;
    }
    const key = `${item.managerId}`;
    if (!totals.managers[key]) {
      totals.managers[key] = {
        managerId: item.managerId,
        managerName: item.managerName,
        calls: 0,
        averageScore: 0,
        totalScore: 0,
      };
    }
    totals.managers[key].calls += 1;
    totals.managers[key].totalScore += item?.scriptAnalysis?.overallScore || 0;
  }

  totals.averageScore = scoreCount ? Math.round((scoreSum / scoreCount) * 10) / 10 : 0;
  return {
    ...totals,
    managers: Object.values(totals.managers)
      .map((item) => ({
        ...item,
        averageScore: item.calls ? Math.round((item.totalScore / item.calls) * 10) / 10 : 0,
      }))
      .sort((a, b) => b.averageScore - a.averageScore),
  };
}

app.get("/api/health", async (_req, res) => {
  const store = await readAnalysisStore();
  res.json({ ok: true, configured: Boolean(VIBE_API_KEY), updatedAt: store.updatedAt });
});

app.get("/api/managers", async (_req, res, next) => {
  try {
    res.json({ success: true, data: await listManagers() });
  } catch (error) {
    next(error);
  }
});

app.get("/api/calls", async (req, res, next) => {
  try {
    res.json({ success: true, data: await fetchCalls(req.query) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/analyze", async (req, res, next) => {
  try {
    const { activityId, scriptChecklist, customMetrics } = req.body || {};
    if (!activityId) {
      const error = new Error("activityId is required");
      error.statusCode = 400;
      throw error;
    }
    res.json({ success: true, data: await analyzeCall(activityId, scriptChecklist, customMetrics) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/analyze-batch", async (req, res, next) => {
  try {
    const { filters = {}, scriptChecklist, customMetrics } = req.body || {};
    const callsData = await fetchCalls({
      ...filters,
      onlyRecorded: "true",
      limit: Math.min(Number(filters.limit || MAX_CALLS_PER_BATCH), MAX_CALLS_PER_BATCH),
    });

    const selectedCalls = callsData.calls.slice(0, MAX_CALLS_PER_BATCH);
    const results = [];

    for (const call of selectedCalls) {
      try {
        const analysis = await analyzeCall(call.id, scriptChecklist, customMetrics);
        results.push({
          activityId: call.id,
          subject: call.subject,
          managerName: call.managerName,
          status: "ok",
          cached: analysis.cached,
          analysis: analysis.analysis,
        });
      } catch (error) {
        results.push({
          activityId: call.id,
          subject: call.subject,
          managerName: call.managerName,
          status: "error",
          error: error.message,
        });
      }
    }

    res.json({ success: true, data: { totalSelected: selectedCalls.length, processed: results.length, results } });
  } catch (error) {
    next(error);
  }
});

app.get("/api/reports/summary", async (req, res, next) => {
  try {
    const store = await readAnalysisStore();
    let analyses = [...store.analyses];
    if (req.query.managerId) analyses = analyses.filter((item) => String(item.managerId) === String(req.query.managerId));
    res.json({ success: true, data: { summary: summarizeAnalyses(analyses), analyses } });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      message: error.message || "Unexpected server error",
      details: error.payload || null,
    },
  });
});

ensureDataFiles()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`CallsReport listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize application", error);
    process.exit(1);
  });
