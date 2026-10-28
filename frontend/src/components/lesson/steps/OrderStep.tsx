'use client';

import { useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useLang } from '@/i18n/client';
import { LESSON } from '../copy';
import { LessonBar } from '../LessonBar';
import { feel } from '../feel';

/**
 * A fixed shuffle, so the server and the browser start from the same order, and never the answer:
 * reversed, then the middle pair swapped (for three items that is still a real puzzle).
 */
export function shuffled(n: number): number[] {
  const order = Array.from({ length: n }, (_, i) => n - 1 - i);
  if (n >= 4) [order[1], order[2]] = [order[2], order[1]];
  return order;
}

/** Moves the item at `from` to `to`, shifting the ones in between. */
export function move<T>(list: T[], from: number, to: number): T[] {
  const out = [...list];
  const [it] = out.splice(from, 1);
  out.splice(to, 0, it);
  return out;
}

/**
 * Drag the cards into order (or move them with the arrow buttons / keys), then check. Each card in
 * its right place turns green; the others show the place they belong in.
 */
export function OrderStep({
  question,
  ordered,
  top,
  bottom,
  explain,
  onDone,
}: {
  question: string;
  ordered: string[];
  top: string;
  bottom: string;
  explain: string;
  onDone: (correct: boolean) => void;
}) {
  const [order, setOrder] = useState(() => shuffled(ordered.length));
  const [touched, setTouched] = useState(false);
  const [checked, setChecked] = useState(false);
  const [drag, setDrag] = useState<{ from: number; y0: number; dy: number; h: number }>();
  const list = useRef<HTMLOListElement>(null);
  const t = LESSON[useLang().lang];
  const placed = order.filter((n, i) => n === i).length;
  const right = placed === ordered.length;

  const shift = (from: number, to: number) => {
    if (checked || to < 0 || to >= order.length || to === from) return;
    setOrder((o) => move(o, from, to));
    setTouched(true);
  };
  // where the dragged card would land, from how far it has moved
  const target = drag ? Math.max(0, Math.min(order.length - 1, drag.from + Math.round(drag.dy / drag.h))) : -1;

  function offset(i: number): number {
    if (!drag) return 0;
    if (i === drag.from) return drag.dy;
    if (drag.from < i && i <= target) return -drag.h;
    if (target <= i && i < drag.from) return drag.h;
    return 0;
  }

  return (
    <>
      <h1 className="lesson-q">{question}</h1>
      <span className="lesson-hint">{t.order}</span>
      <div className="order">
        <span className="order-end">
          <Icon name="arrowUp" size={14} /> {top}
        </span>
        <ol className="order-list" ref={list}>
          {order.map((n, i) => {
            const state = checked ? (n === i ? 'correct' : 'wrong') : undefined;
            return (
              <li
                key={n}
                className="order-item"
                data-state={state}
                data-dragging={drag?.from === i || undefined}
                style={drag ? { transform: `translateY(${offset(i)}px)`, transition: drag.from === i ? 'none' : undefined } : undefined}
                onPointerDown={(e) => {
                  if (checked || (e.target as HTMLElement).closest('button')) return;
                  const rows = list.current?.children;
                  const h = rows && rows.length > 1 ? (rows[1] as HTMLElement).offsetTop - (rows[0] as HTMLElement).offsetTop : 64;
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDrag({ from: i, y0: e.clientY, dy: 0, h });
                }}
                onPointerMove={(e) => drag && setDrag({ ...drag, dy: e.clientY - drag.y0 })}
                onPointerUp={() => {
                  if (!drag) return;
                  shift(drag.from, target);
                  setDrag(undefined);
                }}
                onPointerCancel={() => setDrag(undefined)}
              >
                <span className="order-grip" aria-hidden="true">
                  {checked ? (n === i ? <Icon name="check" size={18} /> : n + 1) : <Icon name="grip" size={18} />}
                </span>
                <span className="order-label">{ordered[n]}</span>
                {!checked && (
                  <span className="order-moves">
                    <button type="button" aria-label={t.moveUp(ordered[n])} disabled={i === 0} onClick={() => shift(i, i - 1)}>
                      <Icon name="arrowUp" size={16} />
                    </button>
                    <button type="button" aria-label={t.moveDown(ordered[n])} disabled={i === order.length - 1} onClick={() => shift(i, i + 1)}>
                      <Icon name="arrowDown" size={16} />
                    </button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <span className="order-end">
          <Icon name="arrowDown" size={14} /> {bottom}
        </span>
      </div>
      {checked ? (
        <LessonBar
          tone={right ? 'correct' : 'wrong'}
          title={right ? t.orderRight : t.orderWrong(placed, ordered.length)}
          body={explain}
          label={t.continue}
          onClick={() => onDone(right)}
        />
      ) : (
        <LessonBar
          label={t.check}
          disabled={!touched}
          hint={t.dragHint}
          onClick={() => {
            setChecked(true);
            feel(right ? 'right' : 'wrong');
          }}
        />
      )}
    </>
  );
}
