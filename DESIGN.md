# Rost design rules

Rost is a money app for young adults in Romania. The look is "calm paper": warm off-white ground, one deep green for action, one coral for attention, and nothing that shouts. People should trust it with their money, so the interface stays quiet and does what they expect.

All values live as tokens at the top of `frontend/src/app/globals.css`. Components read tokens; they don't invent colours, radii or timings.

## Colour

- `--ground` paper, `--surface` white cards, `--ink` text.
- `--primary` (green) is the action colour: primary buttons, chosen answers, progress, "right".
- `--accent` (coral) marks attention: the current lesson, "wrong", the active tab. Text on coral uses `--accent-ink`, never white on `--accent` (3.6:1 is too low for body text).
- `--muted` is warm, taken from the paper, not a cool grey. It is 6:1 on `--ground`.
- On dark surfaces, secondary text is `--on-dark-muted`.
- Contrast: body text at least 4.5:1, large text at least 3:1.

## Type

- Display: Bricolage Grotesque (headings, big numbers). Body: DM Sans. Both self-hosted through `next/font`.
- Headings are balanced (`text-wrap: balance`), paragraphs pretty. Tracking never tighter than -0.04em.
- Money and scores use tabular numerals (`.money`, `.provider-figure`, `.score strong`).
- No kicker or eyebrow above a heading. A note on what kind of step this is (Sort, Guess first) goes under the question (`.lesson-hint`). Metadata like a date or "3 min" goes under the title (`.card-meta`). `.eyebrow` is only a label for the value under it (Risk, Access, Level).

## Surfaces

- Cards: 16px radius, a 1px line, no shadow. One way of showing elevation, never a line plus a shadow.
- No card inside a card. A tinted area inside a card is a panel (`.panel-tint`, `.panel-accent`).
- Controls: 12px radius; answer tiles 14px; pills only for small controls (buttons, tags, the language switch).
- No hard offset "ledge" shadows. The only soft shadow is on things that are physical objects: the sort card and a row being dragged.
- Icons come from `components/ui/Icon.tsx`, one stroke weight. No Unicode arrows or emoji as icons.
- Touch targets are at least 40px, 44px for buttons.

## Motion

Animate only when it helps someone see what changed. How often someone sees a thing decides whether it moves:

| How often | What moves |
|---|---|
| Many times a day (tabs, the language switch) | Nothing. Colour changes only. |
| Often (buttons, tiles, rows) | A press: `scale(0.97)` over `--dur-press`. |
| Now and then (a new lesson step, feedback, revealing providers) | A short rise or fade over `--dur-enter`; lists cascade 40ms apart (`.stagger`). |
| Rarely (finishing a lesson) | The one authored moment: the badge pops, confetti, the rest follows. |

- Easing: `--ease-out` for anything entering or leaving, `--ease-in-out` for things moving on screen, plain `ease` for colour. Never `ease-in`.
- UI motion stays under 300ms. Exits are faster than entries.
- Animate `transform` and `opacity`, not width or height. The lesson progress fills with `scaleX`.
- Nothing starts from `scale(0)`; the smallest start is about 0.85.
- No motion that never stops: the hint dot pulses three times, then rests.
- Hover styles exist only for real pointers (`@media (hover: hover) and (pointer: fine)`), so taps don't leave things stuck highlighted.
- Reduced motion means less movement, not none: rises become fades, shakes and confetti go, presses don't scale, and fades and colour changes stay because they still say what changed.
- Don't put a transform animation on a parent of `position: fixed` content (the lesson bar): it moves the bar while it plays. The lesson body only fades.

## Sources for these rules

The rules follow two public skill sets, read from GitHub: pbakaus/impeccable (its craft floor and polish playbook) and emilkowalski/skills (`emil-design-eng`).
