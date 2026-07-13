import { useAnimationPreviewPlayer } from "../../hooks/useAnimationPreviewPlayer";

interface AnimationPreviewPlayerProps {
  frames: string[];
  fps: number;
  width: number;
  height: number;
  isPlaying?: boolean;
  flip?: boolean;
}

// renders a single looping animation. purely presentational so it can be
// reused by the assignment panel and the final preview.
export function AnimationPreviewPlayer({
  frames,
  fps,
  width,
  height,
  isPlaying = true,
  flip = false,
}: AnimationPreviewPlayerProps) {
  const frameSrc = useAnimationPreviewPlayer(frames, fps, isPlaying);

  return (
    <div className="flex items-center justify-center" style={{ width, height }}>
      {frameSrc ? (
        <img
          src={frameSrc}
          alt=""
          draggable={false}
          className="h-full w-full select-none object-contain"
          style={{
            imageRendering: "pixelated",
            transform: flip ? "scaleX(-1)" : undefined,
          }}
        />
      ) : (
        <span className="text-xs font-medium text-island-muted">No frames</span>
      )}
    </div>
  );
}
