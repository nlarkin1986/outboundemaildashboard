import { htmlToEditableText } from '@/lib/email-format';
import type { BatchReviewState, ReviewContact, ReviewState } from '@/lib/types';

export function normalizeReviewStateForEditing(state: ReviewState): ReviewState {
  return {
    ...state,
    contacts: state.contacts.map(normalizeContactForEditing),
  };
}

export function normalizeBatchReviewStateForEditing(state: BatchReviewState): BatchReviewState {
  return {
    ...state,
    runs: state.runs.map((run) => ({
      ...run,
      review: normalizeReviewStateForEditing(run.review),
    })),
  };
}

function normalizeContactForEditing(contact: ReviewContact): ReviewContact {
  return {
    ...contact,
    emails: contact.emails.map((email) => ({
      ...email,
      body_text: htmlToEditableText(email.body_html),
    })),
  };
}
