mod menu;
mod speech;
mod walk_picker;
mod window_surfaces;

use std::collections::HashSet;
use std::sync::{LazyLock, Mutex};

use serde::Serialize;
use tauri::window::Color;
use tauri::{AppHandle, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder};

pub use menu::{
    create_companion_menu_window, hide_companion_menu, resize_companion_menu, show_companion_menu,
};
pub use speech::{
    destroy_companion_speech_window, ensure_speech_window, hide_companion_speech,
    set_companion_speech_size, show_companion_speech, sync_companion_speech_position,
    take_companion_speech_content,
};
pub use walk_picker::{
    cancel_walk_picker, create_walk_picker_window, hide_walk_picker, show_walk_picker,
    submit_target_picker,
};
pub use window_surfaces::{
    get_window_surfaces, hit_title_bar_at, hit_window_bottom_at, hit_window_surface_at,
    hit_window_wall_at, register_excluded_hwnd, register_excluded_hwnds_from_app,
};

pub const SPRITE_WIDTH: f64 = 128.0;
pub const SPRITE_HEIGHT: f64 = 128.0;
pub const ANCHOR_X: f64 = 64.0;
pub const DEFAULT_ANCHOR_X_OFFSET: f64 = 64.0;
pub const DEFAULT_ANCHOR_Y_OFFSET: f64 = 128.0;

// guards concurrent async creates for the same instance id (react strict mode
// can fire bootstrap twice before the first build finishes)
static COMPANION_CREATING: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

// each on-screen companion is its own window labelled companion-<instanceId>
pub fn companion_window_label(id: &str) -> String {
    format!("companion-{id}")
}

// the instance id for a companion window, or None for sibling windows
// (speech/menu/walk-picker) that happen to share the companion- prefix.
pub fn instance_id_from_companion_label(label: &str) -> Option<String> {
    if label.starts_with("companion-speech-") {
        return None;
    }

    label
        .strip_prefix("companion-")
        .map(|id| id.to_string())
}

pub(crate) fn companion_window_position(
    anchor_x: f64,
    anchor_y: f64,
    anchor_x_offset: f64,
    anchor_y_offset: f64,
) -> (i32, i32) {
    (
        (anchor_x - anchor_x_offset) as i32,
        (anchor_y - anchor_y_offset) as i32,
    )
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorWorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopBounds {
    pub monitors: Vec<MonitorWorkArea>,
    pub virtual_left: i32,
    pub virtual_top: i32,
    pub virtual_width: u32,
    pub virtual_height: u32,
}

fn build_desktop_bounds(monitors: Vec<MonitorWorkArea>) -> DesktopBounds {
    if monitors.is_empty() {
        return DesktopBounds {
            monitors,
            virtual_left: 0,
            virtual_top: 0,
            virtual_width: 1920,
            virtual_height: 1080,
        };
    }

    let virtual_left = monitors.iter().map(|monitor| monitor.x).min().unwrap_or(0);
    let virtual_top = monitors.iter().map(|monitor| monitor.y).min().unwrap_or(0);
    let virtual_right = monitors
        .iter()
        .map(|monitor| monitor.x + monitor.width as i32)
        .max()
        .unwrap_or(0);
    let virtual_bottom = monitors
        .iter()
        .map(|monitor| monitor.y + monitor.height as i32)
        .max()
        .unwrap_or(0);

    DesktopBounds {
        monitors,
        virtual_left,
        virtual_top,
        virtual_width: (virtual_right - virtual_left) as u32,
        virtual_height: (virtual_bottom - virtual_top) as u32,
    }
}

#[cfg(windows)]
pub(crate) fn query_desktop_bounds() -> Result<DesktopBounds, String> {
    use std::sync::Mutex;
    use windows::Win32::Foundation::{BOOL, LPARAM, RECT, TRUE};
    use windows::Win32::Graphics::Gdi::{
        EnumDisplayMonitors, GetMonitorInfoW, HDC, HMONITOR, MONITORINFO,
    };

    static MONITOR_LIST: Mutex<Vec<MonitorWorkArea>> = Mutex::new(Vec::new());

    unsafe extern "system" fn monitor_enum_proc(
        monitor: HMONITOR,
        _device_context: HDC,
        _clip_area: *mut RECT,
        _data: LPARAM,
    ) -> BOOL {
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };

        if !GetMonitorInfoW(monitor, &mut info).as_bool() {
            return TRUE;
        }

        let work_area = info.rcWork;

        if let Ok(mut monitors) = MONITOR_LIST.lock() {
            monitors.push(MonitorWorkArea {
                x: work_area.left,
                y: work_area.top,
                width: (work_area.right - work_area.left) as u32,
                height: (work_area.bottom - work_area.top) as u32,
            });
        }

        TRUE
    }

    {
        let mut monitors = MONITOR_LIST
            .lock()
            .map_err(|error| format!("failed to lock monitor list: {error}"))?;
        monitors.clear();
    }

    unsafe {
        if !EnumDisplayMonitors(None, None, Some(monitor_enum_proc), LPARAM(0)).as_bool() {
            return Err("failed to enumerate monitors".to_string());
        }
    }

    let monitors = MONITOR_LIST
        .lock()
        .map_err(|error| format!("failed to read monitor list: {error}"))?
        .clone();

    Ok(build_desktop_bounds(monitors))
}

