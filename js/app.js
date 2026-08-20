// COCPrep — App shell: screen routing + auth state

const screens = {
  auth: document.getElementById("screen-auth"),
  practice: document.getElementById("screen-practice"),
  results: document.getElementById("screen-results"),
};

const topbar = document.getElementById("topbar");
const userEmailEl = document.getElementById("userEmail");

function showScreen(name) {
  Object.entries(screens).forEach(([key, node]) => {
    node.hidden = key !== name;
  });
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.nav === name);
  });

  if (name === "practice") {
    resetPracticeState();
    loadNextQuestion();
    initFiltersFromQuestions();
  }
  if (name === "results") {
    loadResults();
  }
}

document.querySelectorAll("[data-nav]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    showScreen(link.dataset.nav);
  });
});

function enterSignedInState(session) {
  topbar.hidden = false;
  userEmailEl.textContent = session.user.email || "";
  showScreen("practice");
}

function enterSignedOutState() {
  topbar.hidden = true;
  showScreen("auth");
}

// React to auth changes: initial load, sign in, sign out, token refresh,
// and magic-link redirect callbacks all flow through this one listener.
supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session) {
    enterSignedInState(session);
  } else {
    enterSignedOutState();
  }
});

// Also check immediately on load in case a session already exists
// (onAuthStateChange fires async, this avoids a flash of the auth screen).
supabaseClient.auth.getSession().then(({ data }) => {
  if (data?.session) {
    enterSignedInState(data.session);
  } else {
    enterSignedOutState();
  }
});
