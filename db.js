const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { ensureEnvLoaded, envValue } = require("./env");

ensureEnvLoaded({ baseDir: __dirname });

const DB_DIR = envValue("APP_DB_DIR", "/var/lib/callsreport");
const COMPAT_DB_PATH = envValue("APP_DB_PATH", "");
const MAIN_DB_PATH = envValue("APP_MAIN_DB_PATH", COMPAT_DB_PATH || path.join(DB_DIR, "main.db"));
const CACHE_DB_PATH = envValue("APP_CACHE_DB_PATH", path.join(DB_DIR, "cache.db"));
const LEGACY_COMBINED_DB_PATH = envValue("APP_LEGACY_DB_PATH", COMPAT_DB_PATH || path.join(DB_DIR, "callsreport.sqlite"));
const LEGACY_DATA_DIR = envValue("APP_LEGACY_DATA_DIR", path.join(DB_DIR, "bootstrap-data"));
const BACKUP_DIR = envValue("APP_DB_BACKUP_DIR", path.join(DB_DIR, "backups"));
const ANALYSIS_EXPORT_DIR = envValue("APP_ANALYSIS_EXPORT_DIR", path.join(DB_DIR, "analysis-exports"));
const DB_BACKUP_INTERVAL_MS = Math.max(60 * 1000, Number(envValue("APP_DB_BACKUP_INTERVAL_MS", String(15 * 60 * 1000))));
const DB_BACKUP_KEEP = Math.max(2, Number(envValue("APP_DB_BACKUP_KEEP", "48")));
const DB_BUSY_TIMEOUT_MS = Math.max(1000, Number(envValue("APP_DB_BUSY_TIMEOUT_MS", "5000")));

const DEFAULT_SCENARIO = {
  id: "default-sales",
  name: "\u0411\u0430\u0437\u043e\u0432\u044b\u0439 \u0441\u0446\u0435\u043d\u0430\u0440\u0438\u0439 \u043f\u0440\u043e\u0434\u0430\u0436",
  description: "\u0423\u043d\u0438\u0432\u0435\u0440\u0441\u0430\u043b\u044c\u043d\u044b\u0439 \u0441\u0446\u0435\u043d\u0430\u0440\u0438\u0439 \u0434\u043b\u044f \u043f\u0435\u0440\u0432\u0438\u0447\u043d\u044b\u0445 \u043f\u0440\u043e\u0434\u0430\u0436 \u0438 \u043a\u043e\u043d\u0441\u0443\u043b\u044c\u0442\u0430\u0446\u0438\u0439.",
  scriptChecklist:
    "\u041f\u0440\u043e\u0432\u0435\u0440\u044c \u0437\u0432\u043e\u043d\u043e\u043a \u043f\u043e \u044d\u0442\u0430\u043f\u0430\u043c: \u043f\u0440\u0438\u0432\u0435\u0442\u0441\u0442\u0432\u0438\u0435, \u0432\u044b\u044f\u0432\u043b\u0435\u043d\u0438\u0435 \u043f\u043e\u0442\u0440\u0435\u0431\u043d\u043e\u0441\u0442\u0438, \u043f\u0440\u0435\u0437\u0435\u043d\u0442\u0430\u0446\u0438\u044f \u0440\u0435\u0448\u0435\u043d\u0438\u044f, \u0440\u0430\u0431\u043e\u0442\u0430 \u0441 \u0432\u043e\u0437\u0440\u0430\u0436\u0435\u043d\u0438\u044f\u043c\u0438, \u0444\u0438\u043a\u0441\u0430\u0446\u0438\u044f \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0433\u043e \u0448\u0430\u0433\u0430.",
  customMetrics: [
    "\u042d\u043c\u043f\u0430\u0442\u0438\u044f",
    "\u0427\u0435\u0442\u043a\u043e\u0441\u0442\u044c \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0435\u0433\u043e \u0448\u0430\u0433\u0430",
    "\u0420\u0430\u0431\u043e\u0442\u0430 \u0441 \u0432\u043e\u0437\u0440\u0430\u0436\u0435\u043d\u0438\u044f\u043c\u0438",
  ],
  matchRules: {},
  autoApply: true,
  isDefault: true,
  updatedAt: new Date().toISOString(),
};

