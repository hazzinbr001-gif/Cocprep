const resultsEl = {
  historyList: document.getElementById("historyList"),
  historyEmpty: document.getElementById("historyEmpty"),
};
let allAttempts = [], historyFilter = "all";

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
  grid.innerHTML = ["mcq", "truefalse"].map((section) => {
    const label = section === "mcq" ? "SECTION A · MULTIPLE CHOICE" : "SECTION B · TRUE / FALSE";
    const s = stats(allAttempts.filter((x) => sectionOf(x) === section));
    return `<div class="result-stat progress-section-stat"><span class="section-tag">${label}</span><strong>${s.answered}</strong><span>Answered</span><strong>${s.correct}</strong><span>Correct</span><strong>${s.incorrect}</strong><span>Incorrect</span><strong>${s.accuracy}</strong><span>Accuracy</span></div>`;
  }).join("");
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
async function loadResults() {
  try {
    allAttempts = await apiGetAttemptHistory();
    buildProgressCards();
    const heading = document.querySelector(".history-panel .section-heading");
    if (heading && !heading.querySelector(".history-filters")) {
      const filters = document.createElement("div");
      filters.className = "history-filters";
      filters.innerHTML = '<button class="btn btn-secondary btn-sm is-active" data-history-filter="all">All</button><button class="btn btn-secondary btn-sm" data-history-filter="mcq">Section A</button><button class="btn btn-secondary btn-sm" data-history-filter="truefalse">Section B</button>';
      heading.appendChild(filters);
      filters.querySelectorAll("[data-history-filter]").forEach((button) => button.onclick = () => {
        historyFilter = button.dataset.historyFilter;
        filters.querySelectorAll("button").forEach((b) => b.classList.toggle("is-active", b === button));
        renderHistory();
      });
    }
    renderHistory();
  } catch (e) {
    resultsEl.historyEmpty.hidden = false;
    resultsEl.historyEmpty.querySelector("strong").textContent = "Couldn't load your results";
    resultsEl.historyEmpty.querySelector("p").textContent = e.message;
  }
}
document.querySelectorAll("[data-history-filter]").forEach((button) => button.onclick = () => {
  historyFilter = button.dataset.historyFilter;
  document.querySelectorAll("[data-history-filter]").forEach((b) => b.classList.toggle("is-active", b === button));
  renderHistory();
});