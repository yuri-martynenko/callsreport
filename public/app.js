const PAGE_SIZE = 10;

const CALLS_PAGE_CACHE_LIMIT = 20;
const CALLS_VIRTUAL_ROW_HEIGHT = 88;
const CALLS_VIRTUAL_OVERSCAN = 6;

const state = {
  calls: [],
  callsTotal: 0,
  callsPageSize: PAGE_SIZE,
  callsTotalPages: 1,
  callsHasMore: false,
  callsStatusBreakdown: [],
  summary: null,
  dashboardCalls: [],
  dashboardAnalyses: [],
  dashboardSummary: null,
  dashboardStatusBreakdown: [],
  dashboardCharts: null,
  dashboardDatasetLoaded: false,
  dashboardDatasetLoading: null,
  scenarios: [],
  managers: [],
  scenarioRuleOptions: {
    entityTypes: [],
  },
  settings: {
    autoTranscriptionMode: "disabled",
  },
  access: {
    currentUser: null,
    permissions: {},
    roles: [],
  },
  accessUsers: [],
  selectedAccessRoleId: "",
  accessLoaded: false,
  accessUsersLoaded: false,
  settingsDirty: false,
  accessDirty: false,
  scenarioDirty: false,
  scenarioFormBaseline: "",
  selectedCallId: null,
  selectedAnalysis: null,
  selectedScenarioId: "",
  currentView: "dashboard",
  page: 1,
  appliedFilters: null,
  filtersDirty: false,
  analysisOverrides: {},
  scenarioSelections: {},
  analysisPollingTimer: null,
  callsNextCursor: "",
  callsCursorByPage: {},
  reportDataLoaded: false,
  reportDataLoading: null,
  managersLoaded: false,
  managersLoading: null,
  settingsLoaded: false,
  settingsLoading: null,
  scenariosLoaded: false,
  scenariosLoading: null,
  scenarioRuleOptionsLoaded: false,
  scenarioRuleOptionsLoading: null,
  callsVirtual: {
    scrollTop: 0,
    viewportHeight: 0,
  },
  playback: {
    activityId: null,
    segmentKey: "",
    audioUrl: "",
    loading: false,
    mode: "",
    currentTime: 0,
    duration: 0,
    seeking: false,
  },
};

const callsPageCache = new Map();
const callsPagePrefetchInFlight = new Map();

