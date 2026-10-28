'use client';

import { useId, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { RankedProvider } from '@/data/types';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import { ProviderRow } from './ProviderRow';

/** How many providers show before "Arată mai multe". */
export const PROVIDERS_SHOWN = 2;

const T = copy(
  { more: (n: number) => (n === 1 ? 'Arată încă una' : `Arată încă ${n}`), less: 'Arată mai puține' },
  { more: (n: number) => (n === 1 ? 'Show 1 more' : `Show ${n} more`), less: 'Show fewer' },
);

/** The two best-known providers, with the rest one tap away. */
export function ProviderList({ providers }: { providers: RankedProvider[] }) {
  const t = T[useLang().lang];
  const [open, setOpen] = useState(false);
  const id = useId();
  const hidden = providers.length - PROVIDERS_SHOWN;
  return (
    <>
      {providers.slice(0, PROVIDERS_SHOWN).map((p) => (
        <ProviderRow key={p.id} p={p} />
      ))}
      {hidden > 0 && (
        <>
          <div id={id} hidden={!open}>
            {providers.slice(PROVIDERS_SHOWN).map((p) => (
              <ProviderRow key={p.id} p={p} />
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ alignSelf: 'center', marginTop: 8, gap: 4 }}
            aria-expanded={open}
            aria-controls={id}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? t.less : t.more(hidden)}
            <span aria-hidden="true" style={{ display: 'inline-flex', transform: `rotate(${open ? -90 : 90}deg)` }}>
              <Icon name="chevron" size={16} />
            </span>
          </button>
        </>
      )}
    </>
  );
}
