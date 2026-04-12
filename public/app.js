const PAGE_SIZE = 10;

const state = {
  calls: [],
  summary: null,
  analyses: [],
  scenarios: [],
  selectedAnalysis: null,
  selectedScenarioId: "",
  currentView: "report",
  page: 1,
};

const el = {
  reportView: document.getElementById("reportView"),
  scenariosView: document.getElementById("scenariosView"),
  showReportView: document.getElementById("showReportView"),
  showScenariosView: document.getElementById("showScenariosView"),
  managerId: document.getElementById("managerId"),
  dateFrom: document.getElementById("dateFrom"),
  dateTo: document.getElementById("dateTo"),
  direction: document.getElementById("direction"),
  onlyRecorded: document.getElementById("onlyRecorded"),
  refreshCalls: document.getElementById("refreshCalls"),
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
  callsTable: document.getElementById("callsTable"),
  callsCount: document.getElementById("callsCount"),
  statusText: document.getElementById("statusText"),
  analysisDetail: document.getElementById("analysisDetail"),
  analysisState: document.getElementById("analysisState"),
  prevPage: document.getElementById("prevPage"),
  nextPage: document.getElementById("nextPage"),
  pageInfo: document.getElementById("pageInfo"),
};

function filters() {
  return {
    managerId: el.managerId.value,
    dateFrom: el.dateFrom.value,
    dateTo: el.dateTo.value,
    direction: el.direction.value,
    onlyRecorded: String(el.onlyRecorded.checked),
  };
}

function formatDuration(seconds) {
  const safe = Number(seconds || 0);
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString("ru-RU") : "—";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item)),
      subjectKeywords: el.scenarioKeywords.value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      minDurationSeconds: el.scenarioMinDuration.value ? Number(el.scenarioMinDuration.value) : null,
      maxDurationSeconds: el.scenarioMaxDuration.value ? Number(el.scenarioMaxDuration.value) : null,
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
  el.reportView.classList.toggle("active", view === "report");
  el.scenariosView.classList.toggle("active", view === "scenarios");
  el.showReportView.classList.toggle("primary-action", view === "report");
  el.showScenariosView.classList.toggle("primary-action", view === "scenarios");
}

