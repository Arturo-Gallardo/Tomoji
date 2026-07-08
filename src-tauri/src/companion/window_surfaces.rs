use serde::Serialize;
use std::collections::HashSet;
use std::sync::{LazyLock, Mutex};
use tauri::Manager;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowSurface {
    pub hwnd: isize,
    pub left: i32,
    pub right: i32,
    pub top: i32,
    pub bottom: i32,
    pub title_bar_bottom: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WindowWallSide {
    Left,
    Right,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowWallHit {
    pub hwnd: isize,
    pub left: i32,
    pub right: i32,
    pub top: i32,
    pub bottom: i32,
    pub side: WindowWallSide,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowBottomHit {
    pub hwnd: isize,
    pub left: i32,
    pub right: i32,
    pub top: i32,
    pub bottom: i32,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WindowSnapKind {
    TitleBar,
    WallLeft,
    WallRight,
    Underside,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowSnapHit {
    pub kind: WindowSnapKind,
    pub surface: WindowSurface,
}

static EXCLUDED_HWNDS: LazyLock<Mutex<HashSet<isize>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

const MIN_SURFACE_WIDTH: i32 = 200;
const MIN_SURFACE_HEIGHT: i32 = 80;
const TITLE_BAR_BAND_MIN: i32 = 8;
const TITLE_BAR_BAND_MAX: i32 = 48;
// magnet zone around the title bar — larger below so you can snap from under the bar
const HIT_TOLERANCE_X: i32 = 32;
const HIT_TOLERANCE_Y_ABOVE: i32 = 24;
const HIT_TOLERANCE_Y_BELOW: i32 = 56;
const WALL_HIT_TOLERANCE_X: i32 = 36;
const WALL_HIT_TOLERANCE_Y: i32 = 32;
const BOTTOM_HIT_PADDING_X: i32 = 64;
const BOTTOM_HIT_TOLERANCE_ABOVE: i32 = 12;
const BOTTOM_HIT_TOLERANCE_BELOW: i32 = 16;
const MIN_BOTTOM_CRAWL_WIDTH: i32 = 200;
const MIN_BOTTOM_CRAWL_HEIGHT: i32 = 160;
const MIN_WALL_CLIMB_HEIGHT: i32 = 160;
// sprite hangs below the underside anchor (128px tall, anchor at y=48)
const BOTTOM_CRAWL_SPRITE_REACH_BELOW_ANCHOR: i32 = 80;
const WORK_AREA_BOTTOM_PADDING: i32 = 8;

pub fn register_excluded_hwnd(hwnd: isize) {
    if hwnd == 0 {
        return;
    }

    if let Ok(mut excluded) = EXCLUDED_HWNDS.lock() {
        excluded.insert(hwnd);
    }
}

fn excluded_hwnds() -> std::sync::MutexGuard<'static, HashSet<isize>> {
    EXCLUDED_HWNDS
        .lock()
        .expect("excluded hwnd mutex poisoned")
}

pub fn register_excluded_hwnds_from_app(app: &tauri::AppHandle) -> Result<(), String> {
    // exclude every app-owned window (companion instances are created
    // dynamically, so enumerate rather than hardcode labels)
    for (_, window) in app.webview_windows() {
        if let Ok(hwnd) = window.hwnd() {
            register_excluded_hwnd(hwnd.0 as isize);
        }
    }

    #[cfg(windows)]
    register_shell_taskbar_hwnds();

    Ok(())
}

#[cfg(windows)]
fn register_shell_taskbar_hwnds() {
    use windows::core::w;
    use windows::Win32::UI::WindowsAndMessaging::FindWindowW;

    for class in [w!("Shell_TrayWnd"), w!("Shell_SecondaryTrayWnd")] {
        unsafe {
            if let Ok(hwnd) = FindWindowW(class, None) {
                if !hwnd.0.is_null() {
                    register_excluded_hwnd(hwnd.0 as isize);
                }
            }
        }
    }
}

#[cfg(windows)]
fn is_excluded(hwnd: isize) -> bool {
    excluded_hwnds().contains(&hwnd)
}

#[cfg(windows)]
fn title_bar_band_height() -> i32 {
    use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CYFRAME, SM_CYCAPTION};

    unsafe {
        let caption = GetSystemMetrics(SM_CYCAPTION);
        let frame = GetSystemMetrics(SM_CYFRAME);
        (caption + frame).clamp(TITLE_BAR_BAND_MIN, TITLE_BAR_BAND_MAX)
    }
}

#[cfg(windows)]
fn is_cloaked(hwnd: windows::Win32::Foundation::HWND) -> bool {
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};

    let mut cloaked = 0u32;

    unsafe {
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_CLOAKED,
            std::ptr::addr_of_mut!(cloaked).cast(),
            std::mem::size_of_val(&cloaked) as u32,
        )
        .is_ok()
            && cloaked != 0
    }
}

#[cfg(windows)]
fn surface_from_hwnd(hwnd: windows::Win32::Foundation::HWND) -> Option<WindowSurface> {
    use windows::Win32::Foundation::RECT;
    use windows::Win32::UI::WindowsAndMessaging::{
        GetAncestor, GetWindowLongPtrW, GetWindowRect, IsIconic, IsWindowVisible, IsZoomed, GA_ROOT,
        GWL_EXSTYLE, GWL_STYLE, WS_CAPTION, WS_EX_TOOLWINDOW,
    };

    let hwnd_isize = hwnd.0 as isize;

    if hwnd.0.is_null() || is_excluded(hwnd_isize) {
        return None;
    }

    unsafe {
        if !IsWindowVisible(hwnd).as_bool() || IsIconic(hwnd).as_bool() || is_cloaked(hwnd) {
            return None;
        }

        let root = GetAncestor(hwnd, GA_ROOT);
        if root.0.is_null() {
            return None;
        }

        if root != hwnd {
            return surface_from_hwnd(root);
        }

        if is_disallowed_shell_root(hwnd) {
            return None;
        }

        let style = GetWindowLongPtrW(hwnd, GWL_STYLE) as u32;
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
        let has_caption = style & WS_CAPTION.0 != 0;
        let is_tool_window = ex_style & WS_EX_TOOLWINDOW.0 != 0;

        if !has_caption && is_tool_window {
            return None;
        }

        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_err() {
            return None;
        }

        let width = rect.right - rect.left;
        let height = rect.bottom - rect.top;

        if width < MIN_SURFACE_WIDTH || height < MIN_SURFACE_HEIGHT {
            return None;
        }

        if is_phantom_snap_surface(hwnd, &rect) {
            return None;
        }

        // Maximized/fullscreen windows should behave like monitor edges, not
        // window surfaces. Otherwise pets can lock to the app wall and face the
        // wrong direction instead of hugging the screen bezel.
        if IsZoomed(hwnd).as_bool() || rect_covers_monitor(&rect) {
            return None;
        }

        let band = title_bar_band_height();
        let top = rect.top;
        let title_bar_bottom = top + band;

        Some(WindowSurface {
            hwnd: hwnd_isize,
            left: rect.left,
            right: rect.right,
            top,
            bottom: rect.bottom,
            title_bar_bottom,
        })
    }
}

#[cfg(windows)]
fn point_hits_surface(surface: &WindowSurface, x: f64, y: f64) -> bool {
    let x = x.round() as i32;
    let y = y.round() as i32;

    x >= surface.left - HIT_TOLERANCE_X
        && x <= surface.right + HIT_TOLERANCE_X
        && y >= surface.top - HIT_TOLERANCE_Y_ABOVE
        && y <= surface.title_bar_bottom + HIT_TOLERANCE_Y_BELOW
}

#[cfg(windows)]
fn distance_to_title_band(surface: &WindowSurface, y: i32) -> i32 {
    if y < surface.top {
        surface.top - y
    } else if y > surface.title_bar_bottom {
        y - surface.title_bar_bottom
    } else {
        0
    }
}

#[cfg(windows)]
fn surface_point_is_visible(
    surfaces: &[WindowSurface],
    surface_index: usize,
    x: i32,
    y: i32,
) -> bool {
    // EnumWindows returns top-level windows in top-to-bottom z-order.
    !surfaces[..surface_index].iter().any(|covering| {
        x >= covering.left
            && x < covering.right
            && y >= covering.top
            && y < covering.bottom
    })
}

#[cfg(windows)]
fn find_nearby_title_bar(surfaces: &[WindowSurface], x: f64, y: f64) -> Option<WindowSurface> {
    surfaces
        .iter()
        .enumerate()
        .filter(|(surface_index, surface)| {
            if !point_hits_surface(surface, x, y) {
                return false;
            }

            let probe_x = (x.round() as i32).clamp(surface.left, surface.right.saturating_sub(1));
            let probe_y = (y.round() as i32).clamp(surface.top, surface.title_bar_bottom);
            surface_point_is_visible(surfaces, *surface_index, probe_x, probe_y)
        })
        .min_by_key(|(_, surface)| distance_to_title_band(surface, y.round() as i32))
        .map(|(_, surface)| surface.clone())
}

#[cfg(windows)]
pub fn query_window_surfaces() -> Result<Vec<WindowSurface>, String> {
    use std::sync::Mutex as EnumMutex;
    use windows::Win32::Foundation::{BOOL, HWND, LPARAM, TRUE};
    use windows::Win32::UI::WindowsAndMessaging::EnumWindows;

    static SURFACE_LIST: EnumMutex<Vec<WindowSurface>> = EnumMutex::new(Vec::new());

    unsafe extern "system" fn enum_proc(hwnd: HWND, _: LPARAM) -> BOOL {
        if let Some(surface) = surface_from_hwnd(hwnd) {
            if let Ok(mut surfaces) = SURFACE_LIST.lock() {
                if !surfaces.iter().any(|entry| entry.hwnd == surface.hwnd) {
                    surfaces.push(surface);
                }
            }
        }

        TRUE
    }

    {
        let mut surfaces = SURFACE_LIST
            .lock()
            .map_err(|error| format!("failed to lock surface list: {error}"))?;
        surfaces.clear();
    }

    unsafe {
        if EnumWindows(Some(enum_proc), LPARAM(0)).is_err() {
            return Err("failed to enumerate windows".to_string());
        }
    }

    let surfaces = SURFACE_LIST
        .lock()
        .map_err(|error| format!("failed to read surface list: {error}"))?
        .clone();

    Ok(surfaces)
}

#[cfg(windows)]
pub fn query_hit_title_bar_at(x: f64, y: f64) -> Result<Option<WindowSurface>, String> {
    let surfaces = query_window_surfaces()?;
    Ok(find_nearby_title_bar(&surfaces, x, y))
}

#[cfg(windows)]
fn point_hits_left_wall(surface: &WindowSurface, x: f64, y: f64) -> bool {
    let x = x.round() as i32;
    let y = y.round() as i32;
    let height = surface.bottom - surface.top;

    if height < MIN_WALL_CLIMB_HEIGHT {
        return false;
    }

    x >= surface.left - WALL_HIT_TOLERANCE_X
        && x <= surface.left + WALL_HIT_TOLERANCE_X
        && y >= surface.top - WALL_HIT_TOLERANCE_Y
        && y <= surface.bottom + WALL_HIT_TOLERANCE_Y
}

#[cfg(windows)]
fn point_hits_right_wall(surface: &WindowSurface, x: f64, y: f64) -> bool {
    let x = x.round() as i32;
    let y = y.round() as i32;
    let height = surface.bottom - surface.top;

    if height < MIN_WALL_CLIMB_HEIGHT {
        return false;
    }

    x >= surface.right - WALL_HIT_TOLERANCE_X
        && x <= surface.right + WALL_HIT_TOLERANCE_X
        && y >= surface.top - WALL_HIT_TOLERANCE_Y
        && y <= surface.bottom + WALL_HIT_TOLERANCE_Y
}

#[cfg(windows)]
fn distance_to_vertical_edge(surface: &WindowSurface, side: WindowWallSide, x: i32) -> i32 {
    match side {
        WindowWallSide::Left => (x - surface.left).abs(),
        WindowWallSide::Right => (x - surface.right).abs(),
    }
}

#[cfg(windows)]
fn wall_hit_from_surface(surface: &WindowSurface, side: WindowWallSide) -> WindowWallHit {
    WindowWallHit {
        hwnd: surface.hwnd,
        left: surface.left,
        right: surface.right,
        top: surface.top,
        bottom: surface.bottom,
        side,
    }
}

#[cfg(windows)]
fn wall_side_is_visible(
    surfaces: &[WindowSurface],
    surface_index: usize,
    side: WindowWallSide,
    y: f64,
) -> bool {
    let surface = &surfaces[surface_index];
    let probe_x = match side {
        WindowWallSide::Left => surface.left,
        WindowWallSide::Right => surface.right.saturating_sub(1),
    };
    let probe_y = (y.round() as i32).clamp(surface.top, surface.bottom.saturating_sub(1));

    surface_point_is_visible(surfaces, surface_index, probe_x, probe_y)
}

#[cfg(windows)]
fn find_nearby_window_wall(surfaces: &[WindowSurface], x: f64, y: f64) -> Option<WindowWallHit> {
    let x_i = x.round() as i32;

    let mut best: Option<(WindowWallHit, i32)> = None;

    for (surface_index, surface) in surfaces.iter().enumerate() {
        if point_hits_left_wall(surface, x, y)
            && wall_side_is_visible(surfaces, surface_index, WindowWallSide::Left, y)
        {
            let distance = distance_to_vertical_edge(surface, WindowWallSide::Left, x_i);
            let hit = wall_hit_from_surface(surface, WindowWallSide::Left);
            if best.as_ref().map(|(_, d)| distance < *d).unwrap_or(true) {
                best = Some((hit, distance));
            }
        }

        if point_hits_right_wall(surface, x, y)
            && wall_side_is_visible(surfaces, surface_index, WindowWallSide::Right, y)
        {
            let distance = distance_to_vertical_edge(surface, WindowWallSide::Right, x_i);
            let hit = wall_hit_from_surface(surface, WindowWallSide::Right);
            if best.as_ref().map(|(_, d)| distance < *d).unwrap_or(true) {
                best = Some((hit, distance));
            }
        }
    }

    best.map(|(hit, _)| hit)
}

#[cfg(windows)]
pub fn query_hit_window_wall_at(x: f64, y: f64) -> Result<Option<WindowWallHit>, String> {
    let surfaces = query_window_surfaces()?;
    Ok(find_nearby_window_wall(&surfaces, x, y))
}

#[cfg(windows)]
fn root_hwnd(hwnd: windows::Win32::Foundation::HWND) -> windows::Win32::Foundation::HWND {
    use windows::Win32::UI::WindowsAndMessaging::{GetAncestor, GA_ROOT};

    unsafe {
        let root = GetAncestor(hwnd, GA_ROOT);
        if root.0.is_null() {
            hwnd
        } else {
            root
        }
    }
}

#[cfg(windows)]
fn window_class_name(hwnd: windows::Win32::Foundation::HWND) -> String {
    use windows::Win32::UI::WindowsAndMessaging::GetClassNameW;

    let mut buffer = [0u16; 256];

    unsafe {
        let len = GetClassNameW(hwnd, &mut buffer);
        if len == 0 {
            return String::new();
        }

        String::from_utf16_lossy(&buffer[..len as usize])
    }
}

#[cfg(windows)]
fn is_disallowed_shell_root(hwnd: windows::Win32::Foundation::HWND) -> bool {
    matches!(
        window_class_name(hwnd).as_str(),
        "Shell_TrayWnd" | "Shell_SecondaryTrayWnd" | "Progman" | "WorkerW"
    )
}

#[cfg(windows)]
fn window_title(hwnd: windows::Win32::Foundation::HWND) -> String {
    use windows::Win32::UI::WindowsAndMessaging::GetWindowTextW;

    let mut buffer = [0u16; 512];

    unsafe {
        let len = GetWindowTextW(hwnd, &mut buffer);
        if len == 0 {
            return String::new();
        }

        String::from_utf16_lossy(&buffer[..len as usize])
    }
}

#[cfg(windows)]
fn rect_covers_work_area(rect: &windows::Win32::Foundation::RECT) -> bool {
    const EDGE_TOLERANCE: i32 = 4;

    let center_x = (rect.left + rect.right) / 2;
    let probe_y = rect.top.max(rect.bottom.saturating_sub(1));
    let Some(info) = monitor_info_at_point(center_x, probe_y) else {
        return false;
    };

    let work = info.rcWork;

    rect.left <= work.left + EDGE_TOLERANCE
        && rect.right >= work.right - EDGE_TOLERANCE
        && rect.top <= work.top + EDGE_TOLERANCE
        && rect.bottom >= work.bottom - EDGE_TOLERANCE
}

#[cfg(windows)]
fn rect_covers_monitor(rect: &windows::Win32::Foundation::RECT) -> bool {
    const EDGE_TOLERANCE: i32 = 4;

    let center_x = (rect.left + rect.right) / 2;
    let center_y = (rect.top + rect.bottom) / 2;
    let Some(info) = monitor_info_at_point(center_x, center_y) else {
        return false;
    };

    let monitor = info.rcMonitor;

    rect.left <= monitor.left + EDGE_TOLERANCE
        && rect.right >= monitor.right - EDGE_TOLERANCE
        && rect.top <= monitor.top + EDGE_TOLERANCE
        && rect.bottom >= monitor.bottom - EDGE_TOLERANCE
}

// invisible fullscreen hosts (empty UWP frame, desktop, gpu overlay) register as
// huge window surfaces and magnet-snag pets at screen edges above the taskbar
#[cfg(windows)]
fn is_phantom_snap_surface(
    hwnd: windows::Win32::Foundation::HWND,
    rect: &windows::Win32::Foundation::RECT,
) -> bool {
    match window_class_name(hwnd).as_str() {
        "CEF-OSC-WIDGET" => true,
        "ApplicationFrameWindow" => window_title(hwnd).is_empty() && rect_covers_work_area(rect),
        "Windows.UI.Core.CoreWindow" => window_title(hwnd).is_empty() && rect_covers_work_area(rect),
        _ => false,
    }
}

#[cfg(windows)]
fn is_shell_taskbar_hwnd(hwnd: isize) -> bool {
    let hwnd = windows::Win32::Foundation::HWND(hwnd as *mut std::ffi::c_void);
    is_disallowed_shell_root(root_hwnd(hwnd))
}

#[cfg(windows)]
fn monitor_info_at_point(x: i32, y: i32) -> Option<windows::Win32::Graphics::Gdi::MONITORINFO> {
    use windows::Win32::Foundation::POINT;
    use windows::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromPoint, MONITOR_DEFAULTTONEAREST, MONITORINFO};

    let point = POINT { x, y };

    unsafe {
        let monitor = MonitorFromPoint(point, MONITOR_DEFAULTTONEAREST);
        let mut info = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            ..Default::default()
        };

        if GetMonitorInfoW(monitor, &mut info).as_bool() {
            Some(info)
        } else {
            None
        }
    }
}

