import type { ShimejiDraftController } from "../../hooks/useShimejiDraft";

interface SelectImgFolderStepProps {
  controller: ShimejiDraftController;
}

export function SelectImgFolderStep({ controller }: SelectImgFolderStepProps) {
  const { draft, isLoadingFolder, loadImgFolder } = controller;

  return (
    <div className="space-y-8">
      <p className="max-w-xl text-sm leading-relaxed text-neutral-400">
        Pick a folder of image frames (PNG recommended; JPG, WebP, and BMP
        also work. Choose the character sprite folder inside
        <code className="mx-1 rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-200">
          img
        </code>
        , or <code className="rounded bg-neutral-800 px-1.5 py-0.5 text-neutral-200">img</code>{" "}
        itself when it directly contains shime*.png. Do not choose the outer
        Shimeji app folder. Choose frames manually, then tune animation speed
        and details. Your files stay on your machine — nothing is uploaded.
      </p>

      <button
        type="button"
        disabled={isLoadingFolder}
        onClick={() => void loadImgFolder()}
        className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50"
      >
        {isLoadingFolder ? "Loading..." : "Choose img sprite folder"}
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
