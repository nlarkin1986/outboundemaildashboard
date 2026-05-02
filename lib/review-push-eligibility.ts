import { BDR_PLAY_ID } from '@/lib/plays/bdr/types';

export const SENDABLE_APPROVED_CONTACT_ERROR = 'At least one approved contact with a real email and sendable sequence is required before submit';

export type PushEligibilityContact = {
  status: string;
  email?: string;
  sequence_code?: string;
  play_metadata?: Record<string, unknown>;
};

export function hasRealEmail(contact: PushEligibilityContact) {
  return Boolean(contact.email && !contact.email.endsWith('.invalid'));
}

export function isBdrSequenceBlocked(contact: PushEligibilityContact, runPlayId?: string) {
  return (runPlayId === BDR_PLAY_ID || contact.play_metadata?.play_id === BDR_PLAY_ID) && !contact.sequence_code;
}

export function isSendableApprovedContact(contact: PushEligibilityContact, runPlayId?: string) {
  return contact.status === 'approved' && hasRealEmail(contact) && !isBdrSequenceBlocked(contact, runPlayId);
}
