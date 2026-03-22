import Link from 'next/link';

const publicSkills = [
  { name: 'openclaw', body: 'Production workflow package for operator-grade tools and integrations.' },
  { name: 'weather-openmeteo', body: 'Live weather retrieval with simple, safe query ergonomics.' },
  { name: 'notion', body: 'Knowledge retrieval and page update flows for Notion workspaces.' },
  { name: 'spotify', body: 'Media search and playback helper flows for consumer control surfaces.' },
];

export const metadata = {
  title: 'Sven Marketplace',
};

export default function MarketplacePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-12 text-zinc-100">
      <div className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.28em] text-fuchsia-300/80">Marketplace</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Public catalog, verified install path, operator review gates.</h1>
        <p className="mt-4 text-base leading-7 text-zinc-300">
          Sven exposes its installable skill ecosystem through quarantine, promotion, and policy controls. This
          public page is the discovery surface. Installation and trust elevation remain governed in authenticated
          operator flows.
        </p>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {publicSkills.map((skill) => (
          <article key={skill.name} className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium text-zinc-100">{skill.name}</h2>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-300">
                reviewable
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-400">{skill.body}</p>
          </article>
        ))}
      </div>

      <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <h2 className="text-xl font-medium text-zinc-100">How installs work</h2>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-zinc-300">
          <li>Discover packages publicly.</li>
          <li>Install through the authenticated registry flow.</li>
          <li>Review quarantined artifacts and evidence.</li>
          <li>Promote only after operator signoff.</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/community"
            className="inline-flex items-center rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 transition hover:border-zinc-500"
          >
            Community
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200 transition hover:bg-cyan-400/20"
          >
            Sign In For Install
          </Link>
        </div>
      </section>
    </main>
  );
}
