use serde::Deserialize;
use tauri::window::Color;
use tauri::{AppHandle, Manager, PhysicalPosition, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use super::{query_desktop_bounds, register_excluded_hwnd};

pub const COMPANION_OVERLAY_WINDOW_LABEL: &str = "companion-overlay";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompanionOverlayHitRegion {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

fn position_overlay_window(window: &WebviewWindow) -> Result<(), String> {
    let bounds = query_desktop_bounds()?;

    window
        .set_size(tauri::PhysicalSize::new(
            bounds.virtual_width,
            bounds.virtual_height,
        ))
        .map_err(|error| format!("failed to resize companion overlay: {error}"))?;

    window
        .set_position(PhysicalPosition::new(
            bounds.virtual_left,
            bounds.virtual_top,
        ))
        .map_err(|error| format!("failed to position companion overlay: {error}"))?;

    Ok(())
}

#[cfg(windows)]
fn apply_overlay_hit_regions(
    window: &WebviewWindow,
    regions: &[CompanionOverlayHitRegion],
    capture_all: bool,
) -> Result<(), String> {
    use std::ffi::c_void;
    use windows::Win32::Foundation::{BOOL, HWND};
    use windows::Win32::Graphics::Gdi::{
        CombineRgn, CreateRectRgn, DeleteObject, SetWindowRgn, RGN_OR,
    };

    let hwnd = window
        .hwnd()
        .map_err(|error| format!("failed to read companion overlay hwnd: {error}"))?;
    let hwnd = HWND(hwnd.0 as *mut c_void);
    let bounds = query_desktop_bounds()?;

    unsafe {
        let union_region = if capture_all {
            CreateRectRgn(
                0,
                0,
                bounds.virtual_width as i32,
                bounds.virtual_height as i32,
            )
        } else {
            let union_region = CreateRectRgn(0, 0, 0, 0);

            for region in regions {
                if region.width <= 0.0 || region.height <= 0.0 {
                    continue;
                }

                let left = region.x.floor() as i32;
                let top = region.y.floor() as i32;
                let right = (region.x + region.width).ceil() as i32;
                let bottom = (region.y + region.height).ceil() as i32;
                let rect_region = CreateRectRgn(left, top, right, bottom);

                CombineRgn(union_region, union_region, rect_region, RGN_OR);
                let _ = DeleteObject(rect_region);
            }

            union_region
        };

        if union_region.is_invalid() {
            return Err("failed to create companion overlay hit region".to_string());
        }

        let result = SetWindowRgn(hwnd, union_region, BOOL(1));
        if result == 0 {
            let _ = DeleteObject(union_region);
            return Err("failed to apply companion overlay hit region".to_string());
        }
    }

    Ok(())
}

#[cfg(not(windows))]
fn apply_overlay_hit_regions(
    _window: &WebviewWindow,
    _regions: &[CompanionOverlayHitRegion],
    _capture_all: bool,
) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn show_companion_overlay(app: AppHandle) -> Result<(), String> {
    let window = if let Some(existing) = app.get_webview_window(COMPANION_OVERLAY_WINDOW_LABEL) {
        existing
    } else {
        let overlay_window = WebviewWindowBuilder::new(
            &app,
            COMPANION_OVERLAY_WINDOW_LABEL,
            WebviewUrl::default(),
        )
        .title("Tomoji Overlay")
        .inner_size(1.0, 1.0)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .background_color(Color(0, 0, 0, 0))
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .focused(false)
        .visible(false)
        .build()
        .map_err(|error| format!("failed to create companion overlay: {error}"))?;

        if let Ok(hwnd) = overlay_window.hwnd() {
            register_excluded_hwnd(hwnd.0 as isize);
        }

        overlay_window
    };

    position_overlay_window(&window)?;
    apply_overlay_hit_regions(&window, &[], false)?;

    window
        .show()
        .map_err(|error| format!("failed to show companion overlay: {error}"))?;

    Ok(())
}

#[tauri::command]
pub fn hide_companion_overlay(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(COMPANION_OVERLAY_WINDOW_LABEL) {
        window
            .hide()
            .map_err(|error| format!("failed to hide companion overlay: {error}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn set_companion_overlay_hit_regions(
    app: AppHandle,
    regions: Vec<CompanionOverlayHitRegion>,
    capture_all: bool,
) -> Result<(), String> {
    let Some(window) = app.get_webview_window(COMPANION_OVERLAY_WINDOW_LABEL) else {
        return Ok(());
    };

    apply_overlay_hit_regions(&window, &regions, capture_all)
}