#[cfg(windows)]
fn point_is_in_shell_taskbar_band(x: f64, y: f64) -> bool {
    let Some(info) = monitor_info_at_point(x.round() as i32, y.round() as i32) else {
        return false;
    };

    // taskbar / shell band — includes the work-area bottom edge line
    y.round() as i32 >= info.rcWork.bottom
}

#[cfg(windows)]
fn max_bottom_crawl_anchor_y(surface: &WindowSurface) -> Option<i32> {
    let center_x = (surface.left + surface.right) / 2;
    let info = monitor_info_at_point(center_x, surface.bottom.saturating_sub(1))?;

    let clearance =
        BOTTOM_CRAWL_SPRITE_REACH_BELOW_ANCHOR + WORK_AREA_BOTTOM_PADDING;
    Some(info.rcWork.bottom - clearance)
}

#[cfg(windows)]
fn surface_allows_bottom_crawl(surface: &WindowSurface) -> bool {
    if is_excluded(surface.hwnd) || is_shell_taskbar_hwnd(surface.hwnd) {
        return false;
    }

    let Some(info) = monitor_info_at_point(
        (surface.left + surface.right) / 2,
        surface.bottom.saturating_sub(1),
    ) else {
        return true;
    };

    const MONITOR_EDGE_TOLERANCE: i32 = 2;
    if surface.bottom >= info.rcMonitor.bottom - MONITOR_EDGE_TOLERANCE {
        return false;
    }

    // window bottom must sit above the taskbar band, with room for the sprite below the anchor
    let Some(max_anchor_y) = max_bottom_crawl_anchor_y(surface) else {
        return true;
    };

    surface.bottom <= max_anchor_y
}

