// COCPrep — Practice screen behavior

const FREE_LIMIT = 20;

const el = {
  questionCard: document.getElementById("questionCard"),
  loadingCard: document.getElementById("loadingCard"),
  paywallCard: document.getElementById("paywallCard"),
  emptyCard: document.getElementById("emptyCard"),
  errorCard: document.getElementById("errorCard"),

  questionUnit: document.getElementById("questionUnit"),
  questionCondition: document.getElementById("questionCondition"),
  questionText: document.getElementById("questionText"),
  choicesList: document.getElementById("choicesList"),
  submitAnswerBtn: document.getElementById("submitAnswerBtn"),
  feedback: document.getElementById("feedback"),
  feedbackBadge: document.getElementById("feedbackBadge"),
  feedbackExplanation: document.getElementById("feedbackExplanation"),
  nextQuestionBtn: document.getElementById("nextQuestionBtn"),

  progressCount: document.getElementById("progressCount"),
  tickStrip: document.getElementById("tickStrip"),
  filterBlock: document.getElementById("filterBlock"),
  filterUnit: document.getElementById("filterUnit"),
  filterCondition: document.getElementById("filterCondition"),
  filterMostTested: document.getElementById("filterMostTested"),
  applyFiltersBtn: document.getElementById("applyFiltersBtn"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),

  errorBody: document.getElementById("errorBody"),
  retryBtn: document.getElementById("retryBtn"),
  upgradeBtn: document.getElementById("upgradeBtn"),
  paywallNote: document.getElementById("paywallNote"),
};

let currentQuestion = null;
let selectedChoiceKey = null;
let activeFilters = {};
let questionsAnsweredCount = 0;
let tickHistory = []; // 'correct' | 'wrong' for answered ticks, drawn left to right

function showState(name) {
  ["questionCard", "loadingCard", "paywallCard", "emptyCard", "errorCard"].forEach((key) => {
    el[key].hidden = key !== name;
  });
}

function renderTickStrip() {
  const total = Math.max(FREE_LIMIT, questionsAnsweredCount);
  el.tickStrip.innerHTML = "";
  for (let i = 0; i < FREE_LIMIT; i++) {
    const tick = document.createElement("div");
    tick.className = "tick";
    const state = tickHistory[i];
    if (state === "correct") tick.classList.add("is-correct");
    else if (state === "wrong") tick.classList.add("is-wrong");
    else if (i < questionsAnsweredCount) tick.classList.add("is-answered");
    el.tickStrip.appendChild(tick);
  }
  el.progressCount.textContent = `${questionsAnsweredCount} / ${FREE_LIMIT} free`;
}

function letterFor(index) {
  return String.fromCharCode(65 + index); // A, B, C, D...
}

function renderQuestion(q) {
  currentQuestion = q;
  selectedChoiceKey = null;

  el.questionUnit.textContent = q.unit || "General";
  el.questionCondition.textContent = q.condition || "—";
  el.questionText.textContent = q.question_text;

  el.choicesList.innerHTML = "";
  const choices = Array.isArray(q.choices) ? q.choices : Object.entries(q.choices || {});

  choices.forEach((choiceRaw, index) => {
    // Support both ["text1","text2"] and {A:"text1", B:"text2"} shapes
    const key = Array.isArray(q.choices) ? letterFor(index) : choiceRaw[0];
    const text = Array.isArray(q.choices) ? choiceRaw : choiceRaw[1];

    const div = document.createElement("div");
    div.className = "choice";
    div.dataset.key = key;
    div.innerHTML = `
      <span class="choice-letter">${key}</span>
      <span class="choice-text"></span>
    `;
    div.querySelector(".choice-text").textContent = text;
    div.addEventListener("click", () => selectChoice(key));
    el.choicesList.appendChild(div);
  });

  el.feedback.hidden = true;
  el.submitAnswerBtn.hidden = false;
  el.submitAnswerBtn.disabled = true;
  el.submitAnswerBtn.textContent = "Submit answer";
  showState("questionCard");
}

function selectChoice(key) {
  if (el.feedback.hidden === false) return; // already answered, locked
  selectedChoiceKey = key;
  el.choicesList.querySelectorAll(".choice").forEach((c) => {
    c.classList.toggle("is-selected", c.dataset.key === key);
  });
  el.submitAnswerBtn.disabled = false;
}

