const PAGE_SIZE = 10;

const state = {
  calls: [],
  summary: null,
  analyses: [],
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
  filtersTimer: null,
  analysisOverrides: {},
  analysisPollingTimer: null,
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
  analysisDrawerBackdrop: document.getElementById("analysisDrawerBackdrop"),
  closeAnalysisDrawer: document.getElementById("closeAnalysisDrawer"),
  firstPage: document.getElementById("firstPage"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  lastPage: document.getElementById("lastPage"),
  pageInfo: document.getElementById("pageInfo"),
  managerScoreChart: document.getElementById("managerScoreChart"),
  sentimentChart: document.getElementById("sentimentChart"),
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

function filters() {
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

function filtersQuery() {
  const current = filters();
  const params = new URLSearchParams();
  if (current.managerIds.length) params.set("managerIds", current.managerIds.join(","));
  if (current.dateFrom) params.set("dateFrom", current.dateFrom);
  if (current.dateTo) params.set("dateTo", current.dateTo);
  if (current.directions.length) params.set("directions", current.directions.join(","));
  if (current.analysisStates.length) params.set("analysisStates", current.analysisStates.join(","));
  if (current.scenarioIds.length) params.set("scenarioIds", current.scenarioIds.join(","));
  params.set("onlyRecorded", String(current.onlyRecorded));
  return params.toString();
}

function formatDuration(seconds) {
  const safe = Number(seconds || 0);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function callMetaLine(source = {}) {
  return [
    source.managerName || "—",
    localizeDirection(source.direction),
    formatDuration(source.durationSeconds),
  ].join(" • ");
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
        return `
        <article class="transcript-row">
          <div class="transcript-meta-line">
            <span class="transcript-role">
              <span class="transcript-role-badge ${participantBadgeClass(roleLabel)}">${escapeHtml(roleLabel)}</span>
              <span class="transcript-time">${escapeHtml(segment.startLabel || formatTimestamp(segment.start))} - ${escapeHtml(segment.endLabel || formatTimestamp(segment.end))}</span>
            </span>
          </div>
          <p class="transcript-text">${escapeHtml(segment.text || "")}</p>
        </article>`;
      },
    )
    .join("")}</div>`;
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
  const start = (state.page - 1) * PAGE_SIZE;
  return state.calls.slice(start, start + PAGE_SIZE);
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
  renderSummaryInto(el.summaryCards, state.summary);
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
    const items = callsStatusCounts(state.calls);
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
  const totalPages = Math.max(1, Math.ceil(state.calls.length / PAGE_SIZE));
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
    el.callsCount.textContent = String(state.calls.length);
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
    setAnalysisDrawerOpen(false);
    setAnalysisHeaderMeta("");
    el.analysisState.textContent = "Не выбран";
    el.analysisState.className = "badge neutral";
    el.analysisDetail.className = "analysis-detail empty";
    el.analysisDetail.textContent = "Выберите звонок со статусом «Готово» или нажмите «Анализировать», чтобы здесь появились резюме, рекомендации и проверка по сценарию.";
    return;
  }

  if (analysis.state === "queued" || analysis.state === "processing") {
    setAnalysisHeaderMeta("");
    el.analysisState.textContent = analysis.state === "queued" ? "В очереди" : "В работе";
    el.analysisState.className = "badge warning";
    el.analysisDetail.className = "analysis-detail";
    el.analysisDetail.innerHTML = `
      <section class="detail-block">
        <h3>${escapeHtml(analysis.subject || "Звонок")}</h3>
        <div class="muted">${escapeHtml(callMetaLine(analysis))}</div>
        <p>${analysis.state === "queued" ? "Звонок поставлен в очередь на анализ. Статус и детализация обновятся автоматически." : "Анализ выполняется. После завершения статус и детализация обновятся автоматически."}</p>
      </section>`;
    return;
  }

  if (analysis.state === "error") {
    setAnalysisHeaderMeta("");
    el.analysisState.textContent = "Ошибка";
    el.analysisState.className = "badge warning";
    el.analysisDetail.className = "analysis-detail";
    el.analysisDetail.innerHTML = `
      <section class="detail-block">
        <h3>${escapeHtml(analysis.subject || "Звонок")}</h3>
        <div class="muted">${escapeHtml(callMetaLine(analysis))}</div>
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
  el.analysisState.textContent = detailStateLabel;
  el.analysisState.className = `badge ${hasDetailedResult && analysis.state !== "outdated" ? "success" : "warning"}`;
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

  const scoreValue = analysis.scriptAnalysis?.overallScore ?? "—";
  const complianceValue = analysis.scriptAnalysis?.compliancePercent ?? "—";
  const totalTokens = analysis.tokenUsage?.totalTokens ?? "—";
  const transcriptionTokens = analysis.tokenUsage?.transcriptionTokens ?? "—";
  const analysisTokens = analysis.tokenUsage?.analysisTotalTokens ?? "—";
  setAnalysisHeaderMeta(`
    <div class="analysis-header-rows">
      <div class="analysis-header-pills">
        <span class="pill">Сентимент: ${escapeHtml(localizeSentiment(analysis.overview?.sentiment))}</span>
        <span class="pill">Риск: ${escapeHtml(localizeRisk(analysis.overview?.riskLevel))}</span>
        <span class="pill">Score: ${escapeHtml(scoreValue)}</span>
      </div>
      <div class="analysis-header-pills script-row">
        <span class="pill">Сценарий: ${escapeHtml(analysis.selectedScenarioName || "Автоподбор / ручной ввод")}</span>
        <span class="pill">Соблюдение скрипта: ${escapeHtml(complianceValue)}%</span>
      </div>
      <div class="analysis-header-pills">
        <span class="pill">Токены: ${escapeHtml(totalTokens)} (транскрибация ${escapeHtml(transcriptionTokens)}, анализ ${escapeHtml(analysisTokens)})</span>
      </div>
      <div class="analysis-header-nav">
        <a class="analysis-header-link" href="#analysisOverview">Общий срез</a>
        <a class="analysis-header-link" href="#analysisRecommendations">Рекомендации</a>
        <a class="analysis-header-link" href="#analysisScript">Проверка сценария</a>
        <a class="analysis-header-link" href="#analysisMetrics">Индивидуальные параметры</a>
        <a class="analysis-header-link" href="#analysisNextStep">Следующий шаг</a>
        <a class="analysis-header-link" href="#analysisTranscript">Транскрипт</a>
      </div>
    </div>
  `);

  el.analysisDetail.innerHTML = `
    <section class="detail-block">
      <h3>${escapeHtml(analysis.subject || "Звонок")}</h3>
      <div class="muted">${escapeHtml(callMetaLine(analysis))}</div>
      <p>${escapeHtml(resultExplanation)}</p>
      <p class="muted">CRM: ${escapeHtml(analysis.ownerTypeLabel || "—")} #${escapeHtml(analysis.ownerId || "—")}</p>
      ${analysis.crmEntityUrl ? `<p><a class="crm-link" href="${escapeHtml(analysis.crmEntityUrl)}" target="_blank" rel="noopener noreferrer">Открыть карточку в Bitrix24</a></p>` : ""}
    </section>
    <section id="analysisOverview" class="detail-block">
      <h3>Общий срез</h3>
      <p class="muted">Исход: ${escapeHtml(localizeFreeText(analysis.overview?.callOutcome))}</p>
      <p class="muted">Потребность клиента: ${escapeHtml(localizeFreeText(analysis.overview?.clientNeed))}</p>
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
    <section id="analysisNextStep" class="detail-block next-step-block">
      <h3>Следующий шаг</h3>
      <p>${escapeHtml(localizeFreeText(analysis.nextStep || "Следующий шаг не определён"))}</p>
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

function renderManagerScoreChart() {
  const rows = (state.summary?.managers || []).filter((item) => Number.isFinite(Number(item.averageScore)));
  if (!rows.length) {
    renderEmptyChart(el.managerScoreChart, "Недостаточно данных для графика по менеджерам.");
    return;
  }

  const maxScore = Math.max(...rows.map((item) => Number(item.averageScore) || 0), 1);
  el.managerScoreChart.innerHTML = `<div class="bars-vertical">${rows
    .map((item) => {
      const value = Number(item.averageScore) || 0;
      const width = Math.max(8, Math.round((value / maxScore) * 100));
      return `
        <div class="bar-row">
          <div class="bar-label">
            <strong>${escapeHtml(item.managerName || "Без имени")}</strong>
            <span class="muted">${escapeHtml(item.calls)} звонков</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${width}%"></div>
          </div>
          <div class="bar-value">${escapeHtml(value.toFixed(1))}</div>
        </div>`;
    })
    .join("")}</div>`;
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

  const maxValue = Math.max(...parts.map((item) => item.value), 1);
  el.sentimentChart.innerHTML = `<div class="bars-vertical">${parts
    .map((item) => {
      const width = Math.max(8, Math.round((item.value / maxValue) * 100));
      const toneClass =
        item.label === "Позитив" ? "is-positive" : item.label === "Нейтрал" ? "is-neutral" : "is-negative";
      const percent = Math.round((item.value / total) * 100) || 0;
      return `
        <div class="bar-row">
          <div class="bar-label">
            <strong>${escapeHtml(item.label)}</strong>
          </div>
          <div class="bar-track ${toneClass}">
            <div class="bar-fill" style="width:${width}%"></div>
          </div>
          <div class="bar-value"><span>${escapeHtml(item.value)}</span><span class="muted">(${escapeHtml(percent)}%)</span></div>
        </div>`;
    })
    .join("")}</div>`;
}

function dailyScoreSeries() {
  const buckets = new Map();
  for (const call of state.calls) {
    const score = Number(call.analysis?.scriptAnalysis?.overallScore);
    if (!Number.isFinite(score)) continue;
    const key = call.startTime ? new Date(call.startTime).toISOString().slice(0, 10) : null;
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, { day: key, total: 0, count: 0 });
    const bucket = buckets.get(key);
    bucket.total += score;
    bucket.count += 1;
  }

  return Array.from(buckets.values())
    .map((item) => ({
      day: item.day,
      averageScore: item.count ? Math.round((item.total / item.count) * 10) / 10 : 0,
    }))
    .sort((left, right) => left.day.localeCompare(right.day));
}

function renderDailyScoreChart() {
  const series = dailyScoreSeries();
  if (!series.length) {
    renderEmptyChart(el.dailyScoreChart, "Недостаточно данных для графика по дням.");
    return;
  }

  const width = 760;
  const height = 240;
  const padding = 28;
  const maxScore = Math.max(...series.map((item) => item.averageScore), 1);
  const minScore = Math.min(...series.map((item) => item.averageScore), 0);
  const range = Math.max(maxScore - minScore, 1);

  const points = series.map((item, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(series.length - 1, 1);
    const y = height - padding - ((item.averageScore - minScore) / range) * (height - padding * 2);
    return { ...item, x, y };
  });

  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  const labels = series
    .map((item, index) => {
      const x = padding + (index * (width - padding * 2)) / Math.max(series.length - 1, 1);
      return `<text x="${x}" y="${height - 6}" text-anchor="middle">${escapeHtml(formatDay(item.day))}</text>`;
    })
    .join("");

  const dots = points
    .map(
      (point) => `
        <circle cx="${point.x}" cy="${point.y}" r="4"></circle>
        <text x="${point.x}" y="${point.y - 10}" text-anchor="middle">${escapeHtml(point.averageScore.toFixed(1))}</text>`,
    )
    .join("");

  el.dailyScoreChart.innerHTML = `
    <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="График среднего score по дням">
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}"></line>
      <polyline points="${polyline}"></polyline>
      ${dots}
      <g class="axis-labels">${labels}</g>
    </svg>`;
}

function renderDashboard() {
  renderManagerScoreChart();
  renderSentimentChart();
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
  await Promise.all([loadCalls(), loadSummary()]);
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

async function loadCalls() {
  if (el.statusText) el.statusText.textContent = "Загружаю список звонков...";
  const data = await api(`/api/calls?${filtersQuery()}`);
  state.calls = data.calls;
  for (const call of state.calls) {
    syncAnalysisOverride(call);
  }
  renderCalls();
  if (state.selectedCallId) {
    selectAnalysisByCallId(state.selectedCallId);
  } else {
    renderAnalysis(state.selectedAnalysis);
  }
  renderDashboard();
  ensureAnalysisPolling();
}

async function loadSummary() {
  const data = await api(`/api/reports/summary?${filtersQuery()}`);
  state.summary = data.summary;
  state.analyses = data.analyses;
  renderSummary();
  renderDashboard();
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
      await Promise.all([loadCalls(), loadSummary()]);
    } catch (error) {
      notifyLoadError(error);
    } finally {
      if (hasActiveAnalysisWork()) ensureAnalysisPolling();
    }
  }, 4000);
}

function selectAnalysisByCallId(activityId) {
  const call = callById(activityId);
  const analysis = resolvedAnalysisForCall(activityId);
  state.selectedCallId = activityId;
  setAnalysisDrawerOpen(true);
  if (!analysis) {
    const selectedScenario = selectedScenarioForCall(call);
    state.selectedAnalysis = null;
    renderCalls();
    setAnalysisHeaderMeta(`
      <div class="analysis-header-topline">${escapeHtml(call?.subject || "Звонок")} • ${escapeHtml(callMetaLine(call || {}))}</div>
    `);
    el.analysisState.textContent = "Не готов";
    el.analysisState.className = "badge neutral";
    el.analysisDetail.className = "analysis-detail";
    el.analysisDetail.innerHTML = `
      <section class="detail-block">
          <h3>${escapeHtml(call?.subject || "Звонок")}</h3>
          <div class="muted">${escapeHtml(callMetaLine(call || {}))}</div>
          <p>Для этого звонка результат анализа пока отсутствует.</p>
          <p class="muted">Статус: ${escapeHtml(analysisStatus(call || {}).label || "Ожидает анализа")}</p>
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
      await Promise.all([loadCalls(), loadSummary()]);
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
    await Promise.all([loadCalls(), loadSummary()]);
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

function scheduleFiltersReload() {
  clearTimeout(state.filtersTimer);
  refreshFilterLabels();
  state.filtersTimer = setTimeout(async () => {
    state.page = 1;
    try {
      await Promise.all([loadCalls(), loadSummary()]);
    } catch (error) {
      notifyLoadError(error);
    }
  }, 250);
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
  scheduleFiltersReload();
}

document.addEventListener("click", async (event) => {
  if (event.target === el.analysisDrawerBackdrop || event.target === el.closeAnalysisDrawer) {
    state.selectedCallId = null;
    state.selectedAnalysis = null;
    setAnalysisDrawerOpen(false);
    renderCalls();
    renderAnalysis(null);
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
  if (!analyzeButton) return;

  analyzeButton.disabled = true;
  try {
    await analyzeOne(analyzeButton.getAttribute("data-id"));
  } catch (error) {
    try {
      await Promise.all([loadCalls(), loadSummary()]);
    } catch (refreshError) {
      notifyLoadError(refreshError);
    }
    notifyLoadError(error);
  } finally {
    analyzeButton.disabled = false;
  }
});

[el.dateFrom, el.dateTo, el.onlyRecorded].forEach((control) => {
  control.addEventListener("change", scheduleFiltersReload);
});

document.addEventListener("change", (event) => {
  if (
    event.target.matches(
      'input[data-filter-option="manager"], input[data-filter-option="direction"], input[data-filter-option="analysis-state"], input[data-filter-option="scenario"]',
    )
  ) {
    scheduleFiltersReload();
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
  el.prevPage.addEventListener("click", () => {
    if (state.page <= 1) return;
    state.page -= 1;
    renderCalls();
  });
}

if (el.firstPage) {
  el.firstPage.addEventListener("click", () => {
    if (state.page <= 1) return;
    state.page = 1;
    renderCalls();
  });
}

if (el.nextPage) {
  el.nextPage.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(state.calls.length / PAGE_SIZE));
    if (state.page >= totalPages) return;
    state.page += 1;
    renderCalls();
  });
}

if (el.lastPage) {
  el.lastPage.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(state.calls.length / PAGE_SIZE));
    if (state.page >= totalPages) return;
    state.page = totalPages;
    renderCalls();
  });
}

(async function init() {
  try {
    setCurrentView("dashboard");
    await loadManagers();
    await loadSettings();
    await loadScenarios();
    await Promise.all([loadCalls(), loadSummary()]);
    renderAnalysis(null);
  } catch (error) {
    if (el.statusText) el.statusText.textContent = error.message;
    renderEmptyChart(el.managerScoreChart, error.message);
    renderEmptyChart(el.sentimentChart, error.message);
    renderEmptyChart(el.dailyScoreChart, error.message);
  }
})();
