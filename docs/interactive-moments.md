# Interactive moments

Lessons were already short and hands-on. This change makes them more interactive, and gives Momente a clear roadmap. It stays a finance app: no points, streak flames or badges.

## Inside a lesson

| What | How it works |
| --- | --- |
| Second try | A wrong pick on a choice with 3+ options crosses that option out and offers "Mai încearcă" or "Arată răspunsul", the way a tutor would. Only the first try counts toward passing and the level. |
| Swipe to sort | Sorting cards follow the finger and fly off left or right. The bucket buttons and the ←/→ keys still work. |
| Order puzzle | New graded step type `order`: drag the cards (or use the ↑↓ buttons) into order, then check. Each card turns green or shows the place it belongs in. |
| Haptics | A short buzz on right and wrong answers and at the end, on phones that support it, and never with reduced motion. |

## At the end of a lesson

- The score, the time, what to remember, and this week as seven dots: the days with a finished lesson.
- **Up next** is the main button, so the next lesson is one tap away. The lesson's own link (e.g. "See savings accounts") moves under it.
- A failed lesson (under two thirds right) offers "Reia lecția", which starts it over.

## Momente

- **Top card:** your level and its core-lesson progress, and this week's dots.
- **Roadmap:** level by level. Each level has a header ("L0 · Fundația", 1 of 3 core lessons), then its lessons on a vertical line:
  - done lessons are ticked;
  - the current lesson opens into a card with Start or Continue;
  - lessons above your level are dashed and locked, but still open to read.
- **From your life:** moments from your life (payslip, inflation) are listed under the roadmap.

## The `order` step

```json
{ "type": "order", "question": "…", "ordered": ["first", "second", "third"], "top": "Safest", "bottom": "Riskiest", "explain": "…" }
```

- `ordered` is the right order, top to bottom, with 3 to 6 different items. The app shows a fixed shuffle that is never the answer.
- Graded like choice, predict and sort. `POST /api/library/{id}/complete` takes `{"step": n, "order": [..]}`: the items as left by the user, as indexes into `ordered`. It is right when it is `[0, 1, 2, …]`.
- The English block can translate `question`, `ordered`, `top`, `bottom` and `explain`.
- Added to "Fondul de urgență" (what to do first with money set aside) and "ETF-uri" (calmest to wildest in a bad year). The seeded lessons upgrade on the next start.

## Where the state lives

The days with a finished lesson sit in the profile cookie (`learnedDays`, the last two weeks), next to the completed lessons, like the rest of the progress until the backend serves `GET /api/me`.
