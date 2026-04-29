import { describe, expect, it } from 'vitest';
import { nextContactId, nextBatchSelection } from '@/lib/review-navigation';

describe('review submission navigation', () => {
  it('moves to the next contact after submitting the current sequence', () => {
    expect(nextContactId(['contact_1', 'contact_2', 'contact_3'], 'contact_1')).toBe('contact_2');
  });

  it('stays on the final contact when there is no next sequence', () => {
    expect(nextContactId(['contact_1', 'contact_2'], 'contact_2')).toBe('contact_2');
  });

  it('moves to the next contact in the same batch run first', () => {
    expect(nextBatchSelection([
      { runId: 'run_1', contactId: 'contact_1' },
      { runId: 'run_1', contactId: 'contact_2' },
      { runId: 'run_2', contactId: 'contact_3' },
    ], { runId: 'run_1', contactId: 'contact_1' })).toEqual({ runId: 'run_1', contactId: 'contact_2' });
  });

  it('moves to the first contact in the next batch run after the current run is complete', () => {
    expect(nextBatchSelection([
      { runId: 'run_1', contactId: 'contact_1' },
      { runId: 'run_2', contactId: 'contact_2' },
    ], { runId: 'run_1', contactId: 'contact_1' })).toEqual({ runId: 'run_2', contactId: 'contact_2' });
  });
});