#[cfg(windows)]
fn max_bottom_hit_y(surface: &WindowSurface, x: f64) -> i32 {
    let mut max_y = surface.bottom + BOTTOM_HIT_TOLERANCE_BELOW;
    let probe_y = surface.bottom.saturating_sub(1);

    if let Some(info) = monitor_info_at_point(x.round() as i32, probe_y) {
        max_y = max_y.min(info.rcWork.bottom - 1);
    }

    max_y
}

#[cfg(windows)]
fn point_hits_window_bottom(surface: &WindowSurface, x: f64, y: f64) -> bool {
    if !surface_allows_bottom_crawl(surface) || point_is_in_shell_taskbar_band(x, y) {
        return false;
    }

    let x_i = x.round() as i32;
    let y_i = y.round() as i32;
    let width = surface.right - surface.left;
    let height = surface.bottom - surface.top;

    if width < MIN_BOTTOM_CRAWL_WIDTH || height < MIN_BOTTOM_CRAWL_HEIGHT {
        return false;
    }

    x_i >= surface.left + BOTTOM_HIT_PADDING_X
        && x_i <= surface.right - BOTTOM_HIT_PADDING_X
        && y_i >= surface.bottom - BOTTOM_HIT_TOLERANCE_ABOVE
        && y_i <= max_bottom_hit_y(surface, x)
}

