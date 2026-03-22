export const metadata = {
  title: 'Terms of Service | Sven',
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-zinc-100">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-3 text-sm text-zinc-400">Last updated: 2026-02-21</p>

      <section className="mt-8 space-y-4 text-sm leading-7 text-zinc-200">
        <p>
          Sven is provided for productivity and assistant workflows. You are responsible for the content and actions
          initiated from your account and connected integrations.
        </p>
        <p>
          Features involving external systems, tools, or automations may require explicit approvals and policy
          controls. Availability may vary by deployment and service dependencies.
        </p>
        <p>
          By using Sven, you agree to operate it in compliance with applicable law, platform policies, and your own
          organizational security requirements.
        </p>
      </section>
    </main>
  );
}

