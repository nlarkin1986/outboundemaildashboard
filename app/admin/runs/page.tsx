import Link from 'next/link';
import { listRuns, reviewUrlForRun } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function RunsPage() {
  const runs = await listRuns();
  return <main className="container"><section className="card" style={{padding:24}}><p className="eyebrow">Admin</p><h1>Outbound runs</h1>{runs.length === 0 ? <p>No runs yet. Create one with POST /api/runs.</p> : <div style={{display:'grid',gap:12}}>{runs.map((run) => <div key={run.id} className="card" style={{padding:16}}><strong>{run.company_name}</strong><p>{run.status} · {run.contact_count} contacts · {run.approved_count} approved</p><Link href={reviewUrlForRun(run).replace(process.env.APP_BASE_URL ?? 'http://localhost:3000','')}>Open review</Link></div>)}</div>}</section></main>;
}
