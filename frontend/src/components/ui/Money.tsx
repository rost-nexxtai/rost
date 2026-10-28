import { lei, leiSigned } from '@/lib/format';

const SIZE = { sm: '', md: ' display-md', xl: ' display-xl' } as const;

/**
 * A lei amount with tabular figures. The caller picks the tone: a "+32 lei" fuel cost is bad news,
 * a "+46 lei" interest gain is good news, so the sign alone can't decide the colour.
 */
export function Money({
  lei: amount,
  signed = false,
  size = 'sm',
  tone,
}: {
  lei: number;
  signed?: boolean;
  size?: 'sm' | 'md' | 'xl';
  tone?: 'pos' | 'neg';
}) {
  return <span className={`money${tone ? ` ${tone}` : ''}${SIZE[size]}`}>{signed ? leiSigned(amount) : lei(amount)}</span>;
}
