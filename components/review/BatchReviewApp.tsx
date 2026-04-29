'use client';

import { useMemo, useState } from 'react';
import type { BatchReviewState, ReviewContact } from '@/lib/types';

function stripHtml(html: string) {
  if (typeof document === 'undefined') return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const el = document.createElement('div');
  el.innerHTML = html;
  return (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
}

function statusLabel(status: ReviewContact['status']) {
  if (status === 'needs_edit') return 'Needs edit';
  if (status === 'approved') return 'Approved';
  return 'Skipped';
}

export function BatchReviewApp({ initialState, token }: { initialState: BatchReviewState; token: string }) {
  const [state, setState] = useState(initialState);
  const firstContact = state.runs.flatMap((r) => r.review.contacts.map((c) => ({ runId: r.run_id, contactId: c.id }))).at(0);
  const [selected, setSelected] = useState(firstContact);
  const [message, setMessage] = useState('Review only. No Instantly push has been made from the browser.');
  const selectedRun = state.runs.find((r) => r.run_id === selected?.runId) ?? state.runs[0];
  const selectedContact = selectedRun?.review.contacts.find((c) => c.id === selected?.contactId) ?? selectedRun?.review.contacts[0];

  const counts = useMemo(() => {
    const contacts = state.runs.flatMap((r) => r.review.contacts);
    return {
      companies: state.runs.length,
      contacts: contacts.length,
      approved: contacts.filter((c) => c.status === 'approved').length,
      needsEdit: contacts.filter((c) => c.status === 'needs_edit').length,
      skipped: contacts.filter((c) => c.status === 'skipped').length,
      readyToPush: contacts.filter((c) => c.status === 'approved' && !c.email.endsWith('.invalid')).length,
    };
  }, [state]);

  function updateContact(runId: string, contactId: string, patch: Partial<ReviewContact>) {
    setState((current) => ({
      ...current,
      runs: current.runs.map((run) => run.run_id !== runId ? run : {
        ...run,
        review: { ...run.review, contacts: run.review.contacts.map((contact) => contact.id === contactId ? { ...contact, ...patch } : contact) },
      }),
    }));
  }

  function updateEmail(runId: string, contactId: string, step: number, patch: { subject?: string; body_html?: string }) {
    setState((current) => ({
      ...current,
      runs: current.runs.map((run) => run.run_id !== runId ? run : {
        ...run,
        review: {
          ...run.review,
          contacts: run.review.contacts.map((contact) => contact.id !== contactId ? contact : {
            ...contact,
            emails: contact.emails.map((email) => email.step_number === step ? { ...email, ...patch, body_text: patch.body_html ? stripHtml(patch.body_html) : email.body_text } : email),
          }),
        },
      }),
    }));
  }

  async function save() {
    const payload = { runs: state.runs.map((run) => ({ run_id: run.run_id, contacts: run.review.contacts })) };
    const res = await fetch(`/api/review/batch/${token}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? 'Save failed');
    setMessage(`Saved at ${new Date(body.saved_at).toLocaleTimeString()}. No Instantly push has been made yet.`);
  }

  async function submit() {
    await save();
    const res = await fetch(`/api/review/batch/${token}/submit`, { method: 'POST' });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? 'Submit failed');
    setMessage(body.message ?? `${body.approved_contacts} approved contacts queued for server-side Instantly push.`);
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
    download(`${state.batch.id}-approved.json`, JSON.stringify(state.runs.flatMap((r) => r.review.contacts.filter((c) => c.status === 'approved').map((c) => ({ company_name: r.company_name, ...c, run_id: r.run_id }))), null, 2), 'application/json');
  }

  function exportCsv() {
    const rows = [['company','email','first_name','last_name','title','status','subject_1','body_1','subject_2','body_2','subject_3','body_3']];
    for (const run of state.runs) for (const c of run.review.contacts) rows.push([run.company_name, c.email, c.first_name ?? '', c.last_name ?? '', c.title ?? '', c.status, ...c.emails.flatMap((e) => [e.subject, stripHtml(e.body_html)])]);
    download(`${state.batch.id}-review.csv`, rows.map((r) => r.map((v) => `"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'), 'text/csv');
  }

  if (!selectedRun || !selectedContact) {
    return <main className="reviewShell emptyReview"><div className="reviewCard">Batch has no generated runs yet.</div></main>;
  }

  return <main className="reviewShell">
    <header className="reviewTopbar">
      <a className="backLink" href="/admin/runs"><span aria-hidden="true">‹</span><span>Runs</span></a>
      <div className="gladlyLogo" aria-label="Gladly"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#009b00"/><path d="M12 7v10M7 12h10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg><span>Gladly</span></div>
      <div className="topbarRight"><span className="safeBadge">Batch review only</span><div className="avatar">NL</div></div>
    </header>

    <aside className="reviewSidebar">
      <h2>Batch Review</h2>
      <div className="sidebarSectionLabel">Companies</div>
      <nav className="sidebarNav" aria-label="Companies">
        {state.runs.map((run) => <a key={run.run_id} className={run.run_id === selectedRun.run_id ? 'active' : ''} href="#contacts" onClick={(e) => { e.preventDefault(); setSelected({ runId: run.run_id, contactId: run.review.contacts[0]?.id }); }}>{run.company_name}</a>)}
      </nav>
      <div className="sidebarNote"><strong>No browser push.</strong><span>Submit approved contacts for server-side Instantly push.</span></div>
    </aside>

    <section className="reviewMain">
      <div className="pageHeader">
        <div><span className="badge activeBadge">{state.batch.status}</span><h1>Outbound batch</h1><p>{message}</p></div>
        <div className="pageActions" id="submit">
          <button className="buttonSecondary" onClick={() => save().catch((e) => setMessage(e.message))}>Save</button>
          <button className="buttonSecondary" onClick={exportCsv}>Download CSV</button>
          <button className="buttonSecondary" onClick={exportJson}>Download approved JSON</button>
          <button className="buttonPrimary" onClick={() => submit().catch((e) => setMessage(e.message))}>Submit approved contacts for server-side Instantly push</button>
        </div>
      </div>

      <section className="metricGrid" aria-label="Batch counts">
        <div className="metricCard"><span>Companies</span><strong>{counts.companies}</strong></div>
        <div className="metricCard"><span>Contacts</span><strong>{counts.contacts}</strong></div>
        <div className="metricCard"><span>Approved</span><strong>{counts.approved}</strong></div>
        <div className="metricCard"><span>Needs edit</span><strong>{counts.needsEdit}</strong></div>
        <div className="metricCard"><span>Skipped</span><strong>{counts.skipped}</strong></div>
        <div className="metricCard"><span>Ready to push</span><strong>{counts.readyToPush}</strong></div>
      </section>

      <div className="reviewWorkspace">
        <aside className="contactPanel reviewCard" id="contacts">
          <div className="panelHeader"><div><h3>{selectedRun.company_name}</h3><p>{selectedRun.review.contacts.length} contact(s)</p></div></div>
          <div className="contactList">
            {selectedRun.review.contacts.map((contact) => <button key={contact.id} className={`contactItem ${selectedContact.id === contact.id ? 'selected' : ''}`} onClick={() => setSelected({ runId: selectedRun.run_id, contactId: contact.id })}>
              <span className="contactAvatar">{(contact.first_name?.[0] ?? 'C').toUpperCase()}</span>
              <span className="contactCopy"><strong>{contact.first_name} {contact.last_name}</strong><small>{contact.email} · {statusLabel(contact.status)}</small></span>
            </button>)}
          </div>
        </aside>

        <section className="detailPanel">
          <div className="reviewCard selectedHeader">
            <div><div className="sectionEyebrow">Selected contact</div><h2>{selectedContact.first_name} {selectedContact.last_name}</h2><p>{selectedContact.title} · {selectedContact.email}</p></div>
            <div className="statusButtons">{(['approved','needs_edit','skipped'] as const).map((status) => <button key={status} className={selectedContact.status === status ? 'active' : ''} onClick={() => updateContact(selectedRun.run_id, selectedContact.id, { status })}>{statusLabel(status)}</button>)}</div>
          </div>
          <div className="reviewCard evidenceCard">
            <div className="panelTitleRow"><div><div className="sectionEyebrow">Evidence and angle</div><h3>Review before approving</h3></div>{selectedContact.qa_warnings.length ? <span className="badge warningBadge">Warnings</span> : <span className="badge activeBadge">No QA warnings</span>}</div>
            <div className="fieldGrid">
              <label>Primary angle<textarea value={selectedContact.primary_angle ?? ''} onChange={(e) => updateContact(selectedRun.run_id, selectedContact.id, { primary_angle: e.target.value })} /></label>
              <label>Opening hook<textarea value={selectedContact.opening_hook ?? ''} onChange={(e) => updateContact(selectedRun.run_id, selectedContact.id, { opening_hook: e.target.value })} /></label>
              <label>Proof used<textarea value={selectedContact.proof_used ?? ''} onChange={(e) => updateContact(selectedRun.run_id, selectedContact.id, { proof_used: e.target.value })} /></label>
              <label>Guardrail<textarea value={selectedContact.guardrail ?? ''} onChange={(e) => updateContact(selectedRun.run_id, selectedContact.id, { guardrail: e.target.value })} /></label>
            </div>
            {selectedContact.qa_warnings.length ? <div className="warningCallout">{selectedContact.qa_warnings.join(', ')}</div> : null}
          </div>
          <div className="emailStack">
            {selectedContact.emails.map((email) => <div className="reviewCard emailCard" key={email.id}>
              <div className="emailHeader"><div><div className="sectionEyebrow">Email {email.step_number}</div><h3>{email.subject}</h3></div><span className="badge neutralBadge">Draft</span></div>
              <div className="emailGrid"><div className="emailEditor"><label>Subject<input value={email.subject} onChange={(e) => updateEmail(selectedRun.run_id, selectedContact.id, email.step_number, { subject: e.target.value })} /></label><label>Body HTML<textarea rows={9} value={email.body_html} onChange={(e) => updateEmail(selectedRun.run_id, selectedContact.id, email.step_number, { body_html: e.target.value })} /></label></div><div className="previewPane"><div className="sectionEyebrow">Rendered preview</div><h4>{email.subject}</h4><p>{stripHtml(email.body_html)}</p></div></div>
            </div>)}
          </div>
        </section>
      </div>
    </section>
  </main>;
}
