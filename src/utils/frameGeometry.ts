import { getImageSize } from "./imageSize";

export interface FrameSize {
  width: number;
  height: number;
}

export async function getMaxImageSize(
  imageUrls: readonly string[],
  fallback: FrameSize,
): Promise<FrameSize> {
  let width = 0;
  let height = 0;

  for (const url of imageUrls) {
    try {
      const size = await getImageSize(url);
      width = Math.max(width, size.width);
      height = Math.max(height, size.height);
    } catch {
      // ignore unreadable frames; caller fallback keeps import usable
    }
  }

  if (width === 0 || height === 0) {
    return fallback;
  }

  return { width, height };
}