#[cfg(windows)]
fn query_work_area() -> Result<WorkArea, String> {
    let bounds = query_desktop_bounds()?;
    let primary = bounds
        .monitors
        .first()
        .cloned()
        .ok_or_else(|| "no monitors found".to_string())?;

    Ok(WorkArea {
        x: primary.x,
        y: primary.y,
        width: primary.width,
        height: primary.height,
    })
}

#[cfg(not(windows))]
pub(crate) fn query_desktop_bounds() -> Result<DesktopBounds, String> {
    Ok(build_desktop_bounds(vec![MonitorWorkArea {
        x: 0,
        y: 0,
        width: 1920,
        height: 1040,
    }]))
}

#[cfg(not(windows))]
fn query_work_area() -> Result<WorkArea, String> {
    Ok(WorkArea {
        x: 0,
        y: 0,
        width: 1920,
        height: 1040,
    })
}

#[tauri::command]
pub fn get_work_area() -> Result<WorkArea, String> {
    query_work_area()
}

#[tauri::command]
pub fn get_desktop_bounds() -> Result<DesktopBounds, String> {
    query_desktop_bounds()
}

#[tauri::command]
pub fn set_companion_position(
    window: tauri::WebviewWindow,
    x: f64,
    y: f64,
    anchor_x_offset: Option<f64>,
    anchor_y_offset: Option<f64>,
) -> Result<(), String> {
    let scale_factor = window
        .scale_factor()
        .map_err(|error| format!("failed to read companion scale factor: {error}"))?;
    let x_offset = anchor_x_offset.unwrap_or(DEFAULT_ANCHOR_X_OFFSET) * scale_factor;
    let y_offset = anchor_y_offset.unwrap_or(DEFAULT_ANCHOR_Y_OFFSET) * scale_factor;
    let (window_x, window_y) = companion_window_position(x, y, x_offset, y_offset);

    // a companion window moves itself, so the caller is the right target
    window
        .set_position(PhysicalPosition::new(window_x, window_y))
        .map_err(|error| format!("failed to move companion window: {error}"))?;

    if let Some(id) = instance_id_from_companion_label(window.label()) {
        let _ = sync_companion_speech_position(window.app_handle(), &id, x, y, y_offset);
    }

    Ok(())
}

fn apply_companion_window_size(
    window: &tauri::WebviewWindow,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let size = LogicalSize::new(width, height);

    // borderless windows on windows often ignore set_size unless briefly resizable
    #[cfg(windows)]
    {
        window
            .set_resizable(true)
            .map_err(|error| format!("failed to unlock companion resize: {error}"))?;
        window
            .set_size(size)
            .map_err(|error| format!("failed to resize companion window: {error}"))?;
        window
            .set_resizable(false)
            .map_err(|error| format!("failed to lock companion resize: {error}"))?;
        return Ok(());
    }

    #[cfg(not(windows))]
    {
        window
            .set_size(size)
            .map_err(|error| format!("failed to resize companion window: {error}"))?;
        Ok(())
    }
}

#[tauri::command]
pub fn set_companion_window_size(
    window: tauri::WebviewWindow,
    width: f64,
    height: f64,
) -> Result<(), String> {
    apply_companion_window_size(&window, width, height)
}

// spawns (or reveals) the OS window for a single companion instance. x/y are
// the window top-left in physical screen pixels.
//
// async on purpose: sync commands run on the main thread, and building a
// webview window blocks until the main event loop creates it, so a sync version
// deadlocks. running off-thread lets the loop service the build.
#[tauri::command]
pub async fn create_companion_instance_window(
    app: AppHandle,
    id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let label = companion_window_label(&id);

    if let Some(existing) = app.get_webview_window(&label) {
        apply_companion_window_size(&existing, width, height)?;
        existing
            .show()
            .map_err(|error| format!("failed to show companion window: {error}"))?;
        return Ok(());
    }

    {
        let mut creating = COMPANION_CREATING
            .lock()
            .map_err(|error| format!("failed to lock companion create guard: {error}"))?;
        if !creating.insert(id.clone()) {
            // another invoke is already building this label — let it finish
            return Ok(());
        }
    }

    let build_result: Result<(), String> = async {
        let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::default())
            .title("Companion")
            .inner_size(width, height)
            .decorations(false)
            .transparent(true)
            // shadows break transparency on windows and show as a grey box around the sprite
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
            .map_err(|error| format!("failed to create companion window: {error}"))?;

        window
            .set_position(PhysicalPosition::new(x.round() as i32, y.round() as i32))
            .map_err(|error| format!("failed to position companion window: {error}"))?;
        window
            .show()
            .map_err(|error| format!("failed to show companion window: {error}"))?;

        // keep companions from grabbing each other as draggable surfaces
        if let Ok(hwnd) = window.hwnd() {
            register_excluded_hwnd(hwnd.0 as isize);
        }

        Ok(())
    }
    .await;

    if let Ok(mut creating) = COMPANION_CREATING.lock() {
        creating.remove(&id);
    }

    build_result
}

// spawns the hidden speech bubble window for an instance. kept separate from
// the companion create so we never nest two webview builds in one command.
#[tauri::command]
pub async fn create_companion_speech_instance_window(
    app: AppHandle,
    id: String,
) -> Result<(), String> {
    ensure_speech_window(&app, &id)
}

#[tauri::command]
pub fn destroy_companion_instance_window(app: AppHandle, id: String) -> Result<(), String> {
    let _ = destroy_companion_speech_window(&app, &id);

    if let Some(window) = app.get_webview_window(&companion_window_label(&id)) {
        window
            .close()
            .map_err(|error| format!("failed to close companion window: {error}"))?;
    }

    Ok(())
}
