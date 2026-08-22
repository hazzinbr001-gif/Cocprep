// COCPrep — Supabase client + edge function helpers
// Loads the Supabase JS library from CDN, then exposes small wrapper
// functions the rest of the app calls into.

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Calls the get-next-question edge function.
 * Requires an active session — throws if none.
 */
async function apiGetNextQuestion({ unit, topic, condition, most_tested, section } = {}) {
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
    body: JSON.stringify({ unit, topic, condition, most_tested, section }),
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
    .select("id, question_id, selected_answer, correct, answered_at, section, questions(id, question_text, choices, explanation, correct_answer, section, question_type, topic, condition, unit)")
    .order("answered_at", { ascending: false })
    ;

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Returns the authenticated student's persisted score and streak. */
async function apiGetStudentProgress() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;
  const { data, error } = await supabaseClient
    .from("student_progress")
    .select("user_id, current_streak, last_activity_date, section_a_answered, section_a_correct, section_b_answered, section_b_correct, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
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
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return false;

  // Do not use maybeSingle here: an account can have more than one
  // entitlement after a payment is corrected or re-approved. In that case
  // maybeSingle() returns an error and the UI incorrectly shows the paywall.
  const { data, error } = await supabaseClient
    .from("entitlements")
    .select("id, product, expires_at, user_id")
    .eq("user_id", userId)
    .eq("product", "full_access")
    .order("expires_at", { ascending: false, nullsFirst: true })
    .limit(20);

  // Never infer entitlement from a failed read. A checkout visit, a local
  // flag, or a transient database error is not proof of payment.
  if (error) return false;
  return (data ?? []).some((entitlement) =>
    !entitlement.expires_at || new Date(entitlement.expires_at) >= new Date()
  );
}

/**
 * Checks whether the current user has a pending (unreviewed) payment.
 * Used to show "we're checking your payment" state.
 */
async function apiGetPendingPayment() {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabaseClient
    .from("payments")
    .select("id, status, created_at, user_id")
    .eq("user_id", userId)
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


async function apiAdminQuestions(payload = {}) {
  return apiCallFunction("admin-questions", payload);
}

async function apiAdminReports(payload = {}) {
  return apiCallFunction("admin-question-reports", payload);
}

async function apiAdminPayments(payload = {}) {
  return apiCallFunction("approve-payment", payload);
}


async function apiGetQuestionTopics(section = "mcq") {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) throw new Error("Not signed in.");
  const res = await fetch(SUPABASE_URL + "/functions/v1/get-next-question", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ action: "topics", section }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || ("Request failed (" + res.status + ")"));
  return body.topics || [];
}

async function apiGetQuestionComments(questionId, page = 0, pageSize = 10) {
  const from = page * pageSize;
  const { data, error } = await supabaseClient
    .from("comments")
    .select("id, question_id, user_id, body, content, parent_comment_id, created_at, updated_at")
    .eq("question_id", questionId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: true })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);
  return data || [];
}

async function apiCreateQuestionComment(questionId, content, parentCommentId = null) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error("Sign in to join the discussion.");
  if (!(await apiCheckEntitlement())) throw new Error("Premium access is required to join the discussion.");
  const { data, error } = await supabaseClient.from("comments").insert({
    question_id: questionId,
    user_id: userId,
    body: content,
    content,
    parent_comment_id: parentCommentId,
  }).select("id, question_id, user_id, body, content, parent_comment_id, created_at, updated_at").single();
  if (error) throw new Error(error.message);
  return data;
}

async function apiToggleCommentLike(commentId) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error("Sign in to like a comment.");
  const { data: existing, error: readError } = await supabaseClient
    .from("comment_likes").select("id").eq("comment_id", commentId).eq("user_id", userId).maybeSingle();
  if (readError) throw new Error(readError.message);
  if (existing) {
    const { error } = await supabaseClient.from("comment_likes").delete().eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { liked: false };
  }
  const { error } = await supabaseClient.from("comment_likes").insert({ comment_id: commentId, user_id: userId });
  if (error) throw new Error(error.message);
  return { liked: true };
}

async function apiReportComment(commentId, reason, details = "") {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error("Sign in to report a comment.");
  const { error } = await supabaseClient.from("comment_reports").insert({
    comment_id: commentId, user_id: userId, reason, details
  });
  if (error) throw new Error(error.message);
  return { submitted: true };
}
