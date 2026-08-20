// COCPrep — Supabase client + edge function helpers
// Loads the Supabase JS library from CDN, then exposes small wrapper
// functions the rest of the app calls into.

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Calls the get-next-question edge function.
 * Requires an active session — throws if none.
 */
async function apiGetNextQuestion({ unit, condition, most_tested, section } = {}) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-next-question`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ unit, condition, most_tested, section }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok && !body.blocked) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

/**
 * Calls the submit-answer edge function.
 * Expected to return { correct: boolean, correct_answer, explanation }.
 */
async function apiSubmitAnswer({ questionId, selectedChoice, section }) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ question_id: questionId, selected_answer: selectedChoice, section }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

/**
 * Fetches this user's attempt history directly from the question_attempts
 * table (protected by RLS: users can only read their own rows).
 */
async function apiGetAttemptHistory() {
  const { data, error } = await supabaseClient
    .from("question_attempts")
    .select("id, question_id, selected_answer, correct, answered_at, questions(question_text)")
    .order("answered_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * Calls submit-payment-code — user has already sent M-Pesa money manually
 * and is submitting their confirmation code. This queues a pending payment;
 * it does NOT unlock access on its own (an admin must approve it).
 */
async function apiSubmitPaymentCode(mpesaCode) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-payment-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      "apikey": SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ mpesa_code: mpesaCode }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return body;
}

/**
 * Checks whether the current user has an active full_access entitlement.
 * Used to show "pending approval" vs "unlocked" state on the paywall.
 */
async function apiCheckEntitlement() {
  const { data, error } = await supabaseClient
    .from("entitlements")
    .select("id, product, expires_at")
    .eq("product", "full_access")
    .limit(1)
    .maybeSingle();

  if (error) return false; // fail closed — treat as not entitled
  if (!data) return false;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return false;
  return true;
}

/**
 * Checks whether the current user has a pending (unreviewed) payment.
 * Used to show "we're checking your payment" state.
 */
async function apiGetPendingPayment() {
  const { data, error } = await supabaseClient
    .from("payments")
    .select("id, status, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}

async function apiCallFunction(name, payload) {
  const { data } = await supabaseClient.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("Not signed in.");
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error || `Request failed (${res.status})`), { code: res.status, body });
  return body;
}

async function apiToggleQuestionFlag(questionId) {
  return apiCallFunction("toggle-question-flag", { question_id: questionId });
}

async function apiSubmitQuestionReport(questionId, reason, details) {
  return apiCallFunction("submit-question-report", { question_id: questionId, reason, details });
}

async function apiGetQuestionFlags() {
  return apiCallFunction("get-question-flags", {});
}
