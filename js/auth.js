// COCPrep — authentication behavior

const authStatusEl = document.getElementById("authStatus");
const loginView = document.getElementById("loginView");
const signupView = document.getElementById("signupView");
const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

function setAuthStatus(message, kind) {
  authStatusEl.textContent = message || "";
  authStatusEl.classList.remove("is-error", "is-success");
  if (kind) authStatusEl.classList.add(kind === "error" ? "is-error" : "is-success");
}

function showAuthView(view) {
  const isSignup = view === "signup";
  loginView.hidden = isSignup;
  signupView.hidden = !isSignup;
  setAuthStatus("");
}

document.querySelectorAll("[data-auth-view]").forEach((button) => {
  button.addEventListener("click", () => showAuthView(button.dataset.authView));
});

function readCredentials(form) {
  return {
    email: form.email.value.trim(),
    password: form.password.value,
  };
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { email, password } = readCredentials(loginForm);
  const submitButton = loginForm.querySelector('[data-action="signin"]');
  setAuthStatus("Signing in…");
  submitButton.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (error) {
    setAuthStatus(error.message || "Unable to sign in. Please check your details.", "error");
  } finally {
    submitButton.disabled = false;
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const { email, password } = readCredentials(signupForm);
  const submitButton = signupForm.querySelector('[data-action="signup"]');
  setAuthStatus("Creating your account…");
  submitButton.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    signupForm.reset();
    setAuthStatus("Account created. Check your email to confirm, then sign in.", "success");
  } catch (error) {
    setAuthStatus(error.message || "Unable to create your account. Please try again.", "error");
  } finally {
    submitButton.disabled = false;
  }
});

document.getElementById("signOutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
});
