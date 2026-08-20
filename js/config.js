// COCPrep — Supabase configuration
// The anon/public key is safe to expose in frontend code — it has no
// power on its own; Row Level Security and the edge functions are the
// real security boundary (see get-next-question, which uses the
// service role key server-side only).

const SUPABASE_URL = "https://jdeivgomafdxqgscnbat.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkZWl2Z29tYWZkeHFnc2NuYmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjM0MDEsImV4cCI6MjEwMjY5OTQwMX0.P-aGwbrvZ4xPd4rWcLdCTV6--57KBBvBvxGhFKIQL1E";

// Where to send free users who hit the paywall.
// Replace with your real Stripe/Paystack checkout link when ready.
const UPGRADE_URL = null; // e.g. "https://buy.stripe.com/xxxxx"
