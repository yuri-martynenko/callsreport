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
const SCENARIOS_FILE = path.join(DATA_DIR, "scenarios.json");

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

function createId(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeScenario(input = {}) {
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
      minDurationSeconds: Number.isFinite(Number(input.matchRules?.minDurationSeconds))
        ? Number(input.matchRules.minDurationSeconds)
        : null,
      maxDurationSeconds: Number.isFinite(Number(input.matchRules?.maxDurationSeconds))
        ? Number(input.matchRules.maxDurationSeconds)
        : null,
    },
    autoApply: Boolean(input.autoApply),
    isDefault: Boolean(input.isDefault),
    updatedAt: new Date().toISOString(),
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

if (call.direction && rules.directions?.includes(call.direction)) score += 1;
  if (call.managerId && rules.managerIds?.includes(call.managerId)) score += 2;
  return score;
}