async function loadNextQuestion() {
  showState("loadingCard");
  try {
    const result = await apiGetNextQuestion(activeFilters);

    if (result.blocked) {
      questionsAnsweredCount = result.questions_answered ?? questionsAnsweredCount;
      renderTickStrip();
      el.paywallNote.textContent =
        result.reason === "free_pool_exhausted"
          ? "Looks like the free question set ran out early — full access unlocks the rest."
          : "";
      showState("paywallCard");
      return;
    }

    if (!result.question) {
      document.getElementById("emptyTitle").textContent = "No questions match this filter";
      document.getElementById("emptyBody").textContent =
        result.message || "Try widening your filter, or clear it to see everything.";
      showState("emptyCard");
      return;
    }

    questionsAnsweredCount = result.questions_answered ?? questionsAnsweredCount;
    renderTickStrip();
    renderQuestion(result.question);
  } catch (err) {
    el.errorBody.textContent = err.message || "Couldn't reach the server.";
    showState("errorCard");
  }
}

el.submitAnswerBtn.addEventListener("click", async () => {
  if (!selectedChoiceKey || !currentQuestion) return;
  el.submitAnswerBtn.disabled = true;
  el.submitAnswerBtn.textContent = "Checking…";

  try {
    const result = await apiSubmitAnswer({
      questionId: currentQuestion.id,
      selectedChoice: selectedChoiceKey,
    });

    const isCorrect = !!result.correct;
    questionsAnsweredCount += 1;
    tickHistory[questionsAnsweredCount - 1] = isCorrect ? "correct" : "wrong";
    renderTickStrip();

    // Mark chosen + correct answer on the choice list
    el.choicesList.querySelectorAll(".choice").forEach((c) => {
      const key = c.dataset.key;
      if (result.correct_answer && key === result.correct_answer) {
        c.classList.add("is-correct-reveal");
      } else if (key === selectedChoiceKey && !isCorrect) {
        c.classList.add("is-wrong-reveal");
      }
    });

    el.feedbackBadge.textContent = isCorrect ? "Correct" : "Not quite";
    el.feedbackBadge.className = "feedback-badge " + (isCorrect ? "is-correct" : "is-wrong");
    el.feedbackExplanation.textContent = result.explanation || "";
    el.submitAnswerBtn.hidden = true;
    el.feedback.hidden = false;
  } catch (err) {
    el.submitAnswerBtn.disabled = false;
    el.submitAnswerBtn.textContent = "Submit answer";
    el.errorBody.textContent = err.message || "Couldn't submit your answer.";
    showState("errorCard");
  }
});

el.nextQuestionBtn.addEventListener("click", loadNextQuestion);
el.retryBtn.addEventListener("click", loadNextQuestion);

el.upgradeBtn.addEventListener("click", () => {
  if (typeof UPGRADE_URL === "string" && UPGRADE_URL) {
    window.location.href = UPGRADE_URL;
  } else {
    alert("Checkout isn't wired up yet — add your payment link in js/config.js (UPGRADE_URL).");
  }
});

el.applyFiltersBtn.addEventListener("click", () => {
  activeFilters = {
    unit: el.filterUnit.value || undefined,
    condition: el.filterCondition.value || undefined,
    most_tested: el.filterMostTested.checked || undefined,
  };
  loadNextQuestion();
});

el.clearFiltersBtn.addEventListener("click", () => {
  activeFilters = {};
  el.filterUnit.value = "";
  el.filterCondition.value = "";
  el.filterMostTested.checked = false;
  loadNextQuestion();
});

/**
 * Populates the unit/condition filter dropdowns and shows the filter
 * block. Called once we know the user has full access (paid) — the
 * backend only honors these filters for paid users anyway.
 */
async function initFiltersFromQuestions() {
  try {
    const { data, error } = await supabaseClient
      .from("questions")
      .select("unit, condition")
      .limit(500);
    if (error || !data) return;

    const units = [...new Set(data.map((r) => r.unit).filter(Boolean))].sort();
    const conditions = [...new Set(data.map((r) => r.condition).filter(Boolean))].sort();

    units.forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u; opt.textContent = u;
      el.filterUnit.appendChild(opt);
    });
    conditions.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c; opt.textContent = c;
      el.filterCondition.appendChild(opt);
    });

    el.filterBlock.hidden = false;
  } catch {
    // Filters are a nice-to-have; fail silently if the questions table
    // isn't directly readable for this user (RLS may restrict it).
  }
}

function resetPracticeState() {
  questionsAnsweredCount = 0;
  tickHistory = [];
  activeFilters = {};
  currentQuestion = null;
}
