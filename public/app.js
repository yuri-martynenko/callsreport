const PAGE_SIZE = 10;

const state = {
  calls: [],
  summary: null,
  analyses: [],
  scenarios: [],
  settings: {
    autoTranscriptionMode: "disabled",
  },
  selectedAnalysis: null,
  selectedScenarioId: "",
  currentView: "dashboard",
  page: 1,
  filtersTimer: null,
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
  onlyRecorded: document.getElementById("onlyRecorded"),
  resetFilters: document.getElementById("resetFilters"),
  scenarioName: document.getElementById("scenarioName"),
  scenarioDescription: document.getElementById("scenarioDescription"),
  scenarioScriptChecklist: document.getElementById("scenarioScriptChecklist"),
  scenarioCustomMetrics: document.getElementById("scenarioCustomMetrics"),
  scenarioDirection: document.getElementById("scenarioDirection"),
  scenarioManagerIds: document.getElementById("scenarioManagerIds"),
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
  statusText: document.getElementById("statusText"),
  analysisDetail: document.getElementById("analysisDetail"),
  analysisState: document.getElementById("analysisState"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
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

  if (el.managerIdsLabel) {
    el.managerIdsLabel.textContent = selectedItemsLabel(selectedManagerIds(), "Все менеджеры", managerMap);
  }
  if (el.directionsLabel) {
    el.directionsLabel.textContent = selectedItemsLabel(selectedDirections(), "Все направления", directionMap);
  }
}

function closeFilterDropdowns(except = null) {
  [el.managerIdsDropdown, el.directionsDropdown].forEach((dropdown) => {
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
  params.set("onlyRecorded", String(current.onlyRecorded));
  return params.toString();
}

function formatDuration(seconds) {
  const safe = Number(seconds || 0);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("ru-RU") : "—";
}

function formatDay(value) {
  return value ? new Date(value).toLocaleDateString("ru-RU") : "—";
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

function autoTranscriptionMode() {
  return document.querySelector('input[name="autoTranscriptionMode"]:checked')?.value || "disabled";
}

function localizeFreeText(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "—";

  const map = {
    sale: "Продажа",
    success: "Успех",
    follow_up: "Нужен повторный контакт",
    "follow-up": "Нужен повторный контакт",
    callback: "Перезвон",
    consultation: "Консультация",
    no_answer: "Не удалось связаться",
    objection: "Есть возражения",
    price_objection: "Возражение по цене",
    interested: "Заинтересован",
    not_interested: "Не заинтересован",
    qualified_lead: "Квалифицированный лид",
    unqualified_lead: "Неквалифицированный лид",
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
      managerIds: el.scenarioManagerIds.value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item)),
      subjectKeywords: el.scenarioKeywords.value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
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
}

function analysisStatus(call) {
  if (!call.hasRecording) return { label: "Нет записи", className: "status-missing" };

  switch (call.analysis?.state) {
    case "processing":
      return { label: "В работе", className: "status-processing" };
    case "ready":
      return { label: "Готово", className: "status-ready" };
    case "partial":
      return { label: "Частично", className: "status-partial" };
    case "technical":
      return { label: "Тех. результат", className: "status-partial" };
    case "outdated":
      return { label: "Нужен повтор", className: "status-warning" };
    case "error":
      return { label: "Ошибка", className: "status-error" };
    default:
      return { label: "Ожидает анализа", className: "status-pending" };
  }
}

function hydrateSelectedAnalysis() {
  if (!state.selectedAnalysis?.activityId) return;
  const actual = state.calls.find((call) => String(call.id) === String(state.selectedAnalysis.activityId))?.analysis;
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

function renderPagination() {
  const totalPages = Math.max(1, Math.ceil(state.calls.length / PAGE_SIZE));
  if (state.page > totalPages) state.page = totalPages;
  if (el.pageInfo) el.pageInfo.textContent = `Страница ${state.page} из ${totalPages}`;
  if (el.prevPage) el.prevPage.disabled = state.page <= 1;
  if (el.nextPage) el.nextPage.disabled = state.page >= totalPages;
}
function renderCalls() {
  hydrateSelectedAnalysis();
  el.callsCount.textContent = String(state.calls.length);
  el.callsTable.innerHTML = pagedCalls()
    .map((call) => {
      const status = analysisStatus(call);
      const scenarioName = call.analysis?.selectedScenarioName || "—";
      const totalTokens = call.analysis?.tokenUsage?.totalTokens ?? "—";
      return `
        <tr class="${state.selectedAnalysis?.activityId === call.id ? "is-selected" : ""}">
          <td><div class="call-subject">${escapeHtml(call.subject)}</div><div class="call-meta">${formatDate(call.startTime)}</div></td>
          <td><div>${escapeHtml(call.managerName || "—")}</div><div class="call-meta">${escapeHtml(call.managerPosition || "Без должности")}</div></td>
          <td>${localizeDirection(call.direction)}</td>
          <td>${formatDuration(call.durationSeconds)}</td>
          <td><span class="status-pill ${status.className}">${status.label}</span></td>
          <td>${escapeHtml(scenarioName)}</td>
          <td class="token-cell">${escapeHtml(totalTokens)}</td>
          <td><div class="action-stack">${call.analysis ? `<button class="call-action" data-action="show" data-id="${call.id}">Показать</button>` : ""}<button class="call-action primary-action" data-action="analyze" data-id="${call.id}" ${!call.hasRecording ? "disabled" : ""}>${call.hasRecording ? "Анализировать" : "Нет записи"}</button></div></td>
        </tr>`;
    })
    .join("");
  renderPagination();
}

function renderAnalysis(analysis) {
  if (!analysis) {
    el.analysisState.textContent = "Не выбран";
    el.analysisState.className = "badge neutral";
    el.analysisDetail.className = "analysis-detail empty";
    el.analysisDetail.textContent = "Выберите звонок со статусом «Готово» или нажмите «Анализировать», чтобы здесь появились резюме, рекомендации и проверка по сценарию.";
    return;
  }

  if (analysis.state === "processing") {
    el.analysisState.textContent = "В работе";
    el.analysisState.className = "badge warning";
    el.analysisDetail.className = "analysis-detail";
    el.analysisDetail.innerHTML = `<section class="detail-block"><h3>${escapeHtml(analysis.subject || "Звонок")}</h3><p>Анализ выполняется. После завершения статус и детализация обновятся автоматически.</p></section>`;
    return;
  }

  if (analysis.state === "error") {
    el.analysisState.textContent = "Ошибка";
    el.analysisState.className = "badge warning";
    el.analysisDetail.className = "analysis-detail";
    el.analysisDetail.innerHTML = `<section class="detail-block"><h3>${escapeHtml(analysis.subject || "Звонок")}</h3><p>${escapeHtml(analysis.errorMessage || "Ошибка анализа")}</p></section>`;
    return;
  }

  const hasDetailedResult =
    analysis.summary ||
    analysis.overview ||
    (analysis.recommendations && analysis.recommendations.length) ||
    (analysis.scriptAnalysis?.checkpoints && analysis.scriptAnalysis.checkpoints.length) ||
    (analysis.customMetrics && analysis.customMetrics.length);

  el.analysisState.textContent = hasDetailedResult ? "Готово" : "Неполный результат";
  el.analysisState.className = `badge ${hasDetailedResult ? "success" : "warning"}`;
  el.analysisDetail.className = "analysis-detail";
  const resultExplanation = analysis.summary
    ? analysis.summary
    : analysis.transcriptText
      ? "Полный AI-разбор пока не сформирован: сохранилась транскрибация, но резюме и оценка сценария не были получены. Обычно помогает повторный анализ звонка."
      : "Результат анализа пока не заполнен. Попробуйте повторно запустить анализ звонка.";

  el.analysisDetail.innerHTML = `
    <section class="detail-block">
      <h3>${escapeHtml(analysis.subject || "Звонок")}</h3>
      <div class="muted">${escapeHtml(analysis.managerName || "—")} • ${localizeDirection(analysis.direction)} • ${formatDuration(analysis.durationSeconds)}</div>
      <p>${escapeHtml(resultExplanation)}</p>
      <p class="muted">Сценарий: ${escapeHtml(analysis.selectedScenarioName || "Автоподбор / ручной ввод")}</p>
      <p class="muted">Токены: ${escapeHtml(analysis.tokenUsage?.totalTokens ?? "—")} (транскрибация ${escapeHtml(analysis.tokenUsage?.transcriptionTokens ?? "—")}, анализ ${escapeHtml(analysis.tokenUsage?.analysisTotalTokens ?? "—")})</p>
    </section>
    <section class="detail-block">
      <h3>Общий срез</h3>
      <div class="pill-row">
        <span class="pill">Сентимент: ${escapeHtml(localizeSentiment(analysis.overview?.sentiment))}</span>
        <span class="pill">Риск: ${escapeHtml(localizeRisk(analysis.overview?.riskLevel))}</span>
        <span class="pill">Score: ${escapeHtml(analysis.scriptAnalysis?.overallScore ?? "—")}</span>
        <span class="pill">Соблюдение скрипта: ${escapeHtml(analysis.scriptAnalysis?.compliancePercent ?? "—")}%</span>
      </div>
      <p class="muted">Исход: ${escapeHtml(localizeFreeText(analysis.overview?.callOutcome))}</p>
      <p class="muted">Потребность клиента: ${escapeHtml(localizeFreeText(analysis.overview?.clientNeed))}</p>
    </section>
    <section class="detail-block">
      <h3>Рекомендации</h3>
      <ul class="flat">${(analysis.recommendations || []).map((item) => `<li>${escapeHtml(localizeFreeText(item))}</li>`).join("") || "<li>Рекомендации отсутствуют</li>"}</ul>
    </section>
    <section class="detail-block">
      <h3>Проверка сценария</h3>
      <ul class="flat">${(analysis.scriptAnalysis?.checkpoints || []).map((item) => `<li><strong>${escapeHtml(localizeFreeText(item.name))}</strong>: ${escapeHtml(localizeCheckpointStatus(item.status))} — ${escapeHtml(localizeFreeText(item.comment))}</li>`).join("") || "<li>Пункты сценария ещё не заполнены</li>"}</ul>
    </section>
    <section class="detail-block">
      <h3>Индивидуальные параметры</h3>
      <ul class="flat">${(analysis.customMetrics || []).map((item) => `<li><strong>${escapeHtml(localizeFreeText(item.name))}</strong>: ${escapeHtml(item.score)} (${escapeHtml(localizeCheckpointStatus(item.status))}) — ${escapeHtml(localizeFreeText(item.comment))}</li>`).join("") || "<li>Индивидуальные параметры ещё не заполнены</li>"}</ul>
      <p class="muted">Следующий шаг: ${escapeHtml(localizeFreeText(analysis.nextStep))}</p>
    </section>
    <section class="detail-block">
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
  renderScenarioList();
  if (state.selectedScenarioId) {
    const scenario = state.scenarios.find((item) => item.id === state.selectedScenarioId);
    if (scenario) applyScenarioToForm(scenario);
  }
}

function applySettings(settings) {
  state.settings = {
    autoTranscriptionMode: settings?.autoTranscriptionMode || "disabled",
  };
  const selectedMode = document.querySelector(
    `input[name="autoTranscriptionMode"][value="${state.settings.autoTranscriptionMode}"]`,
  );
  if (selectedMode) selectedMode.checked = true;
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
  if (el.statusText) {
    el.statusText.textContent = "Настройки сохранены.";
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
  renderScenarioList();
  applyScenarioToForm(data.scenario);
}

async function deleteScenario() {
  if (!state.selectedScenarioId) return;
  const data = await api(`/api/scenarios/${state.selectedScenarioId}`, { method: "DELETE" });
  state.scenarios = data.scenarios || [];
  resetScenarioForm();
  renderScenarioList();
}

async function loadCalls() {
  if (el.statusText) el.statusText.textContent = "Загружаю список звонков...";
  const data = await api(`/api/calls?${filtersQuery()}`);
  state.calls = data.calls;
  renderCalls();
  renderAnalysis(state.selectedAnalysis);
  renderDashboard();
  if (el.statusText) el.statusText.textContent = `Найдено звонков: ${data.total}`;
}

async function loadSummary() {
  const data = await api(`/api/reports/summary?${filtersQuery()}`);
  state.summary = data.summary;
  state.analyses = data.analyses;
  renderSummary();
  renderDashboard();
}

function selectAnalysisByCallId(activityId) {
  const call = state.calls.find((item) => String(item.id) === String(activityId));
  if (!call?.analysis) {
    renderAnalysis(null);
    return;
  }
  state.selectedAnalysis = call.analysis;
  renderCalls();
  renderAnalysis(call.analysis);
}

async function analyzeOne(activityId) {
  const call = state.calls.find((item) => String(item.id) === String(activityId));
  if (call) {
    call.analysis = {
      ...(call.analysis || {}),
      activityId: call.id,
      subject: call.subject,
      managerName: call.managerName,
      direction: call.direction,
      durationSeconds: call.durationSeconds,
      selectedScenarioName: call.analysis?.selectedScenarioName || "Автосценарий",
      state: "processing",
    };
    state.selectedAnalysis = call.analysis;
    renderCalls();
    renderAnalysis(call.analysis);
  }

  const result = await api("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activityId,
      scenarioId: null,
      scriptChecklist: "",
      customMetrics: parsedCustomMetrics(),
    }),
  });

  state.selectedAnalysis = result.analysis;
  await Promise.all([loadCalls(), loadSummary()]);
  selectAnalysisByCallId(activityId);
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

  refreshFilterLabels();
  closeFilterDropdowns();
  scheduleFiltersReload();
}

document.addEventListener("click", async (event) => {
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

  const showButton = event.target.closest("[data-action='show']");
  if (showButton) {
    selectAnalysisByCallId(showButton.getAttribute("data-id"));
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
      selectAnalysisByCallId(analyzeButton.getAttribute("data-id"));
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
  if (event.target.matches('input[data-filter-option="manager"], input[data-filter-option="direction"]')) {
    scheduleFiltersReload();
  }
});

[el.managerIdsDropdown, el.directionsDropdown].forEach((dropdown) => {
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

if (el.nextPage) {
  el.nextPage.addEventListener("click", () => {
    const totalPages = Math.max(1, Math.ceil(state.calls.length / PAGE_SIZE));
    if (state.page >= totalPages) return;
    state.page += 1;
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
