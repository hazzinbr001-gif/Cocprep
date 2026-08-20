// COCPrep — Supabase client + edge function helpers
// Loads the Supabase JS library from CDN, then exposes small wrapper
// functions the rest of the app calls into.

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Calls the get-next-question edge function.
 * Requires an active session — throws if none.
 */
async function apiGetNextQuestion({ unit, condition, most_tested } = {}) {
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
    body: JSON.stringify({ unit, condition, most_tested }),
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
async function apiSubmitAnswer({ questionId, selectedChoice }) {
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
    body: JSON.stringify({ question_id: questionId, selected_choice: selectedChoice }),
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
    .select("id, question_id, selected_choice, is_correct, created_at, questions(question_text)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data ?? [];
}
