# Browser and Supabase Storage Contract

Last reviewed: 2026-08-18

## Browser storage

| Key | Owner | Shape / retention | Compatibility |
| --- | --- | --- | --- |
| `dynasaurus-profile` | main profile/sidebar | clamped JSON profile; persistent | malformed/old partial objects are normalized; optional secure `.rkrk.io` cookie mirrors it for the rkrk.io integration |
| `dynasaurus-history` | `src/lib/history.ts` | newest 50 entries, 50k chars per answer, ~1.5M chars total | migrates and removes legacy `dynasaurus_history` |
| `dynasaurus-child-lock` | main sidebar | `"true"`/`"false"`; persistent | stable |
| `dynasaurus-theme` + `dynasaurus-theme-manual` | layout/main/mini | theme and manual-choice marker | shared by main and mini |
| `dynasaurus-onboarded` | onboarding | boolean marker string | stable |
| `dynasaurus-usage-guide-dismissed` | usage guide | boolean marker string | stable |
| `dynasaurus-l1-detected` | main profile bootstrap | one-time detection marker | stable |
| `dynasaurus-add2home-seen` | install guide | seen marker only; guide open state is no longer restored | fixes the old inverted open-on-every-visit behavior |
| `dynasaurus-feedback` | feedback fallback | last 20 unsent reports | device-local; can contain user-entered report text |
| `dynasaurus-email-resend-at` | email verification | email→timestamp map, pruned after 24h | migrates and removes `dynasaurus_email_resend_at` |
| `minisaurus-profile` / `minisaurus-onboarded` | miniSaurus | mini-specific profile and marker | kept separate intentionally |
| `kee-popup-dismissed` (sessionStorage) | coaching CTA | current-tab dismissal | clears when the tab session ends |

Browser storage is convenience state, never an authorization source. All values that reach `/api/chat` are clamped; language and CEFR values are converted to server allowlists. Local and domain cookie profile data must be treated as user-controlled.

## Supabase paths

- `query_log`: authenticated history and a future quota-counting source. `/api/history/load` filters by the authenticated `user.id`; `/api/history/sync` supplies that `user_id` server-side and de-duplicates timestamps/words. The UI's **Clear device** action intentionally clears only browser history; authenticated delete is not granted because deleting usage rows could reset quotas. A future account-wide erasure feature must separate history from immutable usage accounting. Apply the repository RLS migration and verify it against the live schema.
- `profiles`: browser client access depends entirely on live RLS. Export and review its policies before relying on it.
- `subscriptions`, `billing_customers`, `stripe_webhook_events`: service-role writes and authenticated self-read policies are defined in the billing migration.
- `bug_reports` and `bug-screenshots`: browser writes require explicit restrictive table/storage policies. File names are random and MIME-derived, but bucket RLS remains the real security boundary.
- `keebot_messages`: service-role server writes include session/page/IP metadata. Confirm retention, access controls, and disclosure expectations externally because its schema is not in this repository.

No chat/history/PDF feature writes to a local server path. The history export creates an escaped in-memory print document. `/intro` reads only the fixed `public/intro.html` path.
