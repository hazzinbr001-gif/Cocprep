const resultsEl = {
  historyList: document.getElementById("historyList"),
  historyEmpty: document.getElementById("historyEmpty"),
};
let allAttempts = [], historyFilter = "all", studentProgress = null;

function formatRelativeTime(value) {
  const mins = Math.round((Date.now() - new Date(value)) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return new Date(value).toLocaleDateString();
}
function sectionOf(attempt) { return attempt.section || attempt.questions?.section || "mcq"; }
function stats(list) {
  const correct = list.filter((x) => x.correct).length;
  return { answered: list.length, correct, incorrect: list.length - correct, accuracy: list.length ? `${Math.round(correct / list.length * 100)}%` : "—" };
}
function buildProgressCards() {
  const grid = document.querySelector(".results-stat-grid");
  if (!grid) return;
  grid.querySelectorAll(".progress-section-stat").forEach((node) => node.remove());
  grid.insertAdjacentHTML("beforeend", ["mcq", "truefalse"].map((section) => {
    const label = section === "mcq" ? "SECTION A · MULTIPLE CHOICE" : "SECTION B · TRUE / FALSE";
    const filtered = allAttempts.filter((x) => sectionOf(x) === section);
    const source = section === "mcq"
      ? { answered: Number(studentProgress?.section_a_answered ?? filtered.length), correct: Number(studentProgress?.section_a_correct ?? filtered.filter((x) => x.correct).length) }
      : { answered: Number(studentProgress?.section_b_answered ?? filtered.length), correct: Number(studentProgress?.section_b_correct ?? filtered.filter((x) => x.correct).length) };
    const s = { ...source, incorrect: source.answered - source.correct, accuracy: source.answered ? Math.round(source.correct / source.answered * 100) + "%" : "—" };
    return `<div class="result-stat progress-section-stat"><span class="section-tag">${label}</span><strong>${s.answered}</strong><span>Answered</span><strong>${s.correct}</strong><span>Correct</span><strong>${s.incorrect}</strong><span>Incorrect</span><strong>${s.accuracy}</strong><span>Accuracy</span><strong>${s.correct}/${s.answered}</strong><span>Score</span></div>`;
  }).join(""));
}
function buildOverallStats() {
  const summary = studentProgress ? { answered: Number(studentProgress.section_a_answered || 0) + Number(studentProgress.section_b_answered || 0), correct: Number(studentProgress.section_a_correct || 0) + Number(studentProgress.section_b_correct || 0) } : stats(allAttempts);
  summary.incorrect = summary.answered - summary.correct;
  summary.accuracy = summary.answered ? Math.round(summary.correct / summary.answered * 100) + "%" : "—";
  document.getElementById("statAnswered").textContent = summary.answered;
  document.getElementById("statCorrect").textContent = summary.correct;
  const score = document.getElementById("statScore");
  if (score) score.textContent = `${summary.correct}/${summary.answered}`;
  document.getElementById("statAccuracy").textContent = summary.accuracy;
}
function reviewAttempt(attempt) {
  const q = attempt.questions;
  const modal = document.createElement("div");
  modal.className = "review-modal";
  modal.innerHTML = `<section class="card review-card"><button class="back-button review-close">← Back to history</button><span class="section-tag">${sectionOf(attempt) === "truefalse" ? "SECTION B · TRUE / FALSE" : "SECTION A · MCQ"}</span><h2></h2><p class="review-result"></p><div class="review-answers"></div><div class="feedback"><div class="feedback-title"><span>Explanation</span></div><p></p></div></section>`;
  modal.querySelector("h2").textContent = q?.question_text || "This question is no longer available.";
  modal.querySelector(".review-result").textContent = q ? (attempt.correct ? "Correct ✓" : "Incorrect") : "This question is no longer available.";
  if (q) {
    const choices = q.choices || q.statements || {};
    const list = Array.isArray(choices) ? choices.map((c, i) => [c.key || String.fromCharCode(65 + i), c.text || c.statement || c]) : Object.entries(choices);
    modal.querySelector(".review-answers").innerHTML = list.map(([key, text]) => `<div class="review-answer"><b>${key}</b><span></span></div>`).join("");
    list.forEach(([key, text], i) => { modal.querySelectorAll(".review-answer span")[i].textContent = text; });
    modal.querySelector(".feedback p").textContent = q.explanation || "No explanation was provided for this question.";
  } else modal.querySelector(".feedback").hidden = true;
  modal.querySelector(".review-close").onclick = () => modal.remove();
  document.body.appendChild(modal);
}
function renderHistory() {
  const list = allAttempts.filter((a) => historyFilter === "all" || sectionOf(a) === historyFilter);
  resultsEl.historyList.innerHTML = list.map((a) => {
    const section = sectionOf(a);
    const topic = a.questions?.topic || a.questions?.condition || "General";
    const label = section === "truefalse" ? "SECTION B" : "SECTION A";
    return `<button class="history-item history-item-button" type="button"><span class="history-dot ${a.correct ? "is-correct" : ""}"></span><span class="history-text"><b>${label} · ${topic}</b><small>${a.correct ? "Correct" : "Incorrect"}</small></span><span class="history-time">${formatRelativeTime(a.answered_at)}</span></button>`;
  }).join("");
  [...resultsEl.historyList.children].forEach((node, i) => node.onclick = () => reviewAttempt(list[i]));
  resultsEl.historyEmpty.hidden = list.length > 0;
}
async function loadResults() {\n  const [attemptResult, progressResult] = await Promise.allSettled([apiGetAttemptHistory(), apiGetStudentProgress()]);\n  allAttempts = attemptResult.status === "fulfilled" ? attemptResult.value : [];\n  studentProgress = progressResult.status === "fulfilled" ? progressResult.value : null;\n  buildOverallStats();\n  buildProgressCards();\n  const heading = document.querySelector(".history-panel .section-heading");\n  if (heading && !heading.querySelector(".history-filters")) {\n    const filters = document.createElement("div"); filters.className = "history-filters";\n    filters.innerHTML = '<button class="btn btn-secondary btn-sm is-active" data-history-filter="all">All</button><button class="btn btn-secondary btn-sm" data-history-filter="mcq">Section A</button><button class="btn btn-secondary btn-sm" data-history-filter="truefalse">Section B</button>';\n    heading.appendChild(filters);\n    filters.querySelectorAll("[data-history-filter]").forEach((button) => button.onclick = () => { historyFilter = button.dataset.historyFilter; filters.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b === button)); renderHistory(); });\n  }\n  renderHistory();\n}\ndocument.querySelectorAll("[data-history-filter]").forEach((button) => button.onclick = () => {
  historyFilter = button.dataset.historyFilter;
  document.querySelectorAll("[data-history-filter]").forEach((b) => b.classList.toggle("is-active", b === button));
  renderHistory();
});