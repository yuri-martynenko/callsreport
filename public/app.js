const state = { calls: [], summary: null, analyses: [], selectedAnalysis: null };

const el = {
  managerId: document.getElementById("managerId"),
  dateFrom: document.getElementById("dateFrom"),
  dateTo: document.getElementById("dateTo"),
  direction: document.getElementById("direction"),
  onlyRecorded: document.getElementById("onlyRecorded"),
  refreshCalls: document.getElementById("refreshCalls"),
  refreshSummary: document.getElementById("refreshSummary"),
  analyzeBatch: document.getElementById("analyzeBatch"),
  scriptChecklist: document.getElementById("scriptChecklist"),
  customMetrics: document.getElementById("customMetrics"),
  summaryCards: document.getElementById("summaryCards"),
  callsTable: document.getElementById("callsTable"),
  callsCount: document.getElementById("callsCount"),
  statusText: document.getElementById("statusText"),
  analysisDetail: document.getElementById("analysisDetail"),
  analysisState: document.getElementById("analysisState"),
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

function summaryCard(title, value, hint) {
  return `<article class="summary-card"><div class="muted">${title}</div><div class="value">${value}</div><div class="hint">${hint}</div></article>`;
}

function renderSummary() {
  const summary = state.summary;
  if (!summary) return (el.summaryCards.innerHTML = "");
  el.summaryCards.innerHTML = [
    summaryCard("Проанализировано звонков", summary.analyzedCalls, "Все сохранённые AI-разборы"),
    summaryCard("Средний score", summary.averageScore || "0", "Оценка соблюдения сценария"),
    summaryCard("Высокий риск", summary.highRisk, "Требует ручного разбора"),
    summaryCard("Позитив / нейтрал / негатив", `${summary.positive} / ${summary.neutral} / ${summary.negative}`, "Сентимент разговора"),
  ].join("");
}

function renderCalls() {
  el.callsCount.textContent = String(state.calls.length);
  el.callsTable.innerHTML = state.calls
    .map(
      (call) => `
        <tr>
          <td><div class="call-subject">${call.subject}</div><div class="call-meta">${formatDate(call.startTime)}</div></td>
          <td><div>${call.managerName}</div><div class="call-meta">${call.managerPosition || "Без должности"}</div></td>
          <td>${call.direction === "incoming" ? "Входящий" : "Исходящий"}</td>
          <td>${formatDuration(call.durationSeconds)}</td>
          <td>${
            call.analysis
              ? `<div>Score: ${call.analysis.score ?? "—"}</div><div class="call-meta">${call.analysis.summary || ""}</div>`
              : '<span class="muted">Нет актуального анализа</span>'
          }</td>
          <td><button class="call-action" data-action="analyze" data-id="${call.id}" ${!call.hasRecording ? "disabled" : ""}>${call.hasRecording ? "Анализировать" : "Нет записи"}</button></td>
        </tr>`,
    )
    .join("");
}

function renderAnalysis(analysis) {
  if (!analysis) {
    el.analysisState.textContent = "Не выбран";
    el.analysisDetail.className = "analysis-detail empty";
    el.analysisDetail.textContent = "Выберите звонок и запустите анализ, чтобы увидеть резюме, рекомендации и оценку по скрипту.";
    return;
  }

  el.analysisState.textContent = "Готово";
  el.analysisDetail.className = "analysis-detail";
  el.analysisDetail.innerHTML = `
    <section class="detail-block">
      <h3>${analysis.subject}</h3>
      <div class="muted">${analysis.managerName} • ${analysis.direction === "incoming" ? "Входящий" : "Исходящий"} • ${formatDuration(analysis.durationSeconds)}</div>
      <p>${analysis.summary || "Резюме отсутствует"}</p>
    </section>
    <section class="detail-block">
      <h3>Общий срез</h3>
      <div class="pill-row">
        <span class="pill">Сентимент: ${analysis.overview?.sentiment || "—"}</span>
        <span class="pill">Риск: ${analysis.overview?.riskLevel || "—"}</span>
        <span class="pill">Score: ${analysis.scriptAnalysis?.overallScore ?? "—"}</span>
        <span class="pill">Соблюдение скрипта: ${analysis.scriptAnalysis?.compliancePercent ?? "—"}%</span>
      </div>
      <p class="muted">Исход: ${analysis.overview?.callOutcome || "—"}</p>
      <p class="muted">Потребность клиента: ${analysis.overview?.clientNeed || "—"}</p>
    </section>
    <section class="detail-block">
      <h3>Рекомендации</h3>
      <ul class="flat">${(analysis.recommendations || []).map((item) => `<li>${item}</li>`).join("")}</ul>
    </section>
    <section class="detail-block">
      <h3>Проверка сценария</h3>
      <ul class="flat">${(analysis.scriptAnalysis?.checkpoints || []).map((item) => `<li><strong>${item.name}</strong>: ${item.status} — ${item.comment}</li>`).join("")}</ul>
    </section>
    <section class="detail-block">
      <h3>Индивидуальные параметры</h3>
      <ul class="flat">${(analysis.customMetrics || []).map((item) => `<li><strong>${item.name}</strong>: ${item.score} (${item.status}) — ${item.comment}</li>`).join("")}</ul>
      <p class="muted">Следующий шаг: ${analysis.nextStep || "—"}</p>
    </section>`;
}

async function api(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok || payload.success === false) throw new Error(payload?.error?.message || "Request failed");
  return payload.data;
}

