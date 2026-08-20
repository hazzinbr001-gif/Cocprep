// COCPrep — Auth screen behavior

const authStatusEl = document.getElementById("authStatus");

function setAuthStatus(message, kind) {
  authStatusEl.textContent = message || "";
  authStatusEl.classList.remove("is-error", "is-success");
  if (kind) authStatusEl.classList.add(kind === "error" ? "is-error" : "is-success");
}

// --- Tab switching (password vs magic link) ---
document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");

    const target = tab.dataset.authtab;
    document.querySelectorAll("[data-authpane]").forEach((pane) => {
      pane.hidden = pane.dataset.authpane !== target;
    });
    setAuthStatus("");
  });
});

// --- Email + password: sign in / sign up ---
const passwordForm = document.getElementById("passwordForm");
let pendingAction = "signin";

passwordForm.querySelectorAll("[data-action]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    pendingAction = btn.dataset.action;
    // "Create account" is type=button (so Enter in the fields defaults to
    // "Sign in"), so it must trigger the form's submit handler manually —
    // otherwise clicking it only sets pendingAction and does nothing else.
    if (btn.type === "button") {
      e.preventDefault();
      passwordForm.requestSubmit();
    }
  });
});

passwordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = passwordForm.email.value.trim();
  const password = passwordForm.password.value;

  setAuthStatus(pendingAction === "signup" ? "Creating your account…" : "Signing in…");

  try {
    if (pendingAction === "signup") {
      const { error } = await supabaseClient.auth.signUp({ email, password });
      if (error) throw error;
      setAuthStatus("Account created. Check your email to confirm, then sign in.", "success");
    } else {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange in app.js handles the screen switch
    }
  } catch (err) {
    setAuthStatus(err.message || "Something went wrong.", "error");
  }
});

// --- Magic link ---
const magicForm = document.getElementById("magicForm");

magicForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = magicForm.email.value.trim();
  setAuthStatus("Sending your link…");

  try {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    if (error) throw error;
    setAuthStatus("Check your inbox — tap the link to sign in.", "success");
  } catch (err) {
    setAuthStatus(err.message || "Something went wrong.", "error");
  }
});

// --- Sign out ---
document.getElementById("signOutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
});
