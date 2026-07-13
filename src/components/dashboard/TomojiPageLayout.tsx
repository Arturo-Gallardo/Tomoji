import type { ReactNode } from "react";

interface TomojiPageLayoutProps {
  header: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** skip max-width wrapper — useful for wide assignment grids */
  wide?: boolean;
}

// one scroll container for all tomoji sub-pages — avoids nested scrollbars
export function TomojiPageLayout({
  header,
  children,
  footer,
  wide = false,
}: TomojiPageLayoutProps) {
  return (
    <section className="island-page-enter relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="island-page-band shrink-0 px-5 py-4 sm:px-8">
        <div className="mx-auto w-full max-w-6xl">{header}</div>
      </div>

      <div className="island-scroll-region min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
        {wide ? (
          children
        ) : (
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        )}
      </div>

      {footer ? (
        <div className="island-page-band shrink-0 border-b-0 border-t-2 border-island-ink/15 px-5 py-3 sm:px-8 sm:py-4">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
