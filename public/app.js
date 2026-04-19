const PAGE_SIZE = 10;

const state = {
  calls: [],
  callsTotal: 0,
  callsPageSize: PAGE_SIZE,
  callsTotalPages: 1,
  callsHasMore: false,
  callsStatusBreakdown: [],
  summary: null,
  scenarios: [],
  settings: {
    autoTranscriptionMode: "disabled",
  },
  settingsDirty: false,
  selectedCallId: null,
  selectedAnalysis: null,
  selectedScenarioId: "",
  currentView: "dashboard",
  page: 1,
  appliedFilters: null,
  filtersDirty: false,
  analysisOverrides: {},
  analysisPollingTimer: null,
  playback: {
    activityId: null,
    segmentKey: "",
    audioUrl: "",
    loading: false,
    mode: "",
  },
};

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
  scenarioManagerIds: document.getElementById("scenarioManagerIds"),
  scenarioEntityTypeIds: document.getElementById("scenarioEntityTypeIds"),
  scenarioPipelineIds: document.getElementById("scenarioPipelineIds"),
  scenarioStageIds: document.getElementById("scenarioStageIds"),
  scenarioLineNumbers: document.getElementById("scenarioLineNumbers"),
  scenarioKeywords: document.getElementById("scenarioKeywords"),
  scenarioMinDuration: document.getElementById("scenarioMinDuration"),
  scenarioMaxDuration: document.getElementById("scenarioMaxDuration"),
  scenarioAutoApply: document.getElementById("scenarioAutoApply"),
  scenarioIsDefault: document.getElementById("scenarioIsDefault"),
  saveScenario: document.getElementById("saveScenario"),
  newScenario: document.getElementById("newScenario"),
  deleteScenario: document.getElementById("deleteScenario"),
  scenarioList: document.getElementById("scenarioList"),
  summaryCards: document.getElementById("summaryCards"),
  dashboardSummaryCards: document.getElementById("dashboardSummaryCards"),
  callsTable: document.getElementById("callsTable"),
  callsCount: document.getElementById("callsCount"),
  callsBreakdown: document.getElementById("callsBreakdown"),
  reportAutoMode: document.getElementById("reportAutoMode"),
  statusText: document.getElementById("statusText"),
  analysisDetail: document.getElementById("analysisDetail"),
  analysisState: document.getElementById("analysisState"),
  analysisHeaderMeta: document.getElementById("analysisHeaderMeta"),
  analysisDrawer: document.getElementById("analysisDrawer"),
  analysisDrawerPanel: document.querySelector(".analysis-drawer-panel"),
  analysisDrawerBackdrop: document.getElementById("analysisDrawerBackdrop"),
  closeAnalysisDrawer: document.getElementById("closeAnalysisDrawer"),
  firstPage: document.getElementById("firstPage"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  lastPage: document.getElementById("lastPage"),
  pageInfo: document.getElementById("pageInfo"),
  managerScoreChart: document.getElementById("managerScoreChart"),
  sentimentChart: document.getElementById("sentimentChart"),
  scenarioAverageChart: document.getElementById("scenarioAverageChart"),
  recognizedCallsChart: document.getElementById("recognizedCallsChart"),
  tokensUsageChart: document.getElementById("tokensUsageChart"),
  recognizedMinutesChart: document.getElementById("recognizedMinutesChart"),
  dailyScoreChart: document.getElementById("dailyScoreChart"),
  saveSettings: document.getElementById("saveSettings"),
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
}

