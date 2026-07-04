import {
  SPRITE_HEIGHT,
  SPRITE_WIDTH,
} from "../../animations/beyondBirthday";
import type {
  CompanionAction,
  FacingDirection,
  SpriteAnchor,
} from "../../animations/types";
import type { WindowWallSide } from "../../types/companion";

interface CompanionSpriteProps {
  frameSrc: string;
  facing: FacingDirection;
  action: CompanionAction;
  wallSide?: WindowWallSide | null;
  isDragging?: boolean;
  interactive?: boolean;
  scale?: number;
  // unscaled sprite frame size + anchor; defaults to the built-in character
  spriteWidth?: number;
  spriteHeight?: number;
  spriteAnchor?: SpriteAnchor;
  onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
  onContextMenu?: (event: React.MouseEvent<HTMLElement>) => void;
}

function shouldFlipSprite(
  action: CompanionAction,
  facing: FacingDirection,
  wallSide: WindowWallSide | null | undefined,
): boolean {
  if (
    action === "grabWall" ||
    action === "climbWall" ||
    action === "climbWallDown"
  ) {
    return wallSide === "left";
  }

  if (
    action !== "idle" &&
    action !== "walk" &&
    action !== "floorCrawl" &&
    action !== "sit" &&
    action !== "sitAlt" &&
    action !== "sitAlt2" &&
    action !== "sitOnBar" &&
    action !== "dangleOnBar" &&
    action !== "emote" &&
    action !== "emote2" &&
    action !== "emote3" &&
    action !== "emote4" &&
    action !== "emote5" &&
    action !== "emote6" &&
    action !== "grabCeiling" &&
    action !== "climbCeiling"
  ) {
    return false;
  }

  return facing === "right";
}

export function CompanionSprite({
  frameSrc,
  facing,
  action,
  wallSide = null,
  isDragging = false,
  interactive = true,
  scale = 1,
  spriteWidth = SPRITE_WIDTH,
  spriteHeight = SPRITE_HEIGHT,
  onPointerDown,
  onContextMenu,
}: CompanionSpriteProps) {
  const flipScale = shouldFlipSprite(action, facing, wallSide) ? -1 : 1;
  const width = spriteWidth * scale;
  const height = spriteHeight * scale;

  return (
    <div
      className="relative overflow-visible"
      style={{ width, height }}
    >
      <img
        src={frameSrc}
        alt="Tomoji companion"
        draggable={false}
        onPointerDown={interactive ? onPointerDown : undefined}
        onContextMenu={interactive ? onContextMenu : undefined}
        className="absolute bottom-0 left-1/2 max-h-full max-w-full touch-none select-none object-contain object-bottom"
        style={{
          cursor: interactive ? (isDragging ? "grabbing" : "grab") : "default",
          transform: `translateX(-50%) scaleX(${flipScale})`,
          transformOrigin: "center bottom",
        }}
      />
    </div>
  );
}
