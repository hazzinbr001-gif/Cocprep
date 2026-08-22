const screens = {
  auth: document.getElementById("screen-auth"),
  dashboard: document.getElementById("screen-dashboard"),
  practice: document.getElementById("screen-practice"),
  results: document.getElementById("screen-results"),
  admin: document.getElementById("screen-admin"),
};
const topbar = document.getElementById("topbar");
const userEmailEl = document.getElementById("userEmail");
let premiumAccess = false;

function sectionFromRoute() {
  const match = location.hash.match(/^#\/practice\/(section-a|section-b)$/);
  return match ? (match[1] === "section-b" ? "truefalse" : "mcq") : null;
}

function routeFor(section) {
  return section === "truefalse" ? "#/practice/section-b" : "#/practice/section-a";
}

function navigatePractice(section, replace = false) {
  const route = routeFor(section);
  if (replace) history.replaceState({}, "", route);
  else if (location.hash !== route) history.pushState({}, "", route);
  showScreen("practice", section);
}

function showScreen(name, section = sectionFromRoute() || activeSection || "mcq") {
  Object.entries(screens).forEach(([key, node]) => { if (node) node.hidden = key !== name; });
  document.querySelectorAll("[data-nav]").forEach((node) => node.classList.toggle("is-active", node.dataset.nav === name));
  if (name === "dashboard") { loadDashboard(); loadFlaggedQuestions(); }
  if (name === "results") loadResults();
  if (name === "admin") loadAdmin();
  if (name === "practice" && activeSection !== section) startExam(section);
  if (name === "practice" && !currentQuestion) startExam(section);
}

async function updatePremiumUI() {
  premiumAccess = await apiCheckEntitlement();
  const card = document.querySelector(".tf-card");
  if (!card) return;
  card.classList.toggle("has-premium-access", premiumAccess);
  const badge = card.querySelector(".premium-badge");
  const note = card.querySelector(".premium-note");
  const button = card.querySelector("[data-start='truefalse']");
  if (badge) badge.textContent = premiumAccess ? "🏆 Premium" : "🔒 Premium";
  if (note) { note.hidden = premiumAccess; note.textContent = "Premium access required"; }
  if (button) button.textContent = premiumAccess ? "Start True / False practice →" : "Unlock Section B →";
}

async function loadDashboard() {
  try {
    const attempts = await apiGetAttemptHistory();
    const bySection = (section) => attempts.filter((a) => (a.section || a.questions?.section) === section);
    const a = bySection("mcq"), b = bySection("truefalse");
    const accuracy = (list) => list.length ? Math.round(list.filter((x) => x.correct).length / list.length * 100) : null;
    const all = [...a, ...b], overall = accuracy(all);
    document.getElementById("overallAccuracy").textContent = overall === null ? "—" : `${overall}%`;
    document.getElementById("overallProgressBar").style.width = `${overall || 0}%`;
    document.getElementById("overviewAnswered").textContent = all.length;
    document.getElementById("overviewSessions").textContent = all.length ? Math.ceil(all.length / 10) : 0;
    document.getElementById("mcqAttempted").textContent = a.length;
    document.getElementById("mcqAccuracy").textContent = accuracy(a) === null ? "—" : `${accuracy(a)}%`;
    document.getElementById("mcqProgress").style.width = `${Math.min(100, a.length / 20 * 100)}%`;
    document.getElementById("tfAttempted").textContent = b.length;
    document.getElementById("tfAccuracy").textContent = accuracy(b) === null ? "—" : `${accuracy(b)}%`;
    document.getElementById("tfProgress").style.width = `${Math.min(100, b.length / 20 * 100)}%`;
    renderRecentAttempts(all);
  } catch (_) {}
  updatePremiumUI();
}

function renderRecentAttempts(attempts) {
  const target = document.getElementById("recentSessions");
  if (!target) return;
  target.innerHTML = attempts.slice(0, 3).map((x) =>
    `<div class="history-item"><span class="history-dot ${x.correct ? "is-correct" : ""}"></span><span class="history-text">${x.correct ? "Correct answer" : "Needs review"}</span><span class="history-time">${new Date(x.answered_at).toLocaleDateString()}</span></div>`
  ).join("") || '<div class="empty-inline"><span>◷</span><div><strong>No sessions yet</strong><p>Your answered questions will appear here.</p></div></div>';
}

function loadFlaggedQuestions() {
  apiGetQuestionFlags().then(({ flags }) => {
    const target = document.getElementById("flaggedQuestions");
    if (!target) return;
    target.innerHTML = (flags || []).slice(0, 4).map((f) =>
      `<div class="history-item"><span class="history-dot" style="background:#f4c95d"></span><span class="history-text">${f.questions?.question_text || "Flagged question"}</span><span class="history-time">${f.questions?.section === "truefalse" ? "Section B" : "Section A"}</span></div>`
    ).join("") || '<div class="empty-inline"><span>⚑</span><div><strong>No flagged questions</strong><p>Flag a question during practice to revisit it here.</p></div></div>';
  }).catch(() => {});
}

document.querySelectorAll("[data-nav]").forEach((node) => node.addEventListener("click", (event) => {
  event.preventDefault();
  if (node.dataset.nav === "practice") return navigatePractice("mcq");
  showScreen(node.dataset.nav);
}));
document.querySelectorAll("[data-start]").forEach((button) => button.addEventListener("click", () => {
  const section = button.dataset.start === "truefalse" ? "truefalse" : "mcq";
  navigatePractice(section);
}));
window.addEventListener("popstate", () => {
  const section = sectionFromRoute();
  if (section) showScreen("practice", section);
});
window.addEventListener("hashchange", () => {
  const section = sectionFromRoute();
  if (section) showScreen("practice", section);
});

function enterSignedInState(session) {
  topbar.hidden = false;
  userEmailEl.textContent = session.user.email || "";
  document.getElementById("welcomeName").textContent = (session.user.email || "candidate").split("@")[0];
  showScreen(sectionFromRoute() ? "practice" : "dashboard", sectionFromRoute() || "mcq");
  refreshAdminAccess();
}
function enterSignedOutState() { topbar.hidden = true; showScreen("auth"); }
supabaseClient.auth.onAuthStateChange((_event, session) => session ? enterSignedInState(session) : enterSignedOutState());
supabaseClient.auth.getSession().then(({ data }) => data?.session ? enterSignedInState(data.session) : enterSignedOutState());