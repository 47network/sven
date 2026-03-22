export const metadata = {
  title: 'Privacy Policy | Sven',
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-zinc-100">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-3 text-sm text-zinc-400">Last updated: 2026-02-21</p>

      <section className="mt-8 space-y-4 text-sm leading-7 text-zinc-200">
        <p>
          Sven processes account and conversation data to provide chat, approvals, and automation features.
          We collect only data required to operate the service and improve reliability.
        </p>
        <p>
          Authentication credentials are handled via secure token flows. Sensitive values are not intended to be
          stored in plaintext logs. Transport is expected to use HTTPS/TLS for production deployments.
        </p>
        <p>
          You can request data export and account deletion from in-app privacy controls where supported. Diagnostic
          telemetry is designed to support product quality and operations, with privacy controls in client settings.
        </p>
      </section>
    </main>
  );
}

