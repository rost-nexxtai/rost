# Gamified moments

Lessons were already short and hands-on. This change adds the things that bring people back the next day: a reward for every right answer, a reason to come back tomorrow, and a visible path ahead.

## Inside a lesson

| What | How it works |
| --- | --- |
| XP chip | Top right, next to the progress bar. +10 for a choice, guess or order right first time, +4 per sorting card, +5 on a second try. |
| Combo | Right answers in a row light a "3 la rând" toast; from 3 the chip turns into a flame. A slip resets it. |
| Second try | A wrong pick on a choice with 3+ options crosses that option out and offers "Mai încearcă" or "Arată răspunsul". Only the first try counts for the score and the level; the second try still earns XP. |
| Swipe to sort | Sorting cards follow the finger and fly off left or right; the bucket buttons and the ←/→ keys still work. |
| Order puzzle | New graded step type `order`: drag the cards (or use the ↑↓ buttons) into order, then check. Each card turns green or shows its right place. |
| Haptics | A short buzz on right, wrong and finishing, on phones that support it, and never with reduced motion. |

## At the end of a lesson

- XP counting up, with the breakdown: answers, lesson finished (+20), flawless (+20, every graded screen right first time), combo (+15, 5 in a row). A replay of a done lesson earns half.
- The streak: days in a row with a finished lesson (Romanian calendar day), with this week's days as flames.
- Any new badge: first lesson, flawless, combo, 3 and 7 days, level up, 500 XP.
- **Up next** is the main button, so the next lesson is one tap away. The lesson's own link (e.g. "See savings accounts") moves under it.
- A failed lesson (under two thirds right) still counts for the streak and XP, since showing up is the habit, and offers "Mai încearcă lecția", which starts it over.

## Momente

- A streak and XP card on top, with the week and one line: keep your streak today, done for today, or start one.
- The lessons as a path, level by level, winding left and right. Done lessons are green, the current one is big with its card and Start/Continue button, and lessons above your level show a lock but stay open to peek at.
- Moments from your life (payslip, inflation) are listed under the path, and the badge shelf is at the bottom.

## The `order` step

```json
{ "type": "order", "question": "…", "ordered": ["first", "second", "third"], "top": "Safest", "bottom": "Riskiest", "explain": "…" }
```

- `ordered` is the right order, top to bottom, with 3 to 6 different items. The app shows a fixed shuffle that is never the answer.
- Graded like choice, predict and sort. `POST /api/library/{id}/complete` takes `{"step": n, "order": [..]}`: the items as left by the user, as indexes into `ordered`. It is right when it is `[0, 1, 2, …]`.
- The English block can translate `question`, `ordered`, `top`, `bottom` and `explain`.
- Added to "Fondul de urgență" (what to do first with money set aside) and "ETF-uri" (calmest to wildest in a bad year). The seeded lessons upgrade on the next start.

## Where the state lives

XP, the streak and badges sit in the profile cookie (`game`), next to the completed lessons, like the rest of the progress until the backend serves `GET /api/me`. The rules are in `frontend/src/data/mock/game.ts`, and its tests cover them.
