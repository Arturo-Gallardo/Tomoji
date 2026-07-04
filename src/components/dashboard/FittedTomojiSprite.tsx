import { useEffect, useState } from "react";
import type { CompanionAction, FacingDirection } from "../../animations/types";
import { shouldFlipSprite } from "../companion/CompanionSprite";

interface SpriteBounds {
  sourceWidth: number;
  sourceHeight: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface FittedTomojiSpriteProps {
  frameSrc: string;
  facing: FacingDirection;
  action: CompanionAction;
  targetHeight: number;
  maxWidth?: number;
}

const boundsCache = new Map<string, Promise<SpriteBounds>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("failed to load sprite"));
    image.src = src;
  });
}

function fullBounds(sourceWidth: number, sourceHeight: number): SpriteBounds {
  return {
    sourceWidth,
    sourceHeight,
    left: 0,
    top: 0,
    width: sourceWidth,
    height: sourceHeight,
  };
}

async function measureVisibleBounds(frameSrc: string): Promise<SpriteBounds> {
  const image = await loadImage(frameSrc);
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;

  if (sourceWidth === 0 || sourceHeight === 0) {
    return fullBounds(1, 1);
  }

  const canvas = document.createElement("canvas");
  canvas.width = sourceWidth;
  canvas.height = sourceHeight;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return fullBounds(sourceWidth, sourceHeight);
  }

  context.drawImage(image, 0, 0);

  try {
    const pixels = context.getImageData(0, 0, sourceWidth, sourceHeight).data;
    let left = sourceWidth;
    let top = sourceHeight;
    let right = -1;
    let bottom = -1;

    for (let y = 0; y < sourceHeight; y += 1) {
      for (let x = 0; x < sourceWidth; x += 1) {
        const alpha = pixels[(y * sourceWidth + x) * 4 + 3] ?? 0;
        if (alpha === 0) {
          continue;
        }

        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }

    if (right < left || bottom < top) {
      return fullBounds(sourceWidth, sourceHeight);
    }

    return {
      sourceWidth,
      sourceHeight,
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1,
    };
  } catch {
    return fullBounds(sourceWidth, sourceHeight);
  }
}

function getCachedBounds(frameSrc: string): Promise<SpriteBounds> {
  const cached = boundsCache.get(frameSrc);
  if (cached) {
    return cached;
  }

  const next = measureVisibleBounds(frameSrc);
  boundsCache.set(frameSrc, next);
  return next;
}

function useVisibleBounds(frameSrc: string): SpriteBounds | null {
  const [bounds, setBounds] = useState<SpriteBounds | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBounds(null);

    void getCachedBounds(frameSrc)
      .then((next) => {
        if (!cancelled) {
          setBounds(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBounds(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [frameSrc]);

  return bounds;
}

export function FittedTomojiSprite({
  frameSrc,
  facing,
  action,
  targetHeight,
  maxWidth,
}: FittedTomojiSpriteProps) {
  const bounds = useVisibleBounds(frameSrc);
  const visible = bounds ?? fullBounds(targetHeight, targetHeight);
  const heightScale = targetHeight / visible.height;
  const widthScale =
    maxWidth === undefined ? heightScale : Math.min(heightScale, maxWidth / visible.width);
  const scale = Number.isFinite(widthScale) && widthScale > 0 ? widthScale : 1;
  const width = visible.width * scale;
  const height = visible.height * scale;
  const flip = shouldFlipSprite(action, facing, null);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width,
        height,
        transform: flip ? "scaleX(-1)" : undefined,
      }}
      aria-hidden
    >
      <img
        src={frameSrc}
        alt=""
        draggable={false}
        className="absolute max-w-none select-none"
        style={{
          width: visible.sourceWidth * scale,
          height: visible.sourceHeight * scale,
          left: -visible.left * scale,
          top: -visible.top * scale,
          imageRendering: "auto",
        }}
      />
    </div>
  );
}
