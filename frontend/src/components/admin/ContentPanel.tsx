'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ContentItem, ContentKind, ContentStatus } from '@/contract';
import { useLang } from '@/i18n/client';
import { copy } from '@/i18n/lang';
import type { AdminCall } from './api';

const T = copy(
  {
    loading: 'Se încarcă…',
    sub: {
      moments: 'Lecțiile din Momente. O lecție fără pași apare ca „în curând”. Validarea e pe server, aceleași reguli ca testele.',
      news: 'Știrile din Știri. Validarea e pe server.',
    } as Record<ContentKind, string>,
    new: 'Adaugă',
    edit: 'Editează',
    publish: 'Publică',
    unpublish: 'Trece în ciornă',
    delete: 'Șterge',
    confirmDelete: (id: string) => `Ștergi „${id}”? Nu se poate anula.`,
    status: { draft: 'Ciornă', published: 'Publicat' } as Record<ContentStatus, string>,
    updated: (when: string, by: string) => `actualizat ${when}${by ? `, de ${by}` : ''}`,
    position: 'Poziție',
    statusLabel: 'Stare',
    doc: 'Conținut (JSON)',
    docHint: 'Id-ul nu se poate schimba după creare. Pentru o lecție nouă, pornești de la o copie a primei lecții.',
    save: 'Salvează',
    cancel: 'Renunță',
    badJson: (msg: string) => `JSON invalid: ${msg}`,
    empty: 'Nimic încă.',
    newId: 'id-nou',
  },
  {
    loading: 'Loading…',
    sub: {
      moments: 'The lessons in Momente. A lesson with no steps shows as "coming soon". The server validates with the same rules as the tests.',
      news: 'The items in Știri. The server validates them.',
    },
    new: 'Add',
    edit: 'Edit',
    publish: 'Publish',
    unpublish: 'Back to draft',
    delete: 'Delete',
    confirmDelete: (id) => `Delete "${id}"? This can't be undone.`,
    status: { draft: 'Draft', published: 'Published' },
    updated: (when, by) => `updated ${when}${by ? ` by ${by}` : ''}`,
    position: 'Position',
    statusLabel: 'Status',
    doc: 'Content (JSON)',
    docHint: "The id can't change once created. A new lesson starts from a copy of the first one.",
    save: 'Save',
    cancel: 'Cancel',
    badJson: (msg) => `Invalid JSON: ${msg}`,
    empty: 'Nothing yet.',
    newId: 'new-id',
  },
);

type Doc = { id?: string; title?: string } & Record<string, unknown>;
type Item = ContentItem<Doc>;
/** What the editor holds: an existing item, or a new one (id undefined). */
type Draft = { id?: string; status: ContentStatus; position: string; json: string };

/** Lessons or news: list (drafts included), publish, edit as JSON, add, delete. */
export function ContentPanel({ kind, call }: { kind: ContentKind; call: AdminCall }) {
  const t = T[useLang().lang];
  const [items, setItems] = useState<Item[]>();
  const [draft, setDraft] = useState<Draft>();
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const r = await call<{ items: Item[] }>(`/content/${kind}`);
    if (r.ok) setItems(r.data.items ?? []);
    else setError(r.data.error ?? String(r.status));
  }, [call, kind]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(path: string, method: string, body: unknown) {
    setError('');
    const r = await call(path, { method, body });
    if (!r.ok) {
      setError(r.data.error ?? String(r.status));
      return false;
    }
    await load();
    return true;
  }

  async function submitDraft() {
    if (!draft) return;
    let doc: Doc;
    try {
      doc = JSON.parse(draft.json);
    } catch (e) {
      setError(t.badJson((e as Error).message));
      return;
    }
    const position = draft.position.trim() === '' ? undefined : Number(draft.position);
    const body = { status: draft.status, position, doc };
    const ok = draft.id ? await save(`/content/${kind}/${encodeURIComponent(draft.id)}`, 'PUT', body) : await save(`/content/${kind}`, 'POST', body);
    if (ok) setDraft(undefined);
  }

  function startNew() {
    const template: Doc = items?.[0] ? { ...items[0].doc, id: t.newId } : {};
    setError('');
    setDraft({ status: 'draft', position: '', json: JSON.stringify(template, null, 2) });
  }

  function startEdit(it: Item) {
    setError('');
    setDraft({ id: it.id, status: it.status, position: String(it.position), json: JSON.stringify(it.doc, null, 2) });
  }

  async function toggle(it: Item) {
    await save(`/content/${kind}/${encodeURIComponent(it.id)}`, 'PUT', {
      status: it.status === 'published' ? 'draft' : 'published',
      position: it.position,
      doc: it.doc,
    });
  }

  async function remove(it: Item) {
    if (!window.confirm(t.confirmDelete(it.id))) return;
    await save(`/content/${kind}/${encodeURIComponent(it.id)}`, 'DELETE', undefined);
  }

  if (draft) {
    return (
      <section className="card stack">
        <h2>{draft.id ?? t.new}</h2>
        <div className="grid2">
          <label>
            {t.statusLabel}
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ContentStatus })}>
              <option value="draft">{t.status.draft}</option>
              <option value="published">{t.status.published}</option>
            </select>
          </label>
          <label>
            {t.position}
            <input type="number" value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} />
          </label>
        </div>
        <label>
          {t.doc}
          <textarea className="admin-json" spellCheck={false} value={draft.json} onChange={(e) => setDraft({ ...draft, json: e.target.value })} />
        </label>
        <p className="note">{t.docHint}</p>
        {error && <p className="error">{error}</p>}
        <div className="row-start">
          <button className="btn btn-primary btn-sm" onClick={submitDraft}>
            {t.save}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setDraft(undefined)}>
            {t.cancel}
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="stack">
      <div className="row">
        <p className="small muted">{t.sub[kind]}</p>
        <button className="btn btn-primary btn-sm" onClick={startNew} disabled={!items}>
          {t.new}
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {!items && !error && <p className="muted">{t.loading}</p>}
      {items?.length === 0 && <p className="muted">{t.empty}</p>}
      {items?.map((it) => (
        <section key={it.id} className="card admin-item">
          <div className="row">
            <span>
              <strong>{it.doc.title ?? it.id}</strong>
              <br />
              <span className="small muted">
                {it.id} · #{it.position} · {t.updated(it.updatedAt.slice(0, 10), it.updatedBy)}
              </span>
            </span>
            <span className={`tag ${it.status === 'published' ? 'tag-done' : 'tag-progress'}`}>{t.status[it.status]}</span>
          </div>
          <div className="row-start">
            <button className="btn btn-secondary btn-sm" onClick={() => startEdit(it)}>
              {t.edit}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => toggle(it)}>
              {it.status === 'published' ? t.unpublish : t.publish}
            </button>
            <button className="btn btn-text" onClick={() => remove(it)}>
              {t.delete}
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
