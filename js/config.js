// COCPrep — Supabase configuration
// The publishable key is safe to expose in frontend code — it has no
// power on its own; Row Level Security and the edge functions are the
// real security boundary (see get-next-question, which uses the
// service role key server-side only).

const SUPABASE_URL = "https://jdeivgomafdxqgscnbat.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_rAK4-7bXmxx-Dh9ypmfllw_pihj_sr1";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Where users send M-Pesa payment manually (Send Money), since Daraja/till
// isn't set up yet. Update this to your real number.
const MPESA_SEND_NUMBER = "0112973866";
const PAYMENT_AMOUNT_KSH = 100;