async function loadManagers() {
  const managers = await api("/api/managers");
  el.managerId.innerHTML = '<option value="">Все менеджеры</option>' + managers.map((manager) => `<option value="${manager.id}">${manager.fullName}</option>`).join("");
}

async function loadCalls() {
  el.statusText.textContent = "Загружаю список звонков...";
  const data = await api(`/api/calls?${new URLSearchParams(filters()).toString()}`);
  state.calls = data.calls;
  renderCalls();
  el.statusText.textContent = `Найдено звонков: ${data.total}`;
}

async function loadSummary() {
  const data = await api(`/api/reports/summary?${new URLSearchParams(filters()).toString()}`);
  state.summary = data.summary;
  state.analyses = data.analyses;
  renderSummary();
}

function parsedCustomMetrics() {
  const raw = el.customMetrics.value.trim();
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return raw.split("\n").map((item) => item.trim()).filter(Boolean);
  }
}

async function analyzeOne(activityId) {
  el.analysisState.textContent = "В работе";
  const result = await api("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      activityId,
      scriptChecklist: el.scriptChecklist.value,
      customMetrics: parsedCustomMetrics(),
    }),
  });
  state.selectedAnalysis = result.analysis;
  renderAnalysis(result.analysis);
  await Promise.all([loadCalls(), loadSummary()]);
}

async function analyzeBatch() {
  el.statusText.textContent = "Запускаю пакетный AI-анализ...";
  const result = await api("/api/analyze-batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: filters(),
      scriptChecklist: el.scriptChecklist.value,
      customMetrics: parsedCustomMetrics(),
    }),
  });
  el.statusText.textContent = `Пакетный анализ завершён. Обработано: ${result.processed}`;
  await Promise.all([loadCalls(), loadSummary()]);
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action='analyze']");
  if (!button) return;
  button.disabled = true;
  try {
    await analyzeOne(button.getAttribute("data-id"));
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
  }
});

el.refreshCalls.addEventListener("click", async () => {
  try {
    await Promise.all([loadCalls(), loadSummary()]);
  } catch (error) {
    alert(error.message);
  }
});

el.refreshSummary.addEventListener("click", async () => {
  try {
    await loadSummary();
  } catch (error) {
    alert(error.message);
  }
});

el.analyzeBatch.addEventListener("click", async () => {
  try {
    await analyzeBatch();
  } catch (error) {
    alert(error.message);
  }
});

(async function init() {
  try {
    await loadManagers();
    await Promise.all([loadCalls(), loadSummary()]);
  } catch (error) {
    el.statusText.textContent = error.message;
  }
})();