const el = {
  dashboardView: document.getElementById("dashboardView"),
  reportView: document.getElementById("reportView"),
  scenariosView: document.getElementById("scenariosView"),
  settingsView: document.getElementById("settingsView"),
  showDashboardView: document.getElementById("showDashboardView"),
  showReportView: document.getElementById("showReportView"),
  showScenariosView: document.getElementById("showScenariosView"),
  showSettingsView: document.getElementById("showSettingsView"),
  managerIdsDropdown: document.getElementById("managerIdsDropdown"),
  managerIdsLabel: document.getElementById("managerIdsLabel"),
  managerIdsOptions: document.getElementById("managerIdsOptions"),
  dateFrom: document.getElementById("dateFrom"),
  dateTo: document.getElementById("dateTo"),
  directionsDropdown: document.getElementById("directionsDropdown"),
  directionsLabel: document.getElementById("directionsLabel"),
  directionsOptions: document.getElementById("directionsOptions"),
  analysisStatesDropdown: document.getElementById("analysisStatesDropdown"),
  analysisStatesLabel: document.getElementById("analysisStatesLabel"),
  analysisStatesOptions: document.getElementById("analysisStatesOptions"),
  scenarioFilterDropdown: document.getElementById("scenarioFilterDropdown"),
  scenarioFilterLabel: document.getElementById("scenarioFilterLabel"),
  scenarioFilterOptions: document.getElementById("scenarioFilterOptions"),
  onlyRecorded: document.getElementById("onlyRecorded"),
  applyFilters: document.getElementById("applyFilters"),
  resetFilters: document.getElementById("resetFilters"),
  scenarioName: document.getElementById("scenarioName"),
  scenarioDescription: document.getElementById("scenarioDescription"),
  scenarioScriptChecklist: document.getElementById("scenarioScriptChecklist"),
  scenarioCustomMetrics: document.getElementById("scenarioCustomMetrics"),
  scenarioDirection: document.getElementById("scenarioDirection"),
  scenarioManagerIdsDropdown: document.getElementById("scenarioManagerIdsDropdown"),
  scenarioManagerIdsLabel: document.getElementById("scenarioManagerIdsLabel"),
  scenarioManagerIdsOptions: document.getElementById("scenarioManagerIdsOptions"),
  scenarioEntityTypeIdsDropdown: document.getElementById("scenarioEntityTypeIdsDropdown"),
  scenarioEntityTypeIdsLabel: document.getElementById("scenarioEntityTypeIdsLabel"),
  scenarioEntityTypeIdsOptions: document.getElementById("scenarioEntityTypeIdsOptions"),
  scenarioKeywords: document.getElementById("scenarioKeywords"),
  scenarioMinDuration: document.getElementById("scenarioMinDuration"),
  scenarioMaxDuration: document.getElementById("scenarioMaxDuration"),
  scenarioAutoApply: document.getElementById("scenarioAutoApply"),
  scenarioIsDefault: document.getElementById("scenarioIsDefault"),
  resetScenarioRules: document.getElementById("resetScenarioRules"),
  saveScenario: document.getElementById("saveScenario"),
  copyScenario: document.getElementById("copyScenario"),
  newScenario: document.getElementById("newScenario"),
  deleteScenario: document.getElementById("deleteScenario"),
  scenarioList: document.getElementById("scenarioList"),
  scenarioSearch: document.getElementById("scenarioSearch"),
  scenarioLibraryMeta: document.getElementById("scenarioLibraryMeta"),
  scenarioModal: document.getElementById("scenarioModal"),
  scenarioModalBackdrop: document.getElementById("scenarioModalBackdrop"),
  closeScenarioModal: document.getElementById("closeScenarioModal"),
  scenarioModalTitle: document.getElementById("scenarioModalTitle"),
  scenarioSelectionSummary: document.getElementById("scenarioSelectionSummary"),
  summaryCards: document.getElementById("summaryCards"),
  dashboardSummaryCards: document.getElementById("dashboardSummaryCards"),
  callsTable: document.getElementById("callsTable"),
  callsTableWrap: document.getElementById("callsTableWrap"),
  callsCount: document.getElementById("callsCount"),
  callsBreakdown: document.getElementById("callsBreakdown"),
  reportAutoMode: document.getElementById("reportAutoMode"),
  openAutoTranscriptionSettings: document.getElementById("openAutoTranscriptionSettings"),
  statusText: document.getElementById("statusText"),
  analysisDetail: document.getElementById("analysisDetail"),
  analysisState: document.getElementById("analysisState"),
  analysisHeaderMeta: document.getElementById("analysisHeaderMeta"),
  analysisDrawer: document.getElementById("analysisDrawer"),
  analysisDrawerPanel: document.querySelector(".analysis-drawer-panel"),
  analysisDrawerBackdrop: document.getElementById("analysisDrawerBackdrop"),
  closeAnalysisDrawer: document.getElementById("closeAnalysisDrawer"),
  autoTranscriptionModal: document.getElementById("autoTranscriptionModal"),
  autoTranscriptionModalBackdrop: document.getElementById("autoTranscriptionModalBackdrop"),
  closeAutoTranscriptionModal: document.getElementById("closeAutoTranscriptionModal"),
  firstPage: document.getElementById("firstPage"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  lastPage: document.getElementById("lastPage"),
  pageInfo: document.getElementById("pageInfo"),
  managerScoreChart: document.getElementById("managerScoreChart"),
  sentimentChart: document.getElementById("sentimentChart"),
  riskChart: document.getElementById("riskChart"),
  scenarioAverageChart: document.getElementById("scenarioAverageChart"),
  scenarioTokensPerMinuteChart: document.getElementById("scenarioTokensPerMinuteChart"),
  recognizedCallsChart: document.getElementById("recognizedCallsChart"),
  tokensUsageChart: document.getElementById("tokensUsageChart"),
  recognizedMinutesChart: document.getElementById("recognizedMinutesChart"),
  noRecordingChart: document.getElementById("noRecordingChart"),
  tokensPerMinuteChart: document.getElementById("tokensPerMinuteChart"),
  violatedCheckpointsChart: document.getElementById("violatedCheckpointsChart"),
  callsHeatmap: document.getElementById("callsHeatmap"),
  callsVolumeChart: document.getElementById("callsVolumeChart"),
  saveSettings: document.getElementById("saveSettings"),
  accessCurrentUser: document.getElementById("accessCurrentUser"),
  accessRolesList: document.getElementById("accessRolesList"),
  accessRoleName: document.getElementById("accessRoleName"),
  accessUsersList: document.getElementById("accessUsersList"),
  newAccessRole: document.getElementById("newAccessRole"),
  saveAccessRole: document.getElementById("saveAccessRole"),
  deleteAccessRole: document.getElementById("deleteAccessRole"),
};

function selectedCheckboxValues(container, selector) {
  return Array.from(container?.querySelectorAll(selector) || [])
    .filter((input) => input.checked)
    .map((input) => input.value)
    .filter(Boolean);
}

function selectedManagerIds() {
  return selectedCheckboxValues(el.managerIdsOptions, 'input[data-filter-option="manager"]');
}

function selectedDirections() {
  return selectedCheckboxValues(el.directionsOptions, 'input[data-filter-option="direction"]');
}

function selectedAnalysisStates() {
  return selectedCheckboxValues(el.analysisStatesOptions, 'input[data-filter-option="analysis-state"]');
}

function selectedScenarioFilters() {
  return selectedCheckboxValues(el.scenarioFilterOptions, 'input[data-filter-option="scenario"]');
}

function selectedScenarioRuleValues(kind) {
  const map = {
    "scenario-manager": el.scenarioManagerIdsOptions,
    "scenario-entity-type": el.scenarioEntityTypeIdsOptions,
  };
  return selectedCheckboxValues(map[kind], `input[data-filter-option="${kind}"]`);
}

function setCheckedValues(container, selector, values) {
  const selected = new Set((values || []).map((value) => String(value)));
  Array.from(container?.querySelectorAll(selector) || []).forEach((input) => {
    input.checked = selected.has(String(input.value));
  });
}

function managerNameById(id) {
  return state.managers.find((manager) => String(manager.id) === String(id))?.fullName || `ID ${id}`;
}

function createClientId(prefix = "id") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function hasPermission(permission) {
  return Boolean(state.access?.currentUser?.isAdmin || state.access?.permissions?.[permission]);
}

function canManageAccess() {
  return Boolean(state.access?.currentUser?.isAdmin);
}

function firstAllowedView() {
  if (hasPermission("viewDashboard")) return "dashboard";
  if (hasPermission("viewReport")) return "report";
  if (hasPermission("viewScenarios")) return "scenarios";
  if (canManageAccess()) return "settings";
  return "settings";
}

function viewAllowed(view) {
  const map = {
    dashboard: "viewDashboard",
    report: "viewReport",
    scenarios: "viewScenarios",
  };
  return view === "settings" ? canManageAccess() : hasPermission(map[view]);
}

function selectedItemsLabel(values, fallbackLabel, optionsMap) {
  if (!values.length) return fallbackLabel;
  if (values.length === 1) return optionsMap.get(values[0]) || values[0];
  return `Выбрано: ${values.length}`;
}

function refreshFilterLabels() {
  const managerMap = new Map(
    Array.from(el.managerIdsOptions?.querySelectorAll('input[data-filter-option="manager"]') || []).map((input) => [
      input.value,
      input.dataset.label || input.value,
    ]),
  );
  const directionMap = new Map(
    Array.from(el.directionsOptions?.querySelectorAll('input[data-filter-option="direction"]') || []).map((input) => [
      input.value,
      input.dataset.label || input.value,
    ]),
  );
  const analysisStateMap = new Map(
    Array.from(el.analysisStatesOptions?.querySelectorAll('input[data-filter-option="analysis-state"]') || []).map((input) => [
      input.value,
      input.dataset.label || input.value,
    ]),
  );
  const scenarioMap = new Map(
    Array.from(el.scenarioFilterOptions?.querySelectorAll('input[data-filter-option="scenario"]') || []).map((input) => [
      input.value,
      input.dataset.label || input.value,
    ]),
  );

  if (el.managerIdsLabel) {
    el.managerIdsLabel.textContent = selectedItemsLabel(selectedManagerIds(), "Все менеджеры", managerMap);
  }
  if (el.directionsLabel) {
    el.directionsLabel.textContent = selectedItemsLabel(selectedDirections(), "Все направления", directionMap);
  }
  if (el.analysisStatesLabel) {
    el.analysisStatesLabel.textContent = selectedItemsLabel(selectedAnalysisStates(), "Все статусы", analysisStateMap);
  }
  if (el.scenarioFilterLabel) {
    el.scenarioFilterLabel.textContent = selectedItemsLabel(selectedScenarioFilters(), "Все сценарии", scenarioMap);
  }

  const scenarioManagerMap = new Map(
    Array.from(el.scenarioManagerIdsOptions?.querySelectorAll('input[data-filter-option="scenario-manager"]') || []).map((input) => [
      input.value,
      input.dataset.label || input.value,
    ]),
  );
  const scenarioEntityTypeMap = new Map(
    Array.from(el.scenarioEntityTypeIdsOptions?.querySelectorAll('input[data-filter-option="scenario-entity-type"]') || []).map((input) => [
      input.value,
      input.dataset.label || input.value,
    ]),
  );
  if (el.scenarioManagerIdsLabel) {
    el.scenarioManagerIdsLabel.textContent = selectedItemsLabel(selectedScenarioRuleValues("scenario-manager"), "Все менеджеры", scenarioManagerMap);
  }
  if (el.scenarioEntityTypeIdsLabel) {
    el.scenarioEntityTypeIdsLabel.textContent = selectedItemsLabel(selectedScenarioRuleValues("scenario-entity-type"), "Любой тип", scenarioEntityTypeMap);
  }
}

function closeFilterDropdowns(except = null) {
  [
    el.managerIdsDropdown,
    el.directionsDropdown,
    el.analysisStatesDropdown,
    el.scenarioFilterDropdown,
    el.scenarioManagerIdsDropdown,
    el.scenarioEntityTypeIdsDropdown,
  ].forEach((dropdown) => {
    if (!dropdown || dropdown === except) return;
    dropdown.open = false;
  });
}

function currentFiltersFromControls() {
  return {
    managerIds: selectedManagerIds(),
    dateFrom: el.dateFrom.value,
    dateTo: el.dateTo.value,
    directions: selectedDirections(),
    analysisStates: selectedAnalysisStates(),
    scenarioIds: selectedScenarioFilters(),
    onlyRecorded: Boolean(el.onlyRecorded.checked),
  };
}

function normalizeFilters(filters) {
  const normalized = filters || {};
  return {
    managerIds: [...new Set((normalized.managerIds || []).map((value) => String(value).trim()).filter(Boolean))].sort(),
    dateFrom: String(normalized.dateFrom || "").trim(),
    dateTo: String(normalized.dateTo || "").trim(),
    directions: [...new Set((normalized.directions || []).map((value) => String(value).trim()).filter(Boolean))].sort(),
    analysisStates: [...new Set((normalized.analysisStates || []).map((value) => String(value).trim()).filter(Boolean))].sort(),
    scenarioIds: [...new Set((normalized.scenarioIds || []).map((value) => String(value).trim()).filter(Boolean))].sort(),
    onlyRecorded: Boolean(normalized.onlyRecorded),
  };
}

function filtersEqual(left, right) {
  return JSON.stringify(normalizeFilters(left)) === JSON.stringify(normalizeFilters(right));
}

function appliedFilters() {
  if (!state.appliedFilters) {
    state.appliedFilters = normalizeFilters(currentFiltersFromControls());
  }
  return state.appliedFilters;
}

function updateApplyFiltersState() {
  state.filtersDirty = !filtersEqual(currentFiltersFromControls(), appliedFilters());
  if (el.applyFilters) {
    el.applyFilters.disabled = !state.filtersDirty;
  }
}

function filtersQuery(includePaging = false) {
  const current = appliedFilters();
  const params = new URLSearchParams();
  if (current.managerIds.length) params.set("managerIds", current.managerIds.join(","));
  if (current.dateFrom) params.set("dateFrom", current.dateFrom);
  if (current.dateTo) params.set("dateTo", current.dateTo);
  if (current.directions.length) params.set("directions", current.directions.join(","));
  if (current.analysisStates.length) params.set("analysisStates", current.analysisStates.join(","));
  if (current.scenarioIds.length) params.set("scenarioIds", current.scenarioIds.join(","));
  params.set("onlyRecorded", String(current.onlyRecorded));
  if (includePaging) {
    params.set("page", String(state.page));
    params.set("pageSize", String(state.callsPageSize || PAGE_SIZE));
  }
  return params.toString();
}

function callsPageCacheKey(page = state.page, pageSize = state.callsPageSize || PAGE_SIZE) {
  const baseQuery = filtersQuery(false) || "_";
  return `${baseQuery}::page=${Math.max(1, Number(page || 1))}::pageSize=${Math.max(1, Number(pageSize || PAGE_SIZE))}`;
}

function callsPageQuery(page = state.page, pageSize = state.callsPageSize || PAGE_SIZE) {
  const params = new URLSearchParams(filtersQuery(false));
  params.set("page", String(Math.max(1, Number(page || 1))));
  params.set("pageSize", String(Math.max(1, Number(pageSize || PAGE_SIZE))));
  return params.toString();
}

function cacheCallsPage(key, data) {
  if (!key || !data) return;
  if (callsPageCache.has(key)) {
    callsPageCache.delete(key);
  }
  callsPageCache.set(key, data);
  while (callsPageCache.size > CALLS_PAGE_CACHE_LIMIT) {
    const oldestKey = callsPageCache.keys().next().value;
    if (!oldestKey) break;
    callsPageCache.delete(oldestKey);
  }
}

function clearCallsPageCache() {
  callsPageCache.clear();
  callsPagePrefetchInFlight.clear();
  state.callsNextCursor = "";
  state.callsCursorByPage = {};
}

function virtualCallsEnabled() {
  return false;
}

function visibleCallsWindow() {
  const calls = pagedCalls();
  if (!virtualCallsEnabled()) {
    return {
      items: calls,
      topSpacer: 0,
      bottomSpacer: 0,
    };
  }

  const viewportHeight = Math.max(Number(state.callsVirtual.viewportHeight || 0), CALLS_VIRTUAL_ROW_HEIGHT * 6);
  const scrollTop = Math.max(0, Number(state.callsVirtual.scrollTop || 0));
  const startIndex = Math.max(0, Math.floor(scrollTop / CALLS_VIRTUAL_ROW_HEIGHT) - CALLS_VIRTUAL_OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / CALLS_VIRTUAL_ROW_HEIGHT) + CALLS_VIRTUAL_OVERSCAN * 2;
  const endIndex = Math.min(calls.length, startIndex + visibleCount);

  return {
    items: calls.slice(startIndex, endIndex),
    topSpacer: startIndex * CALLS_VIRTUAL_ROW_HEIGHT,
    bottomSpacer: Math.max(0, (calls.length - endIndex) * CALLS_VIRTUAL_ROW_HEIGHT),
  };
}

function updateCallsViewportMetrics() {
  if (!el.callsTableWrap) return;
  state.callsVirtual.viewportHeight = el.callsTableWrap.clientHeight || 0;
}

function pageCursorFor(page) {
  return state.callsCursorByPage[String(Math.max(1, Number(page || 1)))] || null;
}

function rememberPageCursor(page, data, requestCursor = "") {
  const normalizedPage = Math.max(1, Number(page || 1));
  state.callsCursorByPage[String(normalizedPage)] = {
    cursorUsed: requestCursor || "",
    nextCursor: String(data.nextCursor || ""),
  };
  if (normalizedPage === 1 && !requestCursor) {
    state.callsCursorByPage["1"].cursorUsed = "";
  }
}

function prefetchCursorForPage(page) {
  if (page <= 1) return "";
  const previousPage = pageCursorFor(page - 1);
  return String(previousPage?.nextCursor || "");
}

function formatDuration(seconds) {
  const safe = Number(seconds || 0);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function callMetaLine(source = {}) {
  const parts = [];
  if (source.managerName) parts.push(source.managerName);
  if (source.direction) parts.push(localizeDirection(source.direction));
  if (Number(source.durationSeconds) > 0) parts.push(formatDuration(source.durationSeconds));
  return parts.join(" • ");
}

function analysisOverride(activityId) {
  return state.analysisOverrides[String(activityId)] || null;
}

function isActiveAnalysisState(value) {
  return ["queued", "processing"].includes(String(value || ""));
}

function isTerminalAnalysisState(value) {
  return ["ready", "partial", "technical", "outdated", "error", "missing"].includes(String(value || ""));
}

function normalizeDisplayAnalysisState(value) {
  const normalized = String(value || "").trim();
  return normalized === "technical" ? "partial" : normalized;
}

function effectiveAnalysis(call) {
  return analysisOverride(call.id) || call.analysis || null;
}

function setAnalysisOverride(activityId, analysis) {
  state.analysisOverrides[String(activityId)] = {
    ...(state.analysisOverrides[String(activityId)] || {}),
    ...analysis,
    activityId,
  };
}

function clearAnalysisOverride(activityId) {
  delete state.analysisOverrides[String(activityId)];
}

function scenarioSelectionOverride(activityId) {
  return Object.prototype.hasOwnProperty.call(state.scenarioSelections, String(activityId))
    ? state.scenarioSelections[String(activityId)]
    : null;
}

function setScenarioSelectionOverride(activityId, scenarioId) {
  state.scenarioSelections[String(activityId)] = String(scenarioId || "");
}

function clearScenarioSelectionOverride(activityId) {
  delete state.scenarioSelections[String(activityId)];
}

function callById(activityId) {
  return state.calls.find((item) => String(item.id) === String(activityId)) || null;
}

function resolvedAnalysisForCall(activityId) {
  const call = callById(activityId);
  return call ? effectiveAnalysis(call) : analysisOverride(activityId);
}

function syncAnalysisOverride(call) {
  const override = analysisOverride(call.id);
  if (!override) return;

  const serverAnalysis = call.analysis || null;
  if (!serverAnalysis) {
    if (!isActiveAnalysisState(override.state)) {
      clearAnalysisOverride(call.id);
    }
    return;
  }

  const serverUpdatedAt = String(serverAnalysis.updatedAt || "");
  const overrideUpdatedAt = String(override.updatedAt || "");
  const serverState = String(serverAnalysis.state || "");
  const overrideState = String(override.state || "");

  if (isTerminalAnalysisState(serverState)) {
    clearAnalysisOverride(call.id);
    return;
  }

  if (serverUpdatedAt && overrideUpdatedAt && serverUpdatedAt !== overrideUpdatedAt) {
    clearAnalysisOverride(call.id);
    return;
  }

  if (isActiveAnalysisState(overrideState)) {
    if (isActiveAnalysisState(serverState) && serverState !== overrideState) {
      clearAnalysisOverride(call.id);
    }
    return;
  }

  if (serverState !== overrideState) {
    clearAnalysisOverride(call.id);
  }
}

function defaultScenario() {
  return state.scenarios.find((scenario) => scenario.isDefault) || state.scenarios[0] || null;
}

function scenarioMatchesCall(call, scenario) {
  const rules = scenario?.matchRules || {};
  if (rules.directions?.length && !rules.directions.includes(call.direction)) return false;
  if (rules.managerIds?.length && !rules.managerIds.includes(Number(call.managerId))) return false;
  if (rules.entityTypeIds?.length && !rules.entityTypeIds.includes(Number(call.ownerTypeId))) return false;
  if (Number.isFinite(rules.minDurationSeconds) && Number(call.durationSeconds || 0) < Number(rules.minDurationSeconds)) return false;
  if (Number.isFinite(rules.maxDurationSeconds) && Number(call.durationSeconds || 0) > Number(rules.maxDurationSeconds)) return false;
  if (rules.subjectKeywords?.length) {
    const subject = String(call.subject || "").toLowerCase();
    if (!rules.subjectKeywords.some((keyword) => subject.includes(String(keyword || "").toLowerCase()))) return false;
  }
  return true;
}

function scenarioPriorityScore(call, scenario) {
  const rules = scenario?.matchRules || {};
  let score = 0;
  if (rules.entityTypeIds?.length) score += 5;
  if (rules.managerIds?.length) score += 4;
  if (rules.subjectKeywords?.length) score += 3;
  if (rules.directions?.length) score += 2;
  if (Number.isFinite(rules.minDurationSeconds) || Number.isFinite(rules.maxDurationSeconds)) score += 1;
  if (scenario.isDefault) score -= 10;
  if (call.ownerTypeId && rules.entityTypeIds?.includes(Number(call.ownerTypeId))) score += 2;
  if (call.direction && rules.directions?.includes(call.direction)) score += 1;
  if (call.managerId && rules.managerIds?.includes(Number(call.managerId))) score += 2;
  return score;
}

function recommendedScenarioForCall(call) {
  if (!call) return defaultScenario();
  const candidates = state.scenarios.filter((scenario) => scenario.autoApply && scenarioMatchesCall(call, scenario));
  if (!candidates.length) return defaultScenario();
  return [...candidates].sort((left, right) => scenarioPriorityScore(call, right) - scenarioPriorityScore(call, left))[0] || defaultScenario();
}

function selectedScenarioIdForCall(call) {
  const selectionOverride = scenarioSelectionOverride(call?.id);
  if (
    selectionOverride !== null &&
    state.scenarios.some((scenario) => String(scenario.id) === String(selectionOverride))
  ) {
    return selectionOverride;
  }
  const analysis = effectiveAnalysis(call);
  const persisted = state.scenarios.find((scenario) => String(scenario.id) === String(analysis?.selectedScenarioId || ""));
  if (persisted && !persisted.isDefault) {
    return persisted.id;
  }
  return recommendedScenarioForCall(call)?.id || persisted?.id || defaultScenario()?.id || "";
}

function selectedScenarioForCall(call) {
  if (!call) return defaultScenario();
  const selectedId = selectedScenarioIdForCall(call);
  return (
    state.scenarios.find((scenario) => String(scenario.id) === String(selectedId || "")) ||
    recommendedScenarioForCall(call) ||
    defaultScenario()
  );
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("ru-RU") : "—";
}

function formatDay(value) {
  return value ? new Date(value).toLocaleDateString("ru-RU") : "—";
}

function formatDayShort(value) {
  if (!value) return "—";
  const date = new Date(value);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}`;
}

function formatCallDateTime(value) {
  return value
    ? new Date(value).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

function callClientTitle(call = {}) {
  if (call.clientName) return call.clientName;
  if (call.ownerTypeLabel && call.ownerId) return `${call.ownerTypeLabel} #${call.ownerId}`;
  return "Клиент не определён";
}

function updateOverlayState() {
  const hasOpenOverlay =
    Boolean(el.analysisDrawer?.classList.contains("open")) ||
    Boolean(el.autoTranscriptionModal?.classList.contains("open")) ||
    Boolean(el.scenarioModal?.classList.contains("open"));
  document.body.classList.toggle("drawer-open", hasOpenOverlay);
}

function setAnalysisDrawerOpen(open) {
  if (!el.analysisDrawer) return;
  el.analysisDrawer.classList.toggle("open", Boolean(open));
  updateOverlayState();
}

function setAutoTranscriptionModalOpen(open) {
  if (!el.autoTranscriptionModal) return;
  el.autoTranscriptionModal.classList.toggle("open", Boolean(open));
  updateOverlayState();
}

function setScenarioModalOpen(open) {
  if (!el.scenarioModal) return;
  el.scenarioModal.classList.toggle("open", Boolean(open));
  updateOverlayState();
}

function setAnalysisHeaderMeta(html = "") {
  if (!el.analysisHeaderMeta) return;
  el.analysisHeaderMeta.innerHTML = html;
}

function detailMetaMarkup(source = {}) {
  const metaLine = callMetaLine(source);
  return metaLine ? `<div class="muted">${escapeHtml(metaLine)}</div>` : "";
}

function analysisHeaderStatusMarkup(label, source = {}, tone = "neutral") {
  const hasSourceMeta = Boolean(
    source?.clientName ||
      source?.clientPhone ||
      source?.direction ||
      source?.startTime ||
      Number(source?.durationSeconds) > 0 ||
      source?.ownerId,
  );
  if (!hasSourceMeta) {
    return `<span class="analysis-status-badge ${escapeHtml(tone)}">${escapeHtml(`Статус: ${label}`)}</span>`;
  }
  const parts = [
    `Клиент: ${callClientTitle(source)}`,
    `Телефон: ${source.clientPhone || "—"}`,
    `Направление: ${localizeDirection(source.direction)}`,
    `Дата и время: ${formatCallDateTime(source.startTime)}`,
    `Длительность: ${formatDuration(source.durationSeconds)}`,
  ];

  return `<span class="analysis-status-meta">${parts.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</span>`;
}

function analysisHeaderMarkup(analysis, options = {}) {
  const scoreValue = analysis?.scriptAnalysis?.overallScore ?? "—";
  const complianceValue = analysis?.scriptAnalysis?.compliancePercent ?? "—";
  const totalTokens = analysis?.tokenUsage?.totalTokens ?? "—";
  const transcriptionTokens = analysis?.tokenUsage?.transcriptionTokens ?? "—";
  const analysisTokens = analysis?.tokenUsage?.analysisTotalTokens ?? "—";
  const scenarioName = options.scenarioName || analysis?.selectedScenarioName || "Автосценарий";
  const statusLabel = String(options.statusLabel || "").trim();
  const statusTone = String(options.statusTone || "neutral").trim();
  const playbackDuration = Math.max(
    0,
    Number(
      state.playback.duration ||
        options.playbackDuration ||
        analysis?.durationSeconds ||
        options.sourceCall?.durationSeconds ||
        0,
    ),
  );
  const playbackCurrentTime = Math.max(0, Math.min(Number(state.playback.currentTime || 0), playbackDuration || Number.MAX_SAFE_INTEGER));
  const isPlayingFullCall =
    state.playback.activityId === analysis?.activityId &&
    state.playback.mode === "full-call";
  const navLinks = options.showNav
    ? `
      <div class="analysis-header-nav">
        <a class="analysis-header-link" href="#analysisOverview">Резюме</a>
        <a class="analysis-header-link" href="#analysisRecommendations">Рекомендации</a>
        <a class="analysis-header-link" href="#analysisScript">Проверка сценария</a>
        <a class="analysis-header-link" href="#analysisMetrics">Индивидуальные параметры</a>
        <a class="analysis-header-link" href="#analysisTranscript">Транскрипт</a>
        ${analysis?.crmEntityUrl
          ? `<a class="analysis-header-link" href="${escapeHtml(analysis.crmEntityUrl)}" target="_blank" rel="noopener noreferrer">Открыть в Bitrix24</a>`
          : ""}
      </div>`
    : "";
  const pills = [];
  if (statusLabel) {
    pills.push(`<span class="analysis-status-badge ${escapeHtml(statusTone)}">${escapeHtml(`Статус: ${statusLabel}`)}</span>`);
  }
  if (options.showDetailPills) {
    pills.push(`<span class="pill">Сентимент: ${escapeHtml(localizeSentiment(analysis?.overview?.sentiment))}</span>`);
    pills.push(`<span class="pill">Риск: ${escapeHtml(localizeRisk(analysis?.overview?.riskLevel))}</span>`);
    pills.push(`<span class="pill">Score: ${escapeHtml(scoreValue)}</span>`);
    pills.push(`<span class="pill">Сценарий: ${escapeHtml(scenarioName)}</span>`);
    pills.push(`<span class="pill">Скрипт: ${escapeHtml(complianceValue)}%</span>`);
    pills.push(
      `<span class="pill">Токены: ${escapeHtml(totalTokens)} (транскрибация ${escapeHtml(transcriptionTokens)}, анализ ${escapeHtml(analysisTokens)})</span>`,
    );
  } else if (options.showScenarioPill) {
    pills.push(`<span class="pill">Сценарий: ${escapeHtml(scenarioName)}</span>`);
  }
  return `
    <div class="analysis-header-rows">
      <div class="analysis-header-top">
        <div class="analysis-header-pills">${pills.join("")}</div>
      </div>
      ${navLinks}
    </div>
  `;
}

function analysisAudioControlsMarkup(analysis) {
  if (!analysis?.recordingUrl) return "";
  const sourceCall = callById(analysis?.activityId) || {};
  const playbackDuration = Number(
    state.playback.duration ||
      analysis.durationSeconds ||
      sourceCall.durationSeconds ||
      0
  );
  const playbackCurrentTime = Number(state.playback.currentTime || 0);
  const isPlayingFullCall = state.playback.mode === "full-call" && !transcriptPlayback.audio.paused;
  return `
    <div class="analysis-header-audio transcript-audio-controls">
      <div class="analysis-header-audio-track">
        <span class="analysis-header-audio-time" data-role="playback-current">${escapeHtml(formatTimestamp(playbackCurrentTime))}</span>
        <input
          class="analysis-header-audio-range"
          type="range"
          min="0"
          max="${escapeHtml(Math.max(playbackDuration, 1))}"
          step="0.1"
          value="${escapeHtml(Math.min(playbackCurrentTime, Math.max(playbackDuration, 1)))}"
          data-action="seek-call-audio"
          ${state.playback.loading ? "disabled" : ""}
        />
        <span class="analysis-header-audio-time" data-role="playback-duration">${escapeHtml(formatTimestamp(playbackDuration))}</span>
      </div>
      <button type="button" class="analysis-audio-button ${isPlayingFullCall ? "is-active" : ""}" data-action="toggle-full-call-audio">${isPlayingFullCall ? "■ Остановить разговор" : "▶ Прослушать разговор"}</button>
    </div>`;
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

function parseTimestampLabel(label) {
  const source = String(label || "").trim();
  if (!source) return null;
  const parts = source.split(":").map((item) => Number(item));
  if (parts.some((item) => !Number.isFinite(item))) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return null;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summaryCard(title, value, hint) {
  return `<article class="summary-card"><div class="muted">${title}</div><div class="value">${value}</div><div class="hint">${hint}</div></article>`;
}

function parseMetricsInput(raw) {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw.trim());
    return Array.isArray(data) ? data : [];
  } catch {
    return raw
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function parsedCustomMetrics() {
  return [];
}

function parseTextList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumericList(value) {
  return parseTextList(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function localizeSentiment(value) {
  const map = {
    positive: "Позитивный",
    neutral: "Нейтральный",
    negative: "Негативный",
    mixed: "Смешанный",
    positive_call: "Позитивный",
    neutral_call: "Нейтральный",
    negative_call: "Негативный",
    позитивный: "Позитивный",
    нейтральный: "Нейтральный",
    негативный: "Негативный",
    смешанный: "Смешанный",
  };
  return map[String(value || "").toLowerCase()] || value || "—";
}

function localizeRisk(value) {
  const map = {
    low: "Низкий",
    medium: "Средний",
    high: "Высокий",
    low_risk: "Низкий",
    medium_risk: "Средний",
    high_risk: "Высокий",
    низкий: "Низкий",
    средний: "Средний",
    высокий: "Высокий",
  };
  return map[String(value || "").toLowerCase()] || value || "—";
}

function localizeCheckpointStatus(value) {
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
  return map[String(value || "").toLowerCase()] || value || "—";
}

function localizeDirection(value) {
  return value === "incoming" ? "Входящий" : value === "outgoing" ? "Исходящий" : value || "—";
}

function ownerTypeLabel(value) {
  const map = {
    1: "Лид",
    2: "Сделка",
    3: "Контакт",
    4: "Компания",
    31: "Смарт-процесс",
  };
  return map[Number(value)] || (value ? `CRM ${value}` : "—");
}

function autoTranscriptionMode() {
  return document.querySelector('input[name="autoTranscriptionMode"]:checked')?.value || "disabled";
}

function localizeFreeText(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "—";

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

function isTemporaryHtmlError(error) {
  return /html вместо json/i.test(String(error?.message || ""));
}

function notifyLoadError(error) {
  if (isTemporaryHtmlError(error)) {
    if (el.statusText) {
      el.statusText.textContent = "Сервер временно перезапускается. Данные будут доступны после повторной загрузки.";
    }
    return;
  }
  alert(error.message);
}

function participantBadgeClass(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized.includes("1")) return "participant-1";
  if (normalized.includes("2")) return "participant-2";
  return "participant-other";
}

function transcriptRoleLabel(segment, index) {
  const candidates = [
    segment?.speakerLabel,
    segment?.speakerName,
    segment?.speaker,
    segment?.speakerId,
    segment?.participant,
    segment?.role,
    segment?.channel,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const normalized = candidates.join(" ").toLowerCase();
  if (
    normalized.includes("2") ||
    normalized.includes("speaker_b") ||
    normalized.includes("participant_b") ||
    normalized.includes("second")
  ) {
    return "Участник 2";
  }
  if (
    normalized.includes("1") ||
    normalized.includes("speaker_a") ||
    normalized.includes("participant_a") ||
    normalized.includes("first")
  ) {
    return "Участник 1";
  }
  return `Участник ${Math.min(2, (index % 2) + 1)}`;
}

function inferTranscriptSegments(analysis) {
  const lines = String(analysis.transcriptText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line, index) => {
      const match = line.match(/^\[(\d{2}:\d{2}(?::\d{2})?)\s*-\s*(\d{2}:\d{2}(?::\d{2})?)\]\s*([^:]+):\s*(.+)$/);
      if (match) {
        return {
          index,
          role: match[3].trim() || `Участник ${Math.min(2, (index % 2) + 1)}`,
          startLabel: match[1],
          endLabel: match[2],
          text: match[4].trim(),
        };
      }
      return {
        index,
        role: `Участник ${Math.min(2, (index % 2) + 1)}`,
        startLabel: "",
        endLabel: "",
        text: line,
      };
    })
    .filter((segment) => segment.text);
}

function transcriptSegmentsMarkup(analysis) {
  const rawSegments = Array.isArray(analysis.transcriptSegments) ? analysis.transcriptSegments : [];
  const segments = rawSegments.length ? rawSegments : inferTranscriptSegments(analysis);
  if (!segments.length) {
    return `<p class="transcript-text">${escapeHtml(analysis.transcriptText || "Транскрипт отсутствует")}</p>`;
  }

  return `<div class="transcript-list">${segments
    .map(
      (segment, index) => {
        const roleLabel = transcriptRoleLabel(segment, index);
        const startSeconds = Number.isFinite(Number(segment.start))
          ? Number(segment.start)
          : parseTimestampLabel(segment.startLabel);
        const endSeconds = Number.isFinite(Number(segment.end))
          ? Number(segment.end)
          : parseTimestampLabel(segment.endLabel);
        const canPlaySegment =
          Boolean(analysis?.recordingUrl) &&
          Number.isFinite(startSeconds) &&
          Number.isFinite(endSeconds) &&
          endSeconds > startSeconds;
        const segmentKey = `${analysis?.activityId || "call"}:${index}:${startSeconds ?? "na"}:${endSeconds ?? "na"}`;
        const isActiveSegment = state.playback.activityId === analysis?.activityId && state.playback.segmentKey === segmentKey;
        return `
        <article class="transcript-row">
          <div class="transcript-meta-line">
            <span class="transcript-role">
              <span class="transcript-role-badge ${participantBadgeClass(roleLabel)}">${escapeHtml(roleLabel)}</span>
              <span class="transcript-time">${escapeHtml(segment.startLabel || formatTimestamp(segment.start))} - ${escapeHtml(segment.endLabel || formatTimestamp(segment.end))}</span>
            </span>
            <button
              type="button"
              class="transcript-play-button ${isActiveSegment ? "is-active" : ""}"
              data-action="play-segment"
              data-start="${escapeHtml(startSeconds ?? "")}"
              data-end="${escapeHtml(endSeconds ?? "")}"
              data-segment-key="${escapeHtml(segmentKey)}"
              data-playable="${canPlaySegment ? "true" : "false"}"
              ${canPlaySegment ? "" : "disabled"}
            >${isActiveSegment ? "■ Стоп" : "▶ Фрагмент"}</button>
          </div>
          <p class="transcript-text">${escapeHtml(segment.text || "")}</p>
        </article>`;
      },
    )
    .join("")}</div>`;
}

function transcriptFullTextValue(analysis) {
  const rawSegments = Array.isArray(analysis?.transcriptSegments) ? analysis.transcriptSegments : [];
  const segments = rawSegments.length ? rawSegments : inferTranscriptSegments(analysis || {});
  if (segments.length) {
    return segments
      .map((segment, index) => {
        const roleLabel = transcriptRoleLabel(segment, index);
        const text = String(segment?.text || "").trim();
        return text ? `${roleLabel}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return String(analysis?.transcriptText || "")
    .split("\n")
    .map((line) => line.replace(/^\[(\d{2}:\d{2}(?::\d{2})?)\s*-\s*(\d{2}:\d{2}(?::\d{2})?)\]\s*/g, "").trim())
    .filter(Boolean)
    .join("\n");
}

function transcriptFullTextMarkup(analysis) {
  const fullText = transcriptFullTextValue(analysis).trim();
  if (!fullText) {
    return `<p class="transcript-text">Полный текст транскрипта отсутствует</p>`;
  }

  return `<div class="transcript-fulltext-card"><p class="transcript-text">${escapeHtml(fullText)}</p></div>`;
}

const transcriptPlayback = {
  audio: typeof Audio !== "undefined" ? new Audio() : null,
  objectUrl: "",
  stopAt: null,
  pendingSeek: null,
};

function revokePlaybackObjectUrl() {
  if (!transcriptPlayback.objectUrl) return;
  URL.revokeObjectURL(transcriptPlayback.objectUrl);
  transcriptPlayback.objectUrl = "";
}

function updateTranscriptPlaybackButtons() {
  document.querySelectorAll('[data-action="play-segment"]').forEach((button) => {
    const isActive =
      String(button.dataset.segmentKey || "") === String(state.playback.segmentKey || "") &&
      String(state.selectedAnalysis?.activityId || "") === String(state.playback.activityId || "");
    const isPlayable = button.dataset.playable === "true";
    button.classList.toggle("is-active", isActive);
    button.textContent = isActive ? "■ Стоп" : "▶ Фрагмент";
    button.disabled = !isPlayable || Boolean(state.playback.loading && !isActive);
  });
  const fullCallButton = document.querySelector('[data-action="toggle-full-call-audio"]');
  if (fullCallButton) {
    const isActive =
      state.playback.mode === "full-call" &&
      String(state.selectedAnalysis?.activityId || "") === String(state.playback.activityId || "");
    fullCallButton.classList.toggle("is-active", isActive);
    fullCallButton.textContent = isActive ? "■ Остановить разговор" : "▶ Прослушать разговор";
    fullCallButton.disabled = Boolean(state.playback.loading);
  }
  const audioRange = document.querySelector('[data-action="seek-call-audio"]');
  if (audioRange) {
    const max = Math.max(1, Number(state.playback.duration || audioRange.max || 1));
    if (!state.playback.seeking) {
      audioRange.max = String(max);
      audioRange.value = String(Math.max(0, Math.min(Number(state.playback.currentTime || 0), max)));
    }
    audioRange.disabled = Boolean(state.playback.loading);
  }
  const currentLabel = document.querySelector('[data-role="playback-current"]');
  if (currentLabel) {
    currentLabel.textContent = formatTimestamp(state.playback.currentTime || 0);
  }
  const durationLabel = document.querySelector('[data-role="playback-duration"]');
  if (durationLabel) {
    durationLabel.textContent = formatTimestamp(state.playback.duration || 0);
  }
}

function stopTranscriptPlayback(resetState = true) {
  if (transcriptPlayback.audio) {
    transcriptPlayback.audio.pause();
  }
  transcriptPlayback.stopAt = null;
  transcriptPlayback.pendingSeek = null;
  if (resetState) {
    state.playback.activityId = null;
    state.playback.segmentKey = "";
    state.playback.loading = false;
    state.playback.mode = "";
    state.playback.currentTime = 0;
    state.playback.duration = 0;
    state.playback.seeking = false;
    updateTranscriptPlaybackButtons();
  }
}

async function ensureTranscriptAudioSource(analysis) {
  if (!analysis?.recordingUrl) {
    throw new Error("Для этого звонка запись недоступна.");
  }
  if (
    transcriptPlayback.audio &&
    transcriptPlayback.objectUrl &&
    state.playback.activityId === analysis.activityId &&
    state.playback.audioUrl === analysis.recordingUrl
  ) {
    return;
  }

  state.playback.loading = true;
  updateTranscriptPlaybackButtons();
  stopTranscriptPlayback(false);

  const response = await fetch(analysis.recordingUrl);
  if (!response.ok) {
    throw new Error("Не удалось загрузить запись звонка.");
  }

  const audioBlob = await response.blob();
  revokePlaybackObjectUrl();
  transcriptPlayback.objectUrl = URL.createObjectURL(audioBlob);
  transcriptPlayback.audio.src = transcriptPlayback.objectUrl;
  state.playback.activityId = analysis.activityId;
  state.playback.audioUrl = analysis.recordingUrl;
  state.playback.loading = false;
  state.playback.currentTime = 0;
  state.playback.duration = 0;
  updateTranscriptPlaybackButtons();
}

async function playTranscriptSegment(button) {
  const analysis = state.selectedAnalysis;
  if (!analysis) return;

  const segmentKey = String(button.dataset.segmentKey || "");
  const start = Number(button.dataset.start);
  const end = Number(button.dataset.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;

  if (state.playback.activityId === analysis.activityId && state.playback.segmentKey === segmentKey) {
    stopTranscriptPlayback();
    return;
  }

  await ensureTranscriptAudioSource(analysis);
  state.playback.activityId = analysis.activityId;
  state.playback.segmentKey = segmentKey;
  state.playback.mode = "segment";
  transcriptPlayback.stopAt = end;
  transcriptPlayback.pendingSeek = start;

  const audio = transcriptPlayback.audio;
  const startPlayback = async () => {
    if (transcriptPlayback.pendingSeek != null) {
      audio.currentTime = transcriptPlayback.pendingSeek;
      transcriptPlayback.pendingSeek = null;
    }
    await audio.play();
  };

  if (audio.readyState >= 1) {
    await startPlayback();
  } else {
    await new Promise((resolve, reject) => {
      const onLoaded = () => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("error", onError);
        reject(new Error("Не удалось открыть запись звонка."));
      };
      audio.addEventListener("loadedmetadata", onLoaded, { once: true });
      audio.addEventListener("error", onError, { once: true });
      audio.load();
    });
    await startPlayback();
  }

  updateTranscriptPlaybackButtons();
}

async function toggleFullCallPlayback() {
  const analysis = state.selectedAnalysis;
  if (!analysis?.recordingUrl) return;

  const isPlayingFullCall =
    state.playback.activityId === analysis.activityId &&
    state.playback.mode === "full-call";
  if (isPlayingFullCall) {
    stopTranscriptPlayback();
    return;
  }

  await ensureTranscriptAudioSource(analysis);
  state.playback.activityId = analysis.activityId;
  state.playback.segmentKey = "";
  state.playback.mode = "full-call";
  transcriptPlayback.stopAt = null;
  transcriptPlayback.pendingSeek = 0;

  const audio = transcriptPlayback.audio;
  const startPlayback = async () => {
    if (transcriptPlayback.pendingSeek != null) {
      audio.currentTime = transcriptPlayback.pendingSeek;
      transcriptPlayback.pendingSeek = null;
    }
    await audio.play();
  };

  if (audio.readyState >= 1) {
    await startPlayback();
  } else {
    await new Promise((resolve, reject) => {
      const onLoaded = () => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("error", onError);
        reject(new Error("Не удалось открыть запись звонка."));
      };
      audio.addEventListener("loadedmetadata", onLoaded, { once: true });
      audio.addEventListener("error", onError, { once: true });
      audio.load();
    });
    await startPlayback();
  }

  updateTranscriptPlaybackButtons();
}

if (transcriptPlayback.audio) {
  transcriptPlayback.audio.preload = "auto";
  transcriptPlayback.audio.addEventListener("loadedmetadata", () => {
    state.playback.duration = Number.isFinite(transcriptPlayback.audio.duration) ? transcriptPlayback.audio.duration : 0;
    state.playback.currentTime = Number(transcriptPlayback.audio.currentTime || 0);
    updateTranscriptPlaybackButtons();
  });
  transcriptPlayback.audio.addEventListener("timeupdate", () => {
    state.playback.currentTime = Number(transcriptPlayback.audio.currentTime || 0);
    if (Number.isFinite(transcriptPlayback.audio.duration)) {
      state.playback.duration = Number(transcriptPlayback.audio.duration || 0);
    }
    updateTranscriptPlaybackButtons();
    if (transcriptPlayback.stopAt == null) return;
    if (transcriptPlayback.audio.currentTime >= transcriptPlayback.stopAt) {
      stopTranscriptPlayback();
    }
  });
  transcriptPlayback.audio.addEventListener("ended", () => {
    stopTranscriptPlayback();
  });
  transcriptPlayback.audio.addEventListener("pause", () => {
    if (state.playback.mode === "full-call" && transcriptPlayback.stopAt == null) {
      updateTranscriptPlaybackButtons();
    }
  });
}

function collectScenarioPayload() {
  return {
    name: el.scenarioName.value.trim(),
    description: el.scenarioDescription.value.trim(),
    scriptChecklist: el.scenarioScriptChecklist.value.trim(),
    customMetrics: parseMetricsInput(el.scenarioCustomMetrics.value),
    autoApply: el.scenarioAutoApply.checked,
    isDefault: el.scenarioIsDefault.checked,
    matchRules: {
      directions: el.scenarioDirection.value ? [el.scenarioDirection.value] : [],
      managerIds: selectedScenarioRuleValues("scenario-manager").map((value) => Number(value)).filter(Number.isFinite),
      entityTypeIds: selectedScenarioRuleValues("scenario-entity-type").map((value) => Number(value)).filter(Number.isFinite),
      subjectKeywords: parseTextList(el.scenarioKeywords.value),
      minDurationSeconds: el.scenarioMinDuration.value.trim() === "" ? null : Number(el.scenarioMinDuration.value),
      maxDurationSeconds: el.scenarioMaxDuration.value.trim() === "" ? null : Number(el.scenarioMaxDuration.value),
    },
  };
}

function collectScenarioSubmitPayload() {
  const existing = state.scenarios.find((item) => String(item.id) === String(state.selectedScenarioId));
  return {
    id: existing?.id,
    ...collectScenarioPayload(),
  };
}

function scenarioById(id) {
  return state.scenarios.find((item) => String(item.id) === String(id)) || null;
}

function defaultScenarioCount() {
  return state.scenarios.filter((scenario) => scenario.isDefault).length;
}

function isOnlyDefaultScenario(id) {
  const current = scenarioById(id);
  return Boolean(current?.isDefault) && defaultScenarioCount() === 1;
}

function scenarioTags(scenario) {
  const tags = [];
  if (scenario.autoApply) tags.push("Автоподбор");
  if (scenario.isDefault) tags.push("По умолчанию");
  if (scenario.matchRules?.directions?.length) {
    tags.push(scenario.matchRules.directions.map((item) => localizeDirection(item)).join(", "));
  }
  return tags;
}

function scenarioRuleSummaries(scenario) {
  const rules = [];
  if (scenario.matchRules?.managerIds?.length) {
    rules.push(`Менеджеры: ${scenario.matchRules.managerIds.map((item) => managerNameById(item)).join(", ")}`);
  }
  if (scenario.matchRules?.entityTypeIds?.length) {
    rules.push(`CRM: ${scenario.matchRules.entityTypeIds.map((item) => ownerTypeLabel(item)).join(", ")}`);
  }
  if (scenario.matchRules?.subjectKeywords?.length) rules.push(`Ключи: ${scenario.matchRules.subjectKeywords.join(", ")}`);
  if (scenario.matchRules?.minDurationSeconds != null) rules.push(`От ${scenario.matchRules.minDurationSeconds} сек`);
  if (scenario.matchRules?.maxDurationSeconds != null) rules.push(`До ${scenario.matchRules.maxDurationSeconds} сек`);
  return rules;
}

function scenarioChecklistCount(scenario) {
  return String(scenario?.scriptChecklist || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;
}

function scenarioCustomMetricCount(scenario) {
  return Array.isArray(scenario?.customMetrics) ? scenario.customMetrics.filter(Boolean).length : 0;
}

function pluralizeRu(value, one, few, many) {
  const normalized = Math.abs(Number(value) || 0);
  const lastTwo = normalized % 100;
  const last = normalized % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function scenarioSummaryPill(value, label, tone = "") {
  return `<span class="analysis-status-badge ${tone}">${value} ${escapeHtml(label)}</span>`;
}

function scenarioSummaryMarkup(scenario = null) {
  const selected = scenario || collectScenarioPayload();
  const checklistCount = scenarioChecklistCount(selected);
  const metricCount = scenarioCustomMetricCount(selected);
  const rulesCount = scenarioRuleSummaries(selected).length;
  return `
    <div class="analysis-header-pills scenario-summary-pills">
      ${scenarioSummaryPill(checklistCount, pluralizeRu(checklistCount, "пункт", "пункта", "пунктов"), "success")}
      ${scenarioSummaryPill(metricCount, pluralizeRu(metricCount, "метрика", "метрики", "метрик"), "neutral")}
      ${scenarioSummaryPill(rulesCount, pluralizeRu(rulesCount, "правило", "правила", "правил"), "warning")}
    </div>`;
}

function scenarioFormSignature() {
  return JSON.stringify(collectScenarioPayload());
}

function updateScenarioDirtyState() {
  state.scenarioDirty = scenarioFormSignature() !== state.scenarioFormBaseline;
  if (el.saveScenario) el.saveScenario.disabled = !state.scenarioDirty;
  if (el.deleteScenario) el.deleteScenario.disabled = !state.selectedScenarioId;
  if (el.copyScenario) el.copyScenario.disabled = !state.selectedScenarioId;
}

function setScenarioFormBaseline(scenario = null) {
  state.scenarioFormBaseline = JSON.stringify(
    scenario
      ? {
          name: scenario.name || "",
          description: scenario.description || "",
          scriptChecklist: scenario.scriptChecklist || "",
          customMetrics: Array.isArray(scenario.customMetrics) ? scenario.customMetrics.filter(Boolean) : [],
          autoApply: Boolean(scenario.autoApply),
          isDefault: Boolean(scenario.isDefault),
          matchRules: {
            directions: scenario.matchRules?.directions || [],
            managerIds: scenario.matchRules?.managerIds || [],
            entityTypeIds: scenario.matchRules?.entityTypeIds || [],
            subjectKeywords: scenario.matchRules?.subjectKeywords || [],
            minDurationSeconds: scenario.matchRules?.minDurationSeconds ?? null,
            maxDurationSeconds: scenario.matchRules?.maxDurationSeconds ?? null,
          },
        }
      : collectScenarioPayload(),
  );
  updateScenarioDirtyState();
}

function resetScenarioRules() {
  el.scenarioDirection.value = "";
  setCheckedValues(el.scenarioManagerIdsOptions, 'input[data-filter-option="scenario-manager"]', []);
  setCheckedValues(el.scenarioEntityTypeIdsOptions, 'input[data-filter-option="scenario-entity-type"]', []);
  el.scenarioKeywords.value = "";
  el.scenarioMinDuration.value = "";
  el.scenarioMaxDuration.value = "";
  refreshFilterLabels();
  updateScenarioDirtyState();
}

function copyScenarioToDraft() {
  if (!state.selectedScenarioId) return;
  const currentDraft = collectScenarioPayload();
  state.selectedScenarioId = "";
  el.scenarioName.value = `${currentDraft.name || "Сценарий"} (копия)`;
  updateScenarioFormMeta(null);
  setScenarioFormBaseline(currentDraft);
  updateScenarioDirtyState();
}

async function saveScenarioInline(id, patch = {}) {
  const current = scenarioById(id);
  if (!current) return;
  if (patch.isDefault === false && isOnlyDefaultScenario(id)) {
    alert("Сценарий по умолчанию должен быть ровно один. Сначала назначьте другой сценарий по умолчанию.");
    renderScenarioList();
    return;
  }
  const payload = {
    ...current,
    ...patch,
    matchRules: {
      ...(current.matchRules || {}),
      ...(patch.matchRules || {}),
    },
  };
  const data = await api("/api/scenarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  state.scenarios = data.scenarios || [];
  if (String(state.selectedScenarioId) === String(id)) {
    applyScenarioToForm(data.scenario);
  } else {
    renderScenarioList();
    updateScenarioDirtyState();
  }
  if (el.statusText) {
    el.statusText.textContent = `Сценарий «${data.scenario.name}» обновлён.`;
  }
}

function filteredScenarios() {
  const query = String(el.scenarioSearch?.value || "").trim().toLowerCase();
  if (!query) return state.scenarios;
  return state.scenarios.filter((scenario) => {
    const haystack = [
      scenario.name,
      scenario.description,
      scenario.scriptChecklist,
      (scenario.customMetrics || []).join(" "),
      scenarioTags(scenario).join(" "),
      scenarioRuleSummaries(scenario).join(" "),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
}

function updateScenarioSummaryCards() {
  return;
}

function updateScenarioFormMeta(scenario = null) {
  const persisted = state.scenarios.find((item) => String(item.id) === String(state.selectedScenarioId)) || null;
  const formScenario = scenario || collectScenarioPayload();
  const isDraft = !persisted;
  if (el.scenarioModalTitle) {
    const draftTitle = el.scenarioName?.value.trim() || "Новый сценарий";
    el.scenarioModalTitle.textContent = isDraft ? draftTitle : (el.scenarioName?.value.trim() || persisted.name || "Сценарий без названия");
  }
  if (el.scenarioSelectionSummary) {
    el.scenarioSelectionSummary.innerHTML = scenarioSummaryMarkup(formScenario);
  }
  updateScenarioDirtyState();
}

function resetScenarioForm() {
  state.selectedScenarioId = "";
  el.scenarioName.value = "";
  el.scenarioDescription.value = "";
  el.scenarioScriptChecklist.value = "";
  el.scenarioCustomMetrics.value = "";
  el.scenarioDirection.value = "";
  setCheckedValues(el.scenarioManagerIdsOptions, 'input[data-filter-option="scenario-manager"]', []);
  setCheckedValues(el.scenarioEntityTypeIdsOptions, 'input[data-filter-option="scenario-entity-type"]', []);
  el.scenarioKeywords.value = "";
  el.scenarioMinDuration.value = "";
  el.scenarioMaxDuration.value = "";
  el.scenarioAutoApply.checked = true;
  el.scenarioIsDefault.checked = false;
  refreshFilterLabels();
  updateScenarioFormMeta(null);
  setScenarioFormBaseline(null);
}

function applyScenarioToForm(scenario) {
  if (!scenario) {
    resetScenarioForm();
    return;
  }
  state.selectedScenarioId = scenario.id;
  el.scenarioName.value = scenario.name || "";
  el.scenarioDescription.value = scenario.description || "";
  el.scenarioScriptChecklist.value = scenario.scriptChecklist || "";
  el.scenarioCustomMetrics.value = (scenario.customMetrics || []).join("\n");
  el.scenarioDirection.value = scenario.matchRules?.directions?.[0] || "";
  setCheckedValues(el.scenarioManagerIdsOptions, 'input[data-filter-option="scenario-manager"]', scenario.matchRules?.managerIds || []);
  setCheckedValues(el.scenarioEntityTypeIdsOptions, 'input[data-filter-option="scenario-entity-type"]', scenario.matchRules?.entityTypeIds || []);
  el.scenarioKeywords.value = (scenario.matchRules?.subjectKeywords || []).join(", ");
  el.scenarioMinDuration.value = scenario.matchRules?.minDurationSeconds ?? "";
  el.scenarioMaxDuration.value = scenario.matchRules?.maxDurationSeconds ?? "";
  el.scenarioAutoApply.checked = Boolean(scenario.autoApply);
  el.scenarioIsDefault.checked = Boolean(scenario.isDefault);
  refreshFilterLabels();
  updateScenarioFormMeta(scenario);
  setScenarioFormBaseline(scenario);
}

function renderScenarioList() {
  if (!el.scenarioList) return;
  const canManage = hasPermission("manageScenarios");
  const scenarios = filteredScenarios();
  const query = String(el.scenarioSearch?.value || "").trim();

  if (el.scenarioLibraryMeta) {
    const baseText = query ? `Найдено ${scenarios.length} из ${state.scenarios.length} сценариев по запросу «${query}».` : "";
    el.scenarioLibraryMeta.textContent = baseText;
  }

  if (!scenarios.length) {
    el.scenarioList.innerHTML = `
      <tr>
        <td colspan="12">
          <div class="scenario-empty-state">
            <h3>Сценарии не найдены</h3>
            <p class="muted">${query ? "Измените поисковый запрос или создайте новый сценарий." : "Создайте первый сценарий, чтобы настроить правила анализа."}</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  el.scenarioList.innerHTML = scenarios
    .map((scenario) => {
      const scenarioNumber = state.scenarios.findIndex((item) => String(item.id) === String(scenario.id)) + 1;
      const checklistCount = scenarioChecklistCount(scenario);
      const metricCount = scenarioCustomMetricCount(scenario);
      const directionLabel = scenario.matchRules?.directions?.length
        ? scenario.matchRules.directions.map((item) => localizeDirection(item)).join(", ")
        : "Любое";
      const managerLabel = scenario.matchRules?.managerIds?.length
        ? scenario.matchRules.managerIds.map((item) => managerNameById(item)).join(", ")
        : "Все";
      const crmLabel = scenario.matchRules?.entityTypeIds?.length
        ? scenario.matchRules.entityTypeIds.map((item) => ownerTypeLabel(item)).join(", ")
        : "Без ограничений";
      const keywordLabel = scenario.matchRules?.subjectKeywords?.length
        ? scenario.matchRules.subjectKeywords.join(", ")
        : "Без ограничений";
      const durationParts = [];
      if (scenario.matchRules?.minDurationSeconds != null) durationParts.push(`от ${scenario.matchRules.minDurationSeconds} сек`);
      if (scenario.matchRules?.maxDurationSeconds != null) durationParts.push(`до ${scenario.matchRules.maxDurationSeconds} сек`);
      return `
        <tr class="${String(state.selectedScenarioId) === String(scenario.id) ? "is-selected" : ""}" data-action="pick-scenario" data-id="${scenario.id}">
          <td class="scenario-index-column">${scenarioNumber}</td>
          <td class="scenario-flag-column">
            <label class="scenario-table-toggle" aria-label="Участвует в автоподборе" title="${scenario.autoApply ? "Участвует в автоподборе" : "Не участвует в автоподборе"}">
              <input type="checkbox" data-action="toggle-scenario-auto" data-id="${scenario.id}" ${scenario.autoApply ? "checked" : ""} ${canManage ? "" : "disabled"} />
            </label>
          </td>
          <td class="scenario-flag-column">
            <label class="scenario-table-toggle" aria-label="Сценарий по умолчанию" title="${scenario.isDefault ? "Сценарий по умолчанию" : "Не сценарий по умолчанию"}">
              <input type="radio" name="scenarioDefaultTable" data-action="toggle-scenario-default" data-id="${scenario.id}" ${scenario.isDefault ? "checked" : ""} ${canManage ? "" : "disabled"} />
            </label>
          </td>
          <td class="scenario-name-column">
            <button type="button" class="scenario-link" data-action="pick-scenario" data-id="${scenario.id}">${escapeHtml(scenario.name)}</button>
          </td>
          <td class="scenario-description-column">${escapeHtml(scenario.description || "Без описания")}</td>
          <td class="scenario-count-column">${checklistCount}</td>
          <td class="scenario-count-column">${metricCount}</td>
          <td>${escapeHtml(directionLabel)}</td>
          <td>${escapeHtml(managerLabel)}</td>
          <td>${escapeHtml(crmLabel)}</td>
          <td>${escapeHtml(keywordLabel)}</td>
          <td>${escapeHtml(durationParts.join(" • ") || "Любая")}</td>
        </tr>`;
    })
    .join("");
}

function setCurrentView(view) {
  if (!viewAllowed(view)) {
    view = firstAllowedView();
  }
  state.currentView = view;
  el.dashboardView.classList.toggle("active", view === "dashboard");
  el.reportView.classList.toggle("active", view === "report");
  el.scenariosView.classList.toggle("active", view === "scenarios");
  el.settingsView.classList.toggle("active", view === "settings");
  el.showDashboardView.classList.toggle("primary-action", view === "dashboard");
  el.showReportView.classList.toggle("primary-action", view === "report");
  el.showScenariosView.classList.toggle("primary-action", view === "scenarios");
  el.showSettingsView.classList.toggle("primary-action", view === "settings");
  if (view !== "report") {
    setAnalysisDrawerOpen(false);
    setAutoTranscriptionModalOpen(false);
  }
  if (view !== "scenarios") {
    setScenarioModalOpen(false);
  }
  if (view === "report") {
    ensureReportViewReady().catch((error) => {
      notifyLoadError(error);
    });
    return;
  }

  if (view === "scenarios") {
    ensureScenariosViewReady().catch((error) => {
      notifyLoadError(error);
    });
    return;
  }

  if (view === "settings") {
    Promise.all([ensureSettingsLoaded(), loadAccessUsers()]).catch((error) => {
      notifyLoadError(error);
    });
  }
}

function analysisFromCall(call) {
  const analysis = effectiveAnalysis(call);
  if (!analysis) return null;
  return {
    ...analysis,
    managerId: call?.managerId ?? analysis.managerId ?? null,
    managerName: call?.managerName || analysis.managerName || "",
  };
}

function dashboardAnalysesFromCalls(calls = []) {
  return calls.map((call) => analysisFromCall(call)).filter(Boolean);
}

async function ensureReportDataLoaded(options = {}) {
  const force = Boolean(options.force);
  if (!force && state.reportDataLoaded) return null;
  if (!force && state.reportDataLoading) return state.reportDataLoading;

  const task = (async () => {
    if (el.statusText) {
      el.statusText.textContent = "Загружаю отчет...";
    }
    await Promise.all([
      loadCalls({ refreshDashboard: false }),
      loadSummary({ refreshDashboard: false }),
    ]);
    state.reportDataLoaded = true;
  })();

  state.reportDataLoading = task.finally(() => {
    state.reportDataLoading = null;
  });

  return state.reportDataLoading;
}

async function ensureManagersLoaded(options = {}) {
  const force = Boolean(options.force);
  if (!force && state.managersLoaded) return null;
  if (!force && state.managersLoading) return state.managersLoading;
  const task = (async () => {
    await loadManagers();
    state.managersLoaded = true;
  })();
  state.managersLoading = task.finally(() => {
    state.managersLoading = null;
  });
  return state.managersLoading;
}

async function ensureSettingsLoaded(options = {}) {
  const force = Boolean(options.force);
  if (!force && state.settingsLoaded) return null;
  if (!force && state.settingsLoading) return state.settingsLoading;
  const task = (async () => {
    await loadSettings();
    state.settingsLoaded = true;
  })();
  state.settingsLoading = task.finally(() => {
    state.settingsLoading = null;
  });
  return state.settingsLoading;
}

async function ensureScenariosLoaded(options = {}) {
  const force = Boolean(options.force);
  if (!force && state.scenariosLoaded) return null;
  if (!force && state.scenariosLoading) return state.scenariosLoading;
  const task = (async () => {
    await loadScenarios();
    state.scenariosLoaded = true;
  })();
  state.scenariosLoading = task.finally(() => {
    state.scenariosLoading = null;
  });
  return state.scenariosLoading;
}

async function ensureScenarioRuleOptionsLoaded(options = {}) {
  const force = Boolean(options.force);
  if (!force && state.scenarioRuleOptionsLoaded) return null;
  if (!force && state.scenarioRuleOptionsLoading) return state.scenarioRuleOptionsLoading;
  const task = (async () => {
    await loadScenarioRuleOptions();
    state.scenarioRuleOptionsLoaded = true;
  })();
  state.scenarioRuleOptionsLoading = task.finally(() => {
    state.scenarioRuleOptionsLoading = null;
  });
  return state.scenarioRuleOptionsLoading;
}

async function ensureReportViewReady() {
  await Promise.all([
    ensureManagersLoaded(),
    ensureScenariosLoaded(),
    ensureSettingsLoaded(),
    ensureReportDataLoaded(),
  ]);
}

async function ensureScenariosViewReady() {
  const tasks = [
    ensureManagersLoaded(),
    ensureScenariosLoaded(),
  ];
  if (hasPermission("manageScenarios")) tasks.push(ensureScenarioRuleOptionsLoaded());
  await Promise.all(tasks);
}

function warmDeferredViewData() {
  setTimeout(() => {
    const tasks = [];
    if (hasPermission("viewReport") || hasPermission("viewScenarios")) tasks.push(ensureManagersLoaded());
    if (hasPermission("manageScenarios")) tasks.push(ensureScenarioRuleOptionsLoaded());
    if (hasPermission("viewReport") || hasPermission("changeAutoTranscription")) tasks.push(ensureSettingsLoaded());
    if (hasPermission("viewReport") || hasPermission("viewScenarios") || hasPermission("manualAnalyze")) {
      tasks.push(ensureScenariosLoaded());
    }
    Promise.allSettled(tasks).catch(() => {
      // Ignore best-effort warmup failures. Data will be loaded on demand.
    });
  }, 0);
}

function analysisStateKey(call) {
  if (!call.hasRecording) return "missing";
  return String(call.analysis?.state || "pending");
}

function analysisStatus(call) {
  if (!call.hasRecording) return { key: "missing", label: "Нет записи", className: "status-missing" };

  switch (normalizeDisplayAnalysisState(call.analysis?.state)) {
    case "queued":
      return { key: "queued", label: "В очереди", className: "status-pending" };
    case "processing":
      return { key: "processing", label: "В работе", className: "status-processing" };
    case "ready":
      return { key: "ready", label: "Готово", className: "status-ready" };
    case "partial":
      return { key: "partial", label: "Частично", className: "status-partial" };
    case "outdated":
      return { key: "outdated", label: "Нужен повтор", className: "status-warning" };
    case "error":
      return { key: "error", label: "Ошибка", className: "status-error" };
    default:
      return { key: "pending", label: "Ожидает анализа", className: "status-pending" };
  }
}

function hydrateSelectedAnalysis() {
  if (!state.selectedAnalysis?.activityId) return;
  const actual = resolvedAnalysisForCall(state.selectedAnalysis.activityId);
  if (actual) state.selectedAnalysis = actual;
}

function pagedCalls() {
  return state.calls;
}

function renderSummaryInto(container, summary) {
  if (!container) return;
  if (!summary) {
    container.innerHTML = "";
    return;
  }
  const missingCalls = Number(summary?.statusBreakdown?.find((item) => item.key === "missing")?.count || state.dashboardStatusBreakdown.find((item) => item.key === "missing")?.count || 0);
  container.innerHTML = [
    summaryCard("Всего звонков", summary.totalCalls || 0, "Общий объём звонков за весь период"),
    summaryCard("Проанализировано звонков", summary.analyzedCalls, "Все сохранённые AI-разборы"),
    summaryCard("Ожидает анализа", summary.awaitingAnalysisCalls ?? summary.pendingCalls ?? 0, "Ожидают запуска или стоят в очереди"),
    summaryCard("Без записи", missingCalls, "Звонки, которые нельзя распознать"),
  ].join("");
}

function renderSummary() {
  renderSummaryInto(el.dashboardSummaryCards, state.dashboardSummary);
}

function autoModeLabel(mode) {
  const map = {
    disabled: "Отключена",
    all: "Все звонки",
    incoming: "Все входящие",
    outgoing: "Все исходящие",
  };
  return map[String(mode || "").trim()] || "Отключена";
}

function autoModeToneClass(mode) {
  const normalized = String(mode || "").trim();
  if (normalized === "disabled") return "";
  if (normalized === "all") return "status-ready";
  return "status-partial";
}

function localizedStatusCountLabel(state) {
  const map = {
    total: "Всего",
    pending: "Ожидает анализа",
    queued: "В очереди",
    ready: "Готово",
    partial: "Частично",
    outdated: "Нужен повтор",
    error: "Ошибка",
    missing: "Нет записи",
  };
  const normalized = normalizeDisplayAnalysisState(state);
  return map[normalized] || normalized;
}

function statusToneClass(state) {
  const map = {
    total: "",
    pending: "status-pending",
    queued: "status-pending",
    ready: "status-ready",
    partial: "status-partial",
    outdated: "status-warning",
    error: "status-error",
    missing: "status-missing",
  };
  return map[normalizeDisplayAnalysisState(state)] || "status-pending";
}

function callsStatusCounts(calls = []) {
  const order = ["total", "ready", "pending", "queued", "partial", "outdated", "error", "missing"];
  const counts = new Map(order.map((key) => [key, 0]));
  counts.set("total", calls.length);
  for (const call of calls) {
    const analysis = effectiveAnalysis(call);
    const normalizedState = normalizeDisplayAnalysisState(analysis?.state || (!call.hasRecording ? "missing" : "pending"));
    const state = normalizedState === "processing" ? "queued" : normalizedState;
    if (counts.has(state)) {
      counts.set(state, (counts.get(state) || 0) + 1);
    }
  }
  return order
    .map((key) => ({ key, count: counts.get(key) || 0 }));
}

function renderReportMeta() {
  if (el.reportAutoMode) {
    el.reportAutoMode.innerHTML = `<span class="report-auto-mode"><span>Автоматическая расшифровка:</span><span class="badge status-breakdown-badge ${autoModeToneClass(state.settings?.autoTranscriptionMode)}">${escapeHtml(autoModeLabel(state.settings?.autoTranscriptionMode))}</span></span>`;
  }
  if (el.callsBreakdown) {
    const items = state.callsStatusBreakdown.length ? state.callsStatusBreakdown : callsStatusCounts(state.calls);
    const totalTokens = Number(state.summary?.totalTokens || 0);
    el.callsBreakdown.innerHTML = items.length
      ? `<div class="status-breakdown">${items
          .map(
            (item) => `
                <span class="status-breakdown-item">
                  <span class="status-breakdown-label">${escapeHtml(localizedStatusCountLabel(item.key))}</span>
                  <span class="badge status-breakdown-badge ${statusToneClass(item.key)}">${escapeHtml(item.count)}</span>
                </span>
              `,
            )
            .join("")}
            <span class="status-breakdown-item status-breakdown-tokens">
              <span class="status-breakdown-label">Токены</span>
              <span class="badge status-breakdown-badge">${escapeHtml(totalTokens)}</span>
            </span>
          </div>`
      : '<div class="status-breakdown muted">Статусы звонков будут показаны после загрузки.</div>';
  }
}

function renderPagination() {
  const totalPages = Math.max(1, Number(state.callsTotalPages || 1));
  if (state.page > totalPages) state.page = totalPages;
  if (el.pageInfo) el.pageInfo.textContent = `Страница ${state.page} из ${totalPages}`;
  if (el.firstPage) el.firstPage.disabled = state.page <= 1;
  if (el.prevPage) el.prevPage.disabled = state.page <= 1;
  if (el.nextPage) el.nextPage.disabled = state.page >= totalPages;
  if (el.lastPage) el.lastPage.disabled = state.page >= totalPages;
}

function renderCallRow(call) {
  const analysis = effectiveAnalysis(call);
  const status = analysisStatus({ ...call, analysis });
  const currentScenarioId = selectedScenarioIdForCall(call);
  const isAnalysisActive = isActiveAnalysisState(status.key);
  const scenarioOptions = [
    `<option value="">Автосценарий</option>`,
    ...state.scenarios.map(
      (scenario) =>
        `<option value="${escapeHtml(scenario.id)}" ${String(currentScenarioId) === String(scenario.id) ? "selected" : ""}>${escapeHtml(scenario.name)}</option>`,
    ),
  ].join("");
  const totalTokens = analysis?.tokenUsage?.totalTokens ?? "—";
  const compliancePercent = status.key === "ready" && Number.isFinite(Number(analysis?.scriptAnalysis?.compliancePercent))
    ? `${analysis.scriptAnalysis.compliancePercent}%`
    : "—";
  const sameScenario = String(analysis?.selectedScenarioId || "") === String(currentScenarioId || "");
  const isReadyAndCurrent = normalizeDisplayAnalysisState(analysis?.state) === "ready" && Boolean(analysis?.isCurrent);
  const isUpToDateReady = sameScenario && isReadyAndCurrent;
  const canManualAnalyze = hasPermission("manualAnalyze");
  const actionDisabled = !canManualAnalyze || !call.hasRecording || isAnalysisActive || isUpToDateReady;
  const actionTitle = !canManualAnalyze
    ? "Нет права на ручной запуск"
    : !call.hasRecording
    ? "Нет записи"
    : isUpToDateReady
      ? "Повторный анализ не требуется"
      : isAnalysisActive
        ? "Анализ уже запущен"
        : "Анализировать звонок";
  const actionIcon = !canManualAnalyze ? "—" : !call.hasRecording ? "×" : isAnalysisActive ? "…" : isUpToDateReady ? "✓" : "▶";

  return `
    <tr class="${String(state.selectedCallId || state.selectedAnalysis?.activityId || "") === String(call.id) ? "is-selected" : ""} is-clickable" data-action="select-call" data-id="${call.id}">
      <td class="call-column">
        <div class="call-subject">${escapeHtml(callClientTitle(call))}</div>
        <div class="call-meta">${escapeHtml(call.clientPhone || "Без номера")}</div>
      </td>
      <td>
        <div>${escapeHtml(call.managerName || "—")}</div>
        ${call.managerPosition ? `<div class="call-meta">${escapeHtml(call.managerPosition)}</div>` : ""}
      </td>
      <td>${localizeDirection(call.direction)}</td>
      <td class="datetime-column">${escapeHtml(formatCallDateTime(call.startTime))}</td>
      <td class="duration-column">${formatDuration(call.durationSeconds)}</td>
      <td><span class="status-pill ${status.className}">${status.label}</span></td>
      <td class="compliance-cell">${escapeHtml(compliancePercent)}</td>
      <td class="scenario-cell"><select class="scenario-select" data-scenario-select="${call.id}" ${isAnalysisActive || !canManualAnalyze ? "disabled" : ""}>${scenarioOptions}</select></td>
      <td class="token-cell">${escapeHtml(totalTokens)}</td>
      <td class="actions-cell"><div class="action-stack"><button class="call-action call-action-icon primary-action" title="${escapeHtml(actionTitle)}" aria-label="${escapeHtml(actionTitle)}" data-action="analyze" data-id="${call.id}" ${actionDisabled ? "disabled" : ""}>${actionIcon}</button></div></td>
    </tr>`;
}

function renderCalls() {
  hydrateSelectedAnalysis();
  if (el.callsCount) {
    el.callsCount.textContent = String(state.callsTotal);
  }
  renderReportMeta();
  updateCallsViewportMetrics();
  const window = visibleCallsWindow();
  const rows = window.items.map((call) => renderCallRow(call)).join("");
  const topSpacer = window.topSpacer > 0 ? `<tr class="virtual-spacer"><td colspan="10" style="height:${window.topSpacer}px"></td></tr>` : "";
  const bottomSpacer = window.bottomSpacer > 0 ? `<tr class="virtual-spacer"><td colspan="10" style="height:${window.bottomSpacer}px"></td></tr>` : "";
  el.callsTable.innerHTML = `${topSpacer}${rows}${bottomSpacer}`;
  renderPagination();
}

function renderAnalysis(analysis) {
  if (!analysis) {
    stopTranscriptPlayback();
    setAnalysisDrawerOpen(false);
    setAnalysisHeaderMeta("");
    el.analysisState.innerHTML = analysisHeaderStatusMarkup("Не выбран");
    el.analysisState.className = "analysis-status-line";
    el.analysisDetail.className = "analysis-detail empty";
    el.analysisDetail.textContent = "Выберите звонок со статусом «Готово» или нажмите «Анализировать», чтобы здесь появились резюме, рекомендации и проверка по сценарию.";
    return;
  }

  if (analysis.state === "queued" || analysis.state === "processing") {
    const source = callById(state.selectedCallId) || analysis;
    setAnalysisHeaderMeta(
      analysisHeaderMarkup(analysis, {
        statusLabel: analysis.state === "queued" ? "В очереди" : "В работе",
        statusTone: "warning",
        sourceCall: source,
      }),
    );
    el.analysisState.innerHTML = analysisHeaderStatusMarkup(analysis.state === "queued" ? "В очереди" : "В работе", source, "warning");
    el.analysisState.className = "analysis-status-line";
    el.analysisDetail.className = "analysis-detail";
    el.analysisDetail.innerHTML = `
      <section class="detail-block">
        <h3>${escapeHtml(analysis.subject || "Звонок")}</h3>
        ${detailMetaMarkup(analysis)}
        <p>${analysis.state === "queued" ? "Звонок поставлен в очередь на анализ. Статус и детализация обновятся автоматически." : "Анализ выполняется. После завершения статус и детализация обновятся автоматически."}</p>
      </section>`;
    return;
  }

  if (analysis.state === "error") {
    const source = callById(state.selectedCallId) || analysis;
    setAnalysisHeaderMeta(analysisHeaderMarkup(analysis, { statusLabel: "Ошибка", statusTone: "warning", sourceCall: source }));
    el.analysisState.innerHTML = analysisHeaderStatusMarkup("Ошибка", source, "warning");
    el.analysisState.className = "analysis-status-line";
    el.analysisDetail.className = "analysis-detail";
    el.analysisDetail.innerHTML = `
      <section class="detail-block">
        <h3>${escapeHtml(analysis.subject || "Звонок")}</h3>
        ${detailMetaMarkup(analysis)}
        <p>${escapeHtml(analysis.errorMessage || "Ошибка анализа")}</p>
      </section>`;
    return;
  }

  const hasDetailedResult =
    analysis.summary ||
    analysis.overview ||
    (analysis.recommendations && analysis.recommendations.length) ||
    (analysis.scriptAnalysis?.checkpoints && analysis.scriptAnalysis.checkpoints.length) ||
    (analysis.customMetrics && analysis.customMetrics.length);

  const detailStateLabel =
    normalizeDisplayAnalysisState(analysis.state) === "partial"
      ? "Частично"
      : analysis.state === "outdated"
          ? "Нужен повтор"
          : hasDetailedResult
            ? "Готово"
            : "Неполный результат";
  const source = callById(state.selectedCallId) || analysis;
  el.analysisState.innerHTML = analysisHeaderStatusMarkup(
    detailStateLabel,
    source,
    hasDetailedResult && analysis.state !== "outdated" ? "success" : "warning",
  );
  el.analysisState.className = "analysis-status-line";
  el.analysisDetail.className = "analysis-detail";
  const resultExplanation = analysis.summary
    ? analysis.summary
    : analysis.processingNotes?.structuredAnalysisErrorMessage
      ? `Транскрибация получена, но этап AI-разбора завершился технической ошибкой: ${analysis.processingNotes.structuredAnalysisErrorMessage}`
    : analysis.processingNotes?.structuredResultEmpty
      ? "Транскрибация получена, но структурированный AI-разбор вернулся пустым. Сохранён частичный результат звонка: транскрипт доступен, повторный анализ можно запустить позже."
    : analysis.transcriptText
      ? "Полный AI-разбор пока не сформирован: сохранилась транскрибация, но резюме и оценка сценария не были получены. Обычно помогает повторный анализ звонка."
      : "Результат анализа пока не заполнен. Попробуйте повторно запустить анализ звонка.";
  const overviewOutcome = localizeFreeText(analysis.overview?.callOutcome || "Результат не определён");
  const clientNeed = localizeFreeText(analysis.overview?.clientNeed || "Потребность клиента не определена");
  const nextStep = localizeFreeText(analysis.nextStep || "Следующий шаг не определён");

  setAnalysisHeaderMeta(
    analysisHeaderMarkup(analysis, {
      showDetailPills: true,
      showNav: true,
      scenarioName: analysis.selectedScenarioName || "Автоподбор / ручной ввод",
      statusLabel: detailStateLabel,
      statusTone: hasDetailedResult && analysis.state !== "outdated" ? "success" : "warning",
      sourceCall: source,
    }),
  );

  el.analysisDetail.innerHTML = `
    <div class="detail-top-grid">
      <section id="analysisOverview" class="detail-block detail-block-summary">
        <h3>Резюме</h3>
        ${detailMetaMarkup(analysis)}
        <p>${escapeHtml(resultExplanation)}</p>
      </section>
      <section id="analysisOutcome" class="detail-block detail-block-outcome">
        <h3>Результат</h3>
        <p>${escapeHtml(overviewOutcome)}</p>
      </section>
      <section id="analysisClientNeed" class="detail-block detail-block-client-need">
        <h3>Потребность клиента</h3>
        <p>${escapeHtml(clientNeed)}</p>
      </section>
    </div>
    <section id="analysisNextStep" class="detail-block detail-block-next-step">
      <h3>Следующий шаг</h3>
      <p>${escapeHtml(nextStep)}</p>
    </section>
    <section id="analysisRecommendations" class="detail-block">
      <h3>Рекомендации</h3>
      <ul class="flat">${(analysis.recommendations || []).map((item) => `<li>${escapeHtml(localizeFreeText(item))}</li>`).join("") || "<li>Рекомендации отсутствуют</li>"}</ul>
    </section>
    <section id="analysisScript" class="detail-block">
      <h3>Проверка сценария</h3>
      <ul class="flat">${(analysis.scriptAnalysis?.checkpoints || []).map((item) => `<li><strong>${escapeHtml(localizeFreeText(item.name))}</strong>: ${escapeHtml(localizeCheckpointStatus(item.status))} — ${escapeHtml(localizeFreeText(item.comment))}</li>`).join("") || "<li>Пункты сценария ещё не заполнены</li>"}</ul>
    </section>
    <section id="analysisMetrics" class="detail-block">
      <h3>Индивидуальные параметры</h3>
      <ul class="flat">${(analysis.customMetrics || []).map((item) => `<li><strong>${escapeHtml(localizeFreeText(item.name))}</strong>: ${escapeHtml(item.score)} (${escapeHtml(localizeCheckpointStatus(item.status))}) — ${escapeHtml(localizeFreeText(item.comment))}</li>`).join("") || "<li>Индивидуальные параметры ещё не заполнены</li>"}</ul>
    </section>
    <section id="analysisTranscript" class="detail-block">
      <h3>Транскрипт</h3>
      <div class="transcript-layout">
        <div class="transcript-column transcript-column-fulltext">
          <h4>Полный текст</h4>
          ${transcriptFullTextMarkup(analysis)}
        </div>
        <div class="transcript-column transcript-column-segments">
          <h4>Плеер и фрагменты</h4>
          ${analysisAudioControlsMarkup(analysis)}
          ${transcriptSegmentsMarkup(analysis)}
        </div>
      </div>
    </section>`;
}

function renderEmptyChart(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="chart-empty">${escapeHtml(message)}</div>`;
}

function roundedMetric(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value || 0) * factor) / factor;
}

function percentBarWidth(value) {
  const safe = Number(value || 0);
  if (safe <= 0) return 0;
  return Math.max(6, Math.min(100, roundedMetric(safe, 1)));
}

function renderHorizontalBars(container, rows, options = {}) {
  if (!container) return;
  const {
    emptyMessage = "Недостаточно данных для графика.",
    maxValue = null,
    formatter = (value) => String(value),
    trackClassName = "",
    usePercentScale = false,
  } = options;

  if (!rows.length) {
    renderEmptyChart(container, emptyMessage);
    return;
  }

  const resolvedMax = usePercentScale
    ? 100
    : Math.max(
        Number(maxValue || 0),
        ...rows.map((item) => Number(item.value || 0)),
        1,
      );

  container.innerHTML = `<div class="bars-vertical">${rows
    .map((item) => {
      const value = Number(item.value || 0);
      const width = usePercentScale ? percentBarWidth(value) : Math.max(8, Math.round((value / resolvedMax) * 100));
      const trackClass = [trackClassName, item.trackClassName].filter(Boolean).join(" ");
      return `
        <div class="bar-row">
          <div class="bar-label">${escapeHtml(item.label)}</div>
          <div class="bar-track ${trackClass}">
            <div class="bar-fill" style="width:${width}%"></div>
          </div>
          <div class="bar-value">${formatter(value, item)}</div>
        </div>`;
    })
    .join("")}</div>`;
}

function lineSeriesSvg(series, options = {}) {
  const {
    ariaLabel = "График",
    valueFormatter = (value) => String(value),
    yTickFormatter = valueFormatter,
    xTickFormatter = (item) => item.label,
    strokeClass = "",
    areaClass = "",
    maxXAxisLabels = 10,
    maxPointLabels = 14,
    pointTextClass = "",
    axisTextClass = "",
  } = options;

  const width = 760;
  const height = 260;
  const paddingX = 42;
  const paddingTop = 28;
  const paddingBottom = 42;
  const chartHeight = height - paddingTop - paddingBottom;
  const maxValue = Math.max(...series.map((item) => Number(item.value || 0)), 1);
  const points = series.map((item, index) => {
    const x = paddingX + (index * (width - paddingX * 2)) / Math.max(series.length - 1, 1);
    const y = height - paddingBottom - (Number(item.value || 0) / maxValue) * chartHeight;
    return { ...item, x, y };
  });
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = [`${paddingX},${height - paddingBottom}`, polyline, `${width - paddingX},${height - paddingBottom}`].join(" ");
  const labelStep = Math.max(1, Math.ceil(points.length / Math.max(1, maxXAxisLabels)));
  const labels = points
    .map((point, index) => {
      const shouldShow = index === points.length - 1 || index % labelStep === 0;
      if (!shouldShow) return "";
      return `<text class="line-chart-axis-text ${axisTextClass}" x="${point.x}" y="${height - 12}" text-anchor="middle">${escapeHtml(xTickFormatter(point))}</text>`;
    })
    .join("");
  const pointLabelStep = Math.max(1, Math.ceil(points.length / Math.max(1, maxPointLabels)));
  const pointLabels = points
    .map((point, index) => `
        <circle cx="${point.x}" cy="${point.y}" r="4"></circle>
        ${index === points.length - 1 || index % pointLabelStep === 0 ? `<text class="line-chart-point-text ${pointTextClass}" x="${point.x}" y="${point.y - 12}" text-anchor="middle">${escapeHtml(valueFormatter(point.value, point))}</text>` : ""}`,
    )
    .join("");
  const yTicks = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    const value = roundedMetric(maxValue - maxValue * ratio, maxValue >= 100 ? 0 : 1);
    const y = paddingTop + chartHeight * ratio;
    return `
      <g class="line-chart-grid-line">
        <line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}"></line>
        <text class="line-chart-axis-text ${axisTextClass}" x="${paddingX - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(yTickFormatter(value))}</text>
      </g>`;
  }).join("");

  return `
    <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(ariaLabel)}">
      <g class="line-chart-grid">
        ${yTicks}
        <line x1="${paddingX}" y1="${height - paddingBottom}" x2="${width - paddingX}" y2="${height - paddingBottom}"></line>
      </g>
      <polygon class="line-chart-area ${areaClass}" points="${areaPoints}"></polygon>
      <polyline class="line-chart-polyline ${strokeClass}" points="${polyline}"></polyline>
      ${pointLabels}
      <g class="axis-labels">${labels}</g>
    </svg>`;
}

function multiLineSeriesSvg(seriesEntries, options = {}) {
  const {
    ariaLabel = "Многосерийный график",
    valueFormatter = (value) => String(value),
    yTickFormatter = valueFormatter,
    xTickFormatter = (item) => item.label,
    maxXAxisLabels = 10,
    maxPointLabels = 10,
    axisTextClass = "",
    pointTextClass = "",
  } = options;

  const width = 760;
  const height = 260;
  const paddingX = 42;
  const paddingTop = 28;
  const paddingBottom = 42;
  const chartHeight = height - paddingTop - paddingBottom;
  const normalizedEntries = (seriesEntries || []).filter((entry) => Array.isArray(entry?.series) && entry.series.length);
  if (!normalizedEntries.length) return "";
  const baseSeries = normalizedEntries[0].series;
  const maxValue = Math.max(...normalizedEntries.flatMap((entry) => entry.series.map((item) => Number(item.value || 0))), 1);
  const buildPoints = (series) =>
    series.map((item, index) => {
      const x = paddingX + (index * (width - paddingX * 2)) / Math.max(series.length - 1, 1);
      const y = height - paddingBottom - (Number(item.value || 0) / maxValue) * chartHeight;
      return { ...item, x, y };
    });

  const renderedEntries = normalizedEntries.map((entry) => ({
    ...entry,
    points: buildPoints(entry.series),
  }));
  const labelStep = Math.max(1, Math.ceil(baseSeries.length / Math.max(1, maxXAxisLabels)));
  const labels = renderedEntries[0].points
    .map((point, index) => {
      const shouldShow = index === renderedEntries[0].points.length - 1 || index % labelStep === 0;
      if (!shouldShow) return "";
      return `<text class="line-chart-axis-text ${axisTextClass}" x="${point.x}" y="${height - 12}" text-anchor="middle">${escapeHtml(xTickFormatter(point))}</text>`;
    })
    .join("");
  const pointLabelStep = Math.max(1, Math.ceil(baseSeries.length / Math.max(1, maxPointLabels)));
  const renderPointSet = (points, seriesClass, pointRadius, labelRule = () => false) =>
    points
      .map(
        (point, index) => `
          <circle class="line-chart-dot ${seriesClass}" cx="${point.x}" cy="${point.y}" r="${pointRadius}"></circle>
          ${labelRule(index, points.length) ? `<text class="line-chart-point-text ${pointTextClass}" x="${point.x}" y="${point.y - 12}" text-anchor="middle">${escapeHtml(valueFormatter(point.value, point))}</text>` : ""}`,
      )
      .join("");
  const yTicks = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    const value = roundedMetric(maxValue - maxValue * ratio, maxValue >= 100 ? 0 : 1);
    const y = paddingTop + chartHeight * ratio;
    return `
      <g class="line-chart-grid-line">
        <line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}"></line>
        <text class="line-chart-axis-text ${axisTextClass}" x="${paddingX - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(yTickFormatter(value))}</text>
      </g>`;
  }).join("");

  return `
    <div class="line-chart-legend">
      ${renderedEntries
        .map(
          (entry) =>
            `<span class="line-chart-legend-item"><i class="line-chart-legend-swatch ${entry.legendClassName || ""}"></i>${escapeHtml(entry.label || "")}</span>`,
        )
        .join("")}
    </div>
    <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(ariaLabel)}">
      <g class="line-chart-grid">
        ${yTicks}
        <line x1="${paddingX}" y1="${height - paddingBottom}" x2="${width - paddingX}" y2="${height - paddingBottom}"></line>
      </g>
      ${renderedEntries
        .map((entry) => `<polyline class="line-chart-polyline ${entry.polylineClassName || ""}" points="${entry.points.map((point) => `${point.x},${point.y}`).join(" ")}"></polyline>`)
        .join("")}
      ${renderedEntries
        .map((entry, entryIndex) =>
          renderPointSet(
            entry.points,
            entry.pointClassName || "",
            Number(entry.pointRadius || 4),
            entry.labelRule ||
              ((index, length) => {
                if (entryIndex === 0) return index === length - 1 || index % pointLabelStep === 0;
                return index === length - 1;
              }),
          ),
        )
        .join("")}
      <g class="axis-labels">${labels}</g>
    </svg>`;
}

function lastNDaysKeys(days = 7, endDate = new Date()) {
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (days - index - 1));
    return date.toISOString().slice(0, 10);
  });
}

function filterCallsByLastNDays(calls, days) {
  const keys = lastNDaysKeys(days);
  const allowed = new Set(keys);
  return calls.filter((call) => allowed.has(callDayKey(call)));
}

function callDayKey(call) {
  if (!call?.startTime) return null;
  const date = new Date(call.startTime);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function callsWithAnalysis() {
  return state.calls.filter((call) => {
    const analysis = effectiveAnalysis(call);
    return analysis && ["ready", "partial", "technical"].includes(String(analysis.state || ""));
  });
}

function dashboardCallsWithAnalysis() {
  return state.dashboardCalls.filter((call) => {
    const analysis = effectiveAnalysis(call);
    return analysis && ["ready", "partial", "technical"].includes(String(analysis.state || ""));
  });
}

function dashboardAnalysesList() {
  if (Array.isArray(state.dashboardAnalyses) && state.dashboardAnalyses.length) {
    return state.dashboardAnalyses;
  }
  return dashboardAnalysesFromCalls(state.dashboardCalls);
}

function isCheckpointViolation(status) {
  const normalized = String(status || "").trim().toLowerCase();
  return !["passed", "good", "not_applicable", "пройден", "хорошо", "не применимо"].includes(normalized);
}

function renderManagerScoreChart() {
  let rows = Array.isArray(state.dashboardCharts?.managerScoreRows) ? state.dashboardCharts.managerScoreRows : null;
  if (!rows) {
    const callsById = new Map(state.dashboardCalls.map((call) => [String(call.id), call]));
    const buckets = new Map();
    for (const item of dashboardAnalysesList()) {
      const score = Number(item?.scriptAnalysis?.overallScore);
      if (!Number.isFinite(score)) continue;
      const managerId = String(item?.managerId || item?.managerName || "unknown");
      const fallbackCall = callsById.get(String(item?.activityId));
      if (!buckets.has(managerId)) {
        buckets.set(managerId, {
          label: item?.managerName || fallbackCall?.managerName || `Менеджер #${item?.managerId || "—"}`,
          totalScore: 0,
          calls: 0,
        });
      }
      const bucket = buckets.get(managerId);
      bucket.totalScore += score;
      bucket.calls += 1;
    }
    rows = Array.from(buckets.values())
      .map((item) => ({
        label: item.label,
        value: item.calls ? roundedMetric(item.totalScore / item.calls, 1) : 0,
        calls: item.calls,
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 12);
  }
  renderHorizontalBars(
    el.managerScoreChart,
    rows,
    {
      emptyMessage: "Недостаточно данных для графика по менеджерам.",
      usePercentScale: true,
      formatter: (value, item) =>
        `<span>${escapeHtml(`${item.calls}`)}</span><span class="muted">${escapeHtml(`(${value.toFixed(1)}%)`)}</span>`,
    },
  );
}

function renderSentimentChart() {
  const summary = state.dashboardSummary;
  if (!summary) {
    renderEmptyChart(el.sentimentChart, "Нет данных по тональности.");
    return;
  }

  const parts = [
    { label: "Позитив", value: Number(summary.positive || 0), color: "#1f6b5f" },
    { label: "Нейтрал", value: Number(summary.neutral || 0), color: "#c08a2b" },
    { label: "Негатив", value: Number(summary.negative || 0), color: "#8b3d2c" },
  ];
  const total = parts.reduce((sum, item) => sum + item.value, 0);
  if (!total) {
    renderEmptyChart(el.sentimentChart, "Нет проанализированных звонков для распределения по тональности.");
    return;
  }

  renderHorizontalBars(
    el.sentimentChart,
    parts.map((item) => {
      const percent = roundedMetric((item.value / total) * 100, 1);
      return {
        label: item.label,
        value: percent,
        rawValue: item.value,
        trackClassName:
          item.label === "Позитив" ? "is-positive" : item.label === "Нейтрал" ? "is-neutral" : "is-negative",
      };
    }),
    {
      emptyMessage: "Нет проанализированных звонков для распределения по тональности.",
      usePercentScale: true,
      formatter: (value, item) =>
        `<span>${escapeHtml(`${item.rawValue}`)}</span><span class="muted">${escapeHtml(`(${value.toFixed(1)}%)`)}</span>`,
    },
  );
}

function renderRiskChart() {
  const rows = Array.isArray(state.dashboardCharts?.riskRows) ? state.dashboardCharts.riskRows : null;
  if (rows) {
    const total = rows.reduce((sum, item) => sum + Number(item.rawValue || 0), 0);
    if (!total) {
      renderEmptyChart(el.riskChart, "Нет данных по рискам.");
      return;
    }
    renderHorizontalBars(el.riskChart, rows, {
      emptyMessage: "Нет данных по рискам.",
      usePercentScale: true,
      formatter: (value, item) =>
        `<span>${escapeHtml(`${item.rawValue}`)}</span><span class="muted">${escapeHtml(`(${value.toFixed(1)}%)`)}</span>`,
    });
    return;
  }

  const parts = [
    { label: "Низкий", count: 0, trackClassName: "is-low-risk" },
    { label: "Средний", count: 0, trackClassName: "is-medium-risk" },
    { label: "Высокий", count: 0, trackClassName: "is-high-risk" },
  ];

  for (const call of dashboardCallsWithAnalysis()) {
    const risk = localizeRisk(effectiveAnalysis(call)?.overview?.riskLevel);
    const bucket = parts.find((item) => item.label === risk);
    if (bucket) bucket.count += 1;
  }

  const total = parts.reduce((sum, item) => sum + item.count, 0);
  if (!total) {
    renderEmptyChart(el.riskChart, "Нет данных по рискам.");
    return;
  }

  renderHorizontalBars(
    el.riskChart,
    parts.map((item) => ({
      label: item.label,
      value: roundedMetric((item.count / total) * 100, 1),
      rawValue: item.count,
      trackClassName: item.trackClassName,
    })),
    {
      emptyMessage: "Нет данных по рискам.",
      usePercentScale: true,
      formatter: (value, item) =>
        `<span>${escapeHtml(`${item.rawValue}`)}</span><span class="muted">${escapeHtml(`(${value.toFixed(1)}%)`)}</span>`,
    },
  );
}

function scenarioComplianceRows() {
  const buckets = new Map();
  for (const call of dashboardCallsWithAnalysis()) {
    const analysis = effectiveAnalysis(call);
    const compliance = Number(analysis?.scriptAnalysis?.compliancePercent);
    if (!Number.isFinite(compliance)) continue;
    const scenarioLabel = String(
      analysis?.selectedScenarioName ||
        state.scenarios.find((item) => String(item.id) === String(analysis?.selectedScenarioId || ""))?.name ||
        "Автосценарий",
    ).trim();
    if (!buckets.has(scenarioLabel)) {
      buckets.set(scenarioLabel, { label: scenarioLabel, total: 0, count: 0 });
    }
    const bucket = buckets.get(scenarioLabel);
    bucket.total += compliance;
    bucket.count += 1;
  }

  return Array.from(buckets.values())
    .map((item) => ({
      label: item.label,
      value: roundedMetric(item.total / item.count, 1),
      count: item.count,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
}

function scenarioTokensPerMinuteRows(days = null) {
  const buckets = new Map();
  const calls = Number.isFinite(Number(days)) && Number(days) > 0
    ? filterCallsByLastNDays(dashboardCallsWithAnalysis(), Number(days))
    : dashboardCallsWithAnalysis();
  for (const call of calls) {
    const analysis = effectiveAnalysis(call);
    const scenarioLabel = String(
      analysis?.selectedScenarioName ||
        state.scenarios.find((item) => String(item.id) === String(analysis?.selectedScenarioId || ""))?.name ||
        "Автосценарий",
    ).trim() || "Автосценарий";
    const totalTokens = Number(analysis?.tokenUsage?.totalTokens || 0);
    const transcriptSeconds = Number(analysis?.transcriptMeta?.duration || call?.durationSeconds || 0);
    const durationMinutes = Math.max(0, transcriptSeconds / 60);
    if (!Number.isFinite(totalTokens) || totalTokens <= 0 || !Number.isFinite(durationMinutes) || durationMinutes <= 0) continue;
    if (!buckets.has(scenarioLabel)) {
      buckets.set(scenarioLabel, { label: scenarioLabel, totalTokens: 0, totalMinutes: 0, count: 0 });
    }
    const bucket = buckets.get(scenarioLabel);
    bucket.totalTokens += totalTokens;
    bucket.totalMinutes += durationMinutes;
    bucket.count += 1;
  }

  return Array.from(buckets.values())
    .map((item) => ({
      label: item.label,
      value: item.totalMinutes > 0 ? roundedMetric(item.totalTokens / item.totalMinutes, 1) : 0,
      count: item.count,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
}

function renderScenarioAverageChart() {
  const rows = Array.isArray(state.dashboardCharts?.scenarioAverageRows)
    ? state.dashboardCharts.scenarioAverageRows
    : scenarioComplianceRows();
  renderHorizontalBars(el.scenarioAverageChart, rows, {
    emptyMessage: "Нет данных по соблюдению сценариев.",
    usePercentScale: true,
    formatter: (value, item) =>
      `<span>${escapeHtml(`${item.count}`)}</span><span class="muted">${escapeHtml(`(${value.toFixed(1)}%)`)}</span>`,
  });
}

function renderScenarioTokensPerMinuteChart() {
  const rows = Array.isArray(state.dashboardCharts?.scenarioTokensPerMinuteRows)
    ? state.dashboardCharts.scenarioTokensPerMinuteRows
    : scenarioTokensPerMinuteRows();
  renderHorizontalBars(el.scenarioTokensPerMinuteChart, rows, {
    emptyMessage: "Нет данных по токенам на минуту в сценариях.",
    formatter: (value, item) =>
      `<span>${escapeHtml(value.toFixed(1))}</span><span class="muted">${escapeHtml(`${item.count} звонков`)}</span>`,
  });
}

function buildLast7DaysSeries(calls, metricResolver) {
  const keys = lastNDaysKeys(7);
  const buckets = new Map(keys.map((key) => [key, 0]));
  for (const call of calls) {
    const key = callDayKey(call);
    if (!key || !buckets.has(key)) continue;
    buckets.set(key, buckets.get(key) + Number(metricResolver(call) || 0));
  }
  return keys.map((key) => ({
    key,
    label: formatDay(key),
    value: buckets.get(key) || 0,
  }));
}

function buildAverageSeriesByDay(calls, metricResolver, days = null) {
  const buckets = new Map();
  for (const call of calls) {
    const key = callDayKey(call);
    if (!key) continue;
    const value = Number(metricResolver(call));
    if (!Number.isFinite(value)) continue;
    if (!buckets.has(key)) {
      buckets.set(key, { total: 0, count: 0 });
    }
    const bucket = buckets.get(key);
    bucket.total += value;
    bucket.count += 1;
  }

  if (Number.isFinite(Number(days)) && Number(days) > 0) {
    return lastNDaysKeys(Number(days)).map((key) => {
      const bucket = buckets.get(key) || { total: 0, count: 0 };
      return {
        key,
        label: formatDay(key),
        value: bucket.count ? roundedMetric(bucket.total / bucket.count, 1) : 0,
      };
    });
  }

  return Array.from(buckets.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([key, bucket]) => ({
      key,
      label: formatDay(key),
      value: bucket.count ? roundedMetric(bucket.total / bucket.count, 1) : 0,
    }));
}

function buildCountSeriesByDay(calls, predicate = () => true, days = 90) {
  const keys = lastNDaysKeys(days);
  const buckets = new Map(keys.map((key) => [key, 0]));
  for (const call of calls) {
    const key = callDayKey(call);
    if (!key || !buckets.has(key) || !predicate(call)) continue;
    buckets.set(key, buckets.get(key) + 1);
  }
  return keys.map((key) => ({
    key,
    label: formatDay(key),
    value: buckets.get(key) || 0,
  }));
}

function buildRatioSeriesByDay(calls, numeratorResolver, denominatorResolver, days = 90) {
  const keys = lastNDaysKeys(days);
  const buckets = new Map(keys.map((key) => [key, { numerator: 0, denominator: 0 }]));
  for (const call of calls) {
    const key = callDayKey(call);
    if (!key || !buckets.has(key)) continue;
    const numerator = Number(numeratorResolver(call));
    const denominator = Number(denominatorResolver(call));
    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) continue;
    const bucket = buckets.get(key);
    bucket.numerator += numerator;
    bucket.denominator += denominator;
  }
  return keys.map((key) => {
    const bucket = buckets.get(key);
    return {
      key,
      label: formatDay(key),
      value: bucket.denominator > 0 ? roundedMetric(bucket.numerator / bucket.denominator, 1) : 0,
    };
  });
}

function violatedCheckpointRows(limit = 10) {
  const buckets = new Map();
  const totalAnalyzedCalls = Math.max(dashboardCallsWithAnalysis().length, 1);
  for (const item of dashboardCallsWithAnalysis()) {
    const checkpoints = effectiveAnalysis(item)?.scriptAnalysis?.checkpoints || [];
    for (const checkpoint of checkpoints) {
      if (!checkpoint?.name || !isCheckpointViolation(checkpoint?.status)) continue;
      const key = String(checkpoint.name).trim();
      if (!buckets.has(key)) {
        buckets.set(key, { label: key, count: 0 });
      }
      buckets.get(key).count += 1;
    }
  }
  return Array.from(buckets.values())
    .sort((left, right) => right.count - left.count)
    .slice(0, limit)
    .map((item) => ({
      label: item.label,
      value: roundedMetric((item.count / totalAnalyzedCalls) * 100, 1),
      count: item.count,
    }));
}

function buildHeatmapData(calls, predicate = () => true, days = 90) {
  const keys = lastNDaysKeys(days);
  const buckets = new Map(keys.map((key) => [key, 0]));
  for (const call of calls) {
    const key = callDayKey(call);
    if (!key || !buckets.has(key) || !predicate(call)) continue;
    buckets.set(key, buckets.get(key) + 1);
  }

  const daysData = keys.map((key) => {
    const date = new Date(`${key}T00:00:00`);
    return {
      key,
      label: formatDay(key),
      weekday: (date.getDay() + 6) % 7,
      value: buckets.get(key) || 0,
    };
  });

  const maxValue = Math.max(...daysData.map((item) => item.value), 0);
  return { days: daysData, maxValue };
}

function renderHeatmap(container, data, options = {}) {
  if (!container) return;
  const { emptyMessage = "Недостаточно данных для тепловой карты." } = options;
  if (!data?.days?.length) {
    renderEmptyChart(container, emptyMessage);
    return;
  }
  const groupedByMonth = [];
  for (const item of data.days) {
    const date = new Date(`${item.key}T00:00:00`);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthLabel = date.toLocaleDateString("ru-RU", { month: "long" });
    const lastGroup = groupedByMonth[groupedByMonth.length - 1];
    if (!lastGroup || lastGroup.key !== monthKey) {
      groupedByMonth.push({ key: monthKey, label: monthLabel, days: [item] });
    } else {
      lastGroup.days.push(item);
    }
  }
  const monthGroups = groupedByMonth.map((group) => {
    const leadingEmpty = group.days[0]?.weekday || 0;
    const paddedDays = [
      ...Array.from({ length: leadingEmpty }, () => null),
      ...group.days,
    ];
    const columns = [];
    for (let offset = 0; offset < paddedDays.length; offset += 7) {
      columns.push({ items: paddedDays.slice(offset, offset + 7) });
    }
    return {
      label: group.label,
      columns,
    };
  });
  const heatmapColumnWidth = 24;
  const heatmapColumnGap = 2;
  const heatmapMonthGap = 12;
  let monthOffset = 0;
  const positionedMonthGroups = monthGroups.map((group, index) => {
    const width = group.columns.length * heatmapColumnWidth + Math.max(0, group.columns.length - 1) * heatmapColumnGap;
    const positioned = {
      ...group,
      offset: monthOffset,
      width,
    };
    monthOffset += width + (index < monthGroups.length - 1 ? heatmapMonthGap : 0);
    return positioned;
  });

  container.innerHTML = `
    <div class="heatmap">
      <div class="heatmap-months" style="--heatmap-width:${monthOffset}px;">
        ${positionedMonthGroups
          .map((group) => `<span class="heatmap-month-label" style="left:${group.offset}px;">${escapeHtml(group.label)}</span>`)
          .join("")}
      </div>
      <div class="heatmap-groups">
        ${positionedMonthGroups
          .map(
            (group) => `
              <div class="heatmap-group" style="--columns:${group.columns.length}">
                ${group.columns
                  .map(
                    (column) => `
                      <div class="heatmap-column">
                        ${column.items
                          .map((item) => {
                            if (!item) return '<div class="heatmap-cell is-empty" aria-hidden="true"></div>';
                            const intensity = data.maxValue > 0 ? Math.max(0.1, item.value / data.maxValue) : 0;
                            if (!item.value) {
                              return `<div class="heatmap-cell" title="${escapeHtml(`${item.label}: 0`)}" aria-label="${escapeHtml(`${item.label}: 0`)}"></div>`;
                            }
                            return `<div class="heatmap-cell is-filled" style="--heat:${intensity.toFixed(3)};" title="${escapeHtml(`${item.label}: ${item.value}`)}" aria-label="${escapeHtml(`${item.label}: ${item.value}`)}"><span class="heatmap-cell-count">${escapeHtml(String(item.value))}</span></div>`;
                          })
                          .join("")}
                      </div>`,
                  )
                  .join("")}
              </div>`,
          )
          .join("")}
      </div>
      <div class="heatmap-legend">
        <span class="muted">Меньше</span>
        <span class="heatmap-legend-scale"><i></i><i></i><i></i><i></i></span>
        <span class="muted">Больше</span>
      </div>
    </div>`;
}

function renderSeriesChart(container, series, options = {}) {
  if (!container) return;
  const {
    emptyMessage = "Недостаточно данных для графика.",
    zeroMessage = "Значения за выбранный период равны 0.",
  } = options;
  if (!series.length) {
    renderEmptyChart(container, emptyMessage);
    return;
  }
  const hasValues = series.some((item) => Number(item.value || 0) > 0);
  const note = hasValues ? "" : `<div class="chart-inline-note">${escapeHtml(zeroMessage)}</div>`;
  container.innerHTML = `${note}${lineSeriesSvg(series, options)}`;
}

function renderRecognizedCallsChart() {
  const series = Array.isArray(state.dashboardCharts?.recognizedCallsSeries)
    ? state.dashboardCharts.recognizedCallsSeries
    : buildCountSeriesByDay(filterCallsByLastNDays(dashboardCallsWithAnalysis(), 30), () => true, 30);
  renderSeriesChart(el.recognizedCallsChart, series, {
    emptyMessage: "Нет распознанных звонков за последний месяц.",
    ariaLabel: "График распознанных звонков за последний месяц",
    valueFormatter: (value) => `${Math.round(value)}`,
    yTickFormatter: (value) => `${Math.round(value)}`,
    strokeClass: "is-calls",
    areaClass: "is-calls",
    pointTextClass: "is-emphasis-light",
    axisTextClass: "is-medium",
    maxXAxisLabels: 6,
    xTickFormatter: (item) => formatDayShort(item.key),
  });
}

function renderTokensUsageChart() {
  const series = Array.isArray(state.dashboardCharts?.tokensUsageSeries)
    ? state.dashboardCharts.tokensUsageSeries
    : lastNDaysKeys(30).map((key) => ({
      key,
      label: formatDay(key),
      value: filterCallsByLastNDays(dashboardCallsWithAnalysis(), 30)
        .filter((call) => callDayKey(call) === key)
        .reduce((sum, call) => sum + Number(effectiveAnalysis(call)?.tokenUsage?.totalTokens || 0), 0),
    }));
  renderSeriesChart(el.tokensUsageChart, series, {
    emptyMessage: "Нет расхода токенов за последний месяц.",
    ariaLabel: "График расхода токенов за последний месяц",
    valueFormatter: (value) => `${Math.round(value)}`,
    yTickFormatter: (value) => `${Math.round(value)}`,
    strokeClass: "is-tokens",
    areaClass: "is-tokens",
    pointTextClass: "is-emphasis-light",
    axisTextClass: "is-medium",
    maxXAxisLabels: 6,
    xTickFormatter: (item) => formatDayShort(item.key),
  });
}

function renderRecognizedMinutesChart() {
  const series = Array.isArray(state.dashboardCharts?.recognizedMinutesSeries)
    ? state.dashboardCharts.recognizedMinutesSeries
    : lastNDaysKeys(30).map((key) => ({
      key,
      label: formatDay(key),
      value: roundedMetric(
        filterCallsByLastNDays(dashboardCallsWithAnalysis(), 30)
          .filter((call) => callDayKey(call) === key)
          .reduce((sum, call) => sum + Number(call.durationSeconds || 0) / 60, 0),
        1,
      ),
    }));
  renderSeriesChart(el.recognizedMinutesChart, series, {
    emptyMessage: "Нет распознанных минут за последний месяц.",
    ariaLabel: "График распознанных минут за последний месяц",
    valueFormatter: (value) => `${value.toFixed(1)}`,
    yTickFormatter: (value) => `${value.toFixed(1)}`,
    strokeClass: "is-minutes",
    areaClass: "is-minutes",
    pointTextClass: "is-emphasis-light",
    axisTextClass: "is-medium",
    maxXAxisLabels: 6,
    xTickFormatter: (item) => formatDayShort(item.key),
  });
}

function renderNoRecordingChart() {
  const series = Array.isArray(state.dashboardCharts?.noRecordingSeries)
    ? state.dashboardCharts.noRecordingSeries
    : buildCountSeriesByDay(
      filterCallsByLastNDays(state.dashboardCalls, 90),
      (call) => !call.hasRecording,
      90,
    );
  renderSeriesChart(el.noRecordingChart, series, {
    emptyMessage: "Нет данных по звонкам без записи.",
    zeroMessage: "За последние 3 месяца звонков без записи не было.",
    ariaLabel: "График звонков без записи за последние 3 месяца",
    valueFormatter: (value) => `${Math.round(value)}`,
    yTickFormatter: (value) => `${Math.round(value)}`,
    strokeClass: "is-missing",
    areaClass: "is-missing",
    maxXAxisLabels: 8,
    maxPointLabels: 10,
    pointTextClass: "is-medium",
    axisTextClass: "is-medium",
  });
}

function renderTokensPerMinuteChart() {
  const series = Array.isArray(state.dashboardCharts?.tokensPerMinuteSeries)
    ? state.dashboardCharts.tokensPerMinuteSeries
    : buildRatioSeriesByDay(
      filterCallsByLastNDays(dashboardCallsWithAnalysis(), 30),
      (call) => Number(effectiveAnalysis(call)?.tokenUsage?.totalTokens || 0),
      (call) => Math.max(0, Number(call.durationSeconds || 0) / 60),
      30,
    );
  renderSeriesChart(el.tokensPerMinuteChart, series, {
    emptyMessage: "Нет данных по токенам на минуту.",
    zeroMessage: "За последний месяц расход токенов на минуту равен 0.",
    ariaLabel: "График токенов на минуту за последний месяц",
    valueFormatter: (value) => `${value.toFixed(1)}`,
    yTickFormatter: (value) => `${value.toFixed(1)}`,
    strokeClass: "is-score",
    areaClass: "is-score",
    maxXAxisLabels: 6,
    maxPointLabels: 10,
    pointTextClass: "is-medium",
    axisTextClass: "is-medium",
    xTickFormatter: (item) => formatDayShort(item.key),
  });
}

function renderViolatedCheckpointsChart() {
  const rows = Array.isArray(state.dashboardCharts?.violatedCheckpointRows)
    ? state.dashboardCharts.violatedCheckpointRows
    : violatedCheckpointRows();
  renderHorizontalBars(el.violatedCheckpointsChart, rows, {
    emptyMessage: "Нет данных по нарушениям checkpoint’ов.",
    usePercentScale: true,
    formatter: (value, item) =>
      `<span>${escapeHtml(`${item.count}`)}</span><span class="muted">${escapeHtml(`(${value.toFixed(1)}%)`)}</span>`,
  });
}

function renderHeatmaps() {
  const data = state.dashboardCharts?.callsHeatmap || buildHeatmapData(state.dashboardCalls, () => true, 184);
  renderHeatmap(el.callsHeatmap, data, {
    emptyMessage: "Нет данных по всем вызовам.",
  });
}

function renderCallsVolumeChart() {
  const totalSeries = Array.isArray(state.dashboardCharts?.callsVolume?.totalSeries)
    ? state.dashboardCharts.callsVolume.totalSeries
    : buildCountSeriesByDay(
      filterCallsByLastNDays(state.dashboardCalls, 90),
      () => true,
      90,
    );
  const recognizedSeries = Array.isArray(state.dashboardCharts?.callsVolume?.recognizedSeries)
    ? state.dashboardCharts.callsVolume.recognizedSeries
    : buildCountSeriesByDay(
      filterCallsByLastNDays(dashboardCallsWithAnalysis(), 90),
      () => true,
      90,
    );
  const missingRecordingSeries = Array.isArray(state.dashboardCharts?.callsVolume?.missingRecordingSeries)
    ? state.dashboardCharts.callsVolume.missingRecordingSeries
    : buildCountSeriesByDay(
      filterCallsByLastNDays(state.dashboardCalls, 90),
      (call) => !call.hasRecording,
      90,
    );
  if (!totalSeries.length) {
    renderEmptyChart(el.callsVolumeChart, "Нет данных по количеству вызовов.");
    return;
  }
  const hasValues = [...totalSeries, ...recognizedSeries, ...missingRecordingSeries].some((item) => Number(item.value || 0) > 0);
  const note = hasValues ? "" : `<div class="chart-inline-note">За последние 3 месяца значения по всем рядам равны 0.</div>`;
  el.callsVolumeChart.innerHTML = `${note}${multiLineSeriesSvg([
    {
      label: "Количество вызовов",
      series: totalSeries,
      polylineClassName: "is-calls is-thin is-volume-total",
      pointClassName: "is-calls",
      pointRadius: 1.35,
      legendClassName: "is-volume-total",
    },
    {
      label: "Распознанные вызовы",
      series: recognizedSeries,
      polylineClassName: "is-secondary is-thin is-volume-recognized",
      pointClassName: "is-volume-recognized",
      pointRadius: 1.35,
      legendClassName: "is-volume-recognized",
    },
    {
      label: "Без записи",
      series: missingRecordingSeries,
      polylineClassName: "is-missing is-thin is-volume-missing",
      pointClassName: "is-volume-missing",
      pointRadius: 1.35,
      legendClassName: "is-volume-missing",
    },
  ], {
    ariaLabel: "График количества вызовов за последние 3 месяца",
    valueFormatter: (value) => `${Math.round(value)}`,
    yTickFormatter: (value) => `${Math.round(value)}`,
    maxXAxisLabels: 9,
    maxPointLabels: 8,
    pointTextClass: "is-half",
    axisTextClass: "is-half",
  })}`;
}

function renderDashboard() {
  if (!state.dashboardDatasetLoaded) {
    [
      el.sentimentChart,
      el.riskChart,
      el.scenarioAverageChart,
      el.scenarioTokensPerMinuteChart,
      el.managerScoreChart,
      el.callsHeatmap,
      el.recognizedCallsHeatmap,
      el.recognizedCallsChart,
      el.tokensUsageChart,
      el.recognizedMinutesChart,
      el.noRecordingChart,
      el.tokensPerMinuteChart,
      el.violatedCheckpointsChart,
      el.dailyScoreChart,
    ].forEach((container) => renderEmptyChart(container, "Загрузка данных..."));
    return;
  }
  renderSentimentChart();
  renderRiskChart();
  renderScenarioAverageChart();
  renderScenarioTokensPerMinuteChart();
  renderManagerScoreChart();
  renderHeatmaps();
  renderRecognizedCallsChart();
  renderTokensUsageChart();
  renderRecognizedMinutesChart();
  renderTokensPerMinuteChart();
  renderViolatedCheckpointsChart();
  renderCallsVolumeChart();
}
async function api(url, options) {
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, options);
      const text = await response.text();
      let payload;
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        if (text.trim().startsWith("<")) {
          const error = new Error("Сервер временно вернул HTML вместо JSON. Обычно это происходит при перезапуске приложения. Запрос будет повторен автоматически.");
          error.retryable = true;
          throw error;
        }
        throw new Error(`Сервер вернул некорректный ответ: ${text.slice(0, 200)}`);
      }
      if (!response.ok || payload.success === false) throw new Error(payload?.error?.message || "Request failed");
      return payload.data;
    } catch (error) {
      lastError = error;
      if (!error.retryable || attempt === 3) break;
      await delay(1000 * attempt);
    }
  }
  throw lastError;
}

async function loadManagers() {
  const selected = new Set(selectedManagerIds());
  const managers = await api("/api/managers");
  state.managers = managers;
  el.managerIdsOptions.innerHTML = managers
    .map(
      (manager) => `<label class="multi-select-option"><input type="checkbox" value="${manager.id}" data-filter-option="manager" data-label="${escapeHtml(manager.fullName)}" ${selected.has(String(manager.id)) ? "checked" : ""} /><span>${escapeHtml(manager.fullName)}</span></label>`,
    )
    .join("");
  const selectedScenarioManagers = new Set(selectedScenarioRuleValues("scenario-manager"));
  if (el.scenarioManagerIdsOptions) {
    el.scenarioManagerIdsOptions.innerHTML = managers
      .map(
        (manager) => `<label class="multi-select-option"><input type="checkbox" value="${manager.id}" data-filter-option="scenario-manager" data-label="${escapeHtml(manager.fullName)}" ${selectedScenarioManagers.has(String(manager.id)) ? "checked" : ""} /><span>${escapeHtml(manager.fullName)}</span></label>`,
      )
      .join("");
  }
  refreshFilterLabels();
  renderScenarioList();
}

function scenarioRuleOptionMarkup(items, type, selected = new Set()) {
  return items
    .map(
      (item) =>
        `<label class="multi-select-option"><input type="checkbox" value="${escapeHtml(item.value)}" data-filter-option="${type}" data-label="${escapeHtml(item.label)}" ${selected.has(String(item.value)) ? "checked" : ""} /><span>${escapeHtml(item.label)}</span></label>`,
    )
    .join("");
}

async function loadScenarioRuleOptions() {
  const data = await api("/api/scenario-options");
  state.scenarioRuleOptions = {
    entityTypes: data.entityTypes || [],
  };

  if (el.scenarioEntityTypeIdsOptions) {
    el.scenarioEntityTypeIdsOptions.innerHTML = scenarioRuleOptionMarkup(
      state.scenarioRuleOptions.entityTypes,
      "scenario-entity-type",
      new Set(selectedScenarioRuleValues("scenario-entity-type")),
    );
  }
  refreshFilterLabels();
}

async function loadScenarios() {
  const data = await api("/api/scenarios");
  state.scenarios = data.scenarios || [];
  const validScenarioIds = new Set(state.scenarios.map((scenario) => String(scenario.id)));
  Object.keys(state.scenarioSelections).forEach((activityId) => {
    if (!validScenarioIds.has(String(state.scenarioSelections[activityId] || ""))) {
      clearScenarioSelectionOverride(activityId);
    }
  });
  const selected = new Set(selectedScenarioFilters());
  if (el.scenarioFilterOptions) {
    el.scenarioFilterOptions.innerHTML = state.scenarios
      .map(
        (scenario) =>
          `<label class="multi-select-option"><input type="checkbox" value="${escapeHtml(scenario.id)}" data-filter-option="scenario" data-label="${escapeHtml(scenario.name)}" ${selected.has(String(scenario.id)) ? "checked" : ""} /><span>${escapeHtml(scenario.name)}</span></label>`,
      )
      .join("");
  }
  updateScenarioSummaryCards();
  renderScenarioList();
  refreshFilterLabels();
  if (state.reportDataLoaded || state.calls.length) {
    renderCalls();
    if (state.selectedCallId) {
      selectAnalysisByCallId(state.selectedCallId);
    }
  }
  if (state.selectedScenarioId) {
    const scenario = state.scenarios.find((item) => item.id === state.selectedScenarioId);
    if (scenario) {
      applyScenarioToForm(scenario);
    } else {
      resetScenarioForm();
    }
  } else {
    resetScenarioForm();
  }
}

function updateSaveSettingsState() {
  if (!el.saveSettings) return;
  el.saveSettings.disabled = !state.settingsDirty;
}

function applySettings(settings) {
  state.settings = {
    autoTranscriptionMode: settings?.autoTranscriptionMode || "disabled",
  };
  const selectedMode = document.querySelector(
    `input[name="autoTranscriptionMode"][value="${state.settings.autoTranscriptionMode}"]`,
  );
  if (selectedMode) selectedMode.checked = true;
  state.settingsDirty = false;
  updateSaveSettingsState();
  renderReportMeta();
}

function applyAccess(access = {}) {
  state.access = {
    currentUser: access.currentUser || null,
    permissions: access.permissions || {},
    roles: Array.isArray(access.roles) ? access.roles : [],
  };
  if (!state.selectedAccessRoleId && state.access.roles.length) {
    state.selectedAccessRoleId = state.access.roles[0].id;
  }
  applyAccessVisibility();
  renderAccessSettings();
}

function currentAccessRole() {
  return state.access.roles.find((role) => String(role.id) === String(state.selectedAccessRoleId)) || null;
}

function permissionInputs() {
  return Array.from(document.querySelectorAll("[data-access-permission]"));
}

function roleUserIds(role) {
  return (role?.userIds || []).map((id) => String(id));
}

function renderAccessSettings() {
  if (el.accessCurrentUser) {
    const user = state.access.currentUser;
    el.accessCurrentUser.textContent = user
      ? `${user.fullName || `User #${user.id}`} (${user.isAdmin ? "администратор" : "пользователь"})`
      : "Пользователь не определен";
  }
  renderAccessRoleList();
  renderAccessRoleEditor();
}

function renderAccessRoleList() {
  if (!el.accessRolesList) return;
  if (!state.access.roles.length) {
    el.accessRolesList.innerHTML = '<div class="muted access-empty">Роли пока не созданы.</div>';
    return;
  }
  el.accessRolesList.innerHTML = state.access.roles
    .map((role) => {
      const userCount = roleUserIds(role).length;
      return `<button class="access-role-item ${String(role.id) === String(state.selectedAccessRoleId) ? "is-selected" : ""}" type="button" data-action="select-access-role" data-id="${escapeHtml(role.id)}">
        <span>${escapeHtml(role.name)}</span>
        <span class="muted">${userCount ? `Сотрудников: ${userCount}` : "Без сотрудников"}</span>
      </button>`;
    })
    .join("");
}

function renderAccessRoleEditor() {
  const role = currentAccessRole();
  const disabled = !canManageAccess() || !role;
  if (el.accessRoleName) {
    el.accessRoleName.value = role?.name || "";
    el.accessRoleName.disabled = disabled;
  }
  permissionInputs().forEach((input) => {
    input.checked = Boolean(role?.permissions?.[input.getAttribute("data-access-permission")]);
    input.disabled = disabled;
  });
  if (el.accessUsersList) {
    const selected = new Set(roleUserIds(role));
    el.accessUsersList.innerHTML = state.accessUsers.length
      ? state.accessUsers
          .map(
            (user) => `<label class="access-user-option"><input type="checkbox" data-access-user="${user.id}" ${selected.has(String(user.id)) ? "checked" : ""} ${disabled ? "disabled" : ""} /><span>${escapeHtml(user.fullName || `User #${user.id}`)}${user.isAdmin ? " · Администратор" : ""}</span></label>`,
          )
          .join("")
      : '<div class="muted access-empty">Список сотрудников загрузится с портала при открытии настроек.</div>';
  }
  if (el.saveAccessRole) el.saveAccessRole.disabled = disabled || !state.accessDirty;
  if (el.deleteAccessRole) el.deleteAccessRole.disabled = disabled;
}

function applyAccessVisibility() {
  const navMap = [
    [el.showDashboardView, "viewDashboard"],
    [el.showReportView, "viewReport"],
    [el.showScenariosView, "viewScenarios"],
  ];
  navMap.forEach(([node, permission]) => {
    if (node) node.hidden = !hasPermission(permission);
  });
  if (el.showSettingsView) el.showSettingsView.hidden = !canManageAccess();
  if (el.openAutoTranscriptionSettings) {
    el.openAutoTranscriptionSettings.hidden = !hasPermission("changeAutoTranscription");
    el.openAutoTranscriptionSettings.disabled = !hasPermission("changeAutoTranscription");
  }
  [el.newScenario, el.saveScenario, el.copyScenario, el.deleteScenario].forEach((node) => {
    if (node) node.hidden = !hasPermission("manageScenarios");
  });
  [
    el.scenarioName,
    el.scenarioDescription,
    el.scenarioScriptChecklist,
    el.scenarioCustomMetrics,
    el.scenarioDirection,
    el.scenarioKeywords,
    el.scenarioMinDuration,
    el.scenarioMaxDuration,
    el.scenarioAutoApply,
    el.scenarioIsDefault,
  ].forEach((node) => {
    if (node) node.disabled = !hasPermission("manageScenarios");
  });
  [el.scenarioManagerIdsDropdown, el.scenarioEntityTypeIdsDropdown, el.resetScenarioRules].forEach((node) => {
    if (node) node.hidden = !hasPermission("manageScenarios");
  });
  if (el.statusText && !Object.values(state.access.permissions || {}).some(Boolean) && !state.access.currentUser?.isAdmin) {
    el.statusText.textContent = "Для текущего пользователя не настроены права доступа к приложению.";
  }
}

async function loadSettings() {
  const data = await api("/api/settings");
  applySettings(data.settings || {});
}

async function loadAccess() {
  const data = await api("/api/access");
  applyAccess(data || {});
  state.accessLoaded = true;
}

async function loadAccessUsers() {
  if (!canManageAccess() || state.accessUsersLoaded) return;
  const data = await api("/api/access/users");
  state.accessUsers = data.users || [];
  state.accessUsersLoaded = true;
  renderAccessRoleEditor();
}

function markAccessDirty() {
  state.accessDirty = true;
  renderAccessRoleEditor();
}

function collectAccessRolePayload() {
  const role = currentAccessRole() || { id: createClientId("role"), permissions: {}, userIds: [] };
  const permissions = {};
  permissionInputs().forEach((input) => {
    permissions[input.getAttribute("data-access-permission")] = input.checked;
  });
  const userIds = Array.from(document.querySelectorAll("[data-access-user]"))
    .filter((input) => input.checked)
    .map((input) => Number(input.getAttribute("data-access-user")))
    .filter((id) => Number.isFinite(id) && id > 0);
  return {
    ...role,
    name: el.accessRoleName?.value.trim() || "Новая роль",
    permissions,
    userIds,
  };
}

function createAccessRole() {
  const role = {
    id: createClientId("role"),
    name: "Новая роль",
    permissions: {},
    userIds: [],
  };
  state.access.roles = [role, ...state.access.roles];
  state.selectedAccessRoleId = role.id;
  state.accessDirty = true;
  renderAccessSettings();
}

async function saveAccessRole() {
  if (!canManageAccess()) throw new Error("Настраивать доступы могут только администраторы");
  const rolePayload = collectAccessRolePayload();
  const roles = state.access.roles.map((role) => String(role.id) === String(rolePayload.id) ? rolePayload : role);
  if (!roles.some((role) => String(role.id) === String(rolePayload.id))) roles.unshift(rolePayload);
  const data = await api("/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roles }),
  });
  state.accessDirty = false;
  applyAccess(data || {});
  if (el.statusText) el.statusText.textContent = `Роль «${rolePayload.name}» сохранена.`;
}

async function deleteAccessRole() {
  const role = currentAccessRole();
  if (!role || !confirm(`Удалить роль «${role.name}»?`)) return;
  const roles = state.access.roles.filter((item) => String(item.id) !== String(role.id));
  const data = await api("/api/access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roles }),
  });
  state.selectedAccessRoleId = roles[0]?.id || "";
  state.accessDirty = false;
  applyAccess(data || {});
  if (el.statusText) el.statusText.textContent = `Роль «${role.name}» удалена.`;
}

