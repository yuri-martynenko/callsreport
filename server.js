const express = require("express");
const fs = require("fs");
const path = require("path");
const { ensureEnvLoaded, envValue, formatEnvBootstrapSummary } = require("./env");

const envBootstrap = ensureEnvLoaded({ baseDir: __dirname });

const {
  ensurePersistence,
  readAnalysisStore: persistenceReadAnalysisStore,
  writeAnalysisStore: persistenceWriteAnalysisStore,
  mutateAnalysisStore: persistenceMutateAnalysisStore,
  readScenarioStore: persistenceReadScenarioStore,
  writeScenarioStore: persistenceWriteScenarioStore,
  readSettingsStore: persistenceReadSettingsStore,
  writeSettingsStore: persistenceWriteSettingsStore,
  readCrmClientCache: persistenceReadCrmClientCache,
  upsertCrmClientCache: persistenceUpsertCrmClientCache,
  readActivitySnapshotCache: persistenceReadActivitySnapshotCache,
  writeActivitySnapshotCache: persistenceWriteActivitySnapshotCache,
} = require("./db");

const app = express();

const PORT = Number(envValue("PORT", "3000"));
const VIBE_API_URL = envValue("VIBE_API_URL", "https://vibecode.bitrix24.tech");
const VIBE_API_KEY = envValue("VIBE_API_KEY", "");
const BITRIX_PORTAL_URL = envValue("BITRIX_PORTAL_URL", "https://yurcentr41.bitrix24.ru").replace(/\/+$/, "");
const AI_CHAT_MODEL = envValue("AI_CHAT_MODEL", "bitrix/bitrixgpt-5");
const AI_TRANSCRIPTION_MODEL = envValue("AI_TRANSCRIPTION_MODEL", "bitrix/deepdml/faster-whisper-large-v3-turbo-ct2");
const AI_TRANSCRIPTION_RETRIES = Math.max(1, Number(envValue("AI_TRANSCRIPTION_RETRIES", "3")));
const MAX_CALLS_PER_BATCH = Number(envValue("MAX_CALLS_PER_BATCH", "20"));
const ANALYSIS_QUEUE_CONCURRENCY = Math.max(1, Number(envValue("ANALYSIS_QUEUE_CONCURRENCY", "1")));
const ANALYSIS_AUTO_SCAN_INTERVAL_MS = Math.max(15000, Number(envValue("ANALYSIS_AUTO_SCAN_INTERVAL_MS", "30000")));
const ANALYSIS_AUTO_SCAN_BATCH = Math.max(1, Number(envValue("ANALYSIS_AUTO_SCAN_BATCH", "10")));
const ANALYSIS_ACTIVE_JOB_STALE_MS = Math.max(300000, Number(envValue("ANALYSIS_ACTIVE_JOB_STALE_MS", "900000")));
const VIBE_REQUEST_TIMEOUT_MS = Math.max(5000, Number(envValue("VIBE_REQUEST_TIMEOUT_MS", "60000")));
const AI_TRANSCRIPTION_TIMEOUT_MS = Math.max(15000, Number(envValue("AI_TRANSCRIPTION_TIMEOUT_MS", "180000")));
const ACTIVITY_SNAPSHOT_REMOTE_LIMIT = Math.max(1000, Number(envValue("ACTIVITY_SNAPSHOT_REMOTE_LIMIT", "5000")));
const ACTIVITY_SNAPSHOT_FRESH_MS = Math.max(15000, Number(envValue("ACTIVITY_SNAPSHOT_FRESH_MS", "120000")));
const ACTIVITY_SNAPSHOT_MAX_STALE_MS = Math.max(
  ACTIVITY_SNAPSHOT_FRESH_MS,
  Number(envValue("ACTIVITY_SNAPSHOT_MAX_STALE_MS", "1800000")),
);

const ACTIVE_ANALYSIS_JOB_STATUSES = new Set(["queued", "processing"]);
const TERMINAL_ANALYSIS_JOB_STATUSES = new Set(["ready", "partial", "technical", "error"]);
const MANAGERS_CACHE_TTL_MS = 5 * 60 * 1000;
const FILTERED_CALLS_CACHE_TTL_MS = 5 * 60 * 1000;
const STALE_JOBS_CLEANUP_INTERVAL_MS = 30 * 1000;

let queueLoopActive = false;
let queueRunningCount = 0;
let queueScanTimer = null;
let autoScanInFlight = false;
const crmEntityCache = new Map();
const crmClientWarmupInFlight = new Set();
let managersCache = { expiresAt: 0, data: null };
const filteredCallsCache = new Map();
const filteredCallsSnapshotInFlight = new Map();
let activitySnapshotCache = { loaded: false, updatedAt: 0, activities: [] };
let activitySnapshotRefreshInFlight = null;
let staleJobsCleanupCheckedAt = 0;
let staleJobsCleanupInFlight = null;
const analysisLocalizationRepairInFlight = new Map();
const analysisLocalizationRepairCooldown = new Map();

console.log(formatEnvBootstrapSummary(envBootstrap));
for (const error of envBootstrap.readErrors) {
  console.warn(`Env bootstrap read error for ${error.filePath}: ${error.message}`);
}
if (envBootstrap.missingRequired.length) {
  console.warn(`Required env missing at startup: ${envBootstrap.missingRequired.join(", ")}`);
}

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
      JSON.stringify({ analyses: [], failures: [], jobs: [], updatedAt: new Date().toISOString() }, null, 2),
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

function normalizeAnalysisStore(store = {}) {
  return {
    analyses: Array.isArray(store.analyses) ? store.analyses : [],
    failures: Array.isArray(store.failures) ? store.failures : [],
    jobs: Array.isArray(store.jobs) ? store.jobs : [],
    updatedAt: store.updatedAt || null,
  };
}

async function readAnalysisStore() {
  await ensureDataFiles();
  return normalizeAnalysisStore(JSON.parse(await fs.readFile(ANALYSES_FILE, "utf8")));
}

async function writeAnalysisStore(store) {
  await ensureDataFiles();
  const normalized = normalizeAnalysisStore(store);
  normalized.updatedAt = new Date().toISOString();
  await fs.writeFile(ANALYSES_FILE, JSON.stringify(normalized, null, 2), "utf8");
}

async function mutateAnalysisStore(mutator) {
  const operation = analysisStoreMutation.then(async () => {
    const store = await readAnalysisStore();
    const result = await mutator(store);
    await writeAnalysisStore(store);
    return result;
  });
  analysisStoreMutation = operation.catch(() => {});
  return operation;
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

// Override legacy JSON storage with persistent SQLite-backed storage.
async function ensureDataFiles() {
  await ensurePersistence();
}

async function readAnalysisStore() {
  return persistenceReadAnalysisStore();
}

async function writeAnalysisStore(store) {
  return persistenceWriteAnalysisStore(store);
}

async function mutateAnalysisStore(mutator) {
  const result = await persistenceMutateAnalysisStore(mutator);
  invalidateFilteredCallsCache();
  return result;
}

async function readScenarioStore() {
  return persistenceReadScenarioStore();
}

async function writeScenarioStore(store) {
  const result = await persistenceWriteScenarioStore(store);
  invalidateFilteredCallsCache();
  return result;
}

async function readSettingsStore() {
  return persistenceReadSettingsStore();
}

async function writeSettingsStore(store) {
  const result = await persistenceWriteSettingsStore(store);
  invalidateFilteredCallsCache();
  return result;
}

async function readCrmClientCache(entries) {
  return persistenceReadCrmClientCache(entries);
}

async function upsertCrmClientCache(entry) {
  return persistenceUpsertCrmClientCache(entry);
}

async function readActivitySnapshotCache() {
  return persistenceReadActivitySnapshotCache("latest-calls");
}

async function writeActivitySnapshotCache(entry) {
  return persistenceWriteActivitySnapshotCache({
    cacheKey: "latest-calls",
    activities: Array.isArray(entry?.activities) ? entry.activities : [],
  });
}

function createId(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function sanitizePositiveIntList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);
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
      directions: sanitizeStringList(input.matchRules?.directions),
      managerIds: sanitizePositiveIntList(input.matchRules?.managerIds),
      subjectKeywords: sanitizeStringList(input.matchRules?.subjectKeywords),
      entityTypeIds: sanitizePositiveIntList(input.matchRules?.entityTypeIds),
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

function ensureSingleDefaultScenario(scenarios = [], preferredId = null) {
  if (!Array.isArray(scenarios) || !scenarios.length) return scenarios;
  let defaultId = scenarios.find((scenario) => scenario.isDefault)?.id || null;
  if (preferredId && scenarios.some((scenario) => String(scenario.id) === String(preferredId))) {
    defaultId = preferredId;
  }
  if (!defaultId) {
    defaultId = scenarios[0].id;
  }
  return scenarios.map((scenario, index) => ({
    ...scenario,
    isDefault: String(scenario.id) === String(defaultId) && index >= 0,
  }));
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
  if (rules.entityTypeIds?.length && !rules.entityTypeIds.includes(Number(call.ownerTypeId))) return false;
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
  if (rules.entityTypeIds?.length) score += 5;
  if (rules.managerIds?.length) score += 4;
  if (rules.subjectKeywords?.length) score += 3;
  if (rules.directions?.length) score += 2;
  if (Number.isFinite(rules.minDurationSeconds) || Number.isFinite(rules.maxDurationSeconds)) score += 1;
  if (scenario.isDefault) score -= 10;
  if (call.ownerTypeId && rules.entityTypeIds?.includes(Number(call.ownerTypeId))) score += 2;
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

  const candidates = scenarios.filter((scenario) => scenario.autoApply && matchesScenario(call, scenario));
  if (candidates.length) {
    return candidates.sort((left, right) => scenarioPriority(call, right) - scenarioPriority(call, left))[0];
  }

  return getDefaultScenario(scenarios);
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

function listJobsNewestFirst(jobs = []) {
  return [...jobs].sort(
    (left, right) => new Date(right.updatedAt || right.createdAt || 0) - new Date(left.updatedAt || left.createdAt || 0),
  );
}

function buildLatestJobMap(jobs = []) {
  return buildLatestRecordsMap(listJobsNewestFirst(jobs), (job) => job.activityId);
}

function buildLatestActiveJobMap(jobs = []) {
  return buildLatestRecordsMap(
    listJobsNewestFirst(jobs).filter((job) => ACTIVE_ANALYSIS_JOB_STATUSES.has(String(job.status || ""))),
    (job) => job.activityId,
  );
}

function invalidateFilteredCallsCache() {
  filteredCallsCache.clear();
}

function normalizeCsvQueryValue(value, { numeric = false } = {}) {
  const items = String(value || "")
    .split(",")
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  if (numeric) {
    return items
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item))
      .sort((left, right) => left - right)
      .join(",");
  }

  return items.sort((left, right) => left.localeCompare(right, "ru")).join(",");
}

function buildFilteredCallsCacheKey(query = {}) {
  return JSON.stringify({
    managerIds: normalizeCsvQueryValue(query.managerIds || query.managerId, { numeric: true }),
    dateFrom: String(query.dateFrom || "").trim(),
    dateTo: String(query.dateTo || "").trim(),
    directions: normalizeCsvQueryValue(query.directions || query.direction),
    analysisStates: normalizeCsvQueryValue(query.analysisStates),
    scenarioIds: normalizeCsvQueryValue(query.scenarioIds),
    onlyRecorded: String(query.onlyRecorded || "").trim(),
    search: String(query.search || "").trim().toLowerCase(),
  });
}

function normalizeDisplayAnalysisState(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "pending";
  if (["processing", "queued"].includes(normalized)) return normalized;
  if (["ready", "partial", "technical", "outdated", "error", "missing", "pending"].includes(normalized)) {
    return normalized;
  }
  return "pending";
}

function normalizeCallStatusKey(call) {
  const rawState = call?.analysis?.state || (!call?.hasRecording ? "missing" : "pending");
  const normalizedState = normalizeDisplayAnalysisState(rawState);
  return normalizedState === "processing" ? "queued" : normalizedState;
}