#[cfg(windows)]
fn bottom_hit_from_surface(surface: &WindowSurface) -> WindowBottomHit {
    WindowBottomHit {
        hwnd: surface.hwnd,
        left: surface.left,
        right: surface.right,
        top: surface.top,
        bottom: surface.bottom,
    }
}

#[cfg(windows)]
fn find_nearby_window_bottom(surfaces: &[WindowSurface], x: f64, y: f64) -> Option<WindowBottomHit> {
    let mut best: Option<(WindowBottomHit, i32)> = None;

    for (surface_index, surface) in surfaces.iter().enumerate() {
        if !point_hits_window_bottom(surface, x, y) {
            continue;
        }

        let probe_x = (x.round() as i32).clamp(surface.left, surface.right.saturating_sub(1));
        let probe_y = surface.bottom.saturating_sub(1);
        if !surface_point_is_visible(surfaces, surface_index, probe_x, probe_y) {
            continue;
        }

        let distance = (y.round() as i32 - surface.bottom).abs();
        let hit = bottom_hit_from_surface(surface);

        if best.as_ref().map(|(_, d)| distance < *d).unwrap_or(true) {
            best = Some((hit, distance));
        }
    }

    best.map(|(hit, _)| hit)
}

#[cfg(windows)]
pub fn query_hit_window_bottom_at(x: f64, y: f64) -> Result<Option<WindowBottomHit>, String> {
    let surfaces = query_window_surfaces()?;
    Ok(find_nearby_window_bottom(&surfaces, x, y))
}

