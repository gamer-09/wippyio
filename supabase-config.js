/*
 * Supabase configuration for build requests.
 *
 * Fill these in from your Supabase project:
 *   Project Settings → API → Project URL        → supabaseUrl
 *   Project Settings → API → Project API anon key → supabaseAnonKey
 *
 * The anon key is SAFE to expose publicly. It can only INSERT rows
 * (enforced by Row Level Security). Only your logged-in admin account
 * can READ the requests. See SETUP.md for the exact SQL.
 */
window.WIPPY_CONFIG = {
  supabaseUrl: "https://fvvuvkfdukrrgypbvgha.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ2dnV2a2ZkdWtycmd5cGJ2Z2hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NjYyMjAsImV4cCI6MjEwNzE0MjIyMH0.otaiRcyy1pqh8VKpHW_oniE8BWEkzillGyKSPkqg0t4",

  /*
   * Your own public contact handles. On the request form, when a visitor
   * picks how they want to be reached, the matching handle below is shown
   * ("reach out to me at …") so they know who will contact them and can be
   * on the lookout for it. Leave a value as "" for any platform you're not on.
   */
  contact: {
    email:    "samueludodong9@gmail.com",
    discord:  "voided_2026",
    telegram: "",                      // no Telegram
    x:        "samueludodong9@gmail.com", // you sign in to X with this email
    github:   "gamer-09",
    other:    "",
  },
};