function buildCallStatusBreakdown(calls = []) {
  const order = ["total", "ready", "pending", "queued", "partial", "outdated", "error", "missing"];
  const counts = new Map(order.map((key) => [key, 0]));
  counts.set("total", calls.length);

  for (const call of calls) {
    const key = normalizeCallStatusKey(call);
    if (counts.has(key)) {
      counts.set(key, Number(counts.get(key) || 0) + 1);
    }
  }

  return order.map((key) => ({ key, count: Number(counts.get(key) || 0) }));
}

function summarizeAnalysesFromCalls(calls = []) {
  return summarizeAnalyses(
    calls
      .map((call) =>
        call?.analysis
          ? {
              ...call.analysis,
              managerId: call.managerId,
              managerName: call.managerName,
            }
          : null,
      )
      .filter(Boolean),
  );
}

function createDashboardAnalysisSnapshot(analysis = null) {
  if (!analysis) return null;
  return {
    activityId: analysis.activityId,
    updatedAt: analysis.updatedAt,
    selectedScenarioId: analysis.selectedScenarioId || null,
    selectedScenarioName: analysis.selectedScenarioName || "",
    state: analysis.state,
    isCurrent: Boolean(analysis.isCurrent),
    overview: analysis.overview
      ? {
          sentiment: analysis.overview.sentiment ?? null,
          riskLevel: analysis.overview.riskLevel ?? null,
        }
      : null,
    scriptAnalysis: analysis.scriptAnalysis
      ? {
          overallScore: analysis.scriptAnalysis.overallScore ?? null,
          compliancePercent: analysis.scriptAnalysis.compliancePercent ?? null,
          checkpoints: Array.isArray(analysis.scriptAnalysis.checkpoints)
            ? analysis.scriptAnalysis.checkpoints.map((checkpoint) => ({
                name: checkpoint?.name || "",
                status: checkpoint?.status || "",
              }))
            : [],
        }
      : null,
    tokenUsage: analysis.tokenUsage
      ? {
          totalTokens: analysis.tokenUsage.totalTokens ?? 0,
        }
      : null,
  };
}

function createDashboardCallSnapshot(call = {}) {
  return {
    id: call.id,
    managerId: call.managerId,
    managerName: call.managerName,
    direction: call.direction,
    startTime: call.startTime,
    durationSeconds: call.durationSeconds,
    hasRecording: Boolean(call.hasRecording),
    analysis: createDashboardAnalysisSnapshot(call.analysis),
  };
}

function activityHasRecording(activity = {}) {
  const rawFiles = activity?.FILES ?? activity?.files ?? activity?.recordings ?? [];
  return Array.isArray(rawFiles) && rawFiles.length > 0;
}

function deriveCallAnalysisStateFromActivity(activity, analysis, failure, latestJob = null) {
  const isFailureCurrent = Boolean(
    failure &&
      (!analysis || new Date(failure.updatedAt || 0).getTime() >= new Date(analysis.updatedAt || 0).getTime()),
  );

  const jobStatus = String(latestJob?.status || "");
  const isJobActive = ACTIVE_ANALYSIS_JOB_STATUSES.has(jobStatus);
  const isJobError = jobStatus === "error";

  if (isJobActive) return jobStatus;
  if (isFailureCurrent || isJobError) return "error";
  if (!activityHasRecording(activity)) return "missing";
  if (!analysis) return "pending";
  if (analysis.sourceUpdatedAt !== activity.updatedAt) return "outdated";
  return deriveAnalysisResultState(analysis);
}

