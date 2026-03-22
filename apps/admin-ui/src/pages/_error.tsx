import type { NextPageContext } from 'next';

type ErrorPageProps = {
  statusCode?: number;
};

function ErrorPage({ statusCode }: ErrorPageProps) {
  const title = statusCode ? `Error ${statusCode}` : 'Application error';
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
      <div style={{ maxWidth: 520, textAlign: 'center' }}>
        <div style={{ fontSize: 14, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#22d3ee' }}>
          Sven Admin
        </div>
        <h1 style={{ marginTop: 16, fontSize: 34, fontWeight: 700 }}>{title}</h1>
        <p style={{ marginTop: 12, fontSize: 16, lineHeight: 1.6, color: '#94a3b8' }}>
          The admin control surface hit an internal rendering failure. Refresh the page or return to the login flow.
        </p>
      </div>
    </main>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;
  return { statusCode };
};

export default ErrorPage;