async function saveSettings() {
  if (!hasPermission("changeAutoTranscription")) throw new Error("Нет права на изменение режима авторасшифровки");
  const nextMode = autoTranscriptionMode();
  const data = await api("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ autoTranscriptionMode: nextMode }),
  });
  applySettings(data.settings || {});
  setAutoTranscriptionModalOpen(false);
  if (el.statusText) {
    const scheduled = Boolean(data.autoScan?.scheduled);
    const queued = Number(data.autoScan?.queued || 0);
    const stopped = Number(data.autoScan?.stopped || 0);
    el.statusText.textContent =
      stopped > 0
        ? `Настройки сохранены. Автоматическая обработка отключена, из очереди снято ${stopped} звонков.`
        : scheduled
          ? "Настройки сохранены. Автоматическая обработка будет обновлена в фоне."
        : queued > 0
          ? `Настройки сохранены. В автоматическую обработку поставлено ${queued} звонков.`
          : "Настройки сохранены. Новый режим автоматической обработки применён.";
  }
  reloadReportData().catch((error) => {
    notifyLoadError(error);
  });
}

async function saveScenario() {
  if (!hasPermission("manageScenarios")) throw new Error("Нет права на изменение сценариев");
  const payload = collectScenarioSubmitPayload();
  if (!payload.name) throw new Error("Укажите название сценария");
  const data = await api("/api/scenarios", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  state.scenarios = data.scenarios || [];
  state.selectedScenarioId = data.scenario.id;
  await loadScenarios();
  applyScenarioToForm(data.scenario);
  setScenarioModalOpen(false);
  if (el.statusText) {
    el.statusText.textContent = `Сценарий «${data.scenario.name}» сохранён.`;
  }
}

async function deleteScenario() {
  if (!hasPermission("manageScenarios")) throw new Error("Нет права на изменение сценариев");
  if (!state.selectedScenarioId) return;
  const current = state.scenarios.find((item) => String(item.id) === String(state.selectedScenarioId));
  if (!confirm(`Удалить сценарий «${current?.name || "без названия"}»? Это действие нельзя отменить.`)) {
    return;
  }
  await api(`/api/scenarios/${state.selectedScenarioId}`, { method: "DELETE" });
  await loadScenarios();
  resetScenarioForm();
  setScenarioModalOpen(false);
  if (el.statusText) {
    el.statusText.textContent = current?.name
      ? `Сценарий «${current.name}» удалён.`
      : "Сценарий удалён.";
  }
}

function applyCallsPayload(data, options = {}) {
  const shouldRefreshDashboard = Boolean(options.refreshDashboard);
  const resetScroll = options.resetScroll !== false;
  state.calls = data.calls;
  state.callsTotal = Number(data.total || 0);
  state.callsPageSize = Number(data.pageSize || PAGE_SIZE);
  state.callsTotalPages = Math.max(1, Number(data.totalPages || 1));
  state.callsHasMore = Boolean(data.hasMore);
  state.callsStatusBreakdown = Array.isArray(data.statusBreakdown) ? data.statusBreakdown : [];
  state.callsNextCursor = String(data.nextCursor || "");
  state.page = Math.max(1, Number(data.page || state.page || 1));
  if (resetScroll && el.callsTableWrap) {
    el.callsTableWrap.scrollTop = 0;
    state.callsVirtual.scrollTop = 0;
  }
  for (const call of state.calls) {
    syncAnalysisOverride(call);
  }
  renderCalls();
  if (state.selectedCallId) {
    selectAnalysisByCallId(state.selectedCallId);
  } else {
    renderAnalysis(state.selectedAnalysis);
  }
  if (shouldRefreshDashboard) {
    renderDashboard();
  }
  ensureAnalysisPolling();
  if (el.statusText) {
    el.statusText.textContent = `Найдено звонков: ${state.callsTotal}`;
  }
}

function prefetchCallsPage(page, pageSize = state.callsPageSize || PAGE_SIZE) {
  const normalizedPage = Math.max(1, Number(page || 1));
  const totalPages = Math.max(1, Number(state.callsTotalPages || 1));
  if (normalizedPage > totalPages) return;
  const cursor = prefetchCursorForPage(normalizedPage);
  if (normalizedPage > 1 && !cursor) return;

  const key = callsPageCacheKey(normalizedPage, pageSize);
  if (callsPageCache.has(key) || callsPagePrefetchInFlight.has(key)) return;

  const query = normalizedPage > 1
    ? `${callsPageQuery(normalizedPage, pageSize)}&cursor=${encodeURIComponent(cursor)}`
    : callsPageQuery(normalizedPage, pageSize);
  const promise = api(`/api/calls?${query}`)
    .then((data) => {
      cacheCallsPage(key, data);
      rememberPageCursor(normalizedPage, data, cursor);
      return data;
    })
    .catch(() => null)
    .finally(() => {
      callsPagePrefetchInFlight.delete(key);
    });

  callsPagePrefetchInFlight.set(key, promise);
}

async function loadCalls(options = {}) {
  const requestedPage = Math.max(1, Number(options.page || state.page || 1));
  const requestedPageSize = Math.max(1, Number(options.pageSize || state.callsPageSize || PAGE_SIZE));
  const shouldRefreshDashboard = Boolean(options.refreshDashboard);
  const preferCache = Boolean(options.preferCache);
  const cacheKey = callsPageCacheKey(requestedPage, requestedPageSize);
  const cursor = options.cursor !== undefined ? String(options.cursor || "") : prefetchCursorForPage(requestedPage);
  if (el.statusText) el.statusText.textContent = "Загружаю список звонков...";
  if (preferCache && callsPageCache.has(cacheKey)) {
    const cached = callsPageCache.get(cacheKey);
    applyCallsPayload(cached, { refreshDashboard: shouldRefreshDashboard });
    prefetchCallsPage(requestedPage + 1, requestedPageSize);
    return cached;
  }

  const query = requestedPage > 1 && cursor
    ? `${callsPageQuery(requestedPage, requestedPageSize)}&cursor=${encodeURIComponent(cursor)}`
    : callsPageQuery(requestedPage, requestedPageSize);
  const data = await api(`/api/calls?${query}`);
  cacheCallsPage(cacheKey, data);
  rememberPageCursor(requestedPage, data, cursor);
  applyCallsPayload(data, { refreshDashboard: shouldRefreshDashboard });
  prefetchCallsPage(requestedPage + 1, requestedPageSize);
  return data;
}

async function loadSummary(options = {}) {
  const data = await api(`/api/reports/summary?${filtersQuery()}`);
  state.summary = data.summary;
  if (options.refreshDashboard !== false) {
    renderDashboard();
  }
}

async function loadDashboardSummaryData(options = {}) {
  const data = await api("/api/dashboard-summary");
  state.dashboardSummary = data.summary || null;
  state.dashboardStatusBreakdown = Array.isArray(data.statusBreakdown) ? data.statusBreakdown : [];
  renderSummary();
  if (options.refreshDashboard !== false) {
    renderDashboard();
  }
}

async function loadDashboardData(options = {}) {
  if (state.dashboardDatasetLoading) {
    return state.dashboardDatasetLoading;
  }

  const task = (async () => {
    const data = await api("/api/dashboard-charts");
    state.dashboardSummary = data.summary || state.dashboardSummary || null;
    state.dashboardCharts = data.charts || null;
    state.dashboardCalls = Array.isArray(data.calls) ? data.calls : [];
    state.dashboardAnalyses = Array.isArray(data.analyses) && data.analyses.length
      ? data.analyses
      : dashboardAnalysesFromCalls(state.dashboardCalls);
    state.dashboardStatusBreakdown = Array.isArray(data.statusBreakdown) ? data.statusBreakdown : state.dashboardStatusBreakdown;
    state.dashboardDatasetLoaded = true;
    renderSummary();
    if (options.refreshDashboard !== false) {
      renderDashboard();
    }
    return data;
  })().finally(() => {
    state.dashboardDatasetLoading = null;
  });

  state.dashboardDatasetLoading = task;
  return task;
}

async function reloadReportData(options = {}) {
  const refreshDashboard = options.refreshDashboard !== false;
  clearCallsPageCache();
  const tasks = [
    loadCalls({ refreshDashboard: false }),
    loadSummary({ refreshDashboard: false }),
  ];
  if (refreshDashboard) {
    tasks.push(loadDashboardData({ refreshDashboard: false }));
  }
  await Promise.all(tasks);
  state.reportDataLoaded = true;
  if (refreshDashboard) {
    renderDashboard();
  }
}

function warmDashboardDataset() {
  const schedule =
    typeof window.requestIdleCallback === "function"
      ? (callback) => window.requestIdleCallback(callback, { timeout: 1200 })
      : (callback) => setTimeout(callback, 350);
  schedule(() => {
    loadDashboardData({ refreshDashboard: true }).catch((error) => {
      notifyLoadError(error);
    });
  });
}

function hasActiveAnalysisWork() {
  const callHasActiveWork = state.calls.some((call) => isActiveAnalysisState(effectiveAnalysis(call)?.state));
  if (callHasActiveWork) return true;
  return Object.values(state.analysisOverrides).some((analysis) => isActiveAnalysisState(analysis?.state));
}

function stopAnalysisPolling() {
  if (!state.analysisPollingTimer) return;
  clearTimeout(state.analysisPollingTimer);
  state.analysisPollingTimer = null;
}

function ensureAnalysisPolling() {
  if (!hasActiveAnalysisWork()) {
    stopAnalysisPolling();
    return;
  }
  if (state.analysisPollingTimer) return;
  state.analysisPollingTimer = setTimeout(async function poll() {
    state.analysisPollingTimer = null;
    try {
      await reloadReportData();
    } catch (error) {
      notifyLoadError(error);
    } finally {
      if (hasActiveAnalysisWork()) ensureAnalysisPolling();
    }
  }, 4000);
}

function selectAnalysisByCallId(activityId) {
  if (String(state.selectedCallId || "") !== String(activityId)) {
    stopTranscriptPlayback();
  }
  const call = callById(activityId);
  const analysis = resolvedAnalysisForCall(activityId);
  state.selectedCallId = activityId;
  setAnalysisDrawerOpen(true);
  if (!analysis) {
    const selectedScenario = selectedScenarioForCall(call);
    state.selectedAnalysis = null;
    renderCalls();
    setAnalysisHeaderMeta(
      analysisHeaderMarkup(call || {}, {
        showScenarioPill: true,
        scenarioName: selectedScenario?.name || "Автосценарий",
        statusLabel: "Не готов",
        statusTone: "neutral",
        sourceCall: call || {},
      }),
    );
    el.analysisState.innerHTML = analysisHeaderStatusMarkup("Не готов", call || {}, "neutral");
    el.analysisState.className = "analysis-status-line";
    el.analysisDetail.className = "analysis-detail";
    el.analysisDetail.innerHTML = `
      <section class="detail-block">
          <h3>${escapeHtml(call?.subject || "Звонок")}</h3>
          ${detailMetaMarkup(call || {})}
          <p>Для этого звонка результат анализа пока отсутствует.</p>
          <p class="muted">Сценарий: ${escapeHtml(selectedScenario?.name || "Автосценарий")}</p>
        </section>`;
      return;
    }
  state.selectedAnalysis = analysis;
  renderCalls();
  renderAnalysis(analysis);
}

async function analyzeOne(activityId) {
  if (!hasPermission("manualAnalyze")) {
    throw new Error("Нет права на ручной запуск расшифровки");
  }
  const call = state.calls.find((item) => String(item.id) === String(activityId));
  const scenarioSelect = document.querySelector(`[data-scenario-select="${activityId}"]`);
  const scenarioId = scenarioSelect?.value || "";
  const selectedScenario = state.scenarios.find((item) => String(item.id) === String(scenarioId)) || null;
  const requestedScenarioName = selectedScenario?.name || "Автосценарий";

  if (call) {
    const currentAnalysis = effectiveAnalysis(call);
    const currentScenarioId = String(currentAnalysis?.selectedScenarioId || "");
    const requestedScenarioId = String(scenarioId || "");
    const sameScenario = currentScenarioId === requestedScenarioId;
    const isReadyAndCurrent =
      normalizeDisplayAnalysisState(currentAnalysis?.state) === "ready" &&
      Boolean(currentAnalysis?.isCurrent);

    if (sameScenario && isReadyAndCurrent) {
      if (el.statusText) {
        el.statusText.textContent = `Повторный запуск не нужен: для звонка уже есть актуальный анализ по сценарию «${requestedScenarioName}».`;
      }
      renderCalls();
      return;
    }
  }

  if (call) {
    const processingAnalysis = {
      ...(effectiveAnalysis(call) || {}),
      activityId: call.id,
      subject: call.subject,
      managerName: call.managerName,
      direction: call.direction,
      durationSeconds: call.durationSeconds,
      ownerId: call.ownerId,
      ownerTypeId: call.ownerTypeId,
      ownerTypeLabel: call.ownerTypeLabel,
      crmEntityUrl: call.crmEntityUrl,
      hasRecording: call.hasRecording,
      recordingFileId: call.recordingFileId,
      recordingUrl: call.recordingUrl,
      selectedScenarioId: scenarioId || null,
      selectedScenarioName: selectedScenario?.name || "Автосценарий",
      state: "queued",
    };
    setAnalysisOverride(call.id, processingAnalysis);
    state.selectedAnalysis =
      String(state.selectedAnalysis?.activityId || "") === String(call.id) ? processingAnalysis : state.selectedAnalysis;
    renderCalls();
  }

  try {
    const result = await api("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activityId,
        scenarioId: scenarioId || null,
        scriptChecklist: "",
        customMetrics: parsedCustomMetrics(),
      }),
    });

    if (result.existing && result.reason === "up_to_date") {
      clearAnalysisOverride(activityId);
      if (el.statusText) {
        el.statusText.textContent = `Актуальный анализ уже существует. Повторный запуск для звонка не потребовался.`;
      }
      await reloadReportData();
      return;
    }

    setAnalysisOverride(activityId, {
      ...(analysisOverride(activityId) || {}),
      activityId,
      state: result.job?.status || "queued",
      selectedScenarioId: result.job?.selectedScenarioId || scenarioId || null,
      selectedScenarioName: result.job?.selectedScenarioName || selectedScenario?.name || "Автосценарий",
      errorMessage: "",
    });
    await reloadReportData();
  } catch (error) {
    const failedCall = state.calls.find((item) => String(item.id) === String(activityId));
    const errorAnalysis = {
      ...(analysisOverride(activityId) || effectiveAnalysis(failedCall || {}) || {}),
      activityId,
      subject: failedCall?.subject || state.selectedAnalysis?.subject || "Звонок",
      managerName: failedCall?.managerName || state.selectedAnalysis?.managerName || "",
      direction: failedCall?.direction || state.selectedAnalysis?.direction || "",
      durationSeconds: failedCall?.durationSeconds || state.selectedAnalysis?.durationSeconds || 0,
      ownerId: failedCall?.ownerId || state.selectedAnalysis?.ownerId || null,
      ownerTypeId: failedCall?.ownerTypeId || state.selectedAnalysis?.ownerTypeId || null,
      ownerTypeLabel: failedCall?.ownerTypeLabel || state.selectedAnalysis?.ownerTypeLabel || "",
      crmEntityUrl: failedCall?.crmEntityUrl || state.selectedAnalysis?.crmEntityUrl || "",
      hasRecording: failedCall?.hasRecording || state.selectedAnalysis?.hasRecording || false,
      recordingFileId: failedCall?.recordingFileId || state.selectedAnalysis?.recordingFileId || null,
      recordingUrl: failedCall?.recordingUrl || state.selectedAnalysis?.recordingUrl || "",
      selectedScenarioName:
        analysisOverride(activityId)?.selectedScenarioName ||
        effectiveAnalysis(failedCall || {})?.selectedScenarioName ||
        "Автосценарий",
      state: "error",
      errorMessage: error.message || "Ошибка анализа",
    };
    setAnalysisOverride(activityId, errorAnalysis);
    state.selectedAnalysis = errorAnalysis;
    renderCalls();
    renderAnalysis(errorAnalysis);
    throw error;
  }
}

