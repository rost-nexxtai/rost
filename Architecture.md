# ACCOUNTS
There is one type of account: an adult's (Home, Momente, Stiri). Kids accounts are a pitch idea,
not part of this build; see "Pitch: kids accounts" in MVP & business plan.md.

# THE APP

### SECTIONS
1. Home
2. Momente
3. Stiri

## USER PROFILE
User profile gets created based on an onboarding quizz. From this onboarding quizz we deduct the users
financial education level:
-L0: little to no knowledge
-L1: Medium
-L2: Advanced,
and the users Risk Profile.

Level: the quiz has 4 questions in two tiers, the basics (inflation, compound interest) and L1
concepts (diversification, bond prices). A tier passes only when both its questions are right,
tiers pass in order, and the level is the number of tiers passed; the harder pair is only asked
once the basics are right. Details in docs/level-assessment.md. Lessons move you up only when
passed (at least 2 of 3 graded screens right); a failed attempt can be retaken.

Risk Profile: follows the level (L0 prudent, L1 echilibrat, L2 dinamic), then capped: money needed
within a year → prudent; dinamic without a 3-month buffer or with expensive debt → echilibrat.
Age adds nothing. The rule lives in backend/internal/learning and is mirrored in
frontend/src/data/mock/scoring.ts.

## HOME SECTION
After taking the onboarding quizz and building the user's profile we make tailored recommendations 
on financial instruments like this:
For L0: Savings Account, fixed term bank deposit
For L1: L0 + Fidelis, bonds and ETFs
For L2: L0 + L1 + Stocks, commodities etc.
All assets are listed for every level but in priority order.

Every asset is stand-alone and we list the real banks/brokers in Romania with their rate after tax
(or the cost of a 1,000 lei order for brokers), the month we checked it, the source, and a link to
their official site. None of them pays to be listed; the order is the number alone. The list lives
in backend/internal/reference/data/seed (offers.json, brokers.json), served by GET /api/providers.
Each asset has a simulation with a graph that puts inflation first: how much of the result
inflation takes, the result in today's money, and the same money left in a current account. The assets contain links to moments that explain the information: "Vreau sa aflu mai multe despre activul X"

## MOMENTS SECTION
Recommended moments based on profile come on top and the rest below.
A moment is a short 5 minutes max lesson (very interactive) on a single topic.
After completing moments, users advance in their level.

## NEWS SECTION
A few 2-3 tailored real world geo-political news that affects the users financial situation: eg Iran conflict.
