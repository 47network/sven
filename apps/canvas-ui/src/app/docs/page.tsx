import Link from 'next/link';

const pillars = [
  {
    title: 'Quickstart',
    body: 'Install Sven, reach the suite, and validate the first operator and end-user flows.',
    href: '/suite/docs',
  },
  {
    title: 'Architecture',
    body: 'Understand the gateway, runtime, message bus, and companion surfaces before deeper rollout.',
    href: '/suite/platform',
  },
  {
    title: 'Security',
    body: 'Review deployment hardening, trust model, policy controls, and operator guardrails.',
    href: '/suite/security',
  },
];

export const metadata = {
  title: 'Sven Documentation',
};

export default function DocsPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-zinc-100">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">Documentation</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Operational guidance, not brochure copy.</h1>
        <p className="mt-4 text-base leading-7 text-zinc-300">
          Sven spans public web, authenticated chat, operator control, device management, and companion apps.
          This entry point consolidates the documentation paths that matter when you are evaluating, deploying,
          or operating the system.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {pillars.map((item) => (
          <article key={item.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h2 className="text-lg font-medium text-zinc-100">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{item.body}</p>
            <Link
              href={item.href}
              className="mt-5 inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-200 transition hover:bg-cyan-400/20"
            >
              Open
            </Link>
          </article>
        ))}
      </div>

      <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-xl font-medium text-zinc-100">What to validate first</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
          <li>Public host routes, legal pages, and suite entry points resolve cleanly.</li>
          <li>Canvas login, chat roundtrip, approvals, and shared transcript flows work on the live gateway.</li>
          <li>Admin setup, integrations, registry, deployment, and device management surfaces are operator-usable.</li>
          <li>Companion-device workflows prove registration, pairing, command delivery, and mirror presentation.</li>
        </ul>
      </section>
    </main>
  );
}