let initializedPromise = null;
let writeChain = Promise.resolve();
let mainDb = null;
let cacheDb = null;
let analysisStoreCache = null;
let scenarioStoreCache = null;
let settingsStoreCache = null;
let activitySnapshotCache = null;
let lastMainBackupAt = 0;

function samePath(left, right) {
  return path.resolve(String(left || "")) === path.resolve(String(right || ""));
}

function fileExists(filePath) {
  return Boolean(filePath) && fsSync.existsSync(filePath);
}

function directoryExists(filePath) {
  try {
    return fsSync.statSync(filePath).isDirectory();
  } catch {
    return false;
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

function normalizeScenarioStore(store = {}) {
  return {
    scenarios: Array.isArray(store.scenarios) ? store.scenarios : [],
    updatedAt: store.updatedAt || null,
  };
}

function normalizeSettingsStore(store = {}) {
  return {
    settings: typeof store.settings === "object" && store.settings ? store.settings : { autoTranscriptionMode: "disabled" },
    updatedAt: store.updatedAt || null,
  };
}

function looksLikeMojibake(value) {
  const text = String(value || "");
  return text.includes("Гђ") || text.includes("Г‘") || text.includes("Р ");
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(String(text || ""));
  } catch {
    return fallback;
  }
}

function quotedIdentifier(identifier) {
  return `"${String(identifier).replace(/"/g, "\"\"")}"`;
}

function tableExists(db, tableName) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(String(tableName));
  return Boolean(row?.name);
}

function readMetadataValue(db, key) {
  if (!tableExists(db, "metadata")) return null;
  const row = db.prepare("SELECT value FROM metadata WHERE key = ?").get(String(key));
  return row?.value ?? null;
}

function setMetadataValue(db, key, value) {
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO metadata (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
  ).run(String(key), value == null ? "" : String(value), now);
}

function readPayloadTable(db, tableName, orderByClause = "") {
  if (!tableExists(db, tableName)) return [];
  const query = `SELECT payload FROM ${quotedIdentifier(tableName)} ${orderByClause}`.trim();
  return db.prepare(query).pluck().all().map((payload) => safeJsonParse(payload, {}));
}

function tableCount(db, tableName) {
  if (!tableExists(db, tableName)) return 0;
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${quotedIdentifier(tableName)}`).get();
  return Number(row?.count || 0);
}

function readAnalysisStoreFromDb(db) {
  return normalizeAnalysisStore({
    analyses: readPayloadTable(db, "analyses", "ORDER BY updated_at DESC"),
    failures: readPayloadTable(db, "failures", "ORDER BY updated_at DESC"),
    jobs: readPayloadTable(db, "jobs", "ORDER BY updated_at DESC"),
    updatedAt: readMetadataValue(db, "analysis_store_updated_at"),
  });
}

function readScenarioStoreFromDb(db) {
  return normalizeScenarioStore({
    scenarios: readPayloadTable(db, "scenarios", "ORDER BY updated_at DESC"),
    updatedAt: readMetadataValue(db, "scenario_store_updated_at"),
  });
}

function readSettingsStoreFromDb(db) {
  if (!tableExists(db, "settings")) {
    return normalizeSettingsStore({ settings: { autoTranscriptionMode: "disabled" } });
  }
  const row = db.prepare("SELECT payload FROM settings WHERE key = ?").get("singleton");
  const payload = safeJsonParse(row?.payload || "{}", { settings: { autoTranscriptionMode: "disabled" } });
  return normalizeSettingsStore({
    settings: payload.settings,
    updatedAt: readMetadataValue(db, "settings_store_updated_at"),
  });
}

function readActivitySnapshotCacheFromDb(db, cacheKey = "latest-calls") {
  if (!tableExists(db, "activity_snapshot_cache")) {
    return { cacheKey: String(cacheKey), updatedAt: null, activities: [] };
  }
  const row = db.prepare("SELECT payload FROM activity_snapshot_cache WHERE cache_key = ?").get(String(cacheKey));
  if (!row) {
    return { cacheKey: String(cacheKey), updatedAt: null, activities: [] };
  }
  const payload = safeJsonParse(row.payload, {});
  return {
    cacheKey: String(payload.cacheKey || cacheKey),
    updatedAt: payload.updatedAt || null,
    activities: Array.isArray(payload.activities) ? payload.activities : [],
  };
}

function readCrmClientCacheFromDb(db, entries = []) {
  const result = new Map();
  if (!tableExists(db, "crm_client_cache")) return result;
  const statement = db.prepare("SELECT payload FROM crm_client_cache WHERE owner_type_id = ? AND owner_id = ?");
  for (const entry of entries) {
    const ownerTypeId = String(entry?.ownerTypeId || "");
    const ownerId = String(entry?.ownerId || "");
    if (!ownerTypeId || !ownerId) continue;
    const row = statement.get(ownerTypeId, ownerId);
    if (!row) continue;
    result.set(`${ownerTypeId}:${ownerId}`, safeJsonParse(row.payload, {}));
  }
  return result;
}

function createMainSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analyses (
      activity_id TEXT NOT NULL,
      signature TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (activity_id, signature)
    );

    CREATE TABLE IF NOT EXISTS failures (
      activity_id TEXT NOT NULL,
      signature TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (activity_id, signature)
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      activity_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scenarios (
      id TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
  `);
}

function createCacheSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS crm_client_cache (
      owner_type_id TEXT NOT NULL,
      owner_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (owner_type_id, owner_id)
    );

    CREATE TABLE IF NOT EXISTS activity_snapshot_cache (
      cache_key TEXT PRIMARY KEY,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
  `);
}

function configureDatabase(db, mode) {
  db.pragma(`busy_timeout = ${DB_BUSY_TIMEOUT_MS}`);
  db.pragma("journal_mode = WAL");
  db.pragma(`synchronous = ${mode === "main" ? "FULL" : "NORMAL"}`);
  db.pragma("temp_store = MEMORY");
  if (mode === "main") {
    db.pragma("foreign_keys = ON");
    db.pragma("wal_autocheckpoint = 1000");
    db.pragma("auto_vacuum = INCREMENTAL");
  }
}

function openDatabase(filePath, mode) {
  const db = new Database(filePath);
  configureDatabase(db, mode);
  return db;
}

function runIntegrityCheck(db) {
  const rows = db.prepare("PRAGMA integrity_check").pluck().all();
  const errors = rows.filter((item) => String(item || "").toLowerCase() !== "ok");
  if (errors.length) {
    throw new Error(errors.join("; "));
  }
}

async function removeSqliteSidecars(filePath) {
  for (const suffix of ["-wal", "-shm"]) {
    try {
      await fs.rm(`${filePath}${suffix}`, { force: true });
    } catch {
      // Ignore cleanup errors for missing sidecar files.
    }
  }
}

async function quarantineSqliteFile(filePath, reason) {
  if (!fileExists(filePath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "").replace(/-/g, "");
  const target = `${filePath}.${reason}-${stamp}`;
  await fs.rename(filePath, target);
  await removeSqliteSidecars(filePath);
  return target;
}

async function latestBackupPath() {
  if (!directoryExists(BACKUP_DIR)) return null;
  const entries = await fs.readdir(BACKUP_DIR);
  const backupFiles = [];
  for (const name of entries) {
    if (!/^main-\d{8}T\d{6}Z\.sqlite$/.test(name)) continue;
    const fullPath = path.join(BACKUP_DIR, name);
    const stat = await fs.stat(fullPath);
    backupFiles.push({ fullPath, mtimeMs: stat.mtimeMs });
  }
  backupFiles.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return backupFiles[0]?.fullPath || null;
}

async function restoreMainDbFromBackup() {
  const backupPath = await latestBackupPath();
  if (!backupPath) return false;
  await fs.mkdir(path.dirname(MAIN_DB_PATH), { recursive: true });
  await fs.copyFile(backupPath, MAIN_DB_PATH);
  await removeSqliteSidecars(MAIN_DB_PATH);
  return true;
}

async function openManagedDatabase(filePath, mode) {
  try {
    const db = openDatabase(filePath, mode);
    const createSchema = mode === "main" ? createMainSchema : createCacheSchema;
    createSchema(db);
    runIntegrityCheck(db);
    return db;
  } catch (error) {
    if (!/malformed|disk image|corrupt|not a database/i.test(String(error?.message || ""))) {
      throw error;
    }

    try {
      if (mode === "main" && mainDb) {
        mainDb.close();
        mainDb = null;
      }
      if (mode === "cache" && cacheDb) {
        cacheDb.close();
        cacheDb = null;
      }
    } catch {
      // Ignore close failures during corruption recovery.
    }

    await quarantineSqliteFile(filePath, "malformed");
    if (mode === "main") {
      const restored = await restoreMainDbFromBackup();
      if (restored) {
        const db = openDatabase(filePath, mode);
        createMainSchema(db);
        runIntegrityCheck(db);
        return db;
      }
    }

    const db = openDatabase(filePath, mode);
    if (mode === "main") createMainSchema(db);
    else createCacheSchema(db);
    return db;
  }
}

function mainDbHasData(db) {
  return (
    tableCount(db, "analyses") > 0 ||
    tableCount(db, "failures") > 0 ||
    tableCount(db, "jobs") > 0 ||
    tableCount(db, "scenarios") > 0 ||
    tableCount(db, "settings") > 0
  );
}

function cacheDbHasData(db) {
  return tableCount(db, "crm_client_cache") > 0 || tableCount(db, "activity_snapshot_cache") > 0;
}

function writeAnalysisStoreToDb(db, store) {
  const normalized = normalizeAnalysisStore(store);
  normalized.updatedAt = new Date().toISOString();
  const insertAnalysis = db.prepare("INSERT INTO analyses (activity_id, signature, updated_at, payload) VALUES (?, ?, ?, ?)");
  const insertFailure = db.prepare("INSERT INTO failures (activity_id, signature, updated_at, payload) VALUES (?, ?, ?, ?)");
  const insertJob = db.prepare("INSERT INTO jobs (id, activity_id, status, created_at, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?)");
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM analyses").run();
    db.prepare("DELETE FROM failures").run();
    db.prepare("DELETE FROM jobs").run();
    for (const row of normalized.analyses) {
      insertAnalysis.run(
        String(row.activityId),
        String(row.signature || ""),
        String(row.updatedAt || normalized.updatedAt),
        JSON.stringify(row),
      );
    }
    for (const row of normalized.failures) {
      insertFailure.run(
        String(row.activityId),
        String(row.signature || ""),
        String(row.updatedAt || normalized.updatedAt),
        JSON.stringify(row),
      );
    }
    for (const row of normalized.jobs) {
      insertJob.run(
        String(row.id),
        String(row.activityId),
        String(row.status || ""),
        String(row.createdAt || normalized.updatedAt),
        String(row.updatedAt || normalized.updatedAt),
        JSON.stringify(row),
      );
    }
    setMetadataValue(db, "analysis_store_updated_at", normalized.updatedAt);
  });
  transaction();
  return normalized;
}

function writeScenarioStoreToDb(db, store) {
  const normalized = normalizeScenarioStore(store);
  normalized.updatedAt = new Date().toISOString();
  const insertScenario = db.prepare("INSERT INTO scenarios (id, updated_at, payload) VALUES (?, ?, ?)");
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM scenarios").run();
    for (const row of normalized.scenarios) {
      insertScenario.run(
        String(row.id),
        String(row.updatedAt || normalized.updatedAt),
        JSON.stringify(row),
      );
    }
    setMetadataValue(db, "scenario_store_updated_at", normalized.updatedAt);
  });
  transaction();
  return normalized;
}

function writeSettingsStoreToDb(db, store) {
  const normalized = normalizeSettingsStore(store);
  normalized.updatedAt = new Date().toISOString();
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM settings").run();
    db.prepare("INSERT INTO settings (key, updated_at, payload) VALUES (?, ?, ?)").run(
      "singleton",
      normalized.updatedAt,
      JSON.stringify({ settings: normalized.settings }),
    );
    setMetadataValue(db, "settings_store_updated_at", normalized.updatedAt);
  });
  transaction();
  return normalized;
}

function writeActivitySnapshotCacheToDb(db, entry) {
  const normalized = {
    cacheKey: String(entry?.cacheKey || "latest-calls"),
    updatedAt: new Date().toISOString(),
    activities: Array.isArray(entry?.activities) ? entry.activities : [],
  };
  db.prepare(
    "INSERT INTO activity_snapshot_cache (cache_key, updated_at, payload) VALUES (?, ?, ?) ON CONFLICT(cache_key) DO UPDATE SET updated_at = excluded.updated_at, payload = excluded.payload",
  ).run(
    normalized.cacheKey,
    normalized.updatedAt,
    JSON.stringify(normalized),
  );
  return normalized;
}

async function readJsonFileSafe(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function migrateLegacyDataIfNeeded(db) {
  if (mainDbHasData(db)) return;
  const legacyDirs = [LEGACY_DATA_DIR, path.join(__dirname, "data")].filter(Boolean);
  for (const legacyDir of legacyDirs) {
    const analyses = await readJsonFileSafe(path.join(legacyDir, "analyses.json"));
    const scenarios = await readJsonFileSafe(path.join(legacyDir, "scenarios.json"));
    const settings = await readJsonFileSafe(path.join(legacyDir, "settings.json"));
    if (!analyses && !scenarios && !settings) continue;

    if (analyses) writeAnalysisStoreToDb(db, analyses);
    if (scenarios) writeScenarioStoreToDb(db, scenarios);
    if (settings) writeSettingsStoreToDb(db, settings);
    setMetadataValue(db, "legacy_migration_source", legacyDir);
    return;
  }
}

function ensureDefaultRows(db) {
  if (tableCount(db, "scenarios") === 0) {
    writeScenarioStoreToDb(db, { scenarios: [DEFAULT_SCENARIO] });
  } else {
    const store = readScenarioStoreFromDb(db);
    let changed = false;
    const repaired = store.scenarios.map((scenario) => {
      if (scenario.id !== DEFAULT_SCENARIO.id) return scenario;
      if (!looksLikeMojibake(scenario.name) && !looksLikeMojibake(scenario.description)) return scenario;
      changed = true;
      return {
        ...scenario,
        ...DEFAULT_SCENARIO,
        updatedAt: new Date().toISOString(),
      };
    });
    if (changed) {
      writeScenarioStoreToDb(db, { scenarios: repaired, updatedAt: store.updatedAt });
    }
  }

  if (tableCount(db, "settings") === 0) {
    writeSettingsStoreToDb(db, { settings: { autoTranscriptionMode: "disabled" } });
  }

  if (!readMetadataValue(db, "analysis_store_updated_at")) {
    setMetadataValue(db, "analysis_store_updated_at", new Date().toISOString());
  }
}

function openSourceDatabase(filePath) {
  if (!fileExists(filePath)) return null;
  try {
    const db = new Database(filePath, { readonly: true, fileMustExist: true });
    runIntegrityCheck(db);
    return db;
  } catch {
    return null;
  }
}

function importMainDataFromSource(sourceDb, targetDb) {
  const store = readAnalysisStoreFromDb(sourceDb);
  if (store.analyses.length || store.failures.length || store.jobs.length) {
    writeAnalysisStoreToDb(targetDb, store);
  }
  const scenarioStore = readScenarioStoreFromDb(sourceDb);
  if (scenarioStore.scenarios.length) {
    writeScenarioStoreToDb(targetDb, scenarioStore);
  }
  const settingsStore = readSettingsStoreFromDb(sourceDb);
  if (Object.keys(settingsStore.settings || {}).length) {
    writeSettingsStoreToDb(targetDb, settingsStore);
  }
}

function importCacheDataFromSource(sourceDb, targetDb) {
  if (tableExists(sourceDb, "crm_client_cache")) {
    const insert = targetDb.prepare(
      "INSERT INTO crm_client_cache (owner_type_id, owner_id, updated_at, payload) VALUES (?, ?, ?, ?) ON CONFLICT(owner_type_id, owner_id) DO UPDATE SET updated_at = excluded.updated_at, payload = excluded.payload",
    );
    const rows = sourceDb.prepare("SELECT owner_type_id, owner_id, updated_at, payload FROM crm_client_cache").all();
    const tx = targetDb.transaction(() => {
      for (const row of rows) {
        insert.run(
          String(row.owner_type_id),
          String(row.owner_id),
          String(row.updated_at || new Date().toISOString()),
          String(row.payload || "{}"),
        );
      }
    });
    tx();
  }

  const snapshot = readActivitySnapshotCacheFromDb(sourceDb);
  if (snapshot.activities.length) {
    writeActivitySnapshotCacheToDb(targetDb, snapshot);
  }
}

function cloneStoreForDiff(store) {
  return jsonClone(normalizeAnalysisStore(store));
}

function collectChangedAnalyses(beforeStore, afterStore) {
  const beforeMap = new Map(
    (beforeStore.analyses || []).map((item) => [`${String(item.activityId)}:${String(item.signature || "")}`, JSON.stringify(item)]),
  );

  return (afterStore.analyses || []).filter((item) => {
    const key = `${String(item.activityId)}:${String(item.signature || "")}`;
    return beforeMap.get(key) !== JSON.stringify(item);
  });
}

async function appendAnalysesExport(analyses = []) {
  if (!analyses.length) return;
  await fs.mkdir(ANALYSIS_EXPORT_DIR, { recursive: true });
  const exportedAt = new Date().toISOString();
  const groups = new Map();
  for (const analysis of analyses) {
    const day = String(analysis?.updatedAt || exportedAt).slice(0, 10) || exportedAt.slice(0, 10);
    const filePath = path.join(ANALYSIS_EXPORT_DIR, `analyses-${day}.jsonl`);
    const line = `${JSON.stringify({ exportedAt, analysis })}\n`;
    groups.set(filePath, `${groups.get(filePath) || ""}${line}`);
  }

  for (const [filePath, content] of groups.entries()) {
    await fs.appendFile(filePath, content, "utf8");
  }
}

function backupTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function pruneBackups() {
  if (!directoryExists(BACKUP_DIR)) return;
  const entries = await fs.readdir(BACKUP_DIR);
  const backups = [];
  for (const name of entries) {
    if (!/^main-\d{8}T\d{6}Z\.sqlite$/.test(name)) continue;
    const fullPath = path.join(BACKUP_DIR, name);
    const stat = await fs.stat(fullPath);
    backups.push({ fullPath, mtimeMs: stat.mtimeMs });
  }
  backups.sort((left, right) => right.mtimeMs - left.mtimeMs);
  const stale = backups.slice(DB_BACKUP_KEEP);
  for (const entry of stale) {
    await fs.rm(entry.fullPath, { force: true });
  }
}

async function ensureMainBackup(options = {}) {
  if (!mainDb) {
    await ensurePersistence();
  }
  const force = Boolean(options.force);
  const now = Date.now();
  if (!force && now - lastMainBackupAt < DB_BACKUP_INTERVAL_MS) return;
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(BACKUP_DIR, `main-${backupTimestamp()}.sqlite`);
  if (typeof mainDb.backup === "function") {
    await mainDb.backup(backupPath);
  } else {
    mainDb.pragma("wal_checkpoint(PASSIVE)");
    await fs.copyFile(MAIN_DB_PATH, backupPath);
  }
  lastMainBackupAt = now;
  await pruneBackups();
}

async function queueWrite(operation) {
  const run = writeChain.then(operation);
  writeChain = run.catch(() => {});
  return run;
}

async function initializeDatabases() {
  if (initializedPromise) return initializedPromise;

  initializedPromise = (async () => {
    await fs.mkdir(DB_DIR, { recursive: true });
    await fs.mkdir(path.dirname(MAIN_DB_PATH), { recursive: true });
    await fs.mkdir(path.dirname(CACHE_DB_PATH), { recursive: true });

    mainDb = await openManagedDatabase(MAIN_DB_PATH, "main");
    cacheDb = await openManagedDatabase(CACHE_DB_PATH, "cache");

    createMainSchema(mainDb);
    createCacheSchema(cacheDb);

    const sourceDb =
      !samePath(LEGACY_COMBINED_DB_PATH, MAIN_DB_PATH) && fileExists(LEGACY_COMBINED_DB_PATH)
        ? openSourceDatabase(LEGACY_COMBINED_DB_PATH)
        : null;

    if (!mainDbHasData(mainDb)) {
      if (sourceDb) {
        importMainDataFromSource(sourceDb, mainDb);
      }
      if (!mainDbHasData(mainDb)) {
        await migrateLegacyDataIfNeeded(mainDb);
      }
    }

    if (!cacheDbHasData(cacheDb)) {
      if (sourceDb) {
        importCacheDataFromSource(sourceDb, cacheDb);
      } else if (!samePath(MAIN_DB_PATH, CACHE_DB_PATH)) {
        importCacheDataFromSource(mainDb, cacheDb);
      }
    }

    ensureDefaultRows(mainDb);
    runIntegrityCheck(mainDb);
    runIntegrityCheck(cacheDb);

    if (sourceDb) sourceDb.close();

    await ensureMainBackup({ force: !directoryExists(BACKUP_DIR) });
  })();

  return initializedPromise;
}

async function ensurePersistence() {
  await initializeDatabases();
}

async function readAnalysisStore() {
  await ensurePersistence();
  if (analysisStoreCache) return analysisStoreCache;
  analysisStoreCache = readAnalysisStoreFromDb(mainDb);
  return analysisStoreCache;
}

async function writeAnalysisStore(store) {
  await ensurePersistence();
  return queueWrite(async () => {
    const previous = cloneStoreForDiff(analysisStoreCache || readAnalysisStoreFromDb(mainDb));
    const normalized = writeAnalysisStoreToDb(mainDb, store);
    analysisStoreCache = normalized;
    await appendAnalysesExport(collectChangedAnalyses(previous, normalized));
    await ensureMainBackup();
    return normalized;
  });
}

async function mutateAnalysisStore(mutator) {
  await ensurePersistence();
  return queueWrite(async () => {
    const store = analysisStoreCache || readAnalysisStoreFromDb(mainDb);
    const previous = cloneStoreForDiff(store);
    const result = await mutator(store);
    const normalized = writeAnalysisStoreToDb(mainDb, store);
    analysisStoreCache = normalized;
    await appendAnalysesExport(collectChangedAnalyses(previous, normalized));
    await ensureMainBackup();
    return result;
  });
}

async function readScenarioStore() {
  await ensurePersistence();
  if (scenarioStoreCache) return scenarioStoreCache;
  scenarioStoreCache = readScenarioStoreFromDb(mainDb);
  return scenarioStoreCache;
}

async function writeScenarioStore(store) {
  await ensurePersistence();
  return queueWrite(async () => {
    const normalized = writeScenarioStoreToDb(mainDb, store);
    scenarioStoreCache = normalized;
    await ensureMainBackup();
    return normalized;
  });
}

async function readSettingsStore() {
  await ensurePersistence();
  if (settingsStoreCache) return settingsStoreCache;
  settingsStoreCache = readSettingsStoreFromDb(mainDb);
  return settingsStoreCache;
}

async function writeSettingsStore(store) {
  await ensurePersistence();
  return queueWrite(async () => {
    const normalized = writeSettingsStoreToDb(mainDb, store);
    settingsStoreCache = normalized;
    await ensureMainBackup();
    return normalized;
  });
}

async function readCrmClientCache(entries = []) {
  await ensurePersistence();
  return readCrmClientCacheFromDb(cacheDb, entries);
}

async function upsertCrmClientCache(entry) {
  await ensurePersistence();
  return queueWrite(async () => {
    const ownerTypeId = String(entry?.ownerTypeId || "");
    const ownerId = String(entry?.ownerId || "");
    if (!ownerTypeId || !ownerId) return null;

    const normalized = {
      ownerTypeId,
      ownerId,
      clientName: String(entry?.clientName || "").trim(),
      updatedAt: new Date().toISOString(),
    };

    cacheDb.prepare(
      "INSERT INTO crm_client_cache (owner_type_id, owner_id, updated_at, payload) VALUES (?, ?, ?, ?) ON CONFLICT(owner_type_id, owner_id) DO UPDATE SET updated_at = excluded.updated_at, payload = excluded.payload",
    ).run(
      normalized.ownerTypeId,
      normalized.ownerId,
      normalized.updatedAt,
      JSON.stringify(normalized),
    );
    return normalized;
  });
}

async function readActivitySnapshotCache(cacheKey = "latest-calls") {
  await ensurePersistence();
  if (activitySnapshotCache && String(activitySnapshotCache.cacheKey) === String(cacheKey)) {
    return activitySnapshotCache;
  }
  activitySnapshotCache = readActivitySnapshotCacheFromDb(cacheDb, cacheKey);
  return activitySnapshotCache;
}

async function writeActivitySnapshotCache(entry) {
  await ensurePersistence();
  return queueWrite(async () => {
    const normalized = writeActivitySnapshotCacheToDb(cacheDb, entry);
    activitySnapshotCache = normalized;
    return normalized;
  });
}

module.exports = {
  DB_PATH: MAIN_DB_PATH,
  MAIN_DB_PATH,
  CACHE_DB_PATH,
  BACKUP_DIR,
  ANALYSIS_EXPORT_DIR,
  ensurePersistence,
  readAnalysisStore,
  writeAnalysisStore,
  mutateAnalysisStore,
  readScenarioStore,
  writeScenarioStore,
  readSettingsStore,
  writeSettingsStore,
  readCrmClientCache,
  upsertCrmClientCache,
  readActivitySnapshotCache,
  writeActivitySnapshotCache,
};