function handleFilterControlsChanged() {
  refreshFilterLabels();
  updateApplyFiltersState();
}

async function applyFilters() {
  state.appliedFilters = normalizeFilters(currentFiltersFromControls());
  state.page = 1;
  closeFilterDropdowns();
  updateApplyFiltersState();
  await reloadReportData();
}

function resetFilters() {
  el.dateFrom.value = "";
  el.dateTo.value = "";
  el.onlyRecorded.checked = true;

  Array.from(el.managerIdsOptions?.querySelectorAll('input[data-filter-option="manager"]') || []).forEach((input) => {
    input.checked = false;
  });
  Array.from(el.directionsOptions?.querySelectorAll('input[data-filter-option="direction"]') || []).forEach((input) => {
    input.checked = false;
  });
  Array.from(el.analysisStatesOptions?.querySelectorAll('input[data-filter-option="analysis-state"]') || []).forEach((input) => {
    input.checked = false;
  });
  Array.from(el.scenarioFilterOptions?.querySelectorAll('input[data-filter-option="scenario"]') || []).forEach((input) => {
    input.checked = false;
  });

  refreshFilterLabels();
  closeFilterDropdowns();
  updateApplyFiltersState();
}

document.addEventListener("click", async (event) => {
  const inlineToggle = event.target.closest('[data-action="toggle-scenario-auto"], [data-action="toggle-scenario-default"]');
  if (inlineToggle) {
    event.stopPropagation();
    return;
  }
  if (event.target === el.analysisDrawerBackdrop || event.target === el.closeAnalysisDrawer) {
    stopTranscriptPlayback();
    state.selectedCallId = null;
    state.selectedAnalysis = null;
    setAnalysisDrawerOpen(false);
    renderCalls();
    renderAnalysis(null);
    return;
  }

  if (event.target === el.autoTranscriptionModalBackdrop || event.target === el.closeAutoTranscriptionModal) {
    setAutoTranscriptionModalOpen(false);
    return;
  }

  if (event.target === el.scenarioModalBackdrop || event.target === el.closeScenarioModal) {
    setScenarioModalOpen(false);
    return;
  }

  const internalAnalysisLink = event.target.closest('.analysis-header-link[href^="#"]');
  if (internalAnalysisLink) {
    event.preventDefault();
    const targetId = internalAnalysisLink.getAttribute("href")?.slice(1);
    const target = targetId ? document.getElementById(targetId) : null;
    const panel = el.analysisDrawerPanel;
    if (target && panel) {
      const head = document.querySelector(".analysis-drawer-head");
      const headHeight = head ? head.getBoundingClientRect().height : 0;
      const panelRect = panel.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const desiredTop = panel.scrollTop + (targetRect.top - panelRect.top) - headHeight - 16;
      panel.scrollTo({ top: Math.max(0, desiredTop), behavior: "smooth" });
    }
    return;
  }

  if (!event.target.closest(".multi-select")) {
    closeFilterDropdowns();
  }

  const accessRoleButton = event.target.closest("[data-action='select-access-role']");
  if (accessRoleButton) {
    state.selectedAccessRoleId = accessRoleButton.getAttribute("data-id");
    state.accessDirty = false;
    renderAccessSettings();
    return;
  }

  const pickScenarioButton = event.target.closest("[data-action='pick-scenario']");
  if (pickScenarioButton) {
    const scenario = state.scenarios.find((item) => String(item.id) === String(pickScenarioButton.getAttribute("data-id")));
    if (scenario) {
      applyScenarioToForm(scenario);
      setScenarioModalOpen(true);
    }
    renderScenarioList();
    return;
  }

  const selectCallRow = event.target.closest("[data-action='select-call']");
  const hasTextSelection = Boolean(window.getSelection && window.getSelection()?.toString().trim());
  if (
    selectCallRow &&
    !hasTextSelection &&
    !event.target.closest("button, a, select, option, input, label, summary, details")
  ) {
    selectAnalysisByCallId(selectCallRow.getAttribute("data-id"));
    return;
  }

  const analyzeButton = event.target.closest("[data-action='analyze']");
  if (!analyzeButton) {
    const fullCallButton = event.target.closest("[data-action='toggle-full-call-audio']");
    if (fullCallButton) {
      try {
        await toggleFullCallPlayback();
      } catch (error) {
        stopTranscriptPlayback();
        notifyLoadError(error);
      }
      return;
    }
    const playSegmentButton = event.target.closest("[data-action='play-segment']");
    if (!playSegmentButton) return;
    try {
      await playTranscriptSegment(playSegmentButton);
    } catch (error) {
      stopTranscriptPlayback();
      notifyLoadError(error);
    }
    return;
  }

  analyzeButton.disabled = true;
  try {
    await analyzeOne(analyzeButton.getAttribute("data-id"));
  } catch (error) {
    try {
      await reloadReportData();
    } catch (refreshError) {
      notifyLoadError(refreshError);
    }
    notifyLoadError(error);
  } finally {
    analyzeButton.disabled = false;
  }
});

