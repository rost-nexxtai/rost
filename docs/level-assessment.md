# How onboarding places someone at L0, L1 or L2

## What it did until now

After four "about you" taps, onboarding asks short knowledge questions and counts the right answers.

| | Frontend (what users get) | Backend (`POST /api/quiz`) |
| --- | --- | --- |
| Questions | 4: inflation, compound interest, single share vs ETF, bond prices when rates rise | 3: the first three only |
| L1 | 2 or 3 right | exactly 2 right |
| L2 | all 4 right | all 3 right |

Each question has three options plus "Nu știu" (I don't know). Completing all core lessons of a level moves you up; the quiz level is a floor.

## What's wrong with it

1. **Two rule sets.** The backend and frontend disagree on the questions and the cut-offs. The day the frontend starts sending the quiz to `POST /api/quiz`, the backend refuses it ("knowledge needs one answer per question"), and if that were fixed the same answers would get a different level.
2. **Guessing gets you to L1.** Someone who taps at random gets at least 2 of 4 right 41% of the time (1 − (2/3)⁴ − 4·(1/3)·(2/3)³ = 33/81). So four in ten guessers are told they know the basics: Momente lists the L1 lessons ahead of the foundation ones, Acasă marks ETFs as "for your level", and their risk profile goes up a step.
3. **All questions count the same.** Missing the inflation question but guessing the bond question gives the same level as knowing inflation and compounding cold. The questions test different levels of knowledge, but the score ignores which ones you got right. A pattern of "hard right, basics wrong" is a sign of guessing, and it's rewarded.
4. **Beginners answer questions they can't know.** A beginner who misses the inflation question still has to face the bond-price question, which is the slowest and most discouraging screen of onboarding, and its answer can't change their level in a useful way.
5. **The two kinds of mistake don't cost the same.** Placing someone too low costs them a few three-minute lessons they could skip, and finishing a level's core lessons moves them up anyway. Placing someone too high shows ETFs and shares as "for your level", and raises their risk profile (it is computed from the level). The old rule treats both the same.

## The new rule: concepts, in order, both answers per tier

Each question tests one tier, the knowledge needed to skip that level's lessons:

| Tier | Questions | Passing it means you can skip |
| --- | --- | --- |
| 0 | inflation, compound interest | the L0 lessons → start at L1 |
| 1 | single share vs ETF, bond prices when rates rise | the L1 lessons → start at L2 |

- **A tier passes only when both its questions are right.** "Nu știu" counts as not right, never as a penalty.
- **Tiers are passed in order.** Tier 1 only counts once tier 0 has passed: nobody reaches L2 without the basics, whatever they guessed.
- **The level is the number of tiers passed in a row**: none → L0, tier 0 → L1, both → L2.
- **Onboarding adapts.** If tier 0 doesn't pass, the tier-1 questions aren't asked; they couldn't change the level. A beginner answers 6 screens instead of 8.

### What that changes

| | Old rule | New rule |
| --- | --- | --- |
| Random guesser reaches L1 or higher | 41% | 11% (1/9) |
| Random guesser reaches L2 | 1.2% | 1.2% (1/81), and only with the basics right |
| Basics wrong, hard question right | L1 | L0 |
| Basics right, one tier-1 slip | L1 | L1 |
| One slip on the basics | L1 | L0, then 3 lessons (about 9 minutes) to L1 |
| Screens for a beginner | 8 | 6 |

The cost: an expert who mis-taps a basic question starts one level low. That is the cheap mistake (see point 5), and the three L0 lessons move them up.

## One rule set, checked in both places

- The questions carry their tier in both `backend/internal/reference/data/seed/quiz.json` and `frontend/src/data/fixtures/quiz.ts`, and the backend now has all four questions.
- `backend/internal/learning/testdata/placement.json` lists answer patterns and the level each must give. The Go tests and the frontend tests both run every case, and a frontend test checks that its questions, right answers and tiers match the backend's. A change to the rule in one place without the other fails CI.

## Not changed here

- **Risk profile.** It still starts from the level (plus one point under 30), with the horizon, savings-cushion and debt caps. A better level makes it better, but knowledge isn't risk tolerance; a direct "how would you feel if this dropped 20%?" question would be the next step.
- **Where the quiz is scored.** The frontend still scores it for the screens, with the same rule as the backend. Moving onboarding to `POST /api/quiz` is a separate change.
