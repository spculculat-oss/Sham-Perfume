# Community post links and automated moderation report

**Status:** Implemented in the working branch; not deployed to production. The community database migration is additive and is applied by the existing migration runner on the next server start after release (schema version 12). No production database was accessed or changed during this work.

## Link rendering

- Community post bodies and comments now render plain-text `http://`, `https://`, and `www.` URLs as blue, underlined links even when surrounded by prose.
- Links open in a new tab with `noopener noreferrer nofollow`. Only HTTP(S) protocols are accepted as anchors; React continues to escape member text as text, not HTML.
- Sentence punctuation after a URL is kept outside the clickable link. Hashtags remain styled as before.

## Moderation policy wired into feed posts

- Server-side text checks run when a feed post is created or edited. A conservatively scoped Arabic/English lexical ruleset recognizes selected explicit sexual terms and obscene profanity. The scan is local to the server; post text is not sent to an external model or service.
- On the first detected violation, the post is hidden (`deleted` moderation status, retained for an auditable admin review) and posting is suspended for 14 days.
- A second detected violation, including one submitted during the first suspension, hides that post, invalidates all active sessions, and changes the account to `banned`. The user's account and other data are not deleted.
- A transaction locks the member row while checking/updating the strike count, hidden post, case, account status and sessions, preventing two simultaneous submissions from both being treated as the same first strike.
- Every automatic case records category, rule version, strike number, outcome and target post. The protected admin panel lists open cases and shows the text/image submitted, member and post IDs. An administrator can confirm the case or reverse a false positive with a required note; reversing restores the post, removes that strike, and reactivates a bot-banned account where applicable. Manual status changes and reversals are audited.
- Admin account restoration resets moderation strikes/restriction. The user is not automatically logged in again after a reversal.

## Important limits

- This is a deterministic keyword filter, **not** contextual AI moderation and not an exhaustive list of abuse. Quoting or educational use of one of the matched explicit terms may be incorrectly flagged; the admin review/reversal path exists for that reason. Ambiguous generic educational language is intentionally not included in the rules.
- Only the text field of feed posts is inspected. Images are not automatically analyzed. Comments, stories, discussion threads/replies, private messages, product reviews, and off-site pages are not covered by this specific bot change. This report does not claim those spaces are moderated by the new rules.
- A `banned` state blocks the member's Sham account/session and authenticated community API use; it does not attempt IP blocking, erase the account, or prevent anonymous visitors from viewing public parts of the site.
- The admin panel can review cases proactively. This change does not add a separate member appeal submission form or promise a review SLA.

## Verification

- Pure tests check Arabic normalization/word boundaries, English terms, benign perfume text, URL punctuation/protocol safety and escaped markup.
- PostgreSQL-engine (PGlite) tests exercise first strike, 14-day posting denial, immediate second strike during the 14-day window, session invalidation, account-wide authenticated ban, database migration and administrator reversal/audit.
- Browser-driven testing of clickable link navigation and the admin review UI was not run. Type checks, React server-render tests, API/service tests and a production build are the automated checks; they do not replace a live moderation policy review.
