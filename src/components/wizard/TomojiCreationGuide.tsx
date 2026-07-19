import { IslandIcon } from "../ui/IslandIcon";

interface TomojiCreationGuideProps {
  onStartCreation: () => void;
}

interface GuideStep {
  title: string;
  body: string;
  tips?: readonly string[];
  screenshotLabel: string;
}

const GUIDE_STEPS: readonly GuideStep[] = [
  {
    title: "Prepare your sprite folder",
    body: "Create one folder containing every pose you want to use. Tomoji reads PNG, JPG, WebP, and BMP files from that folder; PNG with transparency gives the cleanest result.",
    tips: [
      "Use one canvas size for every sprite. 128×128 is a good place to start.",
      "Keep the feet on the same bottom line in every image so the character does not jump while moving.",
      "Leave a little transparent padding around the character so hands, hair, and props do not clip.",
    ],
    screenshotLabel: "Add screenshot: finished sprite folder with clearly named PNG files",
  },
  {
    title: "Draw the essential poses first",
    body: "You only need one idle frame and one walk frame to create a Tomoji. A three-frame walk—stand, step, alternate step—looks much smoother because Tomoji loops frames in the order you assign them.",
    tips: [
      "Name files clearly, for example idle.png, walk-1.png, walk-2.png, walk-3.png.",
      "Reuse a frame when needed. One image can be assigned to more than one action.",
      "Test a small set first; you can edit and add more action assignments later.",
    ],
    screenshotLabel: "Add screenshot: idle and three walk poses side by side",
  },
  {
    title: "Choose your sprite folder",
    body: "In Create new Tomoji, open this guide’s sprite-folder step and click Choose sprite folder. Select the folder that directly contains your images—not individual files—then wait for the frame thumbnails to appear.",
    screenshotLabel: "Add screenshot: Choose sprite folder button and loaded frame thumbnails",
  },
  {
    title: "Assign idle and walk",
    body: "Continue to Assign animations. Open Idle and add at least one standing frame. Then open Walk and add your walking frames in playback order. These two actions are required before you can finish.",
    tips: [
      "Idle can use one still image or several frames for a breathing/blinking loop.",
      "Walk plays in the listed order, then repeats from the start.",
      "Use the preview and reorder controls to check the movement before continuing.",
    ],
    screenshotLabel: "Add screenshot: Idle and Walk assignments with preview controls",
  },
  {
    title: "Add optional behavior poses",
    body: "Expand the other animation groups only for poses you have. Sit, fall, drag, wall climb, ceiling crawl, and emotes make the Tomoji feel more alive, but none are required to create it.",
    tips: [
      "For drag poses, assign left and right leans separately; stronger leans are used for faster pulls.",
      "Use a single fall pose unless you intentionally want a different first frame.",
      "Wall and ceiling crawling look best with a short repeating cycle, similar to walk.",
    ],
    screenshotLabel: "Add screenshot: optional animation groups expanded",
  },
  {
    title: "Set name and preview",
    body: "Give the Tomoji a name, check its size and movement settings, then use the final preview to make sure the assigned sprites look right. Choose Create editable Tomoji when ready; you can reopen its editor later to change sprites or behavior.",
    screenshotLabel: "Add screenshot: details and final preview before Create editable Tomoji",
  },
];

export function TomojiCreationGuide({ onStartCreation }: TomojiCreationGuideProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="island-card p-5 sm:p-6">
        <h2 className="text-lg font-extrabold text-island-ink">Before you start</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-island-muted">
          Make your artwork in any image editor. Tomoji does not upload or alter
          your original files; it copies the assigned sprites into the new
          character when you finish.
        </p>
      </section>

      <ol className="space-y-4">
        {GUIDE_STEPS.map((step, index) => (
          <li
            key={step.title}
            className="island-card grid gap-4 p-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(13rem,0.8fr)] sm:items-center"
          >
            <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-island-ink bg-island-custard text-sm font-extrabold">
              {index + 1}
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-island-ink">{step.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-island-muted">{step.body}</p>
              {step.tips ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs leading-relaxed text-island-muted">
                  {step.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              ) : null}
            </div>
            <div className="grid min-h-28 place-items-center rounded-xl border-2 border-dashed border-island-ink/25 bg-island-custard/35 p-4 text-center text-xs font-bold leading-relaxed text-island-muted">
              <span>
                <IslandIcon name="background" className="mx-auto mb-2 h-6 w-6" />
                {step.screenshotLabel}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <button type="button" onClick={onStartCreation} className="island-button island-button--primary">
        Start creating
      </button>
    </div>
  );
}