[el.dateFrom, el.dateTo, el.onlyRecorded].forEach((control) => {
  control.addEventListener("change", handleFilterControlsChanged);
});

document.addEventListener("change", async (event) => {
  if (event.target.matches("[data-access-permission], [data-access-user]")) {
    markAccessDirty();
    return;
  }

  if (
    event.target.matches(
      'input[data-filter-option="manager"], input[data-filter-option="direction"], input[data-filter-option="analysis-state"], input[data-filter-option="scenario"]',
    )
  ) {
    handleFilterControlsChanged();
    return;
  }

  if (
    event.target.matches(
      'input[data-filter-option="scenario-manager"], input[data-filter-option="scenario-entity-type"]',
    )
  ) {
    refreshFilterLabels();
    updateScenarioDirtyState();
    updateScenarioFormMeta();
    return;
  }

  if (event.target.matches("select[data-scenario-select]")) {
    setScenarioSelectionOverride(event.target.getAttribute("data-scenario-select"), event.target.value || "");
    renderCalls();
    return;
  }

  if (
    event.target === el.scenarioDirection ||
    event.target === el.scenarioAutoApply ||
    event.target === el.scenarioIsDefault
  ) {
    if (event.target === el.scenarioIsDefault && !event.target.checked && isOnlyDefaultScenario(state.selectedScenarioId)) {
      event.target.checked = true;
      alert("Сценарий по умолчанию должен быть ровно один. Сначала назначьте другой сценарий по умолчанию.");
      return;
    }
    updateScenarioDirtyState();
    updateScenarioFormMeta();
    return;
  }

  if (event.target.matches('[data-action="toggle-scenario-auto"]')) {
    if (!hasPermission("manageScenarios")) {
      event.target.checked = !event.target.checked;
      notifyLoadError(new Error("Нет права на изменение сценариев"));
      return;
    }
    try {
      await saveScenarioInline(event.target.getAttribute("data-id"), { autoApply: event.target.checked });
    } catch (error) {
      event.target.checked = !event.target.checked;
      notifyLoadError(error);
    }
    return;
  }

  if (event.target.matches('[data-action="toggle-scenario-default"]')) {
    if (!hasPermission("manageScenarios")) {
      event.target.checked = !event.target.checked;
      notifyLoadError(new Error("Нет права на изменение сценариев"));
      return;
    }
    try {
      await saveScenarioInline(event.target.getAttribute("data-id"), { isDefault: event.target.checked });
    } catch (error) {
      event.target.checked = !event.target.checked;
      notifyLoadError(error);
    }
    return;
  }

  if (event.target.matches('input[name="autoTranscriptionMode"]')) {
    state.settingsDirty = autoTranscriptionMode() !== state.settings.autoTranscriptionMode;
    updateSaveSettingsState();
  }
});

