import type { InstantlyPushPayload } from '@/lib/types';

export type InstantlyResult = { instantly_lead_id?: string; campaign_paused: boolean; raw?: unknown };

export async function pushLeadToInstantly(payload: InstantlyPushPayload): Promise<InstantlyResult> {
  const apiKey = process.env.INSTANTLY_API_KEY;
  if (!apiKey) throw new Error('INSTANTLY_API_KEY is not set');

  // Instantly account payloads vary by workspace/API version. This seam keeps the browser away from secrets
  // and centralizes mapping/idempotency for engineering to finish against the confirmed endpoint.
  const response = await fetch('https://api.instantly.ai/api/v2/leads', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: payload.email,
      first_name: payload.first_name,
      last_name: payload.last_name,
      company_name: payload.company,
      campaign: payload.campaign_id,
      custom_variables: {
        title: payload.title,
        sequence_subject_1: payload.emails[0]?.subject,
        sequence_body_1: payload.emails[0]?.body_text,
        sequence_step_label_1: payload.emails[0]?.step_label,
        sequence_original_step_1: payload.emails[0]?.original_step_number,
        sequence_subject_2: payload.emails[1]?.subject,
        sequence_body_2: payload.emails[1]?.body_text,
        sequence_step_label_2: payload.emails[1]?.step_label,
        sequence_original_step_2: payload.emails[1]?.original_step_number,
        sequence_subject_3: payload.emails[2]?.subject,
        sequence_body_3: payload.emails[2]?.body_text,
        sequence_step_label_3: payload.emails[2]?.step_label,
        sequence_original_step_3: payload.emails[2]?.original_step_number,
        idempotency_key: payload.idempotency_key,
      },
    }),
  });
  const raw = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Instantly push failed: ${response.status} ${JSON.stringify(raw)}`);
  const campaignPaused = raw?.campaign_paused === true || raw?.campaign?.status === 'paused' || raw?.campaign_status === 'paused';
  if (!campaignPaused) throw new Error('Instantly response did not confirm campaign_paused=true or campaign status paused');
  return { instantly_lead_id: raw.id ?? raw.lead_id, campaign_paused: true, raw };
}
