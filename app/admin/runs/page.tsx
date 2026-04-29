import Link from 'next/link';
import { getBatchById, getRun, listBatchRuns, listRuns, reviewUrlForRun } from '@/lib/store';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ batch_id?: string; requested_by?: string }>;

export default async function RunsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const batch = params.batch_id ? await getBatchById(params.batch_id) : null;
  const runs = batch
    ? await Promise.all((await listBatchRuns(batch.id)).map(async (batchRun) => {
      const run = await getRun(batchRun.run_id);
      return run ? { ...run, contact_count: run.contacts.length, approved_count: run.contacts.filter((contact) => contact.status === 'approved').length } : null;
    })).then((rows) => rows.filter((row): row is NonNullable<typeof row> => Boolean(row)))
    : await listRuns();
  const filteredRuns = params.requested_by ? runs.filter((run) => run.created_by === params.requested_by || run.id.includes(params.requested_by ?? '')) : runs;

  return <main className="container"><section className="card" style={{padding:24}}><p className="eyebrow">Admin</p><h1>Outbound runs</h1>{batch ? <p>Batch {batch.id} · {batch.status} · requested by {batch.requested_by ?? 'unknown'} · account {batch.account_id ?? 'none'}</p> : null}{filteredRuns.length === 0 ? <p>No runs yet. Create one with POST /api/runs.</p> : <div style={{display:'grid',gap:12}}>{filteredRuns.map((run) => <div key={run.id} className="card" style={{padding:16}}><strong>{run.company_name}</strong><p>{run.status} · {run.contact_count} contacts · {run.approved_count} approved · {run.created_by ?? 'unknown requester'}</p><p style={{fontSize:12,opacity:.7}}>account: {run.account_id ?? 'none'} · user: {run.created_by_user_id ?? 'none'}</p><Link href={reviewUrlForRun(run).replace(process.env.APP_BASE_URL ?? 'http://localhost:3000','')}>Open review</Link></div>)}</div>}</section></main>;
}