function buildCallStatusBreakdownFromActivities(activities = [], analysesByActivityId = new Map(), failuresByActivityId = new Map(), jobsByActivityId = new Map()) {
  const order = ["total", "ready", "pending", "queued", "partial", "outdated", "error", "missing"];
  const counts = new Map(order.map((key) => [key, 0]));
  counts.set("total", activities.length);

  for (const activity of activities) {
    const activityId = String(activity?.id || "");
    const state = deriveCallAnalysisStateFromActivity(
      activity,
      analysesByActivityId.get(activityId),
      failuresByActivityId.get(activityId),
      jobsByActivityId.get(activityId),
    );
    const normalized = normalizeDisplayAnalysisState(state);
    const key = normalized === "processing" ? "queued" : normalized;
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  return order.map((key) => ({
    key,
    count: counts.get(key) || 0,
  }));
}

async function buildDashboardSummarySnapshot() {
  const [rawActivities, analysisStore] = await Promise.all([
    getRawActivitiesSnapshot(),
    readAnalysisStore(),
  ]);

  const analysesByActivityId = buildLatestRecordsMap(analysisStore.analyses, (analysis) => analysis.activityId);
  const failuresByActivityId = buildLatestRecordsMap(
    analysisStore.failures || [],
    (failure) => failure.activityId,
  );
  const jobsByActivityId = buildLatestJobMap(analysisStore.jobs || []);
  const relevantAnalyses = rawActivities
    .map((activity) => analysesByActivityId.get(String(activity?.id || "")))
    .filter(Boolean);
  const statusBreakdown = buildCallStatusBreakdownFromActivities(
    rawActivities,
    analysesByActivityId,
    failuresByActivityId,
    jobsByActivityId,
  );
  const pendingCalls = Number(statusBreakdown.find((item) => item.key === "pending")?.count || 0);
  const queuedCalls = Number(statusBreakdown.find((item) => item.key === "queued")?.count || 0);

  return {
    summary: {
      ...summarizeAnalyses(relevantAnalyses),
      totalCalls: rawActivities.length,
      pendingCalls,
      awaitingAnalysisCalls: pendingCalls + queuedCalls,
      statusBreakdown,
    },
    statusBreakdown,
  };
}

function roundMetric(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function dashboardCallDayKey(call = {}) {
  if (!call?.startTime) return null;
  const date = new Date(call.startTime);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function dashboardDayLabel(key) {
  if (!key) return "—";
  const date = new Date(`${key}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("ru-RU", { timeZone: "UTC" });
}

function lastNDashboardDayKeys(days = 7, endDate = new Date()) {
  const end = new Date(endDate);
  end.setUTCHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (days - index - 1));
    return date.toISOString().slice(0, 10);
  });
}

function dashboardCallsWithAnalysis(calls = []) {
  return calls.filter((call) => {
    const state = String(call?.analysis?.state || "");
    return ["ready", "partial", "technical"].includes(state);
  });
}

function buildDashboardCountSeries(calls = [], predicate = () => true, days = 90) {
  const keys = lastNDashboardDayKeys(days);
  const buckets = new Map(keys.map((key) => [key, 0]));
  for (const call of calls) {
    const key = dashboardCallDayKey(call);
    if (!key || !buckets.has(key) || !predicate(call)) continue;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }
  return keys.map((key) => ({
    key,
    label: dashboardDayLabel(key),
    value: buckets.get(key) || 0,
  }));
}

function buildDashboardSumSeries(calls = [], metricResolver = () => 0, days = 7, digits = null) {
  const keys = lastNDashboardDayKeys(days);
  const buckets = new Map(keys.map((key) => [key, 0]));
  for (const call of calls) {
    const key = dashboardCallDayKey(call);
    if (!key || !buckets.has(key)) continue;
    buckets.set(key, (buckets.get(key) || 0) + Number(metricResolver(call) || 0));
  }
  return keys.map((key) => {
    const value = buckets.get(key) || 0;
    return {
      key,
      label: dashboardDayLabel(key),
      value: Number.isFinite(digits) ? roundMetric(value, digits) : value,
    };
  });
}

function buildDashboardRatioSeries(calls = [], numeratorResolver = () => 0, denominatorResolver = () => 0, days = 90) {
  const keys = lastNDashboardDayKeys(days);
  const buckets = new Map(keys.map((key) => [key, { numerator: 0, denominator: 0 }]));
  for (const call of calls) {
    const key = dashboardCallDayKey(call);
    if (!key || !buckets.has(key)) continue;
    const numerator = Number(numeratorResolver(call));
    const denominator = Number(denominatorResolver(call));
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) continue;
    const bucket = buckets.get(key);
    bucket.numerator += numerator;
    bucket.denominator += denominator;
  }
  return keys.map((key) => {
    const bucket = buckets.get(key) || { numerator: 0, denominator: 0 };
    return {
      key,
      label: dashboardDayLabel(key),
      value: bucket.denominator > 0 ? roundMetric(bucket.numerator / bucket.denominator, 1) : 0,
    };
  });
}

function buildDashboardHeatmap(calls = [], predicate = () => true, days = 184) {
  const keys = lastNDashboardDayKeys(days);
  const buckets = new Map(keys.map((key) => [key, 0]));
  for (const call of calls) {
    const key = dashboardCallDayKey(call);
    if (!key || !buckets.has(key) || !predicate(call)) continue;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  const daysData = keys.map((key) => {
    const date = new Date(`${key}T00:00:00Z`);
    return {
      key,
      label: dashboardDayLabel(key),
      weekday: (date.getUTCDay() + 6) % 7,
      value: buckets.get(key) || 0,
    };
  });

  return {
    days: daysData,
    maxValue: Math.max(...daysData.map((item) => item.value), 0),
  };
}

function isDashboardCheckpointViolation(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return !["passed", "good", "not_applicable", "пройден", "хорошо", "не применимо"].includes(normalized);
}

function buildDashboardChartsSnapshot(calls = []) {
  const analyzedCalls = dashboardCallsWithAnalysis(calls);
  const riskBuckets = new Map([
    ["Низкий", { label: "Низкий", count: 0, trackClassName: "is-low-risk" }],
    ["Средний", { label: "Средний", count: 0, trackClassName: "is-medium-risk" }],
    ["Высокий", { label: "Высокий", count: 0, trackClassName: "is-high-risk" }],
  ]);
  const scenarioBuckets = new Map();
  const scenarioTokensBuckets = new Map();
  const monthlyScenarioTokensBuckets = new Map();
  const managerBuckets = new Map();
  const checkpointBuckets = new Map();
  const last30DayKeys = new Set(lastNDashboardDayKeys(30));

  for (const call of analyzedCalls) {
    const analysis = call.analysis || {};
    const riskLabel = normalizeRiskLevel(analysis?.overview?.riskLevel) || "";
    if (riskBuckets.has(riskLabel)) {
      riskBuckets.get(riskLabel).count += 1;
    }

    const compliance = Number(analysis?.scriptAnalysis?.compliancePercent);
    if (Number.isFinite(compliance)) {
      const scenarioLabel = String(analysis?.selectedScenarioName || "Автосценарий").trim() || "Автосценарий";
      if (!scenarioBuckets.has(scenarioLabel)) {
        scenarioBuckets.set(scenarioLabel, { label: scenarioLabel, total: 0, count: 0 });
      }
      const bucket = scenarioBuckets.get(scenarioLabel);
      bucket.total += compliance;
      bucket.count += 1;
    }

    const totalTokens = Number(analysis?.tokenUsage?.transcriptionTokens || 0);
    const transcriptSeconds = Number(analysis?.transcriptMeta?.duration || call?.durationSeconds || 0);
    const durationMinutes = Math.max(0, transcriptSeconds / 60);
    if (Number.isFinite(totalTokens) && totalTokens > 0 && Number.isFinite(durationMinutes) && durationMinutes > 0) {
      const scenarioTokenLabel = String(analysis?.selectedScenarioName || "Автосценарий").trim() || "Автосценарий";
      if (!scenarioTokensBuckets.has(scenarioTokenLabel)) {
        scenarioTokensBuckets.set(scenarioTokenLabel, { label: scenarioTokenLabel, totalTokens: 0, totalMinutes: 0, count: 0 });
      }
      const bucket = scenarioTokensBuckets.get(scenarioTokenLabel);
      bucket.totalTokens += totalTokens;
      bucket.totalMinutes += durationMinutes;
      bucket.count += 1;

      const callDayKey = dashboardCallDayKey(call);
      if (callDayKey && last30DayKeys.has(callDayKey)) {
        if (!monthlyScenarioTokensBuckets.has(scenarioTokenLabel)) {
          monthlyScenarioTokensBuckets.set(scenarioTokenLabel, { label: scenarioTokenLabel, totalTokens: 0, totalMinutes: 0, count: 0 });
        }
        const monthlyBucket = monthlyScenarioTokensBuckets.get(scenarioTokenLabel);
        monthlyBucket.totalTokens += totalTokens;
        monthlyBucket.totalMinutes += durationMinutes;
        monthlyBucket.count += 1;
      }
    }

    const score = Number(analysis?.scriptAnalysis?.overallScore);
    if (Number.isFinite(score)) {
      const managerKey = String(call?.managerId || call?.managerName || "unknown");
      if (!managerBuckets.has(managerKey)) {
        managerBuckets.set(managerKey, {
          label: call?.managerName || analysis?.managerName || `Менеджер #${call?.managerId || "—"}`,
          totalScore: 0,
          calls: 0,
        });
      }
      const bucket = managerBuckets.get(managerKey);
      bucket.totalScore += score;
      bucket.calls += 1;
    }

    const checkpoints = Array.isArray(analysis?.scriptAnalysis?.checkpoints) ? analysis.scriptAnalysis.checkpoints : [];
    for (const checkpoint of checkpoints) {
      if (!checkpoint?.name || !isDashboardCheckpointViolation(checkpoint?.status)) continue;
      const key = String(checkpoint.name).trim();
      if (!checkpointBuckets.has(key)) {
        checkpointBuckets.set(key, { label: key, count: 0 });
      }
      checkpointBuckets.get(key).count += 1;
    }
  }

  const totalRiskCalls = analyzedCalls.length;
  const riskRows = Array.from(riskBuckets.values()).map((item) => ({
    label: item.label,
    value: totalRiskCalls ? roundMetric((item.count / totalRiskCalls) * 100, 1) : 0,
    rawValue: item.count,
    trackClassName: item.trackClassName,
  }));

  const scenarioAverageRows = Array.from(scenarioBuckets.values())
    .map((item) => ({
      label: item.label,
      value: item.count ? roundMetric(item.total / item.count, 1) : 0,
      count: item.count,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);

  const scenarioTokensPerMinuteRows = Array.from(scenarioTokensBuckets.values())
    .map((item) => ({
      label: item.label,
      value: item.totalMinutes > 0 ? roundMetric(item.totalTokens / item.totalMinutes, 1) : 0,
      count: item.count,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);

  const monthlyScenarioTokensPerMinuteRows = Array.from(monthlyScenarioTokensBuckets.values())
    .map((item) => ({
      label: item.label,
      value: item.totalMinutes > 0 ? roundMetric(item.totalTokens / item.totalMinutes, 1) : 0,
      count: item.count,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);

  const managerScoreRows = Array.from(managerBuckets.values())
    .map((item) => ({
      label: item.label,
      value: item.calls ? roundMetric(item.totalScore / item.calls, 1) : 0,
      calls: item.calls,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 12);

  const violatedCheckpointRows = Array.from(checkpointBuckets.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, 10)
    .map((item) => ({
      label: item.label,
      value: analyzedCalls.length ? roundMetric((item.count / analyzedCalls.length) * 100, 1) : 0,
      count: item.count,
    }));

  return {
    riskRows,
    scenarioAverageRows,
    scenarioTokensPerMinuteRows,
    monthlyScenarioTokensPerMinuteRows,
    managerScoreRows,
    callsHeatmap: buildDashboardHeatmap(calls, () => true, 184),
    recognizedCallsSeries: buildDashboardCountSeries(analyzedCalls, () => true, 30),
    tokensUsageSeries: buildDashboardSumSeries(
      analyzedCalls,
      (call) => Number(call?.analysis?.tokenUsage?.totalTokens || 0),
      30,
    ),
    recognizedMinutesSeries: buildDashboardSumSeries(
      analyzedCalls,
      (call) => Number(call?.durationSeconds || 0) / 60,
      30,
      1,
    ),
    noRecordingSeries: buildDashboardCountSeries(calls, (call) => !call?.hasRecording, 90),
    tokensPerMinuteSeries: buildDashboardRatioSeries(
      analyzedCalls,
      (call) => Number(call?.analysis?.tokenUsage?.totalTokens || 0),
      (call) => Math.max(0, Number(call?.durationSeconds || 0) / 60),
      30,
    ),
    violatedCheckpointRows,
    callsVolume: {
      totalSeries: buildDashboardCountSeries(calls, () => true, 90),
      recognizedSeries: buildDashboardCountSeries(analyzedCalls, () => true, 90),
      missingRecordingSeries: buildDashboardCountSeries(calls, (call) => !call?.hasRecording, 90),
    },
  };
}

function buildDashboardCallSnapshotFromActivity(activity = {}, managersById = new Map(), analysesByActivityId = new Map(), failuresByActivityId = new Map(), jobsByActivityId = new Map()) {
  const activityId = String(activity?.id || "");
  const manager = managersById.get(activity.responsibleId) || null;
  const analysis = analysesByActivityId.get(activityId) || null;
  const failure = failuresByActivityId.get(activityId) || null;
  const latestJob = jobsByActivityId.get(activityId) || null;
  const rawFiles = activity?.FILES ?? activity?.files ?? activity?.recordings ?? [];
  const files = Array.isArray(rawFiles) ? rawFiles : [];
  const start = activity.startTime || activity.createdAt;
  const end = activity.endTime || activity.updatedAt || start;
  const durationSeconds = Math.max(0, Math.round((new Date(end) - new Date(start)) / 1000));
  const analysisState = deriveCallAnalysisStateFromActivity(activity, analysis, failure, latestJob);

  return {
    id: activity.id,
    managerId: activity.responsibleId,
    managerName: manager?.fullName || `User #${activity.responsibleId}`,
    direction: activity.direction === 1 ? "incoming" : "outgoing",
    startTime: start,
    durationSeconds,
    hasRecording: files.length > 0,
    analysis: createDashboardAnalysisSnapshot(
      analysis
        ? {
            ...analysis,
            selectedScenarioId: latestJob?.selectedScenarioId || analysis.selectedScenarioId || null,
            selectedScenarioName: latestJob?.selectedScenarioName || analysis.selectedScenarioName || "",
            state: analysisState,
            isCurrent: analysis.sourceUpdatedAt === activity.updatedAt,
          }
        : failure || latestJob
          ? {
              activityId: activity.id,
              updatedAt: latestJob?.updatedAt || failure?.updatedAt || null,
              selectedScenarioId: latestJob?.selectedScenarioId || null,
              selectedScenarioName: latestJob?.selectedScenarioName || "",
              state: analysisState,
              isCurrent: true,
              overview: null,
              scriptAnalysis: null,
              tokenUsage: null,
            }
          : null,
    ),
  };
}

async function buildDashboardChartsResponse() {
  const [rawActivities, analysisStore, managers] = await Promise.all([
    getRawActivitiesSnapshot(),
    readAnalysisStore(),
    listManagers(),
  ]);
  const managersById = new Map(managers.map((manager) => [manager.id, manager]));
  const analysesByActivityId = buildLatestRecordsMap(analysisStore.analyses, (analysis) => analysis.activityId);
  const failuresByActivityId = buildLatestRecordsMap(
    analysisStore.failures || [],
    (failure) => failure.activityId,
  );
  const jobsByActivityId = buildLatestJobMap(analysisStore.jobs || []);
  const statusBreakdown = buildCallStatusBreakdownFromActivities(
    rawActivities,
    analysesByActivityId,
    failuresByActivityId,
    jobsByActivityId,
  );
  const pendingCalls = Number(statusBreakdown.find((item) => item.key === "pending")?.count || 0);
  const queuedCalls = Number(statusBreakdown.find((item) => item.key === "queued")?.count || 0);
  const dashboardCalls = rawActivities.map((activity) =>
    buildDashboardCallSnapshotFromActivity(activity, managersById, analysesByActivityId, failuresByActivityId, jobsByActivityId),
  );

  return {
    summary: {
      ...summarizeAnalysesFromCalls(dashboardCalls),
      totalCalls: dashboardCalls.length,
      pendingCalls,
      awaitingAnalysisCalls: pendingCalls + queuedCalls,
      statusBreakdown,
    },
    statusBreakdown,
    charts: buildDashboardChartsSnapshot(dashboardCalls),
  };
}

function callSortTimestamp(call = {}) {
  return new Date(call.startTime || call.createdAt || 0).getTime();
}

function compareCallsForReport(left = {}, right = {}) {
  return callSortTimestamp(right) - callSortTimestamp(left) || Number(right.id || 0) - Number(left.id || 0);
}

function encodeCallsCursor(call) {
  if (!call) return "";
  return Buffer.from(
    JSON.stringify({
      startTime: String(call.startTime || call.createdAt || ""),
      id: String(call.id || ""),
    }),
    "utf8",
  ).toString("base64url");
}

function decodeCallsCursor(cursor) {
  if (!cursor) return null;
  try {
    const payload = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
    if (!payload?.startTime || !payload?.id) return null;
    return {
      startTime: String(payload.startTime),
      id: String(payload.id),
    };
  } catch {
    return null;
  }
}

function findCallsCursorStartIndex(calls, cursor) {
  if (!cursor) return 0;
  const cursorTime = new Date(cursor.startTime || 0).getTime();
  const cursorId = Number(cursor.id || 0);
  const index = calls.findIndex((call) => {
    const time = callSortTimestamp(call);
    const id = Number(call.id || 0);
    return cursorTime - time > 0 || (cursorTime === time && cursorId - id > 0);
  });
  return index >= 0 ? index : calls.length;
}

function buildAnalysisSignature({
  sourceUpdatedAt,
  selectedScenarioId,
  scriptChecklist,
  customMetrics,
}) {
  return JSON.stringify({
    sourceUpdatedAt,
    scenarioId: selectedScenarioId || null,
    scriptChecklist: String(scriptChecklist || "").trim(),
    customMetrics: Array.isArray(customMetrics) ? customMetrics : [],
    transcriptionModel: AI_TRANSCRIPTION_MODEL,
    chatModel: AI_CHAT_MODEL,
  });
}

function findReusableAnalysis(analyses = [], activityId, signature) {
  return (analyses || []).find(
    (item) =>
      String(item.activityId) === String(activityId) &&
      item.signature === signature &&
      analysisHasMeaningfulContent(item) &&
      (Number(item?.tokenUsage?.analysisTotalTokens || 0) > 0 || !item?.tokenUsage),
  ) || null;
}

function countActiveAutoJobs(jobs = []) {
  return (jobs || []).filter(
    (job) =>
      String(job.source || "") === "auto" &&
      ACTIVE_ANALYSIS_JOB_STATUSES.has(String(job.status || "")),
  ).length;
}

async function cancelQueuedAutoJobs() {
  return mutateAnalysisStore(async (store) => {
    const jobs = Array.isArray(store.jobs) ? store.jobs : [];
    const beforeCount = jobs.length;
    store.jobs = jobs.filter(
      (job) => !(String(job.source || "") === "auto" && String(job.status || "") === "queued"),
    );
    return { removed: beforeCount - store.jobs.length };
  });
}

function deriveAnalysisResultState(analysis = {}) {
  const structuredErrorMessage = String(analysis?.processingNotes?.structuredAnalysisErrorMessage || "").trim();
  const localizationErrorMessage = String(analysis?.processingNotes?.localizationErrorMessage || "").trim();
  const localizationPending = Boolean(analysis?.processingNotes?.localizationPending);
  const hasStructuredContent = analysisHasMeaningfulContent(analysis);
  if (analysis?.transcriptText && !hasStructuredContent && (structuredErrorMessage || localizationErrorMessage || localizationPending)) {
    return "outdated";
  }
  if (hasStructuredContent) return "ready";
  if (analysis?.transcriptText) return "partial";
  return "technical";
}

function updateJobRecord(job, patch = {}) {
  return {
    ...job,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

function isStaleActiveJob(job) {
  const status = String(job?.status || "");
  if (!ACTIVE_ANALYSIS_JOB_STATUSES.has(status)) return false;
  const referenceTime = new Date(job?.startedAt || job?.updatedAt || job?.createdAt || 0).getTime();
  if (!Number.isFinite(referenceTime) || referenceTime <= 0) return false;
  return Date.now() - referenceTime > ANALYSIS_ACTIVE_JOB_STALE_MS;
}

async function cleanupStaleActiveJobsLegacy() {
  return mutateAnalysisStore(async (store) => {
    let updated = 0;
    store.jobs = (store.jobs || []).map((job) => {
      if (!isStaleActiveJob(job)) return job;
      updated += 1;
      return updateJobRecord(job, {
        status: "error",
        finishedAt: new Date().toISOString(),
        errorMessage:
          job.status === "processing"
            ? "Фоновая обработка была остановлена по таймауту. Запустите анализ повторно."
            : "Задача анализа слишком долго оставалась в очереди и была сброшена. Запустите анализ повторно.",
      });
    });
    return { updated };
  });
}

async function cleanupStaleActiveJobs() {
  if (staleJobsCleanupInFlight) return staleJobsCleanupInFlight;
  if (Date.now() - staleJobsCleanupCheckedAt < STALE_JOBS_CLEANUP_INTERVAL_MS) {
    return { updated: 0, skipped: true };
  }

  staleJobsCleanupInFlight = (async () => {
    try {
      const store = await readAnalysisStore();
      const staleJobIds = new Set(
        (store.jobs || []).filter((job) => isStaleActiveJob(job)).map((job) => String(job.id)),
      );

      staleJobsCleanupCheckedAt = Date.now();
      if (!staleJobIds.size) {
        return { updated: 0, skipped: true };
      }

      return mutateAnalysisStore(async (draft) => {
        let updated = 0;
        draft.jobs = (draft.jobs || []).map((job) => {
          if (!staleJobIds.has(String(job.id))) return job;
          updated += 1;
          return updateJobRecord(job, {
            status: "error",
            finishedAt: new Date().toISOString(),
            errorMessage:
              job.status === "processing"
                ? "Р¤РѕРЅРѕРІР°СЏ РѕР±СЂР°Р±РѕС‚РєР° Р±С‹Р»Р° РѕСЃС‚Р°РЅРѕРІР»РµРЅР° РїРѕ С‚Р°Р№РјР°СѓС‚Сѓ. Р—Р°РїСѓСЃС‚РёС‚Рµ Р°РЅР°Р»РёР· РїРѕРІС‚РѕСЂРЅРѕ."
                : "Р—Р°РґР°С‡Р° Р°РЅР°Р»РёР·Р° СЃР»РёС€РєРѕРј РґРѕР»РіРѕ РѕСЃС‚Р°РІР°Р»Р°СЃСЊ РІ РѕС‡РµСЂРµРґРё Рё Р±С‹Р»Р° СЃР±СЂРѕС€РµРЅР°. Р—Р°РїСѓСЃС‚РёС‚Рµ Р°РЅР°Р»РёР· РїРѕРІС‚РѕСЂРЅРѕ.",
          });
        });
        return { updated };
      });
    } finally {
      staleJobsCleanupInFlight = null;
    }
  })();

  return staleJobsCleanupInFlight;
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

function normalizeFreeTextValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  const map = {
    sale: "Продажа",
    success: "Успех",
    successful_sale: "Успешная продажа",
    sale_completed: "Продажа завершена",
    deal_closed: "Сделка закрыта",
    follow_up: "Нужен повторный контакт",
    "follow-up": "Нужен повторный контакт",
    followup: "Нужен повторный контакт",
    follow_up_needed: "Нужен повторный контакт",
    callback: "Перезвон",
    call_back: "Перезвон",
    consultation: "Консультация",
    consult: "Консультация",
    no_answer: "Не удалось связаться",
    no_response: "Не удалось связаться",
    unreachable: "Не удалось связаться",
    objection: "Есть возражения",
    price_objection: "Возражение по цене",
    price_concern: "Возражение по цене",
    interested: "Заинтересован",
    not_interested: "Не заинтересован",
    qualified_lead: "Квалифицированный лид",
    unqualified_lead: "Неквалифицированный лид",
    voicemail: "Оставлено голосовое сообщение",
    needs_follow_up: "Требуется повторный контакт",
    pending_decision: "Клиенту нужно время на решение",
    wrong_number: "Неверный номер",
    technical_issue: "Техническая проблема",
    issue_resolved: "Вопрос решён",
    needs_manager_follow_up: "Нужен повторный контакт менеджера",
    client_requests_proposal: "Клиент ожидает предложение",
    client_needs_information: "Клиенту нужна дополнительная информация",
    warm_lead: "Тёплый лид",
    cold_lead: "Холодный лид",
  };

  return map[normalized.toLowerCase()] || normalized;
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

function extractJsonObject(text) {
  const source = String(text || "").trim();
  if (!source) return {};

  const fencedMatch = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : source;

  try {
    return JSON.parse(candidate);
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("AI returned invalid JSON payload");
  }
}

function extractCompletionContent(payload) {
  const completion = payload?.data || payload || {};
  const message = completion?.choices?.[0]?.message || {};
  const messageContent = message?.content;
  const parsedContent = message?.parsed || completion?.parsed || payload?.parsed || null;

  if (parsedContent && typeof parsedContent === "object") {
    return { completion, content: JSON.stringify(parsedContent) };
  }

  if (typeof messageContent === "string") {
    return { completion, content: messageContent };
  }

  if (messageContent && typeof messageContent === "object" && !Array.isArray(messageContent)) {
    return { completion, content: JSON.stringify(messageContent) };
  }

  if (Array.isArray(messageContent)) {
    const text = messageContent
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.type === "text") return item.text || "";
        if (item?.text && typeof item.text === "object") return JSON.stringify(item.text);
        return "";
      })
      .join("")
      .trim();
    return { completion, content: text };
  }

  return { completion, content: "{}" };
}

function normalizeAnalysisResult(raw = {}) {
  const source = raw.analysis || raw.result || raw.data || raw;
  const overview = source.overview || source.callOverview || source.call_overview || {};
  const scriptAnalysis =
    source.scriptAnalysis || source.script_analysis || source.scenarioAnalysis || source.scenario_analysis || {};
  const recommendations = source.recommendations || source.advice || source.suggestions || [];
  const customMetrics = source.customMetrics || source.custom_metrics || source.metrics || [];

  return {
    overview: {
      sentiment: normalizeSentiment(overview.sentiment),
      callOutcome: normalizeFreeTextValue(overview.callOutcome || overview.outcome || ""),
      clientNeed: normalizeFreeTextValue(overview.clientNeed || ""),
      riskLevel: normalizeRiskLevel(overview.riskLevel),
    },
    summary: normalizeFreeTextValue(source.summary || source.resume || source.overallSummary || ""),
    recommendations: Array.isArray(recommendations)
      ? recommendations.map((item) => normalizeFreeTextValue(item)).filter(Boolean)
      : [],
    scriptAnalysis: {
      overallScore: Number.isFinite(Number(scriptAnalysis.overallScore)) ? Number(scriptAnalysis.overallScore) : null,
      compliancePercent: Number.isFinite(Number(scriptAnalysis.compliancePercent))
        ? Number(scriptAnalysis.compliancePercent)
        : null,
      strengths: Array.isArray(scriptAnalysis.strengths)
        ? scriptAnalysis.strengths.map((item) => normalizeFreeTextValue(item)).filter(Boolean)
        : [],
      violations: Array.isArray(scriptAnalysis.violations)
        ? scriptAnalysis.violations.map((item) => normalizeFreeTextValue(item)).filter(Boolean)
        : [],
      checkpoints: Array.isArray(scriptAnalysis.checkpoints)
        ? scriptAnalysis.checkpoints.map((item) => ({
            name: normalizeFreeTextValue(item?.name || ""),
            status: normalizeCheckpointStatus(item?.status),
            comment: normalizeFreeTextValue(item?.comment || ""),
          }))
        : [],
    },
    customMetrics: Array.isArray(customMetrics)
      ? customMetrics.map((item) => ({
          name: normalizeFreeTextValue(item?.name || ""),
          score: Number.isFinite(Number(item?.score)) ? Number(item.score) : null,
          status: normalizeCheckpointStatus(item?.status),
          comment: normalizeFreeTextValue(item?.comment || ""),
        }))
      : [],
    nextStep: normalizeFreeTextValue(source.nextStep || source.next_step || source.followUpAction || ""),
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

function extractStructuredAnalysisTexts(analysis = {}) {
  return [
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
}

function analysisNeedsRussianLocalization(analysis) {
  return extractStructuredAnalysisTexts(analysis).some((item) => containsMeaningfulLatin(item));
}

function emptyStructuredAnalysis() {
  return {
    overview: {
      sentiment: "",
      callOutcome: "",
      clientNeed: "",
      riskLevel: "",
    },
    summary: "",
    recommendations: [],
    scriptAnalysis: {
      overallScore: null,
      compliancePercent: null,
      strengths: [],
      violations: [],
      checkpoints: [],
    },
    customMetrics: [],
    nextStep: "",
  };
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

  const { content } = extractCompletionContent(payload);
  return normalizeAnalysisResult(extractJsonObject(content));
}

async function ensureRussianStructuredAnalysis(analysis, { maxAttempts = 2 } = {}) {
  let normalized = normalizeAnalysisResult(analysis);
  let localizationAttempts = 0;
  let localizationErrorMessage = "";

  while (analysisNeedsRussianLocalization(normalized) && localizationAttempts < maxAttempts) {
    localizationAttempts += 1;
    try {
      normalized = await localizeAnalysisToRussian(normalized);
    } catch (error) {
      localizationErrorMessage = String(error?.message || "Не удалось локализовать analysis на русский язык");
      break;
    }
  }

  return {
    analysis: normalized,
    localizationAttempts,
    localizationErrorMessage,
    localizationPending: analysisNeedsRussianLocalization(normalized),
  };
}

function analysisLocalizationRepairKey(record = {}) {
  return `${String(record.activityId || "")}:${String(record.signature || "")}`;
}

async function repairStoredAnalysisLocalization(record) {
  if (!record || !analysisNeedsRussianLocalization(record)) return record;

  const repairKey = analysisLocalizationRepairKey(record);
  const cooldownUntil = Number(analysisLocalizationRepairCooldown.get(repairKey) || 0);
  if (cooldownUntil > Date.now()) return record;
  if (analysisLocalizationRepairInFlight.has(repairKey)) {
    return analysisLocalizationRepairInFlight.get(repairKey);
  }

  const repairPromise = (async () => {
    const localization = await ensureRussianStructuredAnalysis(record, { maxAttempts: 2 });
    if (localization.localizationPending) {
      analysisLocalizationRepairCooldown.set(repairKey, Date.now() + 10 * 60 * 1000);
      return record;
    }

    const repairedRecord = {
      ...record,
      ...localization.analysis,
      updatedAt: new Date().toISOString(),
      processingNotes: {
        ...(record.processingNotes || {}),
        localizationRepairApplied: localization.localizationAttempts > 0,
        localizationAttempts: localization.localizationAttempts,
        localizationErrorMessage: localization.localizationErrorMessage || "",
        localizationPending: false,
      },
    };

    await upsertAnalysisRecord(repairedRecord);
    analysisLocalizationRepairCooldown.delete(repairKey);
    return repairedRecord;
  })()
    .catch((error) => {
      analysisLocalizationRepairCooldown.set(repairKey, Date.now() + 10 * 60 * 1000);
      console.warn("Failed to repair stored analysis localization", error);
      return record;
    })
    .finally(() => {
      analysisLocalizationRepairInFlight.delete(repairKey);
    });

  analysisLocalizationRepairInFlight.set(repairKey, repairPromise);
  return repairPromise;
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

async function upsertAnalysisRecord(record) {
  await mutateAnalysisStore(async (store) => {
    store.analyses = (store.analyses || []).filter(
      (item) => !(String(item.activityId) === String(record.activityId) && item.signature === record.signature),
    );
    store.failures = (store.failures || []).filter(
      (item) => !(String(item.activityId) === String(record.activityId) && item.signature === record.signature),
    );
    store.analyses.unshift(record);
  });
}

async function saveAnalysisFailure(_store, call, signature, error, stage) {
  await mutateAnalysisStore(async (store) => {
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
  });
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

async function fetchWithTimeout(url, options = {}, timeoutMs = VIBE_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
      timeoutError.statusCode = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function extractUserPosition(user = {}) {
  const directCandidates = [
    user.workPosition,
    user.WORK_POSITION,
    user.work_position,
    user.position,
  ];

  for (const value of directCandidates) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }

  const customPositionEntry = Object.entries(user).find(([key, value]) => {
    if (!/position|долж/i.test(String(key || ""))) return false;
    return typeof value === "string" && value.trim();
  });

  return customPositionEntry ? String(customPositionEntry[1]).trim() : "";
}

async function vibeJson(pathname, options = {}) {
  requireConfig();
  const response = await fetchWithTimeout(`${VIBE_API_URL}${pathname}`, {
    ...options,
    headers: vibeHeaders({
      "Content-Type": "application/json",
      ...(options.headers || {}),
    }),
  }, VIBE_REQUEST_TIMEOUT_MS);

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

async function searchActivities(filter, limit, offset) {
  requireConfig();
  const response = await fetchWithTimeout(`${VIBE_API_URL}/v1/activities/search`, {
    method: "POST",
    headers: vibeHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ filter, limit, offset }),
  }, VIBE_REQUEST_TIMEOUT_MS);

  const text = await response.text();
  const payload = parseJsonSafely(text, "Vibe API /v1/activities/search");
  if (!response.ok) {
    const error = new Error(payload?.error?.message || payload?.message || "Activities search failed");
    error.statusCode = response.status || 502;
    error.payload = payload;
    throw error;
  }
  if (payload.success === false) {
    const error = new Error(payload?.error?.message || payload?.message || "Activities search failed");
    error.statusCode = 502;
    error.payload = payload;
    throw error;
  }
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
}

function uniqueActivities(items = []) {
  const map = new Map();
  for (const item of items) {
    if (!item?.id || map.has(String(item.id))) continue;
    map.set(String(item.id), item);
  }
  return Array.from(map.values()).sort(
    (left, right) => new Date(right.startTime || right.createdAt || 0) - new Date(left.startTime || left.createdAt || 0),
  );
}

function activitiesFingerprint(items = []) {
  let fingerprint = `${items.length}`;
  for (const item of items) {
    fingerprint += `|${String(item?.id || "")}:${String(item?.updatedAt || item?.startTime || item?.createdAt || "")}`;
  }
  return fingerprint;
}

async function searchActivitiesByManagers(baseFilter, managerIds, limit, offset) {
  const ids = Array.from(
    new Set(
      (managerIds || [])
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0),
    ),
  );
  if (!ids.length) return [];

  const perManagerLimit = Math.max(50, Math.min(limit + offset, 200));
  const responses = await Promise.all(
    ids.map((managerId) =>
      searchActivities(
        {
          ...baseFilter,
          responsibleId: managerId,
        },
        perManagerLimit,
        0,
      ),
    ),
  );

  return uniqueActivities(responses.flat()).slice(offset, offset + limit);
}

async function listManagers() {
  if (managersCache.data && Date.now() < managersCache.expiresAt) {
    return managersCache.data;
  }
  const payload = await vibeJson("/v1/users?limit=500");
  const managers = payload.data
    .filter((user) => user.active)
    .map((user) => ({
      id: user.id,
      fullName: [user.lastName, user.name, user.secondName].filter(Boolean).join(" ").trim(),
      position: extractUserPosition(user),
      departmentIds: user.departmentId || [],
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "ru"));
  managersCache = {
    data: managers,
    expiresAt: Date.now() + MANAGERS_CACHE_TTL_MS,
  };
  return managers;
}

function buildCallFilter(query) {
  const filter = { typeId: 2 };
  const managerIds = String(query.managerIds || query.managerId || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
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
  return { filter, managerIds, directions };
}

function applyClientSideCallFilters(calls, query) {
  const managerIds = String(query.managerIds || query.managerId || "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
  const directions = String(query.directions || query.direction || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const analysisStates = String(query.analysisStates || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const scenarioIds = String(query.scenarioIds || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  let filtered = calls;
  if (query.dateFrom) {
    const from = new Date(`${query.dateFrom}T00:00:00`).getTime();
    if (Number.isFinite(from)) {
      filtered = filtered.filter((call) => {
        const start = new Date(call.startTime || 0).getTime();
        return Number.isFinite(start) && start >= from;
      });
    }
  }
  if (query.dateTo) {
    const to = new Date(`${query.dateTo}T23:59:59`).getTime();
    if (Number.isFinite(to)) {
      filtered = filtered.filter((call) => {
        const start = new Date(call.startTime || 0).getTime();
        return Number.isFinite(start) && start <= to;
      });
    }
  }
  if (managerIds.length) {
    filtered = filtered.filter((call) => managerIds.includes(Number(call.managerId)));
  }
  if (directions.length) {
    filtered = filtered.filter((call) => directions.includes(String(call.direction)));
  }
  if (analysisStates.length) {
    filtered = filtered.filter((call) => {
      const state = !call.hasRecording ? "missing" : String(call.analysis?.state || "pending");
      if (analysisStates.includes(state)) return true;
      if (state === "technical" && analysisStates.includes("partial")) return true;
      return false;
    });
  }
  if (scenarioIds.length) {
    filtered = filtered.filter((call) => scenarioIds.includes(String(call.analysis?.selectedScenarioId || "")));
  }
  return filtered;
}

function activitySnapshotAgeMs() {
  return activitySnapshotCache.updatedAt > 0 ? Date.now() - activitySnapshotCache.updatedAt : Number.POSITIVE_INFINITY;
}

async function ensureActivitySnapshotLoaded() {
  if (activitySnapshotCache.loaded) return;
  const persisted = await readActivitySnapshotCache();
  const activities = Array.isArray(persisted?.activities) ? persisted.activities : [];
  activitySnapshotCache = {
    loaded: true,
    updatedAt: persisted?.updatedAt ? new Date(persisted.updatedAt).getTime() : 0,
    activities,
    fingerprint: activitiesFingerprint(activities),
  };
}

async function refreshActivitySnapshotCache(options = {}) {
  const force = Boolean(options.force);
  if (activitySnapshotRefreshInFlight && !force) {
    return activitySnapshotRefreshInFlight;
  }

  const refreshPromise = (async () => {
    const managers = await listManagers();
    let rawActivities = await searchActivities({ typeId: 2 }, ACTIVITY_SNAPSHOT_REMOTE_LIMIT, 0);
    if (!rawActivities.length && managers.length) {
      rawActivities = await searchActivitiesByManagers(
        { typeId: 2 },
        managers.map((manager) => manager.id),
        ACTIVITY_SNAPSHOT_REMOTE_LIMIT,
        0,
      );
    }
    const unique = uniqueActivities(rawActivities).slice(0, ACTIVITY_SNAPSHOT_REMOTE_LIMIT);
    const nextFingerprint = activitiesFingerprint(unique);
    const previousFingerprint = String(activitySnapshotCache.fingerprint || "");
    const persisted = await writeActivitySnapshotCache({ activities: unique });
    activitySnapshotCache = {
      loaded: true,
      updatedAt: persisted?.updatedAt ? new Date(persisted.updatedAt).getTime() : Date.now(),
      activities: unique,
      fingerprint: nextFingerprint,
    };
    if (nextFingerprint !== previousFingerprint) {
      invalidateFilteredCallsCache();
    }
    return unique;
  })().finally(() => {
    activitySnapshotRefreshInFlight = null;
  });

  activitySnapshotRefreshInFlight = refreshPromise;
  return refreshPromise;
}

function refreshActivitySnapshotInBackground() {
  if (activitySnapshotRefreshInFlight) return;
  refreshActivitySnapshotCache().catch((error) => {
    console.error("Failed to refresh activity snapshot cache", error);
  });
}

async function getRawActivitiesSnapshot() {
  await ensureActivitySnapshotLoaded();

  if (!activitySnapshotCache.activities.length) {
    return refreshActivitySnapshotCache({ force: true });
  }

  const ageMs = activitySnapshotAgeMs();
  if (ageMs <= ACTIVITY_SNAPSHOT_FRESH_MS) {
    return activitySnapshotCache.activities;
  }

  if (ageMs <= ACTIVITY_SNAPSHOT_MAX_STALE_MS) {
    refreshActivitySnapshotInBackground();
    return activitySnapshotCache.activities;
  }

  try {
    return await refreshActivitySnapshotCache({ force: true });
  } catch (error) {
    console.warn("Using stale activity snapshot cache after refresh failure", error);
    return activitySnapshotCache.activities;
  }
}

function matchesSummaryFilters(item, query) {
  const managerIds = String(query.managerIds || query.managerId || "")
    .split(",")
    .map((value) => Number(String(value).trim()))
    .filter((value) => Number.isFinite(value) && value > 0)
    .map((value) => String(value));
  const directions = String(query.directions || query.direction || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const analysisStates = String(query.analysisStates || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const scenarioIds = String(query.scenarioIds || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (managerIds.length && !managerIds.includes(String(item.managerId))) return false;
  if (directions.length && !directions.includes(String(item.direction))) return false;
  if (scenarioIds.length && !scenarioIds.includes(String(item.selectedScenarioId || ""))) return false;
  if (analysisStates.length) {
    const inferredState = deriveAnalysisResultState(item);
    if (!analysisStates.includes(inferredState) && !(inferredState === "technical" && analysisStates.includes("partial"))) {
      return false;
    }
  }
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

function extractPhoneNumber(text) {
  const match = String(text || "").match(/(\+?\d[\d\s\-()]{8,}\d)/);
  return match ? match[1].replace(/[^\d+]/g, "") : "";
}

function normalizePersonLikeName(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\+?\d[\d\s\-()]+$/.test(text)) return "";
  if (/^(incoming|outgoing|входящий|исходящий)$/i.test(text)) return "";
  return text;
}

function extractClientName(activity = {}) {
  const directCandidates = [
    activity.clientName,
    activity.CLIENT_NAME,
    activity.contactName,
    activity.CONTACT_NAME,
    activity.companyName,
    activity.COMPANY_NAME,
    activity.ownerName,
    activity.OWNER_NAME,
    activity.ownerTitle,
    activity.OWNER_TITLE,
  ];

  for (const candidate of directCandidates) {
    const normalized = normalizePersonLikeName(candidate);
    if (normalized) return normalized;
  }

  const communicationCollections = [
    activity.communications,
    activity.COMMUNICATIONS,
    activity.communication,
    activity.COMMUNICATION,
  ];

  for (const collection of communicationCollections) {
    if (!Array.isArray(collection)) continue;
    for (const item of collection) {
      const candidates = [
        item?.name,
        item?.NAME,
        item?.title,
        item?.TITLE,
        item?.entityTitle,
        item?.ENTITY_TITLE,
      ];
      for (const candidate of candidates) {
        const normalized = normalizePersonLikeName(candidate);
        if (normalized) return normalized;
      }
    }
  }

  return "";
}

function ownerTypeLabel(ownerTypeId) {
  const mapping = {
    1: "Лид",
    2: "Сделка",
    3: "Контакт",
    4: "Компания",
    31: "Смарт-процесс",
  };
  return mapping[Number(ownerTypeId)] || `CRM ${ownerTypeId || "—"}`;
}

function buildCrmEntityUrl(ownerTypeId, ownerId) {
  const safeId = Number(ownerId || 0);
  if (!safeId) return "";

  switch (Number(ownerTypeId)) {
    case 1:
      return `${BITRIX_PORTAL_URL}/crm/lead/details/${safeId}/`;
    case 2:
      return `${BITRIX_PORTAL_URL}/crm/deal/details/${safeId}/`;
    case 3:
      return `${BITRIX_PORTAL_URL}/crm/contact/details/${safeId}/`;
    case 4:
      return `${BITRIX_PORTAL_URL}/crm/company/details/${safeId}/`;
    default:
      return "";
  }
}

function composeContactName(contact = {}) {
  return [contact.lastName, contact.name, contact.secondName]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim() || normalizePersonLikeName(contact.fullName) || normalizePersonLikeName(contact.shortName) || "";
}

function composeCompanyName(company = {}) {
  return (
    normalizePersonLikeName(company.title) ||
    normalizePersonLikeName(company.companyTitle) ||
    normalizePersonLikeName(company.name) ||
    ""
  );
}

function composeLeadName(lead = {}) {
  return (
    normalizePersonLikeName(lead.title) ||
    [lead.lastName, lead.name, lead.secondName]
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .join(" ")
      .trim()
  );
}

async function readCrmEntityCached(cacheKey, loader) {
  if (crmEntityCache.has(cacheKey)) {
    return crmEntityCache.get(cacheKey);
  }
  const promise = loader()
    .catch(() => null);
  crmEntityCache.set(cacheKey, promise);
  return promise;
}

async function resolveClientNameForCall(call) {
  if (call.clientName) return call.clientName;

  const ownerTypeId = Number(call.ownerTypeId || 0);
  const ownerId = Number(call.ownerId || 0);
  if (!ownerTypeId || !ownerId) return "";

  if (ownerTypeId === 3) {
    const contact = await readCrmEntityCached(`contact:${ownerId}`, async () => {
      const payload = await vibeJson(`/v1/contacts/${ownerId}`);
      return payload?.data || null;
    });
    return composeContactName(contact || {});
  }

  if (ownerTypeId === 4) {
    const company = await readCrmEntityCached(`company:${ownerId}`, async () => {
      const payload = await vibeJson(`/v1/companies/${ownerId}`);
      return payload?.data || null;
    });
    return composeCompanyName(company || {});
  }

  if (ownerTypeId === 1) {
    const lead = await readCrmEntityCached(`lead:${ownerId}`, async () => {
      const payload = await vibeJson(`/v1/leads/${ownerId}`);
      return payload?.data || null;
    });
    return composeLeadName(lead || {});
  }

  if (ownerTypeId === 2) {
    const deal = await readCrmEntityCached(`deal:${ownerId}`, async () => {
      const payload = await vibeJson(`/v1/deals/${ownerId}`);
      return payload?.data || null;
    });
    if (!deal) return "";

    const contactId = Number(deal.contactId || 0);
    if (contactId) {
      const contact = await readCrmEntityCached(`contact:${contactId}`, async () => {
        const payload = await vibeJson(`/v1/contacts/${contactId}`);
        return payload?.data || null;
      });
      const contactName = composeContactName(contact || {});
      if (contactName) return contactName;
    }

    const companyId = Number(deal.companyId || 0);
    if (companyId) {
      const company = await readCrmEntityCached(`company:${companyId}`, async () => {
        const payload = await vibeJson(`/v1/companies/${companyId}`);
        return payload?.data || null;
      });
      const companyName = composeCompanyName(company || {});
      if (companyName) return companyName;
    }

    return normalizePersonLikeName(deal.title) || "";
  }

  return "";
}

function crmClientCacheKey(ownerTypeId, ownerId) {
  return `${Number(ownerTypeId || 0)}:${Number(ownerId || 0)}`;
}

async function hydrateCachedClientNames(calls = []) {
  const unresolved = calls.filter(
    (call) => !call.clientName && Number(call.ownerTypeId || 0) > 0 && Number(call.ownerId || 0) > 0,
  );
  if (!unresolved.length) return;

  const persisted = await readCrmClientCache(
    unresolved.map((call) => ({
      ownerTypeId: call.ownerTypeId,
      ownerId: call.ownerId,
    })),
  );

  for (const call of unresolved) {
    const key = crmClientCacheKey(call.ownerTypeId, call.ownerId);
    const memoryValue = crmEntityCache.get(`client-name:${key}`);
    const persistedValue = persisted.get(key);
    const cachedName =
      (typeof memoryValue === "string" && memoryValue.trim()) ||
      (persistedValue?.clientName ? String(persistedValue.clientName).trim() : "");
    if (cachedName) {
      call.clientName = cachedName;
      crmEntityCache.set(`client-name:${key}`, cachedName);
    }
  }
}

function warmClientNamesInBackground(calls = []) {
  const missing = calls
    .filter((call) => !call.clientName && Number(call.ownerTypeId || 0) > 0 && Number(call.ownerId || 0) > 0)
    .slice(0, 20);

  for (const call of missing) {
    const key = crmClientCacheKey(call.ownerTypeId, call.ownerId);
    if (crmClientWarmupInFlight.has(key)) continue;
    crmClientWarmupInFlight.add(key);

    void (async () => {
      try {
        const clientName = (await resolveClientNameForCall(call)) || "";
        if (!clientName) return;
        crmEntityCache.set(`client-name:${key}`, clientName);
        await upsertCrmClientCache({
          ownerTypeId: call.ownerTypeId,
          ownerId: call.ownerId,
          clientName,
        });
      } catch {
        // Ignore best-effort CRM cache warmup failures.
      } finally {
        crmClientWarmupInFlight.delete(key);
      }
    })();
  }
}

function normalizeCall(activity, managersById, analysis, failure, latestJob = null) {
  const manager = managersById.get(activity.responsibleId) || null;
  const rawFiles = activity?.FILES ?? activity?.files ?? activity?.recordings ?? [];
  const files = Array.isArray(rawFiles) ? rawFiles : [];
  const start = activity.startTime || activity.createdAt;
  const end = activity.endTime || activity.updatedAt || start;
  const durationSeconds = Math.max(0, Math.round((new Date(end) - new Date(start)) / 1000));

  const isFailureCurrent = Boolean(
    failure &&
      (!analysis || new Date(failure.updatedAt || 0).getTime() >= new Date(analysis.updatedAt || 0).getTime()),
  );

  const jobStatus = String(latestJob?.status || "");
  const isJobActive = ACTIVE_ANALYSIS_JOB_STATUSES.has(jobStatus);
  const isJobError = jobStatus === "error";

  const analysisState = isJobActive
    ? jobStatus
    : isFailureCurrent || isJobError
      ? "error"
      : !analysis
        ? "pending"
        : analysis.sourceUpdatedAt !== activity.updatedAt
          ? "outdated"
          : deriveAnalysisResultState(analysis);
  return {
    id: activity.id,
    subject: activity.subject,
    clientPhone: extractPhoneNumber(activity.subject || ""),
    clientName: extractClientName(activity),
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
    ownerTypeLabel: ownerTypeLabel(activity.ownerTypeId),
    crmEntityUrl: buildCrmEntityUrl(activity.ownerTypeId, activity.ownerId),
    missedCall: Boolean(activity.SETTINGS?.MISSED_CALL),
    hasRecording: files.length > 0,
    recordingFileId: files[0]?.id || null,
    recordingUrl: files.length > 0 ? `/api/calls/${activity.id}/recording` : "",
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
          processingNotes: analysis.processingNotes || null,
          ownerId: activity.ownerId,
          ownerTypeId: activity.ownerTypeId,
          ownerTypeLabel: ownerTypeLabel(activity.ownerTypeId),
          crmEntityUrl: buildCrmEntityUrl(activity.ownerTypeId, activity.ownerId),
          hasRecording: files.length > 0,
          recordingFileId: files[0]?.id || null,
          recordingUrl: files.length > 0 ? `/api/calls/${activity.id}/recording` : "",
          selectedScenarioId: latestJob?.selectedScenarioId || analysis.selectedScenarioId || null,
          selectedScenarioName: latestJob?.selectedScenarioName || analysis.selectedScenarioName || "",
          errorMessage: isFailureCurrent ? failure.errorMessage : isJobError ? latestJob?.errorMessage || "" : "",
          state: analysisState,
          isCurrent: analysis.sourceUpdatedAt === activity.updatedAt,
          jobId: latestJob?.id || null,
        }
      : failure || latestJob
        ? {
            activityId: activity.id,
            updatedAt: latestJob?.updatedAt || failure?.updatedAt || null,
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
            ownerId: activity.ownerId,
            ownerTypeId: activity.ownerTypeId,
            ownerTypeLabel: ownerTypeLabel(activity.ownerTypeId),
            crmEntityUrl: buildCrmEntityUrl(activity.ownerTypeId, activity.ownerId),
            hasRecording: files.length > 0,
            recordingFileId: files[0]?.id || null,
            recordingUrl: files.length > 0 ? `/api/calls/${activity.id}/recording` : "",
            selectedScenarioId: latestJob?.selectedScenarioId || null,
            selectedScenarioName: latestJob?.selectedScenarioName || "",
            errorMessage: latestJob?.errorMessage || failure?.errorMessage || "",
            state: analysisState,
            isCurrent: true,
            jobId: latestJob?.id || null,
          }
        : null,
  };
}

async function fetchCalls(query) {
  await cleanupStaleActiveJobs();
  const requestedPageSize = Number(query.pageSize || query.limit || 50);
  const pageSize = Math.max(1, Math.min(requestedPageSize || 50, 200));
  const cursor = decodeCallsCursor(query.cursor);
  const useCursorPaging = Boolean(cursor);
  const explicitOffset = Math.max(0, Number(query.offset || 0));
  const requestedPage = Math.max(1, Number(query.page || 1));
  const page = useCursorPaging ? requestedPage : explicitOffset > 0 ? Math.floor(explicitOffset / pageSize) + 1 : requestedPage;
  const offset = useCursorPaging ? 0 : explicitOffset > 0 ? explicitOffset : (page - 1) * pageSize;
  const snapshot = await buildCallsSnapshot(query);

  const total = snapshot.calls.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cursorStartIndex = useCursorPaging ? findCallsCursorStartIndex(snapshot.calls, cursor) : offset;
  const pagedCalls = snapshot.calls.slice(cursorStartIndex, cursorStartIndex + pageSize);
  const nextCursor = pagedCalls.length === pageSize ? encodeCallsCursor(pagedCalls[pagedCalls.length - 1]) : "";

  await hydrateCachedClientNames(pagedCalls);
  warmClientNamesInBackground(pagedCalls);

  return {
    managers: snapshot.managers,
    calls: pagedCalls,
    statusBreakdown: snapshot.statusBreakdown,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: cursorStartIndex + pagedCalls.length < total,
    nextCursor,
  };
}

async function buildCallsSnapshot(query = {}) {
  const cacheKey = buildFilteredCallsCacheKey(query);
  const cachedEntry = filteredCallsCache.get(cacheKey);
  const hasFreshCache = cachedEntry && cachedEntry.expiresAt > Date.now();
  if (hasFreshCache) {
    return cachedEntry.snapshot;
  }
  if (filteredCallsSnapshotInFlight.has(cacheKey)) {
    return filteredCallsSnapshotInFlight.get(cacheKey);
  }

  const snapshotPromise = (async () => {
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
    const jobsByActivityId = buildLatestJobMap(analysisStore.jobs || []);
    const defaultScenario = getDefaultScenario(scenarioStore.scenarios || []);
    const rawActivities = await getRawActivitiesSnapshot();

    const candidateAnalyses = Array.from(
      new Set(
        rawActivities
          .map((activity) => String(activity.id || ""))
          .filter(Boolean),
      ),
    )
      .map((activityId) => analysesByActivityId.get(activityId))
      .filter((analysis) => analysis && analysisNeedsRussianLocalization(analysis));

    if (candidateAnalyses.length) {
      const repairedAnalyses = await Promise.all(
        candidateAnalyses.slice(0, 20).map((analysis) => repairStoredAnalysisLocalization(analysis)),
      );
      for (const repairedAnalysis of repairedAnalyses) {
        if (!repairedAnalysis) continue;
        analysesByActivityId.set(String(repairedAnalysis.activityId), repairedAnalysis);
      }
    }

    let calls = rawActivities.map((activity) => {
      const analysis = analysesByActivityId.get(String(activity.id));
      const failure = failuresByActivityId.get(String(activity.id));
      const latestJob = jobsByActivityId.get(String(activity.id));
      const normalizedCall = normalizeCall(activity, managersById, analysis, failure, latestJob);

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
    calls.sort(compareCallsForReport);

    const snapshot = {
      managers,
      calls,
      statusBreakdown: buildCallStatusBreakdown(calls),
    };
    filteredCallsCache.set(cacheKey, {
      expiresAt: Date.now() + FILTERED_CALLS_CACHE_TTL_MS,
      snapshot,
    });
    return snapshot;
  })();

  filteredCallsSnapshotInFlight.set(cacheKey, snapshotPromise);
  try {
    return await snapshotPromise;
  } finally {
    filteredCallsSnapshotInFlight.delete(cacheKey);
  }
}

function sortedOptionList(values, buildLabel, numeric = false) {
  return [...values]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .sort((left, right) => {
      if (numeric) return Number(left) - Number(right);
      return left.localeCompare(right, "ru");
    })
    .map((value) => ({ value, label: buildLabel(value) }));
}

async function buildScenarioOptions() {
  const [scenarioStore, snapshot] = await Promise.all([
    readScenarioStore(),
    buildCallsSnapshot({ onlyRecorded: "false" }),
  ]);

  const scenarios = Array.isArray(scenarioStore?.scenarios) ? scenarioStore.scenarios : [];
  const calls = Array.isArray(snapshot?.calls) ? snapshot.calls : [];
  const entityTypes = new Set(["1", "2", "3", "4", "31"]);

  for (const scenario of scenarios) {
    for (const value of scenario?.matchRules?.entityTypeIds || []) entityTypes.add(String(value));
  }

  for (const call of calls) {
    if (Number(call?.ownerTypeId || 0) > 0) entityTypes.add(String(call.ownerTypeId));
  }

  return {
    entityTypes: sortedOptionList(entityTypes, (value) => ownerTypeLabel(Number(value)), true),
  };
}

async function downloadCallAudio(fileId) {
  requireConfig();
  const response = await fetchWithTimeout(`${VIBE_API_URL}/v1/files/${fileId}/download`, {
    headers: vibeHeaders(),
  }, VIBE_REQUEST_TIMEOUT_MS);
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
  const transcriptionEndpoints = ["/v1/audio/transcriptions", "/v1/ai/audio/transcriptions"];

  for (let attempt = 1; attempt <= AI_TRANSCRIPTION_RETRIES; attempt += 1) {
    try {
      for (const endpoint of transcriptionEndpoints) {
        const form = new FormData();
        form.append("response_format", "verbose_json");
        form.append("model", AI_TRANSCRIPTION_MODEL);
        form.append("language", "ru");
        form.append("file", new Blob([audio.buffer], { type: audio.contentType }), audio.fileName);

        const response = await fetchWithTimeout(`${VIBE_API_URL}${endpoint}`, {
          method: "POST",
          headers: vibeHeaders(),
          body: form,
        }, AI_TRANSCRIPTION_TIMEOUT_MS);

        const text = await response.text();
        const payload = parseJsonSafely(text, "Audio transcription");
        if (!response.ok) {
          const error = new Error(payload?.error?.message || "Audio transcription failed");
          error.statusCode = response.status || 500;
          error.endpoint = endpoint;
          if ([404, 405].includes(response.status) && endpoint !== transcriptionEndpoints[transcriptionEndpoints.length - 1]) {
            lastError = error;
            continue;
          }
          throw error;
        }
        return payload;
      }
    } catch (error) {
      lastError = error;
      const retryable =
        Number(error.statusCode || 0) >= 500 || /internalservererror|internal server error|500|timed out/i.test(String(error.message || ""));
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
        {
          role: "system",
          content:
            "Ты строгий аналитик качества звонков. Возвращай только JSON, без markdown. Все текстовые поля, статусы, выводы и рекомендации должны быть только на русском языке. Если данных недостаточно, заполняй строки на русском краткими пояснениями, но не переходи на английский.",
        },
        { role: "user", content: analysisPrompt({ transcriptText, scriptChecklist, customMetrics, call }) },
      ],
    }),
  });

  const { completion, content } = extractCompletionContent(payload);

  return {
    analysis: normalizeAnalysisResult(extractJsonObject(content)),
    usage: completion?.usage || null,
    model: completion?.model || null,
  };
}

async function recoverStructuredAnalysis({ transcriptText, scriptChecklist, customMetrics, call, previousErrorMessage }) {
  const payload = await vibeJson("/v1/ai/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: AI_CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Верни только валидный JSON без markdown. Все текстовые поля и статусы должны быть только на русском языке. Не возвращай пустой объект: если данных мало, заполни поля краткими русскими формулировками по смыслу разговора. Обязательно заполни overview, summary, recommendations, scriptAnalysis, customMetrics и nextStep.",
        },
        {
          role: "user",
          content: [
            "Повтори structured AI-анализ звонка в строгом JSON-формате.",
            previousErrorMessage ? `Причина повтора: ${previousErrorMessage}` : "",
            "Если каких-то данных недостаточно, не переходи на английский и не возвращай пустой JSON.",
            analysisPrompt({ transcriptText, scriptChecklist, customMetrics, call }),
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      ],
    }),
  });

  const { completion, content } = extractCompletionContent(payload);
  return {
    analysis: normalizeAnalysisResult(extractJsonObject(content)),
    usage: completion?.usage || null,
    model: completion?.model || null,
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

  const signature = buildAnalysisSignature({
    sourceUpdatedAt: rawCall.updatedAt,
    selectedScenarioId: selectedScenario?.id || null,
    scriptChecklist: effectiveScriptChecklist,
    customMetrics: effectiveCustomMetrics,
  });

  const existing = findReusableAnalysis(store.analyses, activityId, signature);
  if (existing) {
    return { cached: true, analysis: existing };
  }

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

    let analysisResult = { analysis: emptyStructuredAnalysis(), usage: null, model: null };
    let structuredAnalysisErrorMessage = "";
    let structuredAnalysisRecovered = false;
    let structuredAnalysisAttempts = 0;
    try {
      structuredAnalysisAttempts += 1;
      analysisResult = await analyzeTranscript({
        transcriptText,
        scriptChecklist: effectiveScriptChecklist,
        customMetrics: effectiveCustomMetrics,
        call,
      });
    } catch (analysisStageError) {
      structuredAnalysisErrorMessage = String(analysisStageError?.message || "Ошибка структурированного AI-разбора");
      console.warn("Structured analysis failed, trying recovery attempt", analysisStageError);
    }

    let normalizedAnalysis = analysisResult.analysis;
    let hasMeaningfulStructuredResult = analysisHasMeaningfulContent(normalizedAnalysis);
    if (!hasMeaningfulStructuredResult) {
      try {
        structuredAnalysisAttempts += 1;
        analysisResult = await recoverStructuredAnalysis({
          transcriptText,
          scriptChecklist: effectiveScriptChecklist,
          customMetrics: effectiveCustomMetrics,
          call,
          previousErrorMessage: structuredAnalysisErrorMessage || "Structured AI-анализ вернулся пустым",
        });
        normalizedAnalysis = analysisResult.analysis;
        hasMeaningfulStructuredResult = analysisHasMeaningfulContent(normalizedAnalysis);
        structuredAnalysisRecovered = hasMeaningfulStructuredResult;
        if (structuredAnalysisRecovered) {
          structuredAnalysisErrorMessage = "";
        }
      } catch (recoveryError) {
        if (!structuredAnalysisErrorMessage) {
          structuredAnalysisErrorMessage = String(recoveryError?.message || "Structured AI recovery failed");
        }
        console.warn("Structured analysis recovery failed, keeping transcript result", recoveryError);
      }
    }

    const localizationSourceAnalysis = normalizedAnalysis;
    const localization = await ensureRussianStructuredAnalysis(normalizedAnalysis, { maxAttempts: 2 });
    normalizedAnalysis = localization.analysis;
    if (localization.localizationPending) {
      structuredAnalysisErrorMessage =
        structuredAnalysisErrorMessage || localization.localizationErrorMessage || "Не удалось локализовать analysis на русский язык";
      normalizedAnalysis = analysisHasMeaningfulContent(localization.analysis)
        ? localization.analysis
        : localizationSourceAnalysis;
    }

    if (localization.localizationPending && analysisHasMeaningfulContent(normalizedAnalysis)) {
      structuredAnalysisErrorMessage = "";
    }

    hasMeaningfulStructuredResult = analysisHasMeaningfulContent(normalizedAnalysis);
    if (!hasMeaningfulStructuredResult) {
      normalizedAnalysis = emptyStructuredAnalysis();
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
      processingNotes: {
        hasMeaningfulStructuredResult,
        structuredResultEmpty: !hasMeaningfulStructuredResult,
        structuredAnalysisErrorMessage,
        structuredAnalysisRecovered,
        structuredAnalysisAttempts,
        localizationAttempts: localization.localizationAttempts,
        localizationErrorMessage: localization.localizationErrorMessage || "",
        localizationPending: localization.localizationPending,
      },
      ...normalizedAnalysis,
    };

    await upsertAnalysisRecord(record);

    return { cached: false, analysis: record };
  } catch (error) {
    await saveAnalysisFailure(store, { ...call, sourceUpdatedAt: rawCall.updatedAt }, signature, error, "analysis");
    throw error;
  }
}

async function buildAnalysisJobContext(activityId, scriptChecklist, customMetrics, scenarioId) {
  const [callPayload, managers, scenarioStore, analysisStore] = await Promise.all([
    vibeJson(`/v1/activities/${activityId}`),
    listManagers(),
    readScenarioStore(),
    readAnalysisStore(),
  ]);

  const managersById = new Map(managers.map((manager) => [manager.id, manager]));
  const rawCall = callPayload.data;
  const call = normalizeCall(rawCall, managersById, null, null);
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

  return {
    analysisStore,
    rawCall,
    call,
    selectedScenario,
    effectiveScriptChecklist,
    effectiveCustomMetrics,
  };
}

function matchesAutoAnalyzeMode(call, mode) {
  if (mode === "all") return true;
  if (mode === "incoming") return call.direction === "incoming";
  if (mode === "outgoing") return call.direction === "outgoing";
  return false;
}

async function enqueueAnalysisJob({
  activityId,
  scriptChecklist,
  customMetrics,
  scenarioId,
  source = "manual",
}) {
  const context = await buildAnalysisJobContext(activityId, scriptChecklist, customMetrics, scenarioId);
  const {
    analysisStore,
    rawCall,
    call,
    selectedScenario,
    effectiveScriptChecklist,
    effectiveCustomMetrics,
  } = context;

  const activeJob = listJobsNewestFirst(analysisStore.jobs || []).find(
    (job) => String(job.activityId) === String(activityId) && ACTIVE_ANALYSIS_JOB_STATUSES.has(String(job.status || "")),
  );
  if (activeJob) {
    return { queued: false, existing: true, job: activeJob };
  }

  const signature = buildAnalysisSignature({
    sourceUpdatedAt: rawCall.updatedAt,
    selectedScenarioId: selectedScenario?.id || null,
    scriptChecklist: effectiveScriptChecklist,
    customMetrics: effectiveCustomMetrics,
  });
  const existingAnalysis = findReusableAnalysis(analysisStore.analyses, activityId, signature);
  if (existingAnalysis) {
    return {
      queued: false,
      existing: true,
      reason: "up_to_date",
      analysis: existingAnalysis,
      job: {
        id: null,
        activityId: call.id,
        status: "ready",
        selectedScenarioId: selectedScenario?.id || null,
        selectedScenarioName: selectedScenario?.name || "",
        analysisUpdatedAt: existingAnalysis.updatedAt || null,
      },
    };
  }

  const job = {
    id: createId("job"),
    activityId: call.id,
    sourceUpdatedAt: rawCall.updatedAt,
    subject: call.subject,
    managerId: call.managerId,
    managerName: call.managerName,
    direction: call.direction,
    durationSeconds: call.durationSeconds,
    recordingFileId: call.recordingFileId,
    selectedScenarioId: selectedScenario?.id || null,
    selectedScenarioName: selectedScenario?.name || "",
    scriptChecklist: effectiveScriptChecklist,
    customMetrics: effectiveCustomMetrics,
    source,
    status: "queued",
    attempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
    errorMessage: "",
    analysisUpdatedAt: null,
  };

  await mutateAnalysisStore(async (store) => {
    store.jobs = [job, ...(store.jobs || [])];
  });

  scheduleAnalysisQueue();
  return { queued: true, existing: false, job };
}

async function finalizeAnalysisJob(jobId, patch) {
  return mutateAnalysisStore(async (store) => {
    store.jobs = (store.jobs || []).map((job) =>
      String(job.id) === String(jobId) ? updateJobRecord(job, patch) : job,
    );
    return store.jobs.find((job) => String(job.id) === String(jobId)) || null;
  });
}

async function processQueuedAnalysisJob(job) {
  try {
    const result = await analyzeCall(job.activityId, job.scriptChecklist, job.customMetrics, job.selectedScenarioId);
    const finalStatus = deriveAnalysisResultState(result.analysis);
    await finalizeAnalysisJob(job.id, {
      status: finalStatus,
      finishedAt: new Date().toISOString(),
      errorMessage: "",
      analysisUpdatedAt: result.analysis?.updatedAt || null,
    });
  } catch (error) {
    await finalizeAnalysisJob(job.id, {
      status: "error",
      finishedAt: new Date().toISOString(),
      errorMessage: error.message || "Ошибка анализа",
    });
  }
}

async function claimNextQueuedAnalysisJob() {
  return mutateAnalysisStore(async (store) => {
    const queuedJobs = listJobsNewestFirst(store.jobs || [])
      .filter((job) => String(job.status || "") === "queued")
      .sort((left, right) => new Date(left.createdAt || 0) - new Date(right.createdAt || 0));

    const nextJob = queuedJobs[0] || null;
    if (!nextJob) return null;

    const claimedJob = updateJobRecord(nextJob, {
      status: "processing",
      startedAt: nextJob.startedAt || new Date().toISOString(),
      attempts: Number(nextJob.attempts || 0) + 1,
      errorMessage: "",
    });

    store.jobs = (store.jobs || []).map((job) => (String(job.id) === String(claimedJob.id) ? claimedJob : job));
    return claimedJob;
  });
}

async function processAnalysisQueue() {
  if (queueLoopActive || queueRunningCount >= ANALYSIS_QUEUE_CONCURRENCY) return;
  queueLoopActive = true;

  try {
    while (queueRunningCount < ANALYSIS_QUEUE_CONCURRENCY) {
      const nextJob = await claimNextQueuedAnalysisJob();
      if (!nextJob) break;

      queueRunningCount += 1;
      void processQueuedAnalysisJob(nextJob)
        .catch((error) => {
          console.error("Failed to process claimed analysis job", error);
        })
        .finally(() => {
          queueRunningCount = Math.max(0, queueRunningCount - 1);
          scheduleAnalysisQueue();
        });
    }
  } finally {
    queueLoopActive = false;
  }
}

function scheduleAnalysisQueue() {
  setTimeout(() => {
    processAnalysisQueue().catch((error) => {
      console.error("Failed to process analysis queue", error);
    });
  }, 0);
}

async function autoEnqueuePendingCalls() {
  await cleanupStaleActiveJobs();
  const settingsStore = await readSettingsStore();
  const mode = String(settingsStore.settings?.autoTranscriptionMode || "disabled");
  if (mode === "disabled") {
    const cleanup = await cancelQueuedAutoJobs();
    return { queued: 0, scanned: 0, stopped: cleanup?.removed || 0 };
  }
  const analysisStore = await readAnalysisStore();
  const activeAutoJobs = countActiveAutoJobs(analysisStore.jobs || []);
  const remainingCapacity = Math.max(0, ANALYSIS_AUTO_SCAN_BATCH - activeAutoJobs);
  if (remainingCapacity <= 0) {
    return { queued: 0, scanned: 0, activeAutoJobs };
  }
  let queued = 0;
  let scanned = 0;
  let offset = 0;
  const pageSize = Math.max(ANALYSIS_AUTO_SCAN_BATCH * 5, 50);
  const seenActivityIds = new Set();

  while (queued < remainingCapacity) {
    const callsData = await fetchCalls({
      limit: pageSize,
      offset,
    });
    const pageCalls = Array.isArray(callsData.calls) ? callsData.calls : [];
    if (!pageCalls.length) break;

    for (const call of pageCalls) {
      if (seenActivityIds.has(String(call.id))) continue;
      seenActivityIds.add(String(call.id));
      scanned += 1;
      if (!matchesAutoAnalyzeMode(call, mode)) continue;
      const state = String(call.analysis?.state || "");
      if (!["", "pending", "outdated"].includes(state)) continue;
      if (!call.hasRecording || !call.recordingFileId) continue;

      const queueResult = await enqueueAnalysisJob({ activityId: call.id, source: "auto" });
      if (queueResult.queued) {
        queued += 1;
      }
      if (queued >= remainingCapacity) break;
    }

    if (pageCalls.length < pageSize) break;
    offset += pageCalls.length;
  }

  return { queued, scanned, activeAutoJobs };
}

async function refreshAutomaticAnalysis() {
  if (autoScanInFlight) return { queued: 0, scanned: 0, skipped: true };
  autoScanInFlight = true;
  try {
    const autoScan = await autoEnqueuePendingCalls();
    await processAnalysisQueue();
    return autoScan;
  } finally {
    autoScanInFlight = false;
  }
}

function queueAutomaticAnalysisRefresh() {
  setTimeout(() => {
    refreshAutomaticAnalysis().catch((error) => {
      console.error("Failed to refresh automatic analysis after settings change", error);
    });
  }, 0);
}

function startAnalysisQueueScheduler() {
  if (queueScanTimer) clearInterval(queueScanTimer);
  queueScanTimer = setInterval(() => {
    refreshAutomaticAnalysis()
      .catch((error) => {
        console.error("Failed to scan pending calls for analysis", error);
      });
  }, ANALYSIS_AUTO_SCAN_INTERVAL_MS);

  scheduleAnalysisQueue();
  refreshAutomaticAnalysis()
    .catch((error) => {
      console.error("Failed to initialize analysis queue", error);
    });
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
    totalTokens: 0,
    managers: {},
  };

  let scoreSum = 0;
  let scoreCount = 0;

  for (const item of analyses) {
    const sentiment = canonicalSentiment(item?.overview?.sentiment);
    if (sentiment && Object.hasOwn(totals, sentiment)) totals[sentiment] += 1;
    if (canonicalRiskLevel(item?.overview?.riskLevel) === "high") totals.highRisk += 1;
    totals.totalTokens += Number(item?.tokenUsage?.totalTokens || 0);
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

function summarizeDashboardData(calls = [], analyses = []) {
  const summary = summarizeAnalyses(analyses);
  const statusBreakdown = buildCallStatusBreakdown(calls);
  const pendingCalls = Number(statusBreakdown.find((item) => item.key === "pending")?.count || 0);
  const queuedCalls = Number(statusBreakdown.find((item) => item.key === "queued")?.count || 0);

  return {
    ...summary,
    totalCalls: calls.length,
    pendingCalls,
    awaitingAnalysisCalls: pendingCalls + queuedCalls,
    statusBreakdown,
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

app.get("/api/scenario-options", async (_req, res, next) => {
  try {
    res.json({ success: true, data: await buildScenarioOptions() });
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
    queueAutomaticAnalysisRefresh();
    const autoScan = {
      scheduled: true,
      queued: 0,
      scanned: 0,
      stopped: 0,
    };
    res.json({ success: true, data: { settings: store.settings, autoScan } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/scenarios", async (req, res, next) => {
  try {
    const store = await readScenarioStore();
    const scenario = sanitizeScenario(req.body || {});
    const currentScenarios = Array.isArray(store.scenarios) ? store.scenarios : [];
    const existingIndex = currentScenarios.findIndex((item) => String(item.id) === String(scenario.id));
    store.scenarios = currentScenarios.filter((item) => String(item.id) !== String(scenario.id));
    if (existingIndex >= 0) {
      store.scenarios.splice(existingIndex, 0, scenario);
    } else {
      store.scenarios.unshift(scenario);
    }
    store.scenarios = ensureSingleDefaultScenario(
      store.scenarios,
      scenario.isDefault ? scenario.id : (store.scenarios.find((item) => item.isDefault)?.id || null),
    );
    const savedScenario = store.scenarios.find((item) => String(item.id) === String(scenario.id)) || scenario;
    await writeScenarioStore(store);
    res.json({ success: true, data: { scenario: savedScenario, scenarios: store.scenarios } });
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
    store.scenarios = ensureSingleDefaultScenario(store.scenarios);
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

app.get("/api/calls/:id/recording", async (req, res, next) => {
  try {
    const callsData = await fetchCalls({ onlyRecorded: "false" });
    const call = (callsData.calls || []).find((item) => String(item.id) === String(req.params.id));
    if (!call || !call.hasRecording || !call.recordingFileId) {
      const error = new Error("Recording not found");
      error.statusCode = 404;
      throw error;
    }

    const audio = await downloadCallAudio(call.recordingFileId);
    res.setHeader("Content-Type", audio.contentType || "audio/mpeg");
    res.setHeader("Content-Disposition", `inline; filename="${audio.fileName || `call-${call.id}.mp3`}"`);
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(audio.buffer);
  } catch (error) {
    next(error);
  }
});

app.get("/api/analyze/jobs", async (_req, res, next) => {
  try {
    const store = await readAnalysisStore();
    res.json({ success: true, data: { jobs: listJobsNewestFirst(store.jobs || []) } });
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
    res.json({
      success: true,
      data: await enqueueAnalysisJob({ activityId, scriptChecklist, customMetrics, scenarioId, source: "manual" }),
    });
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
        const queuedJob = await enqueueAnalysisJob({
          activityId: call.id,
          scriptChecklist,
          customMetrics,
          scenarioId,
          source: "batch",
        });
        results.push({
          activityId: call.id,
          subject: call.subject,
          managerName: call.managerName,
          status: queuedJob.job?.status || "queued",
          queued: Boolean(queuedJob.queued),
          existing: Boolean(queuedJob.existing),
          job: queuedJob.job,
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
    const includeAnalyses = String(req.query.includeAnalyses || "").toLowerCase() === "true";
    res.json({
      success: true,
      data: includeAnalyses ? { summary: summarizeAnalyses(analyses), analyses } : { summary: summarizeAnalyses(analyses) },
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard-summary", async (_req, res, next) => {
  try {
    await cleanupStaleActiveJobs();
    res.json({
      success: true,
      data: await buildDashboardSummarySnapshot(),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard-charts", async (_req, res, next) => {
  try {
    res.json({
      success: true,
      data: await buildDashboardChartsResponse(),
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/dashboard", async (_req, res, next) => {
  try {
    const snapshot = await buildCallsSnapshot({ onlyRecorded: "false" });
    const dashboardCalls = snapshot.calls.map((call) => createDashboardCallSnapshot(call));
    res.json({
      success: true,
      data: {
        summary: {
          ...summarizeAnalysesFromCalls(dashboardCalls),
          totalCalls: dashboardCalls.length,
          pendingCalls: Number(snapshot.statusBreakdown.find((item) => item.key === "pending")?.count || 0),
          awaitingAnalysisCalls:
            Number(snapshot.statusBreakdown.find((item) => item.key === "pending")?.count || 0) +
            Number(snapshot.statusBreakdown.find((item) => item.key === "queued")?.count || 0),
          statusBreakdown: snapshot.statusBreakdown,
        },
        calls: dashboardCalls,
        statusBreakdown: snapshot.statusBreakdown,
      },
    });
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
    refreshActivitySnapshotInBackground();
    startAnalysisQueueScheduler();
  })
  .catch((error) => {
    console.error("Failed to initialize application", error);
    process.exit(1);
  });
