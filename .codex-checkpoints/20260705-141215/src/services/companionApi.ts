import { invoke } from "@tauri-apps/api/core";
import type {
  DesktopBounds,
  ScreenPosition,
  WindowBottomHit,
  WindowSurface,
  WindowSnapHit,
  WindowWallHit,
  WorkArea,
} from "../types/companion";

export async function getWorkArea(): Promise<WorkArea> {
  return invoke<WorkArea>("get_work_area");
}

export async function getDesktopBounds(): Promise<DesktopBounds> {
  return invoke<DesktopBounds>("get_desktop_bounds");
}

export async function setCompanionPosition(
  position: ScreenPosition,
  anchorYOffset = 128,
  anchorXOffset = 64,
): Promise<void> {
  await invoke("set_companion_position", {
    x: position.x,
    y: position.y,
    anchorXOffset,
    anchorYOffset,
  });
}

export async function setCompanionWindowSize(
  width: number,
  height: number,
): Promise<void> {
  await invoke("set_companion_window_size", { width, height });
}

// spawns (or reveals) the OS window for a single companion instance.
// x/y are the window top-left in physical screen pixels.
export async function createCompanionInstanceWindow(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
): Promise<void> {
  await invoke("create_companion_instance_window", { id, x, y, width, height });
}

export async function createCompanionSpeechInstanceWindow(
  id: string,
): Promise<void> {
  await invoke("create_companion_speech_instance_window", { id });
}

export async function destroyCompanionInstanceWindow(id: string): Promise<void> {
  await invoke("destroy_companion_instance_window", { id });
}

export async function getWindowSurfaces(): Promise<WindowSurface[]> {
  return invoke<WindowSurface[]>("get_window_surfaces");
}

export async function hitTitleBarAt(
  x: number,
  y: number,
): Promise<WindowSurface | null> {
  return invoke<WindowSurface | null>("hit_title_bar_at", { x, y });
}

export async function hitWindowWallAt(
  x: number,
  y: number,
): Promise<WindowWallHit | null> {
  return invoke<WindowWallHit | null>("hit_window_wall_at", { x, y });
}

export async function hitWindowBottomAt(
  x: number,
  y: number,
): Promise<WindowBottomHit | null> {
  return invoke<WindowBottomHit | null>("hit_window_bottom_at", { x, y });
}

export async function hitWindowSurfaceAt(
  x: number,
  y: number,
  undersideY: number,
): Promise<WindowSnapHit | null> {
  return invoke<WindowSnapHit | null>("hit_window_surface_at", {
    x,
    y,
    undersideY,
  });
}
