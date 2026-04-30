'use client';

import { useMemo, useState } from 'react';
import { editableTextToHtml, emailParagraphs, stripEmailHtml } from '@/lib/email-format';
import { normalizeReviewStateForEditing } from '@/lib/review-editor-state';
import { nextContactId } from '@/lib/review-navigation';
import type { ReviewContact, ReviewState } from '@/lib/types';

function initials(contact: ReviewContact) {
  return `${contact.first_name?.[0] ?? ''}${contact.last_name?.[0] ?? ''}`.toUpperCase() || 'C';
}

function statusLabel(status: ReviewContact['status']) {
  if (status === 'needs_edit') return 'Needs edit';
  if (status === 'approved') return 'Approved';
  return 'Skipped';
}

function statusClass(status: ReviewContact['status']) {
  if (status === 'approved') return 'approved';
  if (status === 'skipped') return 'skipped';
  return 'needsEdit';
}

function emailDisplayLabel(email: ReviewContact['emails'][number]) {
  return email.step_label ?? `Email ${email.step_number}`;
}

export function ReviewApp({ initialState, token }: { initialState: ReviewState; token: string }) {
  const [state, setState] = useState(() => normalizeReviewStateForEditing(initialState));
  const [selectedId, setSelectedId] = useState(initialState.contacts[0]?.id);
  const [filter, setFilter] = useState<'all' | 'approved' | 'needs_edit' | 'skipped' | 'warnings'>('all');
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('No Instantly push has been made yet.');
  const [popup, setPopup] = useState<string | null>(null);
  const selected = state.contacts.find((c) => c.id === selectedId) ?? state.contacts[0];

  const counts = useMemo(() => ({
    total: state.contacts.length,
    approved: state.contacts.filter((c) => c.status === 'approved').length,
    needs_edit: state.contacts.filter((c) => c.status === 'needs_edit').length,
    skipped: state.contacts.filter((c) => c.status === 'skipped').length,
    warnings: state.contacts.filter((c) => c.qa_warnings.length > 0).length,
  }), [state.contacts]);

  const visible = state.contacts.filter((contact) => {
    const text = `${contact.first_name ?? ''} ${contact.last_name ?? ''} ${contact.company ?? ''} ${contact.email} ${contact.primary_angle ?? ''}`.toLowerCase();
    const matchesSearch = text.includes(query.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'warnings' ? contact.qa_warnings.length > 0 : contact.status === filter);
    return matchesSearch && matchesFilter;
  });

  function updateContact(id: string, patch: Partial<ReviewContact>) {
    setState((current) => ({ ...current, contacts: current.contacts.map((c) => c.id === id ? { ...c, ...patch } : c) }));
  }

  function updateEmail(contactId: string, step: number, patch: { subject?: string; body_html?: string; body_text?: string }) {
    setState((current) => ({
      ...current,
      contacts: current.contacts.map((c) => c.id !== contactId ? c : {
        ...c,
        emails: c.emails.map((email) => email.step_number === step ? { ...email, ...patch, body_text: patch.body_text ?? (patch.body_html ? stripEmailHtml(patch.body_html) : email.body_text) } : email),
      }),
    }));
  }

  async function save() {
    const res = await fetch(`/api/review/${token}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contacts: state.contacts }) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? 'Save failed');
    setMessage(`Saved at ${new Date(body.saved_at).toLocaleTimeString()}. No Instantly push has been made yet.`);
  }

  async function submit() {
    await save();
    const res = await fetch(`/api/review/${token}/submit`, { method: 'POST' });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? 'Submit failed');
    const nextId = nextContactId(state.contacts.map((contact) => contact.id), selected.id);
    const advanced = nextId && nextId !== selected.id;
    if (nextId) setSelectedId(nextId);
    setPopup(advanced ? 'Sequence submitted. Moving to the next sequence.' : 'Sequence submitted. You are on the final sequence.');
    setMessage(`${body.approved_count} approved contact(s) queued for server-side Instantly push. Campaign remains paused.`);
  }

  function download(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    download(`${state.run.company_name}-approved.json`, JSON.stringify(state.contacts.filter((c) => c.status === 'approved'), null, 2), 'application/json');
  }

  function exportCsv() {
    const maxEmails = Math.max(0, ...state.contacts.map((contact) => contact.emails.length));
    const emailHeaders = Array.from({ length: maxEmails }, (_, index) => [`email_${index + 1}_label`, `subject_${index + 1}`, `body_${index + 1}`]).flat();
    const rows = [['email','first_name','last_name','company','title','status','sequence_code',...emailHeaders]];
    for (const c of state.contacts) {
      const emailValues = Array.from({ length: maxEmails }, (_, index) => {
        const email = c.emails[index];
        return email ? [emailDisplayLabel(email), email.subject, stripEmailHtml(email.body_html)] : ['', '', ''];
      }).flat();
      rows.push([c.email, c.first_name ?? '', c.last_name ?? '', c.company ?? '', c.title ?? '', c.status, c.sequence_code ?? '', ...emailValues]);
    }
    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');
    download(`${state.run.company_name}-review.csv`, csv, 'text/csv');
  }

  if (!selected) {
    return <main className="reviewShell emptyReview"><div className="reviewCard">No contacts found.</div></main>;
  }

  return <main className="reviewShell">
    <header className="reviewTopbar">
      <a className="backLink" href="/admin/runs" aria-label="Back to runs">
        <span aria-hidden="true">‹</span>
        <span>Runs</span>
      </a>
      <div className="gladlyLogo" aria-label="Gladly">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#009b00"/><path d="M12 7v10M7 12h10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
        <span>Gladly</span>
      </div>
      <div className="topbarRight"><span className="safeBadge">Review only</span><div className="avatar">NL</div></div>
    </header>

    <aside className="reviewSidebar">
      <h2>Outbound Review</h2>
      <div className="sidebarSectionLabel">Queue</div>
      <nav className="sidebarNav" aria-label="Review sections">
        <a className="active" href="#contacts">Contacts</a>
        <a href="#evidence">Evidence</a>
        <a href="#emails">Email drafts</a>
        <a href="#submit">Approval</a>
      </nav>
      <div className="sidebarNote">
        <strong>No vendor push from browser.</strong>
        <span>Approvals are saved to the backend before the server-side worker pushes to Instantly.</span>
      </div>
    </aside>

    <section className="reviewMain">
      {popup ? <div className="submissionPopup" role="status" aria-live="polite">
        <div><strong>{popup}</strong><span>Your approval has been saved. The next step runs securely in the background.</span></div>
        <button type="button" aria-label="Dismiss submission message" onClick={() => setPopup(null)}>×</button>
      </div> : null}
      <div className="pageHeader">
        <div>
          <span className="badge activeBadge">Active review</span>
          <h1>{state.run.company_name}</h1>
          <p>{message}</p>
        </div>
        <div className="pageActions" id="submit">
          <button className="buttonSecondary" onClick={() => save().catch((e) => setMessage(e.message))}>Save</button>
          <button className="buttonSecondary" onClick={exportCsv}>Download CSV</button>
          <button className="buttonSecondary" onClick={exportJson}>Download approved JSON</button>
          <button className="buttonPrimary" onClick={() => submit().catch((e) => setMessage(e.message))}>Submit {counts.approved} approved</button>
        </div>
      </div>

      <section className="metricGrid" aria-label="Review counts">
        <div className="metricCard"><span>Total</span><strong>{counts.total}</strong></div>
        <div className="metricCard"><span>Approved</span><strong>{counts.approved}</strong></div>
        <div className="metricCard"><span>Needs edit</span><strong>{counts.needs_edit}</strong></div>
        <div className="metricCard"><span>Skipped</span><strong>{counts.skipped}</strong></div>
        <div className="metricCard"><span>Warnings</span><strong>{counts.warnings}</strong></div>
      </section>

      <div className="reviewWorkspace">
        <aside className="contactPanel reviewCard" id="contacts">
          <div className="panelHeader">
            <div>
              <h3>Contacts</h3>
              <p>{visible.length} visible</p>
            </div>
          </div>
          <div className="searchField">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts, companies, angles…" />
          </div>
          <div className="filterTabs" role="tablist" aria-label="Contact filters">
            {(['all','approved','needs_edit','skipped','warnings'] as const).map((item) => <button key={item} className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item.replace('_',' ')}</button>)}
          </div>
          <div className="contactList">
            {visible.map((contact) => <button key={contact.id} className={`contactItem ${selected.id === contact.id ? 'selected' : ''}`} onClick={() => setSelectedId(contact.id)}>
              <span className="contactAvatar">{initials(contact)}</span>
              <span className="contactCopy"><strong>{contact.first_name} {contact.last_name}</strong><small>{contact.company} · {statusLabel(contact.status)}</small></span>
              <span className={`statusDot ${statusClass(contact.status)}`} aria-hidden="true" />
            </button>)}
          </div>
        </aside>

        <section className="detailPanel">
          <div className="reviewCard selectedHeader">
            <div className="selectedIdentity">
              <div className="largeAvatar">{initials(selected)}</div>
              <div>
                <div className="sectionEyebrow">Selected contact</div>
                <h2>{selected.first_name} {selected.last_name}</h2>
                <p>{selected.title} · {selected.email}</p>
              </div>
            </div>
            <div className="statusButtons" aria-label="Approval status">
              {(['approved','needs_edit','skipped'] as const).map((status) => <button key={status} className={selected.status === status ? `active ${statusClass(status)}` : ''} onClick={() => updateContact(selected.id, { status })}>{statusLabel(status)}</button>)}
            </div>
          </div>

          <div className="reviewCard evidenceCard" id="evidence">
            <div className="panelTitleRow">
              <div>
                <div className="sectionEyebrow">Evidence and angle</div>
                <h3>Review the claim before approving</h3>
              </div>
              {selected.qa_warnings.length ? <span className="badge warningBadge">Warnings</span> : <span className="badge activeBadge">No QA warnings</span>}
            </div>
            <div className="fieldGrid">
              <label>Primary angle<textarea value={selected.primary_angle ?? ''} onChange={(e) => updateContact(selected.id, { primary_angle: e.target.value })} /></label>
              <label>Opening hook<textarea value={selected.opening_hook ?? ''} onChange={(e) => updateContact(selected.id, { opening_hook: e.target.value })} /></label>
              <label>Proof used<textarea value={selected.proof_used ?? ''} onChange={(e) => updateContact(selected.id, { proof_used: e.target.value })} /></label>
              <label>Guardrail<textarea value={selected.guardrail ?? ''} onChange={(e) => updateContact(selected.id, { guardrail: e.target.value })} /></label>
            </div>
            {selected.qa_warnings.length ? <div className="warningCallout">{selected.qa_warnings.join(', ')}</div> : <div className="okCallout">This draft has no QA warnings. Confirm evidence still matches the outbound claim.</div>}
          </div>

          <div className="emailStack" id="emails">
            {selected.emails.map((email) => <div className="reviewCard emailCard" key={email.id}>
              <div className="emailHeader">
                <div><div className="sectionEyebrow">{emailDisplayLabel(email)}</div><h3>{email.subject}</h3></div>
                <span className="badge neutralBadge">Draft</span>
              </div>
              <div className="emailGrid">
                <div className="emailEditor">
                  <label>Subject<input value={email.subject} onChange={(e) => updateEmail(selected.id, email.step_number, { subject: e.target.value })} /></label>
                  <label>Body text<textarea rows={9} value={email.body_text} onChange={(e) => updateEmail(selected.id, email.step_number, { body_text: e.target.value, body_html: editableTextToHtml(e.target.value) })} /></label>
                </div>
                <div className="previewPane">
                  <div className="sectionEyebrow">Rendered preview</div>
                  <div className="emailPreviewFrame">
                    <div className="emailPreviewMeta">
                      <span>Subject</span>
                      <strong>{email.subject}</strong>
                    </div>
                    <div className="emailPreviewBody">
                      {emailParagraphs(email.body_html).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
                    </div>
                  </div>
                </div>
              </div>
            </div>)}
          </div>
        </section>
      </div>
    </section>
  </main>;
}
