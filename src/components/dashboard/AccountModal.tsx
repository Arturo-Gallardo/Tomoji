import { IslandIcon } from "../ui/IslandIcon";

export interface AccountSummary {
  email: string;
  isPremium: boolean;
  activeDeviceCount: number;
}

interface AccountModalProps {
  account: AccountSummary | null;
  onClose: () => void;
}

export function AccountModal({ account, onClose }: AccountModalProps) {
  if (account === null) {
    return (
      <div className="absolute right-5 top-[4.75rem] z-30 w-44 sm:right-6">
        <div className="island-menu p-2">
          <button
            type="button"
            disabled
            title="Available after the account website is connected"
            className="island-button island-button--primary w-full"
          >
            Log in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute right-5 top-[4.75rem] z-30 w-[calc(100%-2.5rem)] max-w-md sm:right-6 sm:w-full"
    >
      <section
        role="region"
        aria-labelledby="account-dialog-title"
        className="island-menu w-full p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="account-dialog-title" className="text-lg font-extrabold text-island-ink">
              Account
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-island-muted">
              Manage your Tomoji account and Premium access.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="island-icon-button h-9 w-9 shrink-0"
            aria-label="Close account"
          >
            <IslandIcon name="close" className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
            <div className="island-form-section space-y-3">
              <div>
                <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-island-muted">Email</p>
                <p className="mt-1 text-sm font-extrabold text-island-ink">{account.email}</p>
              </div>
              <div>
                <p className="text-[0.7rem] font-extrabold uppercase tracking-[0.12em] text-island-muted">Password</p>
                <p className="mt-1 text-sm font-extrabold text-island-ink">••••••••</p>
                <p className="mt-1 text-xs font-medium text-island-muted">Change your password on the Tomoji website.</p>
              </div>
            </div>
            <div className="island-form-section flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-extrabold text-island-ink">Premium</p>
                <p className="mt-1 text-xs font-medium text-island-muted">
                  {account.activeDeviceCount} of 3 devices active
                </p>
              </div>
              <span className={`island-badge ${account.isPremium ? "island-badge--active" : "island-badge--warning"}`}>
                {account.isPremium ? "Active" : "Free"}
              </span>
            </div>
            <button type="button" disabled className="island-button island-button--soft w-full">
              Manage account on website
            </button>
        </div>
      </section>
    </div>
  );
}
