use std::sync::{LazyLock, Mutex};

use serde::Serialize;
use tauri::window::Color;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder};

use super::{query_desktop_bounds, MonitorWorkArea};

pub const MENU_WINDOW_LABEL: &str = "companion-menu";
pub const COMPANION_MENU_CONFIG_EVENT: &str = "companion-menu-config";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompanionMenuConfigPayload {
    pub wall_locked: bool,
    pub underside_locked: bool,
    pub frozen: bool,
    pub muted: bool,
    pub available_actions: Vec<String>,
    // the companion window the menu should route its actions back to
    pub target_label: String,
}

const MENU_WIDTH: f64 = 152.0;
const DEFAULT_MENU_HEIGHT: f64 = 154.0;
const MAX_MENU_HEIGHT: f64 = 300.0;
const MENU_ITEM_HEIGHT: f64 = 36.0;
const MENU_VERTICAL_PADDING: f64 = 10.0;

#[derive(Clone, Copy)]
struct MenuAnchor {
    screen_x: f64,
    screen_y: f64,
    x: i32,
    y: i32,
}

static MENU_ANCHOR: LazyLock<Mutex<Option<MenuAnchor>>> = LazyLock::new(|| Mutex::new(None));

fn monitor_at_point<'a>(
    x: f64,
    y: f64,
    monitors: &'a [MonitorWorkArea],
) -> Option<&'a MonitorWorkArea> {
    for monitor in monitors {
        let left = monitor.x as f64;
        let top = monitor.y as f64;
        let right = left + monitor.width as f64;
        let bottom = top + monitor.height as f64;

        if x >= left && x <= right && y >= top && y <= bottom {
            return Some(monitor);
        }
    }

    monitors.first()
}

fn clamp_menu_position(
    screen_x: f64,
    screen_y: f64,
    menu_width: f64,
    menu_height: f64,
) -> Result<(i32, i32), String> {
    let bounds = query_desktop_bounds()?;
    let monitor = monitor_at_point(screen_x, screen_y, &bounds.monitors)
        .ok_or_else(|| "no monitors found".to_string())?;

    let mon_left = monitor.x as f64;
    let mon_top = monitor.y as f64;
    let mon_right = mon_left + monitor.width as f64;
    let mon_bottom = mon_top + monitor.height as f64;

    let mut x = screen_x;
    let mut y = screen_y;

    // open above the cursor when the menu would clip off the bottom
    if y + menu_height > mon_bottom {
        y = screen_y - menu_height;
    }

    x = x.clamp(mon_left, (mon_right - menu_width).max(mon_left));
    y = y.clamp(mon_top, (mon_bottom - menu_height).max(mon_top));

    Ok((x.round() as i32, y.round() as i32))
}

pub fn create_companion_menu_window(app: &AppHandle) -> Result<(), String> {
    if app.get_webview_window(MENU_WINDOW_LABEL).is_some() {
        return Ok(());
    }

    let menu_window = WebviewWindowBuilder::new(app, MENU_WINDOW_LABEL, WebviewUrl::default())
        .title("Companion Menu")
        .inner_size(MENU_WIDTH, DEFAULT_MENU_HEIGHT)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .background_color(Color(0, 0, 0, 0))
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .focused(true)
        .visible(false)
        .build()
        .map_err(|error| format!("failed to create companion menu window: {error}"))?;

    let _ = menu_window;

    Ok(())
}

#[tauri::command]
pub fn show_companion_menu(
    caller: tauri::WebviewWindow,
    screen_x: f64,
    screen_y: f64,
    wall_locked: bool,
    underside_locked: bool,
    frozen: bool,
    muted: bool,
    available_actions: Vec<String>,
) -> Result<(), String> {
    let app = caller.app_handle();
    let target_label = caller.label().to_string();

    let window = app
        .get_webview_window(MENU_WINDOW_LABEL)
        .ok_or_else(|| "companion menu window not found".to_string())?;

    let has_animation_menu = !wall_locked && !underside_locked && !available_actions.is_empty();
    let item_count = 5 + if has_animation_menu { 1 } else { 0 };
    let menu_height = MENU_VERTICAL_PADDING + item_count as f64 * MENU_ITEM_HEIGHT;
    let scale_factor = window
        .scale_factor()
        .map_err(|error| format!("failed to read companion menu scale factor: {error}"))?;
    let (window_x, window_y) = clamp_menu_position(
        screen_x,
        screen_y,
        MENU_WIDTH * scale_factor,
        menu_height * scale_factor,
    )?;
    *MENU_ANCHOR
        .lock()
        .map_err(|error| format!("failed to lock companion menu anchor: {error}"))? =
        Some(MenuAnchor {
            screen_x,
            screen_y,
            x: window_x,
            y: window_y,
        });

    window
        .emit(
            COMPANION_MENU_CONFIG_EVENT,
            CompanionMenuConfigPayload {
                wall_locked,
                underside_locked,
                frozen,
                muted,
                available_actions,
                target_label,
            },
        )
        .map_err(|error| format!("failed to emit companion menu config: {error}"))?;

    window
        .set_size(tauri::LogicalSize::new(MENU_WIDTH, menu_height))
        .map_err(|error| format!("failed to resize companion menu window: {error}"))?;

    window
        .set_position(PhysicalPosition::new(window_x, window_y))
        .map_err(|error| format!("failed to position companion menu window: {error}"))?;

    window
        .show()
        .map_err(|error| format!("failed to show companion menu window: {error}"))?;

    window
        .set_focus()
        .map_err(|error| format!("failed to focus companion menu window: {error}"))?;

    Ok(())
}

#[tauri::command]
pub fn resize_companion_menu(
    app: AppHandle,
    expanded: bool,
    animation_item_count: usize,
) -> Result<(), String> {
    let window = app
        .get_webview_window(MENU_WINDOW_LABEL)
        .ok_or_else(|| "companion menu window not found".to_string())?;
    let anchor = MENU_ANCHOR
        .lock()
        .map_err(|error| format!("failed to lock companion menu anchor: {error}"))?
        .ok_or_else(|| "companion menu anchor not found".to_string())?;
    let item_count = 6 + if expanded { animation_item_count } else { 0 };
    let menu_height =
        (MENU_VERTICAL_PADDING + item_count as f64 * MENU_ITEM_HEIGHT).min(MAX_MENU_HEIGHT);
    let bounds = query_desktop_bounds()?;
    let monitor = monitor_at_point(anchor.screen_x, anchor.screen_y, &bounds.monitors)
        .ok_or_else(|| "no monitors found".to_string())?;
    let monitor_top = monitor.y as f64;
    let monitor_bottom = monitor_top + monitor.height as f64;
    let scale_factor = window
        .scale_factor()
        .map_err(|error| format!("failed to read companion menu scale factor: {error}"))?;
    let physical_menu_height = menu_height * scale_factor;
    let window_y = (anchor.y as f64)
        .min(monitor_bottom - physical_menu_height)
        .max(monitor_top);

    window
        .set_size(tauri::LogicalSize::new(MENU_WIDTH, menu_height))
        .map_err(|error| format!("failed to resize companion menu window: {error}"))?;
    window
        .set_position(PhysicalPosition::new(anchor.x, window_y.round() as i32))
        .map_err(|error| format!("failed to reposition companion menu window: {error}"))?;

    Ok(())
}

#[tauri::command]
pub fn hide_companion_menu(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(MENU_WINDOW_LABEL) {
        window
            .hide()
            .map_err(|error| format!("failed to hide companion menu window: {error}"))?;
    }

    Ok(())
}
