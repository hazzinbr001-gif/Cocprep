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
  paywallNote: document.getElementById("paywallNote"),
  paywallPending: document.getElementById("paywallPending"),
  paywallPaymentForm: document.getElementById("paywallPaymentForm"),
  mpesaCodeInput: document.getElementById("mpesaCodeInput"),
  submitPaymentBtn: document.getElementById("submitPaymentBtn"),
  paymentStatus: document.getElementById("paymentStatus"),
  refreshEntitlementBtn: document.getElementById("refreshEntitlementBtn"),
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

  // Actual schema shape (from questions.choices jsonb column) is an array
  // of {key, text} objects, e.g. [{"key":"A","text":"..."}, ...].
  // Still tolerate a couple of alternate shapes defensively, in case a
  // future import script or manual edit stores it differently.
  const rawChoices = q.choices || [];
  let normalized = [];

  if (Array.isArray(rawChoices) && rawChoices.length && typeof rawChoices[0] === "object" && rawChoices[0] !== null && "key" in rawChoices[0]) {
    // [{key:"A", text:"..."}]  <- the real shape
    normalized = rawChoices.map((c) => ({ key: c.key, text: c.text }));
  } else if (Array.isArray(rawChoices)) {
    // ["text1","text2"]  <- plain array fallback
    normalized = rawChoices.map((text, index) => ({ key: letterFor(index), text }));
  } else {
    // {A:"text1", B:"text2"}  <- object map fallback
    normalized = Object.entries(rawChoices).map(([key, text]) => ({ key, text }));
  }

  normalized.forEach(({ key, text }) => {
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
      await refreshPaywallState();
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

/**
 * Checks current entitlement/pending status and shows the right paywall
 * sub-state: payment form (nothing submitted yet), pending (submitted,
 * awaiting admin approval), or re-fetches a question if now entitled.
 */
async function refreshPaywallState() {
  const entitled = await apiCheckEntitlement();
  if (entitled) {
    // Unlocked — go straight back into the quiz
    loadNextQuestion();
    return;
  }

  const pending = await apiGetPendingPayment();
  if (pending) {
    el.paywallPending.hidden = false;
    el.paywallPaymentForm.hidden = true;
  } else {
    el.paywallPending.hidden = true;
    el.paywallPaymentForm.hidden = false;
  }
}

el.submitPaymentBtn.addEventListener("click", async () => {
  const code = el.mpesaCodeInput.value.trim();
  if (!code) {
    el.paymentStatus.textContent = "Enter the M-Pesa confirmation code first.";
    el.paymentStatus.className = "payment-status is-error";
    return;
  }

  el.submitPaymentBtn.disabled = true;
  el.submitPaymentBtn.textContent = "Submitting…";
  el.paymentStatus.textContent = "";

  try {
    const result = await apiSubmitPaymentCode(code);
    el.paymentStatus.textContent = result.message || "Submitted — we'll verify it shortly.";
    el.paymentStatus.className = "payment-status is-success";
    el.mpesaCodeInput.value = "";
    el.paywallPending.hidden = false;
    el.paywallPaymentForm.hidden = true;
  } catch (err) {
    el.paymentStatus.textContent = err.message || "Couldn't submit that code — try again.";
    el.paymentStatus.className = "payment-status is-error";
  } finally {
    el.submitPaymentBtn.disabled = false;
    el.submitPaymentBtn.textContent = "Submit payment code";
  }
});

el.refreshEntitlementBtn.addEventListener("click", async () => {
  el.refreshEntitlementBtn.disabled = true;
  el.refreshEntitlementBtn.textContent = "Checking…";
  try {
    await refreshPaywallState();
  } finally {
    el.refreshEntitlementBtn.disabled = false;
    el.refreshEntitlementBtn.textContent = "Check again";
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
 *
 * NOTE: the `questions` table has no RLS select policy by design (it's
 * only ever read through the get-next-question edge function, which is
 * what makes the paywall actually enforceable — see architecture doc).
 * So this list is maintained here manually rather than queried live.
 * Update UNITS/CONDITIONS below as new question categories are added.
 */
const UNITS = [
  "Medicine", "Paediatrics", "Surgery", "Reproductive Health",
  "Community Health", "Health Systems Management",
];
const CONDITIONS = [
  "Hypertension", "Diabetes Mellitus", "Pneumonia", "Acute Myocardial Infarction",
  "Nephrotic Syndrome", "Meningitis", "Postpartum Hemorrhage", "Malaria",
];

async function initFiltersFromQuestions() {
  UNITS.forEach((u) => {
    const opt = document.createElement("option");
    opt.value = u; opt.textContent = u;
    el.filterUnit.appendChild(opt);
  });
  CONDITIONS.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    el.filterCondition.appendChild(opt);
  });
  el.filterBlock.hidden = false;
}

function resetPracticeState() {
  questionsAnsweredCount = 0;
  tickHistory = [];
  activeFilters = {};
  currentQuestion = null;
}
