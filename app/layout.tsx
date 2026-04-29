import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Outbound Approval', description: 'Cowork to Instantly outbound approval workflow' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
