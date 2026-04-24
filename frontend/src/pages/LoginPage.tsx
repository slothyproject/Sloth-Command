export function LoginPage() {
  const loginHref = 'https://slothlee.xyz/auth/login/discord?next=/app/dashboard';

  return (
    <div className="dashboard-shell grid min-h-screen place-items-center overflow-hidden bg-void px-4">
      <div className="dashboard-orb dashboard-orb-a" aria-hidden="true" />
      <div className="dashboard-orb dashboard-orb-b" aria-hidden="true" />
      <div className="dashboard-grid absolute inset-0" aria-hidden="true" />

      <section className="dashboard-chrome relative z-[1] w-full max-w-2xl rounded-[1.9rem] p-8 xl:p-10">
        <div className="mb-8">
          <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-line bg-white/5 px-4 py-2">
            <img src="/sloth-lee-logo.png" alt="Sloth Lee" className="h-8 w-8 rounded-full border border-line bg-white/10 p-1" />
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan">Sloth Lee operator access</p>
          </div>
          <h1 className="max-w-xl font-display text-4xl font-semibold tracking-tight text-text-0">Enter the command dojo with your Discord identity.</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-text-2">One sign-in gates moderation, ticket operations, audit visibility, and guild management so your team runs from a single trusted identity.</p>
        </div>

        <div className="grid gap-4 rounded-[1.5rem] border border-line bg-white/5 p-5">
          <a
            href={loginHref}
            className="inline-flex items-center justify-center gap-3 rounded-2xl bg-[#5865F2] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#4752c4]"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-mono text-xs">D</span>
            Enter command dojo
          </a>

          <div className="grid gap-3 text-sm text-text-1 sm:grid-cols-3">
            <div className="rounded-2xl border border-line bg-white/5 p-3">Discord role-aware access</div>
            <div className="rounded-2xl border border-line bg-white/5 p-3">Guild-scoped operations</div>
            <div className="rounded-2xl border border-line bg-white/5 p-3">Live moderation + tickets</div>
          </div>
        </div>
      </section>
    </div>
  );
}