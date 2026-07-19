import type { ShimejiDraftController } from "../../hooks/useShimejiDraft";
import { IslandIcon } from "../ui/IslandIcon";

interface SelectImgFolderStepProps {
  controller: ShimejiDraftController;
  variant?: "shimeji" | "tomoji";
  onShowGuide?: () => void;
}

export function SelectImgFolderStep({
  controller,
  variant = "shimeji",
  onShowGuide,
}: SelectImgFolderStepProps) {
  const { draft, isLoadingFolder, loadImgFolder } = controller;
  const isTomoji = variant === "tomoji";

  return (
    <div className="space-y-8">
      {isTomoji ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)]">
          <p className="max-w-xl text-sm leading-relaxed text-neutral-400">
            Pick a folder with your Tomoji sprite images. PNG with transparency
            is recommended; JPG, WebP, and BMP also work. After loading, assign
            sprites to idle, walk, sit, drag, and other actions. Your files stay
            on your machine and nothing is uploaded.
          </p>

          <div className="rounded-2xl border-2 border-island-ink/20 bg-island-paper/80 p-4 text-xs text-island-ink/75">
            <p className="text-sm font-extrabold text-island-ink">New to making sprites?</p>
            <p className="mt-2 leading-relaxed">
              Follow the full step-by-step guide for preparing sprites, assigning
              animations, and previewing your Tomoji.
            </p>
            <button
              type="button"
              onClick={onShowGuide}
              className="mt-3 text-sm font-extrabold text-island-ink decoration-2 decoration-island-orange/70 underline-offset-4 transition hover:underline hover:decoration-island-orange"
            >
              Open creation guide
            </button>
          </div>
        </div>
      ) : (
        <p className="max-w-xl text-sm leading-relaxed text-neutral-400">
          Pick a folder of image frames (PNG recommended; JPG, WebP, and BMP
          also work). Choose the character sprite folder inside{" "}
          <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-200">
            img
          </code>
          , or{" "}
          <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-200">
            img
          </code>{" "}
          itself when it directly contains shime*.png. Do not choose the outer
          Shimeji app folder. Your files stay on your machine and nothing is
          uploaded.
        </p>
      )}

      <button
        type="button"
        disabled={isLoadingFolder}
        onClick={() =>
          void loadImgFolder(
            isTomoji
              ? "Select Tomoji sprite folder"
              : "Select the Shimeji img sprite folder",
          )
        }
        className="island-button island-button--primary disabled:opacity-50"
      >
        <IslandIcon name="folder" className="h-4 w-4" />
        {isLoadingFolder
          ? "Loading..."
          : isTomoji
            ? "Choose sprite folder"
            : "Choose img sprite folder"}
      </button>

      {draft.imgDir ? (
        <div>
          <p className="mb-4 text-sm text-neutral-400">
            {draft.sources.length} frames found ({draft.frameWidth}x
            {draft.frameHeight})
          </p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2 rounded-xl border border-neutral-800 p-3">
            {draft.sources.map((source) => (
              <div
                key={source.path}
                className="flex aspect-square items-center justify-center rounded-md border border-neutral-800 p-1"
                title={source.name}
              >
                <img
                  src={source.url}
                  alt={source.name}
                  className="h-full w-full object-contain"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
