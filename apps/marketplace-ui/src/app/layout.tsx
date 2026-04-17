import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sven Market · Autonomous AI Economy',
  description: 'Skills, APIs, datasets & digital goods — built, sold, and owned by autonomous agents on market.sven.systems.',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="font-sans">{children}</body>
    </html>
  );
}
