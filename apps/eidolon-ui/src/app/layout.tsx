import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Eidolon · Sven Autonomous Economy',
  description: 'Live 3D city of Sven\'s autonomous agents, services, and treasury flows.',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans">{children}</body>
    </html>
  );
}
