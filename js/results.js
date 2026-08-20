// COCPrep — Results screen behavior

const resultsEl = {
  statAnswered: document.getElementById("statAnswered"),
  statCorrect: document.getElementById("statCorrect"),
  statAccuracy: document.getElementById("statAccuracy"),
  historyList: document.getElementById("historyList"),
  historyEmpty: document.getElementById("historyEmpty"),
};

function formatRelativeTime(isoString) {
  const date = new Date(isoString);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

async function loadResults() {
  resultsEl.historyList.innerHTML = "";
  resultsEl.historyEmpty.hidden = true;

  try {
    const attempts = await apiGetAttemptHistory();

    const answered = attempts.length;
    const correct = attempts.filter((a) => a.is_correct).length;
    const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;

    resultsEl.statAnswered.textContent = answered;
    resultsEl.statCorrect.textContent = correct;
    resultsEl.statAccuracy.textContent = `${accuracy}%`;

    if (answered === 0) {
      resultsEl.historyEmpty.hidden = false;
      return;
    }

    attempts.forEach((a) => {
      const item = document.createElement("div");
      item.className = "history-item";
      const questionText = a.questions?.question_text || "Question";
      item.innerHTML = `
        <span class="history-dot ${a.is_correct ? "is-correct" : "is-wrong"}"></span>
        <span class="history-text"></span>
        <span class="history-time">${formatRelativeTime(a.created_at)}</span>
      `;
      item.querySelector(".history-text").textContent = questionText;
      resultsEl.historyList.appendChild(item);
    });
  } catch (err) {
    resultsEl.historyEmpty.hidden = false;
    resultsEl.historyEmpty.textContent = "Couldn't load your results: " + err.message;
  }
}
