use serde::Serialize;
use tauri::window::Color;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder};

use super::query_desktop_bounds;

pub const WALK_PICKER_WINDOW_LABEL: &str = "walk-picker";
pub const WALK_PICKER_SELECTED_EVENT: &str = "walk-picker-selected";
pub const WALK_PICKER_CANCEL_EVENT: &str = "walk-picker-cancel";
pub const TARGET_PICKER_OPEN_EVENT: &str = "target-picker-open";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetPickerOpenPayload {
    pub mode: String,
    pub hint_x: f64,
    // companion window the picker result should be routed back to
    pub target_label: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TargetPickerSelectedPayload {
    pub mode: String,
    pub anchor_x: f64,
    pub anchor_y: f64,
}

pub fn create_walk_picker_window(app: &AppHandle) -> Result<(), String> {
    if app.get_webview_window(WALK_PICKER_WINDOW_LABEL).is_some() {
        return Ok(());
    }

    let picker_window =
        WebviewWindowBuilder::new(app, WALK_PICKER_WINDOW_LABEL, WebviewUrl::default())
            .title("Walk Picker")
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
            .focused(true)
            .visible(false)
            .build()
            .map_err(|error| format!("failed to create walk picker window: {error}"))?;

    let _ = picker_window;

    Ok(())
}

#[tauri::command]
pub fn show_walk_picker(caller: tauri::WebviewWindow, mode: Option<String>) -> Result<(), String> {
    let app = caller.app_handle().clone();
    let target_label = caller.label().to_string();
    let _ = hide_companion_menu(app.clone());

    let bounds = query_desktop_bounds()?;
    let picker_mode = mode.unwrap_or_else(|| "walk".to_string());
    let hint_x = caller
        .outer_position()
        .ok()
        .zip(caller.outer_size().ok())
        .and_then(|(position, size)| {
            let center_x = position.x as f64 + size.width as f64 / 2.0;
            bounds.monitors.iter().find_map(|monitor| {
                (center_x >= monitor.x as f64
                    && center_x < (monitor.x + monitor.width as i32) as f64)
                    .then(|| monitor.x as f64 + monitor.width as f64 / 2.0)
            })
        })
        .unwrap_or(bounds.virtual_left as f64 + bounds.virtual_width as f64 / 2.0)
        - bounds.virtual_left as f64;

    let window = app
        .get_webview_window(WALK_PICKER_WINDOW_LABEL)
        .ok_or_else(|| "walk picker window not found".to_string())?;

    window
        .set_size(tauri::PhysicalSize::new(
            bounds.virtual_width,
            bounds.virtual_height,
        ))
        .map_err(|error| format!("failed to resize walk picker window: {error}"))?;

    window
        .set_position(PhysicalPosition::new(
            bounds.virtual_left,
            bounds.virtual_top,
        ))
        .map_err(|error| format!("failed to position walk picker window: {error}"))?;

    window
        .emit(
            TARGET_PICKER_OPEN_EVENT,
            TargetPickerOpenPayload {
                mode: picker_mode,
                hint_x,
                target_label,
            },
        )
        .map_err(|error| format!("failed to emit target picker config: {error}"))?;

    window
        .show()
        .map_err(|error| format!("failed to show walk picker window: {error}"))?;

    window
        .set_focus()
        .map_err(|error| format!("failed to focus walk picker window: {error}"))?;

    Ok(())
}

#[tauri::command]
pub fn hide_walk_picker(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WALK_PICKER_WINDOW_LABEL) {
        window
            .hide()
            .map_err(|error| format!("failed to hide walk picker window: {error}"))?;
    }

    Ok(())
}

pub fn emit_target_picker_selected(
    app: &AppHandle,
    target_label: &str,
    mode: String,
    anchor_x: f64,
    anchor_y: f64,
) -> Result<(), String> {
    let _ = app.emit_to(
        target_label,
        WALK_PICKER_SELECTED_EVENT,
        TargetPickerSelectedPayload {
            mode,
            anchor_x,
            anchor_y,
        },
    );

    Ok(())
}

pub fn emit_walk_picker_cancel(app: &AppHandle, target_label: &str) -> Result<(), String> {
    let _ = app.emit_to(target_label, WALK_PICKER_CANCEL_EVENT, ());

    Ok(())
}

// called from the walk-picker webview via invoke
#[tauri::command]
pub fn submit_target_picker(
    app: AppHandle,
    target_label: String,
    mode: String,
    anchor_x: f64,
    anchor_y: f64,
) -> Result<(), String> {
    emit_target_picker_selected(&app, &target_label, mode, anchor_x, anchor_y)?;
    hide_walk_picker(app)
}

#[tauri::command]
pub fn cancel_walk_picker(app: AppHandle, target_label: String) -> Result<(), String> {
    emit_walk_picker_cancel(&app, &target_label)?;
    hide_walk_picker(app)
}

fn hide_companion_menu(app: AppHandle) -> Result<(), String> {
    super::menu::hide_companion_menu(app)
}
