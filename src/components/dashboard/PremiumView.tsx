import { IslandIcon } from "../ui/IslandIcon";

const PREMIUM_FEATURES = [
  "Unlimited Tomojis",
  "Create Tomojis from scratch",
  "Edit every animation frame",
  "Custom dialogue",
];

export function PremiumView() {
  return (
    <section className="island-scroll-region island-page-enter min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto w-full max-w-4xl">
        <header className="island-card overflow-hidden p-6 sm:p-8">
          <span className="island-badge island-badge--active">One-time purchase</span>
          <h1 className="mt-4 text-3xl font-extrabold tracking-[0.04em] text-island-ink sm:text-4xl">
            Tomoji Premium
          </h1>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-island-muted sm:text-base">
            Make unlimited Tomojis, then make every one your own.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled
              title="Available after Stripe Checkout is connected"
              className="island-button island-button--primary"
            >
              <IslandIcon name="sparkles" className="h-4 w-4" />
              Get Premium — $5 once
            </button>
            <span className="text-xs font-bold text-island-muted">Keep it forever. No subscription.</span>
          </div>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.3fr]">
          <section className="island-card p-5 sm:p-6">
            <span className="island-badge">Current plan</span>
            <h2 className="mt-3 text-xl font-extrabold text-island-ink">Free</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-island-muted">
              Try Tomoji with the built-in companion and one custom Tomoji slot.
            </p>
            <ul className="mt-5 space-y-3 text-sm font-bold text-island-ink">
              <li className="flex gap-2"><IslandIcon name="check" className="mt-0.5 h-4 w-4 shrink-0" />Import Tomojis and Shimejis</li>
              <li className="flex gap-2"><IslandIcon name="check" className="mt-0.5 h-4 w-4 shrink-0" />Edit Tomoji windows and Shimeji animations</li>
              <li className="flex gap-2 text-island-muted"><IslandIcon name="close" className="mt-0.5 h-4 w-4 shrink-0" />No new Tomojis, frame editing, or dialogue</li>
            </ul>
          </section>

          <section className="island-card border-island-sun-deep bg-island-custard p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <span className="island-badge island-badge--active">Premium</span>
                <h2 className="mt-3 text-xl font-extrabold text-island-ink">$5 once</h2>
              </div>
              <IslandIcon name="sparkles" className="h-9 w-9" />
            </div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {PREMIUM_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm font-extrabold text-island-ink">
                  <IslandIcon name="check" className="h-4 w-4 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="island-card mt-5 p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-island-ink">How Premium works</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="island-form-section">
              <p className="text-sm font-extrabold text-island-ink">1. Sign in</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-island-muted">Create account in browser, then return to Tomoji.</p>
            </div>
            <div className="island-form-section">
              <p className="text-sm font-extrabold text-island-ink">2. Checkout</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-island-muted">Pay securely with Stripe. No subscription.</p>
            </div>
            <div className="island-form-section">
              <p className="text-sm font-extrabold text-island-ink">3. Create offline</p>
              <p className="mt-1 text-xs font-medium leading-relaxed text-island-muted">Premium keeps working offline after activation.</p>
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}
