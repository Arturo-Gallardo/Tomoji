import { IslandIcon } from "../ui/IslandIcon";

interface CompanionSpeechBubbleProps {
  text: string;
  scale?: number;
}

export function CompanionSpeechBubble({
  text,
  scale = 1,
}: CompanionSpeechBubbleProps) {
  const fontSize = 12 * scale;
  const paddingX = 8 * scale;
  const paddingY = 4 * scale;
  const borderRadius = 6 * scale;
  const maxWidth = 112 * scale;

  return (
    <div
      className="island-menu pointer-events-none inline-flex items-start text-left font-extrabold"
      style={{
        fontSize,
        padding: `${paddingY}px ${paddingX}px`,
        borderRadius,
        maxWidth,
        lineHeight: 1.3,
      }}
    >
      <IslandIcon
        name="dialogue"
        className="mr-1.5 mt-0.5 h-3 w-3 shrink-0"
        aria-hidden
      />
      <span>{text}</span>
    </div>
  );
}
