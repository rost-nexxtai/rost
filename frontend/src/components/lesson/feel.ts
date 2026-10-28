/**
 * A short buzz on phones that support it, so a right or wrong answer is felt as well as seen.
 * Silent everywhere else, and for people who asked for less motion.
 */
export function feel(kind: 'right' | 'wrong' | 'done') {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const pattern = { right: 18, wrong: [30, 40, 30], done: [20, 60, 20] }[kind];
  try {
    navigator.vibrate(pattern);
  } catch {
    // some browsers throw when vibration isn't allowed yet
  }
}