[el.managerIdsDropdown, el.directionsDropdown, el.analysisStatesDropdown, el.scenarioFilterDropdown, el.scenarioManagerIdsDropdown, el.scenarioEntityTypeIdsDropdown].forEach((dropdown) => {
  if (!dropdown) return;
  dropdown.addEventListener("toggle", () => {
    if (dropdown.open) {
      closeFilterDropdowns(dropdown);
    }
  });
});

if (el.resetFilters) {
  el.resetFilters.addEventListener("click", () => {
    resetFilters();
  });
}

if (el.applyFilters) {
  el.applyFilters.addEventListener("click", async () => {
    if (!state.filtersDirty) return;
    try {
      await applyFilters();
    } catch (error) {
      notifyLoadError(error);
    }
  });
}

if (el.openAutoTranscriptionSettings) {
  el.openAutoTranscriptionSettings.addEventListener("click", () => {
    setAnalysisDrawerOpen(false);
    setAutoTranscriptionModalOpen(true);
  });
}

if (el.saveScenario) {
  el.saveScenario.addEventListener("click", async () => {
    if (!state.scenarioDirty) return;
    try {
      await saveScenario();
    } catch (error) {
      notifyLoadError(error);
    }
  });
}

if (el.newScenario) {
  el.newScenario.addEventListener("click", () => {
    if (!hasPermission("manageScenarios")) return;
    resetScenarioForm();
    renderScenarioList();
    setScenarioModalOpen(true);
  });
}