#[cfg(windows)]
pub fn query_hit_window_surface_at(
    x: f64,
    y: f64,
    underside_y: f64,
) -> Result<Option<WindowSnapHit>, String> {
    let surfaces = query_window_surfaces()?;

    if let Some(surface) = find_nearby_title_bar(&surfaces, x, y) {
        return Ok(Some(WindowSnapHit {
            kind: WindowSnapKind::TitleBar,
            surface,
        }));
    }

    if let Some(wall) = find_nearby_window_wall(&surfaces, x, y) {
        let Some(surface) = surfaces.iter().find(|surface| surface.hwnd == wall.hwnd) else {
            return Ok(None);
        };
        let kind = match wall.side {
            WindowWallSide::Left => WindowSnapKind::WallLeft,
            WindowWallSide::Right => WindowSnapKind::WallRight,
        };

        return Ok(Some(WindowSnapHit {
            kind,
            surface: surface.clone(),
        }));
    }

    if let Some(bottom) = find_nearby_window_bottom(&surfaces, x, underside_y) {
        let Some(surface) = surfaces.iter().find(|surface| surface.hwnd == bottom.hwnd) else {
            return Ok(None);
        };

        return Ok(Some(WindowSnapHit {
            kind: WindowSnapKind::Underside,
            surface: surface.clone(),
        }));
    }

    Ok(None)
}