function closeFilterDropdowns(except = null) {
  [el.managerIdsDropdown, el.directionsDropdown, el.analysisStatesDropdown, el.scenarioFilterDropdown].forEach((dropdown) => {
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

function selectedScenarioIdForCall(call) {
  return effectiveAnalysis(call)?.selectedScenarioId || defaultScenario()?.id || "";
}

function selectedScenarioForCall(call) {
  const scenarioId = call ? selectedScenarioIdForCall(call) : "";
  return state.scenarios.find((item) => String(item.id) === String(scenarioId)) || defaultScenario();
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("ru-RU") : "—";
}

function formatDay(value) {
  return value ? new Date(value).toLocaleDateString("ru-RU") : "—";
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

function setAnalysisDrawerOpen(open) {
  if (!el.analysisDrawer) return;
  el.analysisDrawer.classList.toggle("open", Boolean(open));
  document.body.classList.toggle("drawer-open", Boolean(open));
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
  const parts = [
    `Клиент: ${callClientTitle(source)}`,
    `Телефон: ${source.clientPhone || "—"}`,
    `Направление: ${localizeDirection(source.direction)}`,
    `Дата и время: ${formatCallDateTime(source.startTime)}`,
    `Длительность: ${formatDuration(source.durationSeconds)}`,
  ];

  return `
    <span class="analysis-status-badge ${escapeHtml(tone)}">${escapeHtml(`Статус: ${label}`)}</span>
    <span class="analysis-status-meta">${parts.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</span>
  `;
}

function analysisHeaderMarkup(analysis, options = {}) {
  const scoreValue = analysis?.scriptAnalysis?.overallScore ?? "—";
  const complianceValue = analysis?.scriptAnalysis?.compliancePercent ?? "—";
  const totalTokens = analysis?.tokenUsage?.totalTokens ?? "—";
  const transcriptionTokens = analysis?.tokenUsage?.transcriptionTokens ?? "—";
  const analysisTokens = analysis?.tokenUsage?.analysisTotalTokens ?? "—";
  const scenarioName = options.scenarioName || analysis?.selectedScenarioName || "Автосценарий";
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
  if (analysis?.recordingUrl) {
    const isPlayingFullCall =
      state.playback.activityId === analysis.activityId &&
      state.playback.mode === "full-call";
    pills.push(
      `<button type="button" class="analysis-audio-button ${isPlayingFullCall ? "is-active" : ""}" data-action="toggle-full-call-audio">${isPlayingFullCall ? "■ Остановить разговор" : "▶ Прослушать разговор"}</button>`,
    );
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
  transcriptPlayback.audio.addEventListener("timeupdate", () => {
    if (transcriptPlayback.stopAt == null) return;
    if (transcriptPlayback.audio.currentTime >= transcriptPlayback.stopAt) {
      stopTranscriptPlayback();
    }
  });
  transcriptPlayback.audio.addEventListener("ended", () => {
    stopTranscriptPlayback();
  });
}

function collectScenarioPayload() {
  const existing = state.scenarios.find((item) => String(item.id) === String(state.selectedScenarioId));
  return {
    id: existing?.id,
    name: el.scenarioName.value.trim(),
    description: el.scenarioDescription.value.trim(),
    scriptChecklist: el.scenarioScriptChecklist.value.trim(),
    customMetrics: parseMetricsInput(el.scenarioCustomMetrics.value),
    autoApply: el.scenarioAutoApply.checked,
    isDefault: el.scenarioIsDefault.checked,
    matchRules: {
      directions: el.scenarioDirection.value ? [el.scenarioDirection.value] : [],
      managerIds: parseNumericList(el.scenarioManagerIds.value),
      entityTypeIds: parseNumericList(el.scenarioEntityTypeIds.value),
      pipelineIds: parseNumericList(el.scenarioPipelineIds.value),
      stageIds: parseTextList(el.scenarioStageIds.value),
      lineNumbers: parseTextList(el.scenarioLineNumbers.value),
      subjectKeywords: parseTextList(el.scenarioKeywords.value),
      minDurationSeconds: el.scenarioMinDuration.value.trim() === "" ? null : Number(el.scenarioMinDuration.value),
      maxDurationSeconds: el.scenarioMaxDuration.value.trim() === "" ? null : Number(el.scenarioMaxDuration.value),
    },
  };
}

function resetScenarioForm() {
  state.selectedScenarioId = "";
  el.scenarioName.value = "";
  el.scenarioDescription.value = "";
  el.scenarioScriptChecklist.value = "";
  el.scenarioCustomMetrics.value = "";
  el.scenarioDirection.value = "";
  el.scenarioManagerIds.value = "";
  el.scenarioEntityTypeIds.value = "";
  el.scenarioPipelineIds.value = "";
  el.scenarioStageIds.value = "";
  el.scenarioLineNumbers.value = "";
  el.scenarioKeywords.value = "";
  el.scenarioMinDuration.value = "";
  el.scenarioMaxDuration.value = "";
  el.scenarioAutoApply.checked = true;
  el.scenarioIsDefault.checked = false;
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
  el.scenarioCustomMetrics.value = JSON.stringify(scenario.customMetrics || [], null, 2);
  el.scenarioDirection.value = scenario.matchRules?.directions?.[0] || "";
  el.scenarioManagerIds.value = (scenario.matchRules?.managerIds || []).join(", ");
  el.scenarioEntityTypeIds.value = (scenario.matchRules?.entityTypeIds || []).join(", ");
  el.scenarioPipelineIds.value = (scenario.matchRules?.pipelineIds || []).join(", ");
  el.scenarioStageIds.value = (scenario.matchRules?.stageIds || []).join(", ");
  el.scenarioLineNumbers.value = (scenario.matchRules?.lineNumbers || []).join(", ");
  el.scenarioKeywords.value = (scenario.matchRules?.subjectKeywords || []).join(", ");
  el.scenarioMinDuration.value = scenario.matchRules?.minDurationSeconds ?? "";
  el.scenarioMaxDuration.value = scenario.matchRules?.maxDurationSeconds ?? "";
  el.scenarioAutoApply.checked = Boolean(scenario.autoApply);
  el.scenarioIsDefault.checked = Boolean(scenario.isDefault);
}

function renderScenarioList() {
  if (!el.scenarioList) return;
  el.scenarioList.innerHTML = state.scenarios
    .map((scenario) => {
      const tags = [];
      if (scenario.autoApply) tags.push("авто");
      if (scenario.isDefault) tags.push("по умолчанию");
      if (scenario.matchRules?.directions?.length) tags.push(scenario.matchRules.directions.join(", "));
      const rules = [];
      if (scenario.matchRules?.managerIds?.length) rules.push(`менеджеры: ${scenario.matchRules.managerIds.join(", ")}`);
      if (scenario.matchRules?.entityTypeIds?.length) rules.push(`сущности: ${scenario.matchRules.entityTypeIds.map((item) => ownerTypeLabel(item)).join(", ")}`);
      if (scenario.matchRules?.pipelineIds?.length) rules.push(`воронки: ${scenario.matchRules.pipelineIds.join(", ")}`);
      if (scenario.matchRules?.stageIds?.length) rules.push(`стадии: ${scenario.matchRules.stageIds.join(", ")}`);
      if (scenario.matchRules?.lineNumbers?.length) rules.push(`линии: ${scenario.matchRules.lineNumbers.join(", ")}`);
      if (scenario.matchRules?.subjectKeywords?.length) rules.push(`ключи: ${scenario.matchRules.subjectKeywords.join(", ")}`);
      if (scenario.matchRules?.minDurationSeconds != null) rules.push(`от ${scenario.matchRules.minDurationSeconds} сек`);
      if (scenario.matchRules?.maxDurationSeconds != null) rules.push(`до ${scenario.matchRules.maxDurationSeconds} сек`);
      return `
        <tr class="${state.selectedScenarioId === scenario.id ? "is-selected" : ""}" data-action="pick-scenario" data-id="${scenario.id}">
          <td><button type="button" class="scenario-link" data-action="pick-scenario" data-id="${scenario.id}">${escapeHtml(scenario.name)}</button></td>
          <td>${escapeHtml(scenario.description || "Без описания")}</td>
          <td>${escapeHtml(tags.join(" • ") || "Ручной запуск")}</td>
          <td>${escapeHtml(rules.join(" • ") || "Без правил")}</td>
        </tr>`;
    })
    .join("");
}

function setCurrentView(view) {
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
  }
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
  container.innerHTML = [
    summaryCard("Проанализировано звонков", summary.analyzedCalls, "Все сохранённые AI-разборы"),
    summaryCard("Средний score", summary.averageScore || "0", "Оценка соблюдения сценария"),
    summaryCard("Высокий риск", summary.highRisk, "Требует ручного разбора"),
    summaryCard(
      "Позитив / нейтрал / негатив",
      `${summary.positive} / ${summary.neutral} / ${summary.negative}`,
      "Сентимент разговора",
    ),
  ].join("");
}

function renderSummary() {
  renderSummaryInto(el.dashboardSummaryCards, state.summary);
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
    el.reportAutoMode.textContent = `Автоматическая расшифровка: ${autoModeLabel(state.settings?.autoTranscriptionMode)}`;
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
function renderCalls() {
  hydrateSelectedAnalysis();
  if (el.callsCount) {
    el.callsCount.textContent = String(state.callsTotal);
  }
  renderReportMeta();
  el.callsTable.innerHTML = pagedCalls()
      .map((call) => {
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
      const actionDisabled = !call.hasRecording || isAnalysisActive || isUpToDateReady;
      const actionTitle = !call.hasRecording
        ? "Нет записи"
        : isUpToDateReady
          ? "Повторный анализ не требуется"
          : isAnalysisActive
            ? "Анализ уже запущен"
            : "Анализировать звонок";
      const actionIcon = !call.hasRecording ? "×" : isAnalysisActive ? "…" : isUpToDateReady ? "✓" : "▶";
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
          <td class="scenario-cell"><select class="scenario-select" data-scenario-select="${call.id}" ${isAnalysisActive ? "disabled" : ""}>${scenarioOptions}</select></td>
          <td class="token-cell">${escapeHtml(totalTokens)}</td>
          <td class="actions-cell"><div class="action-stack"><button class="call-action call-action-icon primary-action" title="${escapeHtml(actionTitle)}" aria-label="${escapeHtml(actionTitle)}" data-action="analyze" data-id="${call.id}" ${actionDisabled ? "disabled" : ""}>${actionIcon}</button></div></td>
          </tr>`;
      })
      .join("");
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
    setAnalysisHeaderMeta(analysisHeaderMarkup(analysis));
    el.analysisState.innerHTML = analysisHeaderStatusMarkup(
      analysis.state === "queued" ? "В очереди" : "В работе",
      source,
      "warning",
    );
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
    setAnalysisHeaderMeta(analysisHeaderMarkup(analysis));
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

  setAnalysisHeaderMeta(
    analysisHeaderMarkup(analysis, {
      showDetailPills: true,
      showNav: true,
      scenarioName: analysis.selectedScenarioName || "Автоподбор / ручной ввод",
    }),
  );

  el.analysisDetail.innerHTML = `
    <section id="analysisOverview" class="detail-block">
      <h3>${escapeHtml(analysis.subject || "Резюме")}</h3>
      ${detailMetaMarkup(analysis)}
      <p>${escapeHtml(resultExplanation)}</p>
      <ul class="flat">
        <li><strong>Результат</strong>: ${escapeHtml(localizeFreeText(analysis.overview?.callOutcome || "Результат не определён"))}</li>
        <li><strong>Потребность клиента</strong>: ${escapeHtml(localizeFreeText(analysis.overview?.clientNeed || "Потребность клиента не определена"))}</li>
        <li><strong>Следующий шаг</strong>: ${escapeHtml(localizeFreeText(analysis.nextStep || "Следующий шаг не определён"))}</li>
      </ul>
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
      ${transcriptSegmentsMarkup(analysis)}
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
    hintFormatter = () => "",
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
      const hint = hintFormatter(item);
      const trackClass = [trackClassName, item.trackClassName].filter(Boolean).join(" ");
      return `
        <div class="bar-row">
          <div class="bar-label">
            <strong>${escapeHtml(item.label)}</strong>
            ${hint ? `<span class="muted">${escapeHtml(hint)}</span>` : ""}
          </div>
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
    strokeClass = "",
    areaClass = "",
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
  const labels = points
    .map(
      (point) =>
        `<text class="line-chart-axis-text" x="${point.x}" y="${height - 12}" text-anchor="middle">${escapeHtml(point.label)}</text>`,
    )
    .join("");
  const pointLabels = points
    .map(
      (point) => `
        <circle cx="${point.x}" cy="${point.y}" r="4"></circle>
        <text class="line-chart-point-text" x="${point.x}" y="${point.y - 12}" text-anchor="middle">${escapeHtml(valueFormatter(point.value, point))}</text>`,
    )
    .join("");
  const yTicks = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3;
    const value = roundedMetric(maxValue - maxValue * ratio, maxValue >= 100 ? 0 : 1);
    const y = paddingTop + chartHeight * ratio;
    return `
      <g class="line-chart-grid-line">
        <line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}"></line>
        <text class="line-chart-axis-text" x="${paddingX - 10}" y="${y + 4}" text-anchor="end">${escapeHtml(yTickFormatter(value))}</text>
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

function lastNDaysKeys(days = 7) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (days - index - 1));
    return date.toISOString().slice(0, 10);
  });
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

function renderManagerScoreChart() {
  const rows = (state.summary?.managers || []).filter((item) => Number.isFinite(Number(item.averageScore)));
  renderHorizontalBars(
    el.managerScoreChart,
    rows.map((item) => ({
      label: item.managerName || "Без имени",
      value: Number(item.averageScore) || 0,
      calls: item.calls,
    })),
    {
      emptyMessage: "Недостаточно данных для графика по менеджерам.",
      formatter: (value) => escapeHtml(value.toFixed(1)),
      hintFormatter: (item) => `${item.calls} звонков`,
    },
  );
}

function renderSentimentChart() {
  const summary = state.summary;
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
      hintFormatter: (item) => `Доля звонков: ${item.value.toFixed(1)}%`,
    },
  );
}

function scenarioComplianceRows() {
  const buckets = new Map();
  for (const call of callsWithAnalysis()) {
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

function renderScenarioAverageChart() {
  const rows = scenarioComplianceRows();
  renderHorizontalBars(el.scenarioAverageChart, rows, {
    emptyMessage: "Нет данных по соблюдению сценариев.",
    usePercentScale: true,
    formatter: (value) => escapeHtml(`${value.toFixed(1)}%`),
    hintFormatter: (item) => `${item.count} звонков`,
  });
}

function buildLast7DaysSeries(metricResolver) {
  const keys = lastNDaysKeys(7);
  const buckets = new Map(keys.map((key) => [key, 0]));
  for (const call of callsWithAnalysis()) {
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

function renderSeriesChart(container, series, options = {}) {
  if (!container) return;
  const { emptyMessage = "Недостаточно данных за последние 7 дней." } = options;
  if (!series.length) {
    renderEmptyChart(container, emptyMessage);
    return;
  }
  const hasValues = series.some((item) => Number(item.value || 0) > 0);
  const note = hasValues
    ? ""
    : '<div class="chart-inline-note">За последние 7 дней значения равны 0.</div>';
  container.innerHTML = `${note}${lineSeriesSvg(series, options)}`;
}

function renderRecognizedCallsChart() {
  const series = buildLast7DaysSeries(() => 1);
  renderSeriesChart(el.recognizedCallsChart, series, {
    emptyMessage: "Нет распознанных звонков за последние 7 дней.",
    ariaLabel: "График распознанных звонков за последние 7 дней",
    valueFormatter: (value) => `${Math.round(value)}`,
    yTickFormatter: (value) => `${Math.round(value)}`,
    strokeClass: "is-calls",
    areaClass: "is-calls",
  });
}

function renderTokensUsageChart() {
  const series = buildLast7DaysSeries((call) => Number(effectiveAnalysis(call)?.tokenUsage?.totalTokens || 0));
  renderSeriesChart(el.tokensUsageChart, series, {
    emptyMessage: "Нет расхода токенов за последние 7 дней.",
    ariaLabel: "График расхода токенов за последние 7 дней",
    valueFormatter: (value) => `${Math.round(value)}`,
    yTickFormatter: (value) => `${Math.round(value)}`,
    strokeClass: "is-tokens",
    areaClass: "is-tokens",
  });
}

function renderRecognizedMinutesChart() {
  const series = buildLast7DaysSeries((call) => Number(call.durationSeconds || 0) / 60).map((item) => ({
    ...item,
    value: roundedMetric(item.value, 1),
  }));
  renderSeriesChart(el.recognizedMinutesChart, series, {
    emptyMessage: "Нет распознанных минут за последние 7 дней.",
    ariaLabel: "График распознанных минут за последние 7 дней",
    valueFormatter: (value) => `${value.toFixed(1)}`,
    yTickFormatter: (value) => `${value.toFixed(1)}`,
    strokeClass: "is-minutes",
    areaClass: "is-minutes",
  });
}

function buildLast7DaysAverageSeries(metricResolver) {
  const keys = lastNDaysKeys(7);
  const buckets = new Map(keys.map((key) => [key, { total: 0, count: 0 }]));
  for (const call of callsWithAnalysis()) {
    const key = callDayKey(call);
    if (!key || !buckets.has(key)) continue;
    const value = Number(metricResolver(call));
    if (!Number.isFinite(value)) continue;
    const bucket = buckets.get(key);
    bucket.total += value;
    bucket.count += 1;
  }
  return keys.map((key) => {
    const bucket = buckets.get(key);
    const average = bucket.count ? roundedMetric(bucket.total / bucket.count, 1) : 0;
    return {
      key,
      label: formatDay(key),
      value: average,
    };
  });
}

function renderDailyScoreChart() {
  const series = buildLast7DaysAverageSeries((call) => effectiveAnalysis(call)?.scriptAnalysis?.overallScore);
  renderSeriesChart(el.dailyScoreChart, series, {
    emptyMessage: "Нет данных по среднему score.",
    ariaLabel: "График среднего score за последние 7 дней",
    valueFormatter: (value) => `${value.toFixed(1)}`,
    yTickFormatter: (value) => `${value.toFixed(1)}`,
    strokeClass: "is-score",
    areaClass: "is-score",
  });
}

function renderDashboard() {
  renderSentimentChart();
  renderScenarioAverageChart();
  renderManagerScoreChart();
  renderRecognizedCallsChart();
  renderTokensUsageChart();
  renderRecognizedMinutesChart();
  renderDailyScoreChart();
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
  el.managerIdsOptions.innerHTML = managers
    .map(
      (manager) => `<label class="multi-select-option"><input type="checkbox" value="${manager.id}" data-filter-option="manager" data-label="${escapeHtml(manager.fullName)}" ${selected.has(String(manager.id)) ? "checked" : ""} /><span>${escapeHtml(manager.fullName)}</span></label>`,
    )
    .join("");
  refreshFilterLabels();
}

async function loadScenarios() {
  const data = await api("/api/scenarios");
  state.scenarios = data.scenarios || [];
  const selected = new Set(selectedScenarioFilters());
  if (el.scenarioFilterOptions) {
    el.scenarioFilterOptions.innerHTML = state.scenarios
      .map(
        (scenario) =>
          `<label class="multi-select-option"><input type="checkbox" value="${escapeHtml(scenario.id)}" data-filter-option="scenario" data-label="${escapeHtml(scenario.name)}" ${selected.has(String(scenario.id)) ? "checked" : ""} /><span>${escapeHtml(scenario.name)}</span></label>`,
      )
      .join("");
  }
  renderScenarioList();
  refreshFilterLabels();
  if (state.selectedScenarioId) {
    const scenario = state.scenarios.find((item) => item.id === state.selectedScenarioId);
    if (scenario) applyScenarioToForm(scenario);
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

async function loadSettings() {
  const data = await api("/api/settings");
  applySettings(data.settings || {});
}

async function saveSettings() {
  const data = await api("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ autoTranscriptionMode: autoTranscriptionMode() }),
  });
  applySettings(data.settings || {});
  await reloadReportData();
  if (el.statusText) {
    const queued = Number(data.autoScan?.queued || 0);
    const stopped = Number(data.autoScan?.stopped || 0);
    el.statusText.textContent =
      stopped > 0
        ? `Настройки сохранены. Автоматическая обработка отключена, из очереди снято ${stopped} звонков.`
        : queued > 0
          ? `Настройки сохранены. В автоматическую обработку поставлено ${queued} звонков.`
          : "Настройки сохранены. Новый режим автоматической обработки применён.";
  }
}

async function saveScenario() {
  const payload = collectScenarioPayload();
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
}

async function deleteScenario() {
  if (!state.selectedScenarioId) return;
  await api(`/api/scenarios/${state.selectedScenarioId}`, { method: "DELETE" });
  await loadScenarios();
  resetScenarioForm();
}

async function loadCalls(options = {}) {
  const shouldRefreshDashboard = Boolean(options.refreshDashboard);
  if (el.statusText) el.statusText.textContent = "Загружаю список звонков...";
  const data = await api(`/api/calls?${filtersQuery(true)}`);
  state.calls = data.calls;
  state.callsTotal = Number(data.total || 0);
  state.callsPageSize = Number(data.pageSize || PAGE_SIZE);
  state.callsTotalPages = Math.max(1, Number(data.totalPages || 1));
  state.callsHasMore = Boolean(data.hasMore);
  state.callsStatusBreakdown = Array.isArray(data.statusBreakdown) ? data.statusBreakdown : [];
  state.page = Math.max(1, Number(data.page || state.page || 1));
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

async function loadSummary(options = {}) {
  const data = await api(`/api/reports/summary?${filtersQuery()}`);
  state.summary = data.summary;
  renderSummary();
  if (options.refreshDashboard !== false) {
    renderDashboard();
  }
}

async function reloadReportData(options = {}) {
  const refreshDashboard = options.refreshDashboard !== false;
  await Promise.all([
    loadCalls({ refreshDashboard: false }),
    loadSummary({ refreshDashboard: false }),
  ]);
  if (refreshDashboard) {
    renderDashboard();
  }
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
  if (event.target === el.analysisDrawerBackdrop || event.target === el.closeAnalysisDrawer) {
    stopTranscriptPlayback();
    state.selectedCallId = null;
    state.selectedAnalysis = null;
    setAnalysisDrawerOpen(false);
    renderCalls();
    renderAnalysis(null);
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

  const pickScenarioButton = event.target.closest("[data-action='pick-scenario']");
  if (pickScenarioButton) {
    const scenario = state.scenarios.find((item) => item.id === pickScenarioButton.getAttribute("data-id"));
    if (scenario) applyScenarioToForm(scenario);
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

document.addEventListener("change", (event) => {
  if (
    event.target.matches(
      'input[data-filter-option="manager"], input[data-filter-option="direction"], input[data-filter-option="analysis-state"], input[data-filter-option="scenario"]',
    )
  ) {
    handleFilterControlsChanged();
    return;
  }

  if (event.target.matches('input[name="autoTranscriptionMode"]')) {
    state.settingsDirty = autoTranscriptionMode() !== state.settings.autoTranscriptionMode;
    updateSaveSettingsState();
  }
});

[el.managerIdsDropdown, el.directionsDropdown, el.analysisStatesDropdown, el.scenarioFilterDropdown].forEach((dropdown) => {
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

if (el.saveScenario) {
  el.saveScenario.addEventListener("click", async () => {
    try {
      await saveScenario();
    } catch (error) {
      notifyLoadError(error);
    }
  });
}

if (el.newScenario) {
  el.newScenario.addEventListener("click", () => {
    resetScenarioForm();
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

if (el.saveSettings) {
  el.saveSettings.addEventListener("click", async () => {
    try {
      await saveSettings();
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
      await loadCalls({ refreshDashboard: false });
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
      await loadCalls({ refreshDashboard: false });
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
      await loadCalls({ refreshDashboard: false });
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
      await loadCalls({ refreshDashboard: false });
    } catch (error) {
      notifyLoadError(error);
    }
  });
}

(async function init() {
  try {
    setCurrentView("dashboard");
    state.appliedFilters = normalizeFilters(currentFiltersFromControls());
    refreshFilterLabels();
    updateApplyFiltersState();
    await Promise.all([
      loadManagers(),
      loadSettings(),
      loadScenarios(),
      loadCalls({ refreshDashboard: false }),
      loadSummary({ refreshDashboard: false }),
    ]);
    renderDashboard();
    renderAnalysis(null);
  } catch (error) {
    if (el.statusText) el.statusText.textContent = error.message;
    renderEmptyChart(el.managerScoreChart, error.message);
    renderEmptyChart(el.sentimentChart, error.message);
    renderEmptyChart(el.scenarioAverageChart, error.message);
    renderEmptyChart(el.recognizedCallsChart, error.message);
    renderEmptyChart(el.tokensUsageChart, error.message);
    renderEmptyChart(el.recognizedMinutesChart, error.message);
    renderEmptyChart(el.dailyScoreChart, error.message);
  }
})();
