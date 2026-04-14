const fs = require("fs/promises");
const path = require("path");
const initSqlJs = require("sql.js");

function envValue(name, fallback = "") {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  return String(raw).trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();
}

const DB_DIR = envValue("APP_DB_DIR", "/var/lib/callsreport");
const DB_PATH = envValue("APP_DB_PATH", path.join(DB_DIR, "callsreport.sqlite"));
const LEGACY_DATA_DIR = envValue("APP_LEGACY_DATA_DIR", path.join(DB_DIR, "bootstrap-data"));

const DEFAULT_SCENARIO = {
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
};

let sqlPromise = null;
let dbPromise = null;
let writeChain = Promise.resolve();

const DEFAULT_SCENARIO_FIXED = {
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

function metadataValue(db, key) {
  const statement = db.prepare("SELECT value FROM metadata WHERE key = ?");
  try {
    statement.bind([key]);
    if (!statement.step()) return null;
    return statement.getAsObject().value ?? null;
  } finally {
    statement.free();
  }
}

function setMetadataValue(db, key, value) {
  const now = new Date().toISOString();
  db.run(
    "INSERT INTO metadata (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    [key, value == null ? "" : String(value), now],
  );
}

function tablePayloads(db, tableName, orderByClause) {
  const statement = db.prepare(`SELECT payload FROM ${tableName} ${orderByClause}`);
  const items = [];
  try {
    while (statement.step()) {
      const row = statement.getAsObject();
      items.push(JSON.parse(String(row.payload || "{}")));
    }
  } finally {
    statement.free();
  }
  return items;
}

function tableCount(db, tableName) {
  const statement = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`);
  try {
    statement.step();
    return Number(statement.getAsObject().count || 0);
  } finally {
    statement.free();
  }
}

function looksLikeMojibake(value) {
  const text = String(value || "");
  return text.includes("Ð") || text.includes("Ñ") || text.includes("Р");
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

async function loadSql() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: (file) => path.join(__dirname, "node_modules", "sql.js", "dist", file),
    });
  }
  return sqlPromise;
}

async function persistDatabase(db) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, Buffer.from(db.export()));
}

function createSchema(db) {
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

function readAnalysisStoreFromDb(db) {
  return normalizeAnalysisStore({
    analyses: tablePayloads(db, "analyses", "ORDER BY updated_at DESC"),
    failures: tablePayloads(db, "failures", "ORDER BY updated_at DESC"),
    jobs: tablePayloads(db, "jobs", "ORDER BY updated_at DESC"),
    updatedAt: metadataValue(db, "analysis_store_updated_at"),
  });
}

function readScenarioStoreFromDb(db) {
  return normalizeScenarioStore({
    scenarios: tablePayloads(db, "scenarios", "ORDER BY updated_at DESC"),
    updatedAt: metadataValue(db, "scenario_store_updated_at"),
  });
}

function readSettingsStoreFromDb(db) {
  const statement = db.prepare("SELECT payload FROM settings WHERE key = ?");
  try {
    statement.bind(["singleton"]);
    const payload = statement.step() ? JSON.parse(String(statement.getAsObject().payload || "{}")) : { settings: { autoTranscriptionMode: "disabled" } };
    return normalizeSettingsStore({
      settings: payload.settings,
      updatedAt: metadataValue(db, "settings_store_updated_at"),
    });
  } finally {
    statement.free();
  }
}

function replacePayloadTable(db, tableName, rows, columnsBuilder) {
  db.run(`DELETE FROM ${tableName}`);
  for (const row of rows) {
    db.run(columnsBuilder.query, columnsBuilder.values(row));
  }
}

function writeAnalysisStoreToDb(db, store) {
  const normalized = normalizeAnalysisStore(store);
  normalized.updatedAt = new Date().toISOString();
  db.run("BEGIN");
  try {
    replacePayloadTable(db, "analyses", normalized.analyses, {
      query: "INSERT INTO analyses (activity_id, signature, updated_at, payload) VALUES (?, ?, ?, ?)",
      values: (row) => [
        String(row.activityId),
        String(row.signature || ""),
        String(row.updatedAt || normalized.updatedAt),
        JSON.stringify(row),
      ],
    });
    replacePayloadTable(db, "failures", normalized.failures, {
      query: "INSERT INTO failures (activity_id, signature, updated_at, payload) VALUES (?, ?, ?, ?)",
      values: (row) => [
        String(row.activityId),
        String(row.signature || ""),
        String(row.updatedAt || normalized.updatedAt),
        JSON.stringify(row),
      ],
    });
    replacePayloadTable(db, "jobs", normalized.jobs, {
      query: "INSERT INTO jobs (id, activity_id, status, created_at, updated_at, payload) VALUES (?, ?, ?, ?, ?, ?)",
      values: (row) => [
        String(row.id),
        String(row.activityId),
        String(row.status || ""),
        String(row.createdAt || normalized.updatedAt),
        String(row.updatedAt || normalized.updatedAt),
        JSON.stringify(row),
      ],
    });
    setMetadataValue(db, "analysis_store_updated_at", normalized.updatedAt);
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
  return normalized;
}

function writeScenarioStoreToDb(db, store) {
  const normalized = normalizeScenarioStore(store);
  normalized.updatedAt = new Date().toISOString();
  db.run("BEGIN");
  try {
    replacePayloadTable(db, "scenarios", normalized.scenarios, {
      query: "INSERT INTO scenarios (id, updated_at, payload) VALUES (?, ?, ?)",
      values: (row) => [
        String(row.id),
        String(row.updatedAt || normalized.updatedAt),
        JSON.stringify(row),
      ],
    });
    setMetadataValue(db, "scenario_store_updated_at", normalized.updatedAt);
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
  return normalized;
}

function writeSettingsStoreToDb(db, store) {
  const normalized = normalizeSettingsStore(store);
  normalized.updatedAt = new Date().toISOString();
  db.run("BEGIN");
  try {
    db.run("DELETE FROM settings");
    db.run(
      "INSERT INTO settings (key, updated_at, payload) VALUES (?, ?, ?)",
      ["singleton", normalized.updatedAt, JSON.stringify({ settings: normalized.settings })],
    );
    setMetadataValue(db, "settings_store_updated_at", normalized.updatedAt);
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
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
  const hasData =
    tableCount(db, "analyses") > 0 ||
    tableCount(db, "failures") > 0 ||
    tableCount(db, "jobs") > 0 ||
    tableCount(db, "scenarios") > 0 ||
    tableCount(db, "settings") > 0;
  if (hasData) return;

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
    writeScenarioStoreToDb(db, { scenarios: [DEFAULT_SCENARIO_FIXED] });
  } else {
    const store = readScenarioStoreFromDb(db);
    let changed = false;
    const repaired = store.scenarios.map((scenario) => {
      if (scenario.id !== DEFAULT_SCENARIO_FIXED.id) return scenario;
      if (!looksLikeMojibake(scenario.name) && !looksLikeMojibake(scenario.description)) return scenario;
      changed = true;
      return {
        ...scenario,
        ...DEFAULT_SCENARIO_FIXED,
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
  if (!metadataValue(db, "analysis_store_updated_at")) {
    setMetadataValue(db, "analysis_store_updated_at", new Date().toISOString());
  }
}

async function ensureDatabase() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQL = await loadSql();
      await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
      let db;
      try {
        const binary = await fs.readFile(DB_PATH);
        db = new SQL.Database(binary);
      } catch {
        db = new SQL.Database();
      }
      createSchema(db);
      await migrateLegacyDataIfNeeded(db);
      ensureDefaultRows(db);
      await persistDatabase(db);
      return db;
    })();
  }
  return dbPromise;
}

async function queueWrite(operation) {
  const run = writeChain.then(operation);
  writeChain = run.catch(() => {});
  return run;
}

async function ensurePersistence() {
  await ensureDatabase();
}

async function readAnalysisStore() {
  const db = await ensureDatabase();
  return readAnalysisStoreFromDb(db);
}

async function writeAnalysisStore(store) {
  return queueWrite(async () => {
    const db = await ensureDatabase();
    const normalized = writeAnalysisStoreToDb(db, store);
    await persistDatabase(db);
    return normalized;
  });
}

async function mutateAnalysisStore(mutator) {
  return queueWrite(async () => {
    const db = await ensureDatabase();
    const store = readAnalysisStoreFromDb(db);
    const result = await mutator(store);
    writeAnalysisStoreToDb(db, store);
    await persistDatabase(db);
    return result;
  });
}

async function readScenarioStore() {
  const db = await ensureDatabase();
  return readScenarioStoreFromDb(db);
}

async function writeScenarioStore(store) {
  return queueWrite(async () => {
    const db = await ensureDatabase();
    const normalized = writeScenarioStoreToDb(db, store);
    await persistDatabase(db);
    return normalized;
  });
}

async function readSettingsStore() {
  const db = await ensureDatabase();
  return readSettingsStoreFromDb(db);
}

async function writeSettingsStore(store) {
  return queueWrite(async () => {
    const db = await ensureDatabase();
    const normalized = writeSettingsStoreToDb(db, store);
    await persistDatabase(db);
    return normalized;
  });
}

module.exports = {
  DB_PATH,
  ensurePersistence,
  readAnalysisStore,
  writeAnalysisStore,
  mutateAnalysisStore,
  readScenarioStore,
  writeScenarioStore,
  readSettingsStore,
  writeSettingsStore,
};
