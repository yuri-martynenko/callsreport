const fs = require("fs");
const path = require("path");

const REQUIRED_ENV_NAMES = [
  "VIBE_API_KEY",
  "VIBE_API_URL",
  "BITRIX_PORTAL_URL",
  "AI_CHAT_MODEL",
  "AI_TRANSCRIPTION_MODEL",
];

let envBootstrapState = null;

function stripWrappingQuotes(value) {
  return String(value).trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1").trim();
}

function envValue(name, fallback = "") {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  return stripWrappingQuotes(raw);
}

function resolveEnvCandidates(baseDir = __dirname) {
  const candidates = [
    envValue("APP_ENV_FILE", ""),
    path.join(baseDir, ".env"),
    path.join(process.cwd(), ".env"),
    "/var/lib/callsreport/.env",
    "/opt/app/.env",
  ];

  return Array.from(new Set(candidates.filter(Boolean)));
}

function loadEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const loadedNames = [];

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const name = line.slice(0, separatorIndex).trim();
    if (!name || process.env[name]) continue;

    process.env[name] = stripWrappingQuotes(line.slice(separatorIndex + 1));
    loadedNames.push(name);
  }

  return loadedNames;
}

function getMissingRequiredEnvNames() {
  return REQUIRED_ENV_NAMES.filter((name) => !envValue(name));
}

function ensureEnvLoaded(options = {}) {
  if (envBootstrapState) return envBootstrapState;

  const baseDir = options.baseDir || __dirname;
  const candidates = resolveEnvCandidates(baseDir);
  const missingFiles = [];
  const readErrors = [];
  let loadedFrom = null;
  let loadedNames = [];

  for (const filePath of candidates) {
    try {
      loadedNames = loadEnvFile(filePath);
      loadedFrom = filePath;
      break;
    } catch (error) {
      if (error.code === "ENOENT") {
        missingFiles.push(filePath);
        continue;
      }
      readErrors.push({ filePath, message: error.message });
    }
  }

  envBootstrapState = {
    loaded: Boolean(loadedFrom),
    loadedFrom,
    loadedNames,
    candidates,
    missingFiles,
    readErrors,
    missingRequired: getMissingRequiredEnvNames(),
  };

  return envBootstrapState;
}

function formatEnvBootstrapSummary(state = ensureEnvLoaded()) {
  if (state.loaded) {
    const loadedCount = state.loadedNames.length;
    const missingRequired = state.missingRequired.length
      ? `; missing required: ${state.missingRequired.join(", ")}`
      : "; all required env present";
    return `Env bootstrap loaded from ${state.loadedFrom} (${loadedCount} vars applied${missingRequired})`;
  }

  const missingRequired = state.missingRequired.length
    ? `Missing required env: ${state.missingRequired.join(", ")}`
    : "No env file loaded, but required env already present in process";
  return `Env bootstrap did not load a file. ${missingRequired}`;
}

module.exports = {
  REQUIRED_ENV_NAMES,
  ensureEnvLoaded,
  envValue,
  formatEnvBootstrapSummary,
  getMissingRequiredEnvNames,
};
