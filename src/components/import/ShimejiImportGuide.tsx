import { IslandIcon } from "../ui/IslandIcon";

interface ShimejiImportGuideProps {
  onStartImport: () => void;
}

interface GuideStep {
  title: string;
  body: string;
  screenshotLabel: string;
}

const PC_STEPS: readonly GuideStep[] = [
  {
    title: "Unzip the download",
    body: "If your character download ends in .zip or .rar, right-click it and extract it first. Do not select the zip file in Tomoji.",
    screenshotLabel: "Add screenshot: right-click download, then Extract All",
  },
  {
    title: "Open the extracted folder",
    body: "Open folders until you see both conf and img. This is usually the folder named after the character.",
    screenshotLabel: "Add screenshot: character folder showing conf and img",
  },
  {
    title: "Choose PC Shimeji in Tomoji",
    body: "Click Import downloaded Shimeji, leave PC Shimeji selected, then click Choose PC Shimeji folder.",
    screenshotLabel: "Add screenshot: PC type selected and choose-folder button",
  },
  {
    title: "Select that folder",
    body: "Select the folder with conf and img, then click Select Folder. Do not open conf, img, or choose individual PNG files.",
    screenshotLabel: "Add screenshot: correct folder highlighted in Windows picker",
  },
];

const ANDROID_STEPS: readonly GuideStep[] = [
  {
    title: "Unzip the download",
    body: "If your character download ends in .zip or .rar, extract it first. Do not select the zip file in Tomoji.",
    screenshotLabel: "Add screenshot: extracted Android Shimeji folder",
  },
  {
    title: "Find the character folder",
    body: "Open folders until you see manifest.json, animation.json, and a sprites folder together.",
    screenshotLabel: "Add screenshot: folder showing manifest.json, animation.json, and sprites",
  },
  {
    title: "Choose Android Shimeji in Tomoji",
    body: "Click Import downloaded Shimeji, choose Android Shimeji from the dropdown, then click Choose Android Shimeji folder.",
    screenshotLabel: "Add screenshot: Android type selected and choose-folder button",
  },
  {
    title: "Select that folder",
    body: "Select the folder with manifest.json and animation.json, then click Select Folder. Do not open sprites or choose individual image files.",
    screenshotLabel: "Add screenshot: correct Android folder highlighted in Windows picker",
  },
];

function GuideSteps({ steps }: { steps: readonly GuideStep[] }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => (
        <li key={step.title} className="island-card grid gap-4 p-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(13rem,0.8fr)] sm:items-center">
          <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-island-ink bg-island-custard text-sm font-extrabold">
            {index + 1}
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-island-ink">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-island-muted">{step.body}</p>
          </div>
          <div className="grid min-h-28 place-items-center rounded-xl border-2 border-dashed border-island-ink/25 bg-island-custard/35 p-4 text-center text-xs font-bold leading-relaxed text-island-muted">
            <span><IslandIcon name="background" className="mx-auto mb-2 h-6 w-6" />{step.screenshotLabel}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ShimejiImportGuide({ onStartImport }: ShimejiImportGuideProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section>
        <details className="island-card group overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left marker:content-none sm:p-6">
            <span>
              <span className="block text-lg font-extrabold text-island-ink">PC Shimeji pack tutorial</span>
              <span className="mt-1 block text-sm text-island-muted">For downloads with <strong>conf</strong> and <strong>img</strong> folders.</span>
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-island-ink/25 bg-island-custard text-island-ink">
              <IslandIcon name="plus" className="h-4 w-4 transition-transform group-open:rotate-45" />
            </span>
          </summary>
          <div className="border-t-2 border-island-ink/15 p-5 pt-4 sm:p-6 sm:pt-4">
            <GuideSteps steps={PC_STEPS} />
          </div>
        </details>
      </section>

      <section>
        <details className="island-card group overflow-hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left marker:content-none sm:p-6">
            <span>
              <span className="block text-lg font-extrabold text-island-ink">Android Shimeji pack tutorial</span>
              <span className="mt-1 block text-sm text-island-muted">For downloads with <strong>manifest.json</strong>, <strong>animation.json</strong>, and <strong>sprites</strong>.</span>
            </span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-island-ink/25 bg-island-custard text-island-ink">
              <IslandIcon name="plus" className="h-4 w-4 transition-transform group-open:rotate-45" />
            </span>
          </summary>
          <div className="border-t-2 border-island-ink/15 p-5 pt-4 sm:p-6 sm:pt-4">
            <GuideSteps steps={ANDROID_STEPS} />
          </div>
        </details>
      </section>

      <button type="button" onClick={onStartImport} className="island-button island-button--primary">
        Go to import
      </button>
    </div>
  );
}
