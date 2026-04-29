import Link from 'next/link';

export default function Home() {
  return <main className="container"><section className="card" style={{padding:32}}><p style={{letterSpacing:'.16em',textTransform:'uppercase',fontSize:12,color:'#66736f'}}>Gladly Outbound</p><h1>Outbound approval system</h1><p>Backend-backed review, approval, and server-side Instantly push workflow.</p><Link href="/admin/runs">View runs</Link></section></main>;
}
