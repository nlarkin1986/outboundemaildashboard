import Link from 'next/link';
import { appBaseUrl, coworkDeepLinkForBatch, dashboardStatusUrl, pollingMetadata } from '@/lib/cowork/continuation';
import { getBatchById, getRun, listBatchRuns, listRuns, reviewUrlForRun } from '@/lib/store';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ batch_id?: string; requested_by?: string }>;

function relativeAppUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : 'unknown';
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="card" style={{ padding: 16 }}><p className="eyebrow">{label}</p><strong>{value}</strong></div>;
}

export default async function RunsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const batch = params.batch_id ? await getBatchById(params.batch_id) : null;
  const batchRuns = batch ? await listBatchRuns(batch.id) : [];
  const rows = batch
    ? await Promise.all(batchRuns.map(async (batchRun) => {
      const run = await getRun(batchRun.run_id);
      return {
        batchRun,
        run,
        contact_count: run?.contacts.length ?? 0,
        approved_count: run?.contacts.filter((contact) => contact.status === 'approved').length ?? 0,
      };
    }))
    : (await listRuns()).map((run) => ({
      batchRun: null,
      run,
      contact_count: run.contact_count,
      approved_count: run.approved_count,
    }));
  const filteredRows = params.requested_by
    ? rows.filter((row) => row.run?.created_by === params.requested_by || row.run?.id.includes(params.requested_by ?? '') || row.batchRun?.run_id.includes(params.requested_by ?? ''))
    : rows;

  const activeBatchRunCount = batchRuns.filter((run) => ['queued', 'researching', 'writing'].includes(run.status)).length;
  const counts = {
    total: batchRuns.length,
    ready_for_review: batchRuns.filter((run) => run.status === 'ready_for_review').length,
    failed: batchRuns.filter((run) => run.status === 'failed').length,
    active: activeBatchRunCount || (batch && ['queued', 'processing', 'pushing'].includes(batch.status) ? 1 : 0),
  };
  const batchDashboardUrl = batch ? dashboardStatusUrl(batch.id) : null;
  const batchReviewUrl = batch ? (batch.review_url ?? `${appBaseUrl()}/review/batch/${batch.review_token}`) : null;
  const continuation = batch ? pollingMetadata(batch.status) : null;
  const deepLink = batch && batchDashboardUrl ? coworkDeepLinkForBatch({ batchId: batch.id, dashboardStatusUrl: batchDashboardUrl, reviewUrl: batchReviewUrl ?? undefined }) : null;
  const canRetry = batch ? ['failed', 'partially_failed', 'processing', 'queued'].includes(batch.status) : false;

  return <main className="container">
    <section className="card" style={{ padding: 24, display: 'grid', gap: 20 }}>
      <div>
        <p className="eyebrow">Admin</p>
        <h1>Outbound runs</h1>
        {batch ? <p>Durable batch status and Cowork continuation controls for <strong>{batch.id}</strong>.</p> : <p>Recent outbound runs. Add <code>?batch_id=batch_...</code> to open a batch status center.</p>}
      </div>

      {batch ? <div className="card" style={{ padding: 16, display: 'grid', gap: 8 }}>
        <p className="eyebrow">Batch summary</p>
        <h2 style={{ margin: 0 }}>{batch.id}</h2>
        <p><strong>Status:</strong> {batch.status}</p>
        <p><strong>Requested by:</strong> {batch.requested_by ?? 'unknown'}</p>
        <p><strong>Created:</strong> {formatDate(batch.created_at)} · <strong>Updated:</strong> {formatDate(batch.updated_at)}</p>
        <p><strong>Source:</strong> {batch.source} · <strong>Mode:</strong> {batch.mode} · <strong>Campaign:</strong> {batch.campaign_id ?? 'none'}</p>
        <p><strong>Account:</strong> {batch.account_id ?? 'none'} · <strong>Cowork thread:</strong> {batch.cowork_thread_id ?? 'none'}</p>
      </div> : null}

      {batch && continuation && batchDashboardUrl ? <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <p className="eyebrow">Cowork continuation</p>
        <p>{continuation.cowork_next_action.instruction}</p>
        <p><strong>Batch ID:</strong> <code>{batch.id}</code></p>
        <p><strong>Poll tool:</strong> <code>{continuation.poll_tool}</code> · <strong>Cadence:</strong> {continuation.recommended_poll_after_seconds}s · <strong>Max attempts:</strong> {continuation.max_poll_attempts}</p>
        <p><strong>Dashboard URL:</strong> <code>{batchDashboardUrl}</code></p>
        {deepLink ? <p><strong>Cowork deep link:</strong> <code style={{ overflowWrap: 'anywhere' }}>{deepLink}</code></p> : null}
      </div> : null}

      {batch ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <Stat label="Total runs" value={counts.total} />
        <Stat label="Ready for review" value={counts.ready_for_review} />
        <Stat label="Failed" value={counts.failed} />
        <Stat label="Queued / processing" value={counts.active} />
      </div> : null}

      {batch ? <div className="card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <p className="eyebrow">Actions</p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {batchReviewUrl ? <Link href={relativeAppUrl(batchReviewUrl)}>Open batch review</Link> : null}
          <Link href={relativeAppUrl(batchDashboardUrl ?? `/admin/runs?batch_id=${batch.id}`)}>Open dashboard status</Link>
        </div>
        <p>Copy batch_id: <code>{batch.id}</code></p>
        <p>Copy dashboard URL: <code>{batchDashboardUrl}</code></p>
        {canRetry ? <p>Retry processing, guarded by internal auth: <code>{`curl -X POST ${appBaseUrl()}/api/internal/process-batch/${batch.id} -H 'Authorization: Bearer $INTERNAL_API_SECRET'`}</code></p> : null}
      </div> : null}

      {filteredRows.length === 0 ? <p>No runs yet. Create one with POST /api/runs or create_outbound_sequence.</p> : <div style={{ display: 'grid', gap: 12 }}>
        {filteredRows.map((row) => {
          const runId = row.run?.id ?? row.batchRun?.run_id ?? 'missing-run';
          const companyName = row.run?.company_name ?? row.batchRun?.company_name ?? 'Unknown company';
          const status = row.batchRun?.status ?? row.run?.status ?? 'unknown';
          return <div key={runId} className="card" style={{ padding: 16, display: 'grid', gap: 6 }}>
            <strong>{companyName}</strong>
            <p>{status} · run {runId} · {row.contact_count} contacts · {row.approved_count} approved · {row.run?.created_by ?? batch?.requested_by ?? 'unknown requester'}</p>
            <p style={{ fontSize: 12, opacity: .7 }}>account: {row.run?.account_id ?? batch?.account_id ?? 'none'} · user: {row.run?.created_by_user_id ?? batch?.created_by_user_id ?? 'none'}</p>
            {row.batchRun?.error ? <p style={{ color: '#b42318' }}>Error: {row.batchRun.error}</p> : null}
            {row.run ? <Link href={relativeAppUrl(reviewUrlForRun(row.run))}>Open run review</Link> : null}
          </div>;
        })}
      </div>}
    </section>
  </main>;
}