#[cfg(not(windows))]
pub fn query_hit_window_bottom_at(_x: f64, _y: f64) -> Result<Option<WindowBottomHit>, String> {
    Ok(None)
}

#[cfg(not(windows))]
pub fn query_hit_window_wall_at(_x: f64, _y: f64) -> Result<Option<WindowWallHit>, String> {
    Ok(None)
}

#[cfg(not(windows))]
pub fn query_hit_title_bar_at(_x: f64, _y: f64) -> Result<Option<WindowSurface>, String> {
    Ok(None)
}

#[cfg(not(windows))]
pub fn query_hit_window_surface_at(
    _x: f64,
    _y: f64,
    _underside_y: f64,
) -> Result<Option<WindowSnapHit>, String> {
    Ok(None)
}

#[cfg(not(windows))]
pub fn query_window_surfaces() -> Result<Vec<WindowSurface>, String> {
    Ok(Vec::new())
}

#[tauri::command]
pub fn hit_window_wall_at(x: f64, y: f64) -> Result<Option<WindowWallHit>, String> {
    query_hit_window_wall_at(x, y)
}

#[tauri::command]
pub fn get_window_surfaces() -> Result<Vec<WindowSurface>, String> {
    query_window_surfaces()
}

#[tauri::command]
pub fn hit_title_bar_at(x: f64, y: f64) -> Result<Option<WindowSurface>, String> {
    query_hit_title_bar_at(x, y)
}

#[tauri::command]
pub fn hit_window_bottom_at(x: f64, y: f64) -> Result<Option<WindowBottomHit>, String> {
    query_hit_window_bottom_at(x, y)
}

#[tauri::command]
pub fn hit_window_surface_at(
    x: f64,
    y: f64,
    underside_y: f64,
) -> Result<Option<WindowSnapHit>, String> {
    query_hit_window_surface_at(x, y, underside_y)
}
