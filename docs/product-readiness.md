# From demo to product, with the same experience

What separates Rost from a real product, without changing what a user sees or does. Each item keeps every screen, word and flow as it is today.

## Doing now (the `dev` branch)

### Accounts and sessions
1. **Real sessions.** The session cookie holds the user's id as it is, so anyone who learns an id can act as that user. It becomes a random token that means nothing on its own. The server keeps a hash of it, with an expiry that renews while the user is active. Signing out ends it on the server. Existing users keep their place: a valid old cookie is swapped for a session on their next visit, once, and only for accounts from before the change, so an id is never a password again. The profile the app kept in the browser (quiz, level, finished lessons, the week's days, the money lines) moves to the server on that visit, so nobody starts over.
2. **Email login, ready for a screen.** Today an account lives in one browser. The backend gets passwordless email login: a one-time link that ties the anonymous account to an email, or reopens the account on another device. A link works only in the browser that asked for it, so a link someone else sends you, or one a mail scanner opens, never mixes two people's accounts. This is API only; the screen comes later.
3. **Demo persona only in demo mode.** Logging in as Maria works, and is offered, only when demo tools are on, as they are on the stage server. A production server never hands out a shared account.
4. **Your data, yours to take or delete.** Profil → Resetează deletes the account and its data instead of only signing out (GDPR art. 17); the demo persona is reset instead. Starting the quiz over on a shared browser only signs the last person out; it never deletes them. `GET /api/me/export` returns everything kept about the user as JSON (art. 20).

### Hardening the API
5. **No crash takes a request down silently.** A panic answers 500 and is logged with its stack. Every request gets an id, which goes in the logs and the response, so a user's report can be traced.
6. **Requests from other sites are refused.** Browsers mark cross-site requests (`Sec-Fetch-Site`). A state-changing request from another site is turned away, which closes the gaps SameSite cookies leave, such as the photo upload form.
7. **Rate limits on what costs money or fills the database:** creating users and quizzes, login emails (also capped per day for the whole server), reading a payslip photo (each one is a paid model call), tracking and referral clicks. They are per client, behind the app's own proxy, including the calls the web server makes for a page.
8. **Uploads are what they claim.** A payslip photo must really be an image of a supported type, checked from its bytes.
9. **Timeouts and headers.** The server gets read, write and idle timeouts. API answers carry `nosniff` and are never cached.
10. **An outage looks like an outage.** When the API can't be reached, pages say so and offer to try again, instead of sending a signed-in user back to the quiz.

### Web app and delivery
11. **Browser security headers.** No other site can frame the app, except the bank view, which is made to be framed. The headers also stop MIME sniffing, keep referrers short, use HSTS on HTTPS, and stop advertising Next.js.
12. **Containers run as a normal user**, with health checks, so the platform restarts what stops answering.
13. **CI checks more.** It adds formatting, known vulnerabilities in Go modules and npm packages, and the Postgres store tests on every push.

## Needs a screen, so not now
- The email login screen and "your account on another device".
- A cookie and consent notice, if analytics beyond first-party tracking are added.
- Notifications on payday (push or email), which today happen when the app is opened.
- Choosing dependants for the personal deduction (it assumes none).
