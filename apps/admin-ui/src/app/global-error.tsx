'use client';

export default function GlobalError() {
  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100vh',
          margin: 0,
          display: 'grid',
          placeItems: 'center',
          background: '#020617',
          color: '#e2e8f0',
          fontFamily: 'system-ui, sans-serif',
          padding: '2rem',
        }}
      >
        <section style={{ maxWidth: 560, textAlign: 'center' }}>
          <p style={{ color: '#f59e0b', fontSize: '0.75rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
            Sven Admin
          </p>
          <h1 style={{ margin: '0.75rem 0 0.5rem', fontSize: '2.25rem', lineHeight: 1.1 }}>Admin runtime error</h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6 }}>
            The admin control surface hit an internal rendering failure. Refresh the route or return to the overview after the runtime stabilizes.
          </p>
          <p style={{ marginTop: '1.5rem' }}>
            <a
              href="/admin47/overview"
              style={{
                display: 'inline-block',
                padding: '0.8rem 1.1rem',
                borderRadius: '999px',
                background: '#0f172a',
                color: '#fbbf24',
                border: '1px solid rgba(245,158,11,0.35)',
                textDecoration: 'none',
                fontWeight: 600,
              }}
            >
              Return to overview
            </a>
          </p>
        </section>
      </body>
    </html>
  );
}
