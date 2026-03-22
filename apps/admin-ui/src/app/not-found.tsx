export default function AdminNotFoundPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#020617',
        color: '#e2e8f0',
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
      }}
    >
      <section style={{ maxWidth: 560, textAlign: 'center' }}>
        <p style={{ color: '#22d3ee', fontSize: '0.75rem', letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          Sven Admin
        </p>
        <h1 style={{ margin: '0.75rem 0 0.5rem', fontSize: '2.25rem', lineHeight: 1.1 }}>Page not found</h1>
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '1rem', lineHeight: 1.6 }}>
          The requested admin route does not exist on this deployment. Return to the control surface and continue from a known route.
        </p>
        <p style={{ marginTop: '1.5rem' }}>
          <a
            href="/admin47/overview"
            style={{
              display: 'inline-block',
              padding: '0.8rem 1.1rem',
              borderRadius: '999px',
              background: '#0f172a',
              color: '#67e8f9',
              border: '1px solid rgba(34,211,238,0.35)',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Open overview
          </a>
        </p>
      </section>
    </main>
  );
}
