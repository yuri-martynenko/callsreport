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
const AI_TRANSCRIPTION_RETRIES = Math.max(1, Number(process.env.AI_TRANSCRIPTION_RETRIES || 3));
const MAX_CALLS_PER_BATCH = Number(process.env.MAX_CALLS_PER_BATCH || 20);

const DATA_DIR = path.join(__dirname, "data");
const ANALYSES_FILE = path.join(DATA_DIR, "analyses.json");
const SCENARIOS_FILE = path.join(DATA_DIR, "scenarios.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

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
  try {
    await fs.access(SCENARIOS_FILE);
  } catch {
    await fs.writeFile(
      SCENARIOS_FILE,
      JSON.stringify(
        {
          scenarios: [
            {
              id: "default-sales",
              name: "Базовый сценарий продаж",
              description: "Универсальный сценарий для первичных продаж и консультаций.",
              scriptChecklist:
                "Проверь звонок по этапам: приветствие, выявление потребности, презентация решения, работа с возражениями, фиксация следующего шага.",
              customMetrics: ["Эмпатия", "Четкость следующего шага", "Работа с возражениями"],
              matchRules: {},
              autoApply: true,
              isDefault: true,
              updatedAt: new Date().toISOString(),
            },
          ],
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      "utf8",
    );
  }
  try {
    await fs.access(SETTINGS_FILE);
  } catch {
    await fs.writeFile(
      SETTINGS_FILE,
      JSON.stringify(
        {
          settings: {
            autoTranscriptionMode: "disabled",
          },
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
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
  if (!Array.isArray(store.failures)) store.failures = [];
  await fs.writeFile(ANALYSES_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function readScenarioStore() {
  await ensureDataFiles();
  return JSON.parse(await fs.readFile(SCENARIOS_FILE, "utf8"));
}

async function writeScenarioStore(store) {
  await ensureDataFiles();
  store.updatedAt = new Date().toISOString();
  await fs.writeFile(SCENARIOS_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function readSettingsStore() {
  await ensureDataFiles();
  return JSON.parse(await fs.readFile(SETTINGS_FILE, "utf8"));
}

async function writeSettingsStore(store) {
  await ensureDataFiles();
  store.updatedAt = new Date().toISOString();
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(store, null, 2), "utf8");
}

function createId(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeScenario(input = {}) {
  const minDurationRaw = input.matchRules?.minDurationSeconds;
  const maxDurationRaw = input.matchRules?.maxDurationSeconds;
  const hasMinDuration = minDurationRaw !== null && minDurationRaw !== undefined && String(minDurationRaw).trim() !== "";
  const hasMaxDuration = maxDurationRaw !== null && maxDurationRaw !== undefined && String(maxDurationRaw).trim() !== "";

  return {
    id: input.id || createId("scenario"),
    name: String(input.name || "").trim() || "Новый сценарий",
    description: String(input.description || "").trim(),
    scriptChecklist: String(input.scriptChecklist || "").trim(),
    customMetrics: Array.isArray(input.customMetrics)
      ? input.customMetrics.map((item) => String(item).trim()).filter(Boolean)
      : [],
    matchRules: {
      directions: Array.isArray(input.matchRules?.directions)
        ? input.matchRules.directions.map((item) => String(item)).filter(Boolean)
        : [],
      managerIds: Array.isArray(input.matchRules?.managerIds)
        ? input.matchRules.managerIds.map((item) => Number(item)).filter(Number.isFinite)
        : [],
      subjectKeywords: Array.isArray(input.matchRules?.subjectKeywords)
        ? input.matchRules.subjectKeywords.map((item) => String(item).trim()).filter(Boolean)
        : [],
      minDurationSeconds: hasMinDuration && Number.isFinite(Number(minDurationRaw))
        ? Number(minDurationRaw)
        : null,
      maxDurationSeconds: hasMaxDuration && Number.isFinite(Number(maxDurationRaw))
        ? Number(maxDurationRaw)
        : null,
    },
    autoApply: Boolean(input.autoApply),
    isDefault: Boolean(input.isDefault),
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeSettings(input = {}) {
  const allowedModes = new Set(["disabled", "all", "incoming", "outgoing"]);
  const autoTranscriptionMode = allowedModes.has(String(input.autoTranscriptionMode || ""))
    ? String(input.autoTranscriptionMode)
    : "disabled";

  return {
    autoTranscriptionMode,
  };
}

function matchesScenario(call, scenario) {
  const rules = scenario.matchRules || {};
  if (rules.directions?.length && !rules.directions.includes(call.direction)) return false;
  if (rules.managerIds?.length && !rules.managerIds.includes(call.managerId)) return false;
  if (
    Number.isFinite(rules.minDurationSeconds) &&
    Number(call.durationSeconds || 0) < Number(rules.minDurationSeconds)
  ) {
    return false;
  }
  if (
    Number.isFinite(rules.maxDurationSeconds) &&
    Number(call.durationSeconds || 0) > Number(rules.maxDurationSeconds)
  ) {
    return false;
  }
  if (rules.subjectKeywords?.length) {
    const subject = String(call.subject || "").toLowerCase();
    const hasKeyword = rules.subjectKeywords.some((keyword) => subject.includes(keyword.toLowerCase()));
    if (!hasKeyword) return false;
  }
  return true;
}

function scenarioPriority(call, scenario) {
  const rules = scenario.matchRules || {};
  let score = 0;
  if (rules.managerIds?.length) score += 4;
  if (rules.subjectKeywords?.length) score += 3;
  if (rules.directions?.length) score += 2;
  if (Number.isFinite(rules.minDurationSeconds) || Number.isFinite(rules.maxDurationSeconds)) score += 1;
  if (scenario.isDefault) score -= 10;
  if (call.direction && rules.directions?.includes(call.direction)) score += 1;
  if (call.managerId && rules.managerIds?.includes(call.managerId)) score += 2;
  return score;
}

function getDefaultScenario(scenarios = []) {
  return scenarios.find((scenario) => scenario.isDefault) || null;
}

function pickScenarioForCall(call, scenarios, requestedScenarioId) {
  if (requestedScenarioId) {
    return scenarios.find((scenario) => String(scenario.id) === String(requestedScenarioId)) || null;
  }

  const defaultScenario = getDefaultScenario(scenarios);
  if (defaultScenario) return defaultScenario;

  const candidates = scenarios.filter((scenario) => scenario.autoApply && matchesScenario(call, scenario));
  if (candidates.length) {
    return candidates.sort((left, right) => scenarioPriority(call, right) - scenarioPriority(call, left))[0];
  }

  return null;
}

function buildLatestRecordsMap(items = [], keySelector) {
  const map = new Map();
  for (const item of items) {
    const key = String(keySelector(item));
    if (!map.has(key)) map.set(key, item);
  }
  return map;
}

function uniqueLatestAnalyses(analyses = []) {
  return Array.from(buildLatestRecordsMap(analyses, (item) => item.activityId).values());
}

function deriveTranscriptionTokenUsage(transcriptionPayload) {
  const directUsage = transcriptionPayload?.data?.usage || transcriptionPayload?.usage || null;
  const segmentTokens =
    transcriptionPayload?.data?.segments?.reduce((sum, segment) => sum + (segment.tokens?.length || 0), 0) ||
    transcriptionPayload?.segments?.reduce((sum, segment) => sum + (segment.tokens?.length || 0), 0) ||
    0;

  return {
    promptTokens: Number(directUsage?.prompt_tokens || 0),
    completionTokens: Number(directUsage?.completion_tokens || 0),
    totalTokens: Number(directUsage?.total_tokens || segmentTokens || 0),
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatTimestamp(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainingSeconds = Math.floor(safe % 60);
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function normalizeSentiment(value) {
  const map = {
    positive: "Позитивный",
    neutral: "Нейтральный",
    negative: "Негативный",
    mixed: "Смешанный",
    "позитивный": "Позитивный",
    "нейтральный": "Нейтральный",
    "негативный": "Негативный",
    "смешанный": "Смешанный",
  };
  return map[String(value || "").toLowerCase()] || value || "";
}

function normalizeRiskLevel(value) {
  const map = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    "низкий": "Низкий",
    "средний": "Средний",
    "высокий": "Высокий",
  };
  return map[String(value || "").toLowerCase()] || value || "";
}

function normalizeCheckpointStatus(value) {
  const map = {
    passed: "Пройден",
    partial: "Частично",
    failed: "Не пройден",
    not_applicable: "Не применимо",
    good: "Хорошо",
    warning: "Требует внимания",
    critical: "Критично",
    "пройден": "Пройден",
    "частично": "Частично",
    "не пройден": "Не пройден",
    "не применимо": "Не применимо",
    "хорошо": "Хорошо",
    "требует внимания": "Требует внимания",
    "критично": "Критично",
  };
  return map[String(value || "").toLowerCase()] || value || "";
}

function buildSpeakerRoles(segments, call) {
  const labels = [];
  for (const segment of segments) {
    const speaker = String(segment.speaker ?? segment.speaker_label ?? segment.speakerLabel ?? segment.channel ?? "").trim();
    if (speaker && !labels.includes(speaker)) labels.push(speaker);
  }

  const roleMap = new Map();
  labels.forEach((label, index) => {
    roleMap.set(label, `Участник ${index + 1}`);
  });
  return roleMap;
}

function normalizeTranscriptSegments(transcriptionPayload, call) {
  const rawSegments = transcriptionPayload?.data?.segments || transcriptionPayload?.segments || [];
  if (!Array.isArray(rawSegments) || !rawSegments.length) return [];

  const roleMap = buildSpeakerRoles(rawSegments, call);
  return rawSegments
    .map((segment, index) => {
      const speaker = String(segment.speaker ?? segment.speaker_label ?? segment.speakerLabel ?? segment.channel ?? "").trim();
      const fallbackRole = `Участник ${Math.min(2, (index % 2) + 1)}`;
      return {
        index,
        start: Number(segment.start ?? 0),
        end: Number(segment.end ?? 0),
        speaker,
        role: roleMap.get(speaker) || fallbackRole,
        text: String(segment.text || "").trim(),
      };
    })
    .filter((segment) => segment.text);
}

function buildTranscriptText(segments, plainText) {
  if (segments.length) {
    return segments
      .map((segment) => `[${formatTimestamp(segment.start)} - ${formatTimestamp(segment.end)}] ${segment.role}: ${segment.text}`)
      .join("\n");
  }
  return String(plainText || "").trim();
}

function normalizeAnalysisResult(raw = {}) {
  const overview = raw.overview || {};
  const scriptAnalysis = raw.scriptAnalysis || {};

  return {
    overview: {
      sentiment: normalizeSentiment(overview.sentiment),
      callOutcome: String(overview.callOutcome || overview.outcome || "").trim(),
      clientNeed: String(overview.clientNeed || "").trim(),
      riskLevel: normalizeRiskLevel(overview.riskLevel),
    },
    summary: String(raw.summary || "").trim(),
    recommendations: Array.isArray(raw.recommendations)
      ? raw.recommendations.map((item) => String(item).trim()).filter(Boolean)
      : [],
    scriptAnalysis: {
      overallScore: Number.isFinite(Number(scriptAnalysis.overallScore)) ? Number(scriptAnalysis.overallScore) : null,
      compliancePercent: Number.isFinite(Number(scriptAnalysis.compliancePercent))
        ? Number(scriptAnalysis.compliancePercent)
        : null,
      strengths: Array.isArray(scriptAnalysis.strengths)
        ? scriptAnalysis.strengths.map((item) => String(item).trim()).filter(Boolean)
        : [],
      violations: Array.isArray(scriptAnalysis.violations)
        ? scriptAnalysis.violations.map((item) => String(item).trim()).filter(Boolean)
        : [],
      checkpoints: Array.isArray(scriptAnalysis.checkpoints)
        ? scriptAnalysis.checkpoints.map((item) => ({
            name: String(item?.name || "").trim(),
            status: normalizeCheckpointStatus(item?.status),
            comment: String(item?.comment || "").trim(),
          }))
        : [],
    },
    customMetrics: Array.isArray(raw.customMetrics)
      ? raw.customMetrics.map((item) => ({
          name: String(item?.name || "").trim(),
          score: Number.isFinite(Number(item?.score)) ? Number(item.score) : null,
          status: normalizeCheckpointStatus(item?.status),
          comment: String(item?.comment || "").trim(),
        }))
      : [],
    nextStep: String(raw.nextStep || "").trim(),
  };
}

function analysisHasMeaningfulContent(analysis = {}) {
  return Boolean(
    analysis?.summary ||
      analysis?.overview?.sentiment ||
      analysis?.overview?.callOutcome ||
      analysis?.overview?.clientNeed ||
      analysis?.overview?.riskLevel ||
      analysis?.nextStep ||
      analysis?.recommendations?.length ||
      analysis?.scriptAnalysis?.strengths?.length ||
      analysis?.scriptAnalysis?.violations?.length ||
      analysis?.scriptAnalysis?.checkpoints?.length ||
      Number.isFinite(Number(analysis?.scriptAnalysis?.overallScore)) ||
      Number.isFinite(Number(analysis?.scriptAnalysis?.compliancePercent)) ||
      analysis?.customMetrics?.length
  );
}

function containsMeaningfulLatin(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  const latinMatches = text.match(/[A-Za-z]{3,}/g) || [];
  if (!latinMatches.length) return false;
  return latinMatches.some((word) => !["json", "score"].includes(word.toLowerCase()));
}

function analysisNeedsRussianLocalization(analysis) {
  const texts = [
    analysis?.summary,
    analysis?.overview?.callOutcome,
    analysis?.overview?.clientNeed,
    analysis?.nextStep,
    ...(analysis?.recommendations || []),
    ...(analysis?.scriptAnalysis?.strengths || []),
    ...(analysis?.scriptAnalysis?.violations || []),
    ...(analysis?.scriptAnalysis?.checkpoints || []).flatMap((item) => [item?.name, item?.comment]),
    ...(analysis?.customMetrics || []).flatMap((item) => [item?.name, item?.comment]),
  ];

  return texts.some((item) => containsMeaningfulLatin(item));
}

async function localizeAnalysisToRussian(analysis) {
  const payload = await vibeJson("/v1/ai/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: AI_CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Переведи все текстовые поля JSON на русский язык. Сохрани JSON-структуру, числа, статусы и смысл. Верни только JSON.",
        },
        {
          role: "user",
          content: JSON.stringify(analysis),
        },
      ],
    }),
  });

  return normalizeAnalysisResult(JSON.parse(payload?.data?.choices?.[0]?.message?.content || "{}"));
}

function mergeTokenUsage(transcriptionUsage, analysisUsage) {
  const transcriptionTotal = Number(transcriptionUsage?.totalTokens || 0);
  const analysisPrompt = Number(analysisUsage?.prompt_tokens || 0);
  const analysisCompletion = Number(analysisUsage?.completion_tokens || 0);
  const analysisTotal = Number(analysisUsage?.total_tokens || analysisPrompt + analysisCompletion || 0);

  return {
    transcriptionTokens: transcriptionTotal,
    analysisPromptTokens: analysisPrompt,
    analysisCompletionTokens: analysisCompletion,
    analysisTotalTokens: analysisTotal,
    totalTokens: transcriptionTotal + analysisTotal,
  };
}

async function saveAnalysisFailure(store, call, signature, error, stage) {
  store.failures = (store.failures || []).filter(
    (item) => !(String(item.activityId) === String(call.id) && item.signature === signature),
  );
  store.failures.unshift({
    activityId: call.id,
    signature,
    sourceUpdatedAt: call.sourceUpdatedAt || null,
    updatedAt: new Date().toISOString(),
    subject: call.subject,
    managerId: call.managerId,
    managerName: call.managerName,
    stage,
    errorMessage: error.message,
  });
  await writeAnalysisStore(store);
}

function vibeHeaders(extra = {}) {
  return { "X-Api-Key": VIBE_API_KEY, ...extra };
}

function parseJsonSafely(text, context) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const preview = text.slice(0, 200).replace(/\s+/g, " ").trim();
    const error = new Error(`${context} returned non-JSON response: ${preview || "empty response"}`);
    error.statusCode = 502;
    error.payload = { preview };
    throw error;
  }
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
  const payload = parseJsonSafely(text, `Vibe API ${pathname}`);
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
  const managerIds = String(query.managerIds || query.managerId || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter(Number.isFinite);
  const directions = String(query.directions || query.direction || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (managerIds.length === 1) filter.responsibleId = managerIds[0];
  if (query.dateFrom || query.dateTo) {
    filter.startTime = {};
    if (query.dateFrom) filter.startTime.$gte = new Date(`${query.dateFrom}T00:00:00`).toISOString();
    if (query.dateTo) filter.startTime.$lte = new Date(`${query.dateTo}T23:59:59`).toISOString();
  }
  if (query.onlyRecorded === "true") filter.PROVIDER_ID = "VOXIMPLANT_CALL";
  return { filter, managerIds, directions };
}

function applyClientSideCallFilters(calls, query) {
  const managerIds = String(query.managerIds || query.managerId || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter(Number.isFinite);
  const directions = String(query.directions || query.direction || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  let filtered = calls;
  if (managerIds.length) {
    filtered = filtered.filter((call) => managerIds.includes(Number(call.managerId)));
  }
  if (directions.length) {
    filtered = filtered.filter((call) => directions.includes(String(call.direction)));
  }
  return filtered;
}

function matchesSummaryFilters(item, query) {
  const managerIds = String(query.managerIds || query.managerId || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const directions = String(query.directions || query.direction || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (managerIds.length && !managerIds.includes(String(item.managerId))) return false;
  if (directions.length && !directions.includes(String(item.direction))) return false;
  if (query.dateFrom && new Date(item.startTime || item.updatedAt || 0) < new Date(`${query.dateFrom}T00:00:00`)) return false;
  if (query.dateTo && new Date(item.startTime || item.updatedAt || 0) > new Date(`${query.dateTo}T23:59:59`)) return false;
  return true;
}

function canonicalSentiment(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["positive", "позитивный"].includes(normalized)) return "positive";
  if (["neutral", "нейтральный"].includes(normalized)) return "neutral";
  if (["negative", "негативный"].includes(normalized)) return "negative";
  if (["mixed", "смешанный"].includes(normalized)) return "mixed";
  return "";
}

function canonicalRiskLevel(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["high", "высокий"].includes(normalized)) return "high";
  if (["medium", "средний"].includes(normalized)) return "medium";
  if (["low", "низкий"].includes(normalized)) return "low";
  return "";
}

function normalizeCall(activity, managersById, analysis, failure) {
  const manager = managersById.get(activity.responsibleId) || null;
  const files = Array.isArray(activity.FILES) ? activity.FILES : [];
  const start = activity.startTime || activity.createdAt;
  const end = activity.endTime || activity.updatedAt || start;
  const durationSeconds = Math.max(0, Math.round((new Date(end) - new Date(start)) / 1000));

  const isFailureCurrent = Boolean(
    failure &&
      (!analysis || new Date(failure.updatedAt || 0).getTime() >= new Date(analysis.updatedAt || 0).getTime()),
  );

  const analysisState = isFailureCurrent
    ? "error"
    : !analysis
    ? "pending"
    : analysis.sourceUpdatedAt !== activity.updatedAt
      ? "outdated"
      : analysis.summary || analysis.overview || analysis.recommendations?.length
        ? "ready"
        : analysis.transcriptText
          ? "partial"
          : "technical";

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
    analysis: analysis
      ? {
          activityId: analysis.activityId,
          updatedAt: analysis.updatedAt,
          summary: analysis.summary,
          transcriptText: analysis.transcriptText || "",
          transcriptSegments: Array.isArray(analysis.transcriptSegments) ? analysis.transcriptSegments : [],
          score: analysis.scriptAnalysis?.overallScore ?? null,
          sentiment: analysis.overview?.sentiment ?? null,
          overview: analysis.overview || null,
          recommendations: analysis.recommendations || [],
          scriptAnalysis: analysis.scriptAnalysis || null,
          customMetrics: analysis.customMetrics || [],
          nextStep: analysis.nextStep || "",
          transcriptMeta: analysis.transcriptMeta || null,
          tokenUsage: analysis.tokenUsage || null,
          selectedScenarioId: analysis.selectedScenarioId || null,
          selectedScenarioName: analysis.selectedScenarioName || "",
          errorMessage: isFailureCurrent ? failure.errorMessage : "",
          state: analysisState,
          isCurrent: analysis.sourceUpdatedAt === activity.updatedAt,
        }
      : failure
        ? {
            activityId: activity.id,
            updatedAt: failure.updatedAt,
            summary: "",
            transcriptText: "",
            transcriptSegments: [],
            score: null,
            sentiment: null,
            overview: null,
            recommendations: [],
            scriptAnalysis: null,
            customMetrics: [],
            nextStep: "",
            transcriptMeta: null,
            tokenUsage: null,
            selectedScenarioId: null,
            selectedScenarioName: "",
            errorMessage: failure.errorMessage,
            state: "error",
            isCurrent: true,
          }
        : null,
  };
}

async function fetchCalls(query) {
  const [managers, analysisStore, scenarioStore] = await Promise.all([
    listManagers(),
    readAnalysisStore(),
    readScenarioStore(),
  ]);
  const managersById = new Map(managers.map((manager) => [manager.id, manager]));
  const analysesByActivityId = buildLatestRecordsMap(analysisStore.analyses, (analysis) => analysis.activityId);
  const failuresByActivityId = buildLatestRecordsMap(
    analysisStore.failures || [],
    (failure) => failure.activityId,
  );
  const defaultScenario = getDefaultScenario(scenarioStore.scenarios || []);

  const { filter } = buildCallFilter(query);
  const payload = await vibeJson("/v1/activities/search", {
    method: "POST",
    body: JSON.stringify({
      filter,
      limit: Math.min(Number(query.limit || 100), 500),
      offset: Number(query.offset || 0),
    }),
  });

  let calls = payload.data.map((activity) => {
    const analysis = analysesByActivityId.get(String(activity.id));
    const failure = failuresByActivityId.get(String(activity.id));
    const normalizedCall = normalizeCall(activity, managersById, analysis, failure);

    if (
      normalizedCall.analysis &&
      !normalizedCall.analysis.selectedScenarioId &&
      !normalizedCall.analysis.selectedScenarioName &&
      defaultScenario
    ) {
      normalizedCall.analysis = {
        ...normalizedCall.analysis,
        selectedScenarioId: defaultScenario.id,
        selectedScenarioName: defaultScenario.name,
      };
    }

    return normalizedCall;
  });

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

  calls = applyClientSideCallFilters(calls, query);

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
  let lastError = null;

  for (let attempt = 1; attempt <= AI_TRANSCRIPTION_RETRIES; attempt += 1) {
    try {
      const form = new FormData();
      form.append("response_format", "verbose_json");
      form.append("model", AI_TRANSCRIPTION_MODEL);
      form.append("language", "ru");
      form.append("file", new Blob([audio.buffer], { type: audio.contentType }), audio.fileName);

      const response = await fetch(`${VIBE_API_URL}/v1/ai/audio/transcriptions`, {
        method: "POST",
        headers: vibeHeaders(),
        body: form,
      });

      const text = await response.text();
      const payload = parseJsonSafely(text, "Audio transcription");
      if (!response.ok) {
        const error = new Error(payload?.error?.message || "Audio transcription failed");
        error.statusCode = response.status || 500;
        throw error;
      }
      return payload;
    } catch (error) {
      lastError = error;
      const retryable =
        Number(error.statusCode || 0) >= 500 || /internalservererror|internal server error|500/i.test(String(error.message || ""));
      if (!retryable || attempt >= AI_TRANSCRIPTION_RETRIES) break;
      await delay(1200 * attempt);
    }
  }

  const fallbackError = new Error(
    `Не удалось выполнить транскрибацию звонка. Сервис Whisper временно вернул внутреннюю ошибку. Техническая причина: ${lastError?.message || "неизвестная ошибка"}`,
  );
  fallbackError.statusCode = lastError?.statusCode || 502;
  throw fallbackError;
}

function analysisPrompt({ transcriptText, scriptChecklist, customMetrics, call }) {
  return `
Ты аналитик отдела продаж. Проанализируй транскрипт звонка и верни JSON без markdown.
Все текстовые поля ответа должны быть строго на русском языке.

Формат ответа:
{
  "overview": {
    "sentiment": "Позитивный|Нейтральный|Негативный|Смешанный",
    "callOutcome": "string",
    "clientNeed": "string",
    "riskLevel": "Низкий|Средний|Высокий"
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
        "status": "Пройден|Частично|Не пройден|Не применимо",
        "comment": "string"
      }
    ]
  },
  "customMetrics": [
    {
      "name": "string",
      "score": 0,
      "status": "Хорошо|Требует внимания|Критично",
      "comment": "string"
    }
  ],
  "nextStep": "string"
}

Контекст звонка:
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

Сценарий для проверки:
${scriptChecklist?.trim() || "Используй базовый сценарий продаж: приветствие, выявление потребности, презентация ценности, работа с возражениями, фиксация следующего шага."}

Индивидуальные параметры:
${JSON.stringify(customMetrics || [], null, 2)}

Транскрипт звонка:
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
        { role: "system", content: "Ты строгий аналитик качества звонков. Возвращай только JSON и только на русском языке." },
        { role: "user", content: analysisPrompt({ transcriptText, scriptChecklist, customMetrics, call }) },
      ],
    }),
  });

  return {
    analysis: normalizeAnalysisResult(JSON.parse(payload?.data?.choices?.[0]?.message?.content || "{}")),
    usage: payload?.data?.usage || null,
    model: payload?.data?.model || null,
  };
}

async function analyzeCall(activityId, scriptChecklist, customMetrics, scenarioId) {
  const [callPayload, managers, store, scenarioStore] = await Promise.all([
    vibeJson(`/v1/activities/${activityId}`),
    listManagers(),
    readAnalysisStore(),
    readScenarioStore(),
  ]);

  const managersById = new Map(managers.map((manager) => [manager.id, manager]));
  const rawCall = callPayload.data;
  const call = normalizeCall(rawCall, managersById, null);
  const selectedScenario = pickScenarioForCall(call, scenarioStore.scenarios || [], scenarioId);
  const effectiveScriptChecklist = String(scriptChecklist || selectedScenario?.scriptChecklist || "").trim();
  const effectiveCustomMetrics =
    Array.isArray(customMetrics) && customMetrics.length
      ? customMetrics
      : Array.isArray(selectedScenario?.customMetrics)
        ? selectedScenario.customMetrics
        : [];

  if (!call.hasRecording || !call.recordingFileId) {
    const error = new Error("У звонка нет записи для транскрибации");
    error.statusCode = 400;
    throw error;
  }

  const signature = JSON.stringify({
    sourceUpdatedAt: rawCall.updatedAt,
    scenarioId: selectedScenario?.id || null,
    scriptChecklist: effectiveScriptChecklist,
    customMetrics: effectiveCustomMetrics,
    transcriptionModel: AI_TRANSCRIPTION_MODEL,
    chatModel: AI_CHAT_MODEL,
  });

  const existing = store.analyses.find(
    (item) => String(item.activityId) === String(activityId) && item.signature === signature,
  );
  if (existing && analysisHasMeaningfulContent(existing)) return { cached: true, analysis: existing };

  try {
    const audio = await downloadCallAudio(call.recordingFileId);
    const transcription = await transcribeAudio(audio);
    const transcriptSegments = normalizeTranscriptSegments(transcription, call);
    const transcriptPlainText =
      transcription?.data?.text ||
      transcription?.data?.segments?.map((segment) => segment.text).join(" ") ||
      transcription.text ||
      transcription?.segments?.map((segment) => segment.text).join(" ") ||
      "";
    const transcriptText = buildTranscriptText(transcriptSegments, transcriptPlainText);
    const transcriptionUsage = deriveTranscriptionTokenUsage(transcription);

    const analysisResult = await analyzeTranscript({
      transcriptText,
      scriptChecklist: effectiveScriptChecklist,
      customMetrics: effectiveCustomMetrics,
      call,
    });
    const normalizedAnalysis = analysisNeedsRussianLocalization(analysisResult.analysis)
      ? await localizeAnalysisToRussian(analysisResult.analysis)
      : analysisResult.analysis;

    if (!analysisHasMeaningfulContent(normalizedAnalysis)) {
      const error = new Error(
        "AI-разбор вернул пустой структурированный ответ: транскрибация получена, но резюме, рекомендации и оценка сценария не заполнены.",
      );
      error.statusCode = 502;
      throw error;
    }

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
      selectedScenarioId: selectedScenario?.id || null,
      selectedScenarioName: selectedScenario?.name || "",
      transcriptText,
      transcriptSegments,
      transcriptMeta: {
        language: transcription?.data?.language || transcription.language || "unknown",
        duration: transcription?.data?.duration || transcription.duration || null,
        model: AI_TRANSCRIPTION_MODEL,
      },
      tokenUsage: mergeTokenUsage(transcriptionUsage, analysisResult.usage),
      ...normalizedAnalysis,
    };

    store.analyses = store.analyses.filter(
      (item) => !(String(item.activityId) === String(activityId) && item.signature === signature),
    );
    store.failures = (store.failures || []).filter(
      (item) => !(String(item.activityId) === String(activityId) && item.signature === signature),
    );
    store.analyses.unshift(record);
    await writeAnalysisStore(store);

    return { cached: false, analysis: record };
  } catch (error) {
    await saveAnalysisFailure(store, { ...call, sourceUpdatedAt: rawCall.updatedAt }, signature, error, "analysis");
    throw error;
  }
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
    const sentiment = canonicalSentiment(item?.overview?.sentiment);
    if (sentiment && Object.hasOwn(totals, sentiment)) totals[sentiment] += 1;
    if (canonicalRiskLevel(item?.overview?.riskLevel) === "high") totals.highRisk += 1;
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

app.get("/api/scenarios", async (_req, res, next) => {
  try {
    const store = await readScenarioStore();
    res.json({ success: true, data: { scenarios: store.scenarios || [] } });
  } catch (error) {
    next(error);
  }
});

app.get("/api/settings", async (_req, res, next) => {
  try {
    const store = await readSettingsStore();
    res.json({ success: true, data: { settings: sanitizeSettings(store.settings || {}) } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/settings", async (req, res, next) => {
  try {
    const store = await readSettingsStore();
    store.settings = sanitizeSettings(req.body || {});
    await writeSettingsStore(store);
    res.json({ success: true, data: { settings: store.settings } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/scenarios", async (req, res, next) => {
  try {
    const store = await readScenarioStore();
    const scenario = sanitizeScenario(req.body || {});
    store.scenarios = (store.scenarios || []).filter((item) => String(item.id) !== String(scenario.id));

    if (scenario.isDefault) {
      store.scenarios = store.scenarios.map((item) => ({ ...item, isDefault: false }));
    }

    store.scenarios.unshift(scenario);
    await writeScenarioStore(store);
    res.json({ success: true, data: { scenario, scenarios: store.scenarios } });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/scenarios/:id", async (req, res, next) => {
  try {
    const store = await readScenarioStore();
    const beforeCount = (store.scenarios || []).length;
    store.scenarios = (store.scenarios || []).filter((item) => String(item.id) !== String(req.params.id));
    if (store.scenarios.length === beforeCount) {
      const error = new Error("Scenario not found");
      error.statusCode = 404;
      throw error;
    }
    if (!store.scenarios.some((item) => item.isDefault) && store.scenarios[0]) {
      store.scenarios[0].isDefault = true;
    }
    await writeScenarioStore(store);
    res.json({ success: true, data: { scenarios: store.scenarios } });
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
    const { activityId, scriptChecklist, customMetrics, scenarioId } = req.body || {};
    if (!activityId) {
      const error = new Error("activityId is required");
      error.statusCode = 400;
      throw error;
    }
    res.json({ success: true, data: await analyzeCall(activityId, scriptChecklist, customMetrics, scenarioId) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/analyze-batch", async (req, res, next) => {
  try {
    const { filters = {}, scriptChecklist, customMetrics, scenarioId } = req.body || {};
    const callsData = await fetchCalls({
      ...filters,
      onlyRecorded: "true",
      limit: Math.min(Number(filters.limit || MAX_CALLS_PER_BATCH), MAX_CALLS_PER_BATCH),
    });

    const selectedCalls = callsData.calls.slice(0, MAX_CALLS_PER_BATCH);
    const results = [];

    for (const call of selectedCalls) {
      try {
        const analysis = await analyzeCall(call.id, scriptChecklist, customMetrics, scenarioId);
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

    res.json({
      success: true,
      data: { totalSelected: selectedCalls.length, processed: results.length, results },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/reports/summary", async (req, res, next) => {
  try {
    const store = await readAnalysisStore();
    let analyses = uniqueLatestAnalyses(store.analyses || []);
    analyses = analyses.filter((item) => matchesSummaryFilters(item, req.query));
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
