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

// --- Email + password: sign in and sign up are two separate, independent flows ---
const passwordForm = document.getElementById("passwordForm");
const signInBtn = passwordForm.querySelector('[data-action="signin"]');
const signUpBtn = passwordForm.querySelector('[data-action="signup"]');

function getEmailPassword() {
  return {
    email: passwordForm.email.value.trim(),
    password: passwordForm.password.value,
  };
}

// Enter key in the fields defaults to sign in (the form's type=submit button).
passwordForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  await handleSignIn();
});

// "Create account" is a separate type=button, wired to its own handler —
// it never touches the sign-in flow or the form's submit event.
signUpBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  await handleSignUp();
});

async function handleSignIn() {
  const { email, password } = getEmailPassword();
  setAuthStatus("Signing in…");
  signInBtn.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // onAuthStateChange in app.js handles the screen switch
  } catch (err) {
    setAuthStatus(err.message || "Something went wrong.", "error");
  } finally {
    signInBtn.disabled = false;
  }
}

async function handleSignUp() {
  const { email, password } = getEmailPassword();
  setAuthStatus("Creating your account…");
  signUpBtn.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    setAuthStatus("Account created. Check your email to confirm, then sign in.", "success");
  } catch (err) {
    setAuthStatus(err.message || "Something went wrong.", "error");
  } finally {
    signUpBtn.disabled = false;
  }
}

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