if (el.scenarioSearch) {
  el.scenarioSearch.addEventListener("input", () => {
    renderScenarioList();
  });
}

if (el.deleteScenario) {
  el.deleteScenario.addEventListener("click", async () => {
    try {
      await deleteScenario();
    } catch (error) {
      notifyLoadError(error);
    }
  });
}

if (el.copyScenario) {
  el.copyScenario.addEventListener("click", () => {
    copyScenarioToDraft();
  });
}

if (el.resetScenarioRules) {
  el.resetScenarioRules.addEventListener("click", () => {
    resetScenarioRules();
    updateScenarioFormMeta();
  });
}

if (el.saveSettings) {
  el.saveSettings.addEventListener("click", async () => {
    try {
      await saveSettings();
    } catch (error) {
      notifyLoadError(error);
    }
  });
}

if (el.newAccessRole) {
  el.newAccessRole.addEventListener("click", () => {
    if (!canManageAccess()) return;
    createAccessRole();
  });
}

if (el.saveAccessRole) {
  el.saveAccessRole.addEventListener("click", async () => {
    try {
      await saveAccessRole();
    } catch (error) {
      notifyLoadError(error);
    }
  });
}

if (el.deleteAccessRole) {
  el.deleteAccessRole.addEventListener("click", async () => {
    try {
      await deleteAccessRole();
    } catch (error) {
      notifyLoadError(error);
    }
  });
}

