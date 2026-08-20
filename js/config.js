// COCPrep — Supabase configuration
// The anon/public key is safe to expose in frontend code — it has no
// power on its own; Row Level Security and the edge functions are the
// real security boundary (see get-next-question, which uses the
// service role key server-side only).

const SUPABASE_URL = "https://jdeivgomafdxqgscnbat.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkZWl2Z29tYWZkeHFnc2NuYmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjM0MDEsImV4cCI6MjEwMjY5OTQwMX0.P-aGwbrvZ4xPd4rWcLdCTV6--57KBBvBvxGhFKIQL1E";

// Where users send M-Pesa payment manually (Send Money), since Daraja/till
// isn't set up yet. Update this to your real number.
const MPESA_SEND_NUMBER = "0112973866";
const PAYMENT_AMOUNT_KSH = 100;
