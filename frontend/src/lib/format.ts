export const lei = (n: number) => `${Math.round(n).toLocaleString('en-US')} lei`;
export const pct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;