if (el.showDashboardView) {
  el.showDashboardView.addEventListener("click", () => {
    setCurrentView("dashboard");
  });
}

if (el.showReportView) {
  el.showReportView.addEventListener("click", () => {
    setCurrentView("report");
  });
}

if (el.showScenariosView) {
  el.showScenariosView.addEventListener("click", () => {
    setCurrentView("scenarios");
  });
}

if (el.showSettingsView) {
  el.showSettingsView.addEventListener("click", () => {
    setCurrentView("settings");
  });
}

if (el.prevPage) {
  el.prevPage.addEventListener("click", async () => {
    if (state.page <= 1) return;
    state.page -= 1;
    try {
      await loadCalls({ refreshDashboard: false, preferCache: true });
    } catch (error) {
      notifyLoadError(error);
    }
  });
}

if (el.firstPage) {
  el.firstPage.addEventListener("click", async () => {
    if (state.page <= 1) return;
    state.page = 1;
    try {
      await loadCalls({ refreshDashboard: false, preferCache: true });
    } catch (error) {
      notifyLoadError(error);
    }
  });
}

if (el.nextPage) {
  el.nextPage.addEventListener("click", async () => {
    const totalPages = Math.max(1, Number(state.callsTotalPages || 1));
    if (state.page >= totalPages) return;
    state.page += 1;
    try {
      await loadCalls({ refreshDashboard: false, preferCache: true });
    } catch (error) {
      notifyLoadError(error);
    }
  });
}

if (el.lastPage) {
  el.lastPage.addEventListener("click", async () => {
    const totalPages = Math.max(1, Number(state.callsTotalPages || 1));
    if (state.page >= totalPages) return;
    state.page = totalPages;
    try {
      await loadCalls({ refreshDashboard: false, preferCache: true });
    } catch (error) {
      notifyLoadError(error);
    }
  });
}

if (el.callsTableWrap) {
  el.callsTableWrap.addEventListener("scroll", () => {
    state.callsVirtual.scrollTop = el.callsTableWrap.scrollTop || 0;
    if (virtualCallsEnabled()) {
      renderCalls();
    }
  });
}

window.addEventListener("resize", () => {
  updateCallsViewportMetrics();
  if (virtualCallsEnabled()) {
    renderCalls();
  }
});

document.addEventListener("input", (event) => {
  if (event.target === el.accessRoleName) {
    markAccessDirty();
    return;
  }

  if (event.target === el.scenarioName) {
    const draftTitle = el.scenarioName.value.trim() || "Новый сценарий";
    if (el.scenarioModalTitle && !state.selectedScenarioId) {
      el.scenarioModalTitle.textContent = draftTitle;
    }
    updateScenarioDirtyState();
    return;
  }

  if (
    event.target === el.scenarioDescription ||
    event.target === el.scenarioScriptChecklist ||
    event.target === el.scenarioCustomMetrics ||
    event.target === el.scenarioKeywords ||
    event.target === el.scenarioMinDuration ||
    event.target === el.scenarioMaxDuration
  ) {
    updateScenarioDirtyState();
    updateScenarioFormMeta();
    return;
  }

  const audioRange = event.target.closest('[data-action="seek-call-audio"]');
  if (!audioRange) return;
  state.playback.seeking = true;
  state.playback.currentTime = Number(audioRange.value || 0);
  updateTranscriptPlaybackButtons();
});

document.addEventListener("change", (event) => {
  const audioRange = event.target.closest('[data-action="seek-call-audio"]');
  if (!audioRange || !transcriptPlayback.audio) return;
  const nextTime = Math.max(0, Number(audioRange.value || 0));
  transcriptPlayback.stopAt = null;
  state.playback.segmentKey = "";
  state.playback.mode = "full-call";
  state.playback.currentTime = nextTime;
  state.playback.seeking = false;
  transcriptPlayback.audio.currentTime = nextTime;
  updateTranscriptPlaybackButtons();
});

(async function init() {
  try {
    await loadAccess();
    setCurrentView(firstAllowedView());
    state.appliedFilters = normalizeFilters(currentFiltersFromControls());
    refreshFilterLabels();
    updateApplyFiltersState();
    if (hasPermission("viewDashboard")) {
      await Promise.all([
        loadDashboardSummaryData({ refreshDashboard: false }),
      ]);
      state.dashboardDatasetLoaded = false;
      renderDashboard();
    }
    renderAnalysis(null);
    warmDeferredViewData();
    if (hasPermission("viewDashboard")) warmDashboardDataset();
  } catch (error) {
    if (el.statusText) el.statusText.textContent = error.message;
    renderEmptyChart(el.managerScoreChart, error.message);
    renderEmptyChart(el.sentimentChart, error.message);
    renderEmptyChart(el.scenarioAverageChart, error.message);
    renderEmptyChart(el.scenarioTokensPerMinuteChart, error.message);
    renderEmptyChart(el.recognizedCallsChart, error.message);
    renderEmptyChart(el.tokensUsageChart, error.message);
    renderEmptyChart(el.recognizedMinutesChart, error.message);
    renderEmptyChart(el.riskChart, error.message);
    renderEmptyChart(el.noRecordingChart, error.message);
    renderEmptyChart(el.tokensPerMinuteChart, error.message);
    renderEmptyChart(el.violatedCheckpointsChart, error.message);
    renderEmptyChart(el.callsHeatmap, error.message);
    renderEmptyChart(el.callsVolumeChart, error.message);
  }
})();