function analysisStatus(call) {
  if (!call.hasRecording) return { label: "Нет записи", className: "status-missing" };

  switch (call.analysis?.state) {
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

function renderSummary() {
  const summary = state.summary;
  if (!summary) {
    el.summaryCards.innerHTML = "";
    return;
  }
  el.summaryCards.innerHTML = [
    summaryCard("Проанализировано звонков", summary.analyzedCalls, "Все сохранённые AI-разборы"),
    summaryCard("Средний score", summary.averageScore || "0", "Оценка соблюдения сценария"),
    summaryCard("Высокий риск", summary.highRisk, "Требует ручного разбора"),
    summaryCard("Позитив / нейтрал / негатив", `${summary.positive} / ${summary.neutral} / ${summary.negative}`, "Сентимент разговора"),
  ].join("");
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
      return `
        <tr class="${state.selectedAnalysis?.activityId === call.id ? "is-selected" : ""}">
          <td><div class="call-subject">${escapeHtml(call.subject)}</div><div class="call-meta">${formatDate(call.startTime)}</div></td>
          <td><div>${escapeHtml(call.managerName || "—")}</div><div class="call-meta">${escapeHtml(call.managerPosition || "Без должности")}</div></td>
          <td>${call.direction === "incoming" ? "Входящий" : "Исходящий"}</td>
          <td>${formatDuration(call.durationSeconds)}</td>
          <td><span class="status-pill ${status.className}">${status.clabel}</span></td>
          <td>${escapeHtml(scenarioName)}</td>
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
    el.analysisDetail.textContent = "Выберите звонок со статусом «Готово» hли нажмите «Анализировать», чтобы здесь появились резюме, рекомендации и проверка по сценарию.";
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

  el.analysisDetail.innerHTML = `
    <section class="detail-block">
      <h3>${escapeHtml(analysis.subject || "Звонок")}</h3>
      <div class="muted">${escapeHtml(analysis.managerName || "—")} • ${analysis.direction === "incoming" ? "Входящий" : "Исходящий"} • ${formatDuration(analysis.durationSeconds)}</div>
      <p>${escapeHtml(analysis.summary || "Резюме пока отсутствует. Обычно это означает, что звонок сохранился с техническим результатом без полного AI-разбора.")}</p>
      <p class="muted">Сценарий: ${escapeHtml(analysis.selectedScenarioName || "Автоподбор / ручной ввод")}</p>
      <p class="muted">Токены: ${escapeHtml(analysis.tokenUsage?.totalTokens ?? "—")} (транскрибация ${escapeHtml(analysis.tokenUsage?.transcriptionTokens ?? "—")}, анализ ${escapeHtml(analysis.tokenUsage?.analysisTotalTokens ?? "—")})</p>
    </section>
    <section class="detail-block">
      <h3>Общий срез</h3>
      <div class="pill-row">
        <span class="pill">Сентимент: ${escapeHtml(analysis.overview?.sentiment || "—")}</span>
        <span class="pill">Риск: ${escapeHtml(analysis.overview?.riskLevel || "—")}</span>
        <span class="pill">Score: ${escapeHtml(analysis.scriptAnalysis?.overallScore ?? "—")}</span>
        <span class="pill">Соблюдение скрипта: ${escapeHtml(analysis.scriptAnalysis?.compliancePercent ?? "—")}%</span>
      </div>
      <p class="muted">Исход: ${escapeHtml(analysis.overview?.callOutcome || "—")}</p>
      <p class="muted">Потребность клиента: ${escapeHtml(analysis.overview?.clientNeed || "—")}</p>
    </section>
    <section class="detail-block">
      <h3>Рекомендации</h3>
      <ul class="flat">${(analysis.recommendations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("") || "<li>Рекомендации отсутствуют</li>"}</ul>
    </section>
    <section class="detail-block">
      <h3>Проверка сценария</h3>
      <ul class="flat">${(analysis.scriptAnalysis?.checkpoints || []).map((item) => `<li><strong>${escapeHtml(item.name)}</strong>: ${escapeHtml(item.status)} — ${escapeHtml(item.comment)}</li>`).join("") || "<li>Пункты сценария ещё не заполнены</li>"}</ul>
    </section>
    <section class="detail-block">
      <h3>Индивидуальные параметры</h3>
      <ul class="flat">${(analysis.customMetrics || []).map((item) => `<li><strong>${escapeHtml(item.name)}</strong>: ${escapeHtml(item.score)} (${escapeHtml(item.status)}) — ${escapeHtml(item.comment)}</li>`).join("") || "<li>Индивидуальные параметры ещё не заполнены</li>"}</ul>
      <p class="muted">Следующий шаг: ${escapeHtml(analysis.nextStep || "—")}</p>
    </section>
    <section class="detail-block">
      <h3>Транскрипт</h3>
      <p class="transcript-text">${escapeHtml(analysis.transcriptText || "Транскрипт отсутствует")}</p>
    </section>`;
}

async function api(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    if (text.trim().startsWith("<")) {
      throw new Error("Сервер вернул HTML вместо JSON. Обычно это означает, что приложение перезапускается или ответ пришёл не от API.");
    }
    throw new Error(`Сервер вернул некорректный ответ: ${text.slice(0, 200)}`);
  }
  if (!response.ok || payload.success === false) throw new Error(payload?.error?.message || "Request failed");
  return payload.data;
}

async function loadManagers() {
  const managers = await api("/api/managers");
  el.managerId.innerHTML = '<option value="">Все менеджеры</option>' + managers.map((manager) => `<option value="${manager.id}">${escapeHtml(manager.fullName)}</option>`).join("");
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
  const data = await api(`/api/calls?${new URLSearchParams(filters()).toString()}`);
  state.calls = data.calls;
  renderCalls();
  renderAnalysis(state.selectedAnalysis);
  if (el.statusText) el.statusText.textContent = `Найдено звонков: ${data.total}`;
}

async function loadSummary() {
  const data = await api(`/api/reports/summary?${new URLSearchParams(filters()).toString()}`);
  state.summary = data.summary;
  state.analyses = data.analyses;
  renderSummary();
}
