use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};

use serde::Serialize;
use tauri::window::Color;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder,
};

use super::{
    query_desktop_bounds, register_excluded_hwnd, MonitorWorkArea, ANCHOR_X,
    DEFAULT_ANCHOR_Y_OFFSET, SPRITE_HEIGHT, SPRITE_WIDTH,
};

pub const COMPANION_SPEECH_CONTENT_EVENT: &str = "companion-speech-content";
pub const COMPANION_SPEECH_DISMISS_EVENT: &str = "companion-speech-dismiss";
pub const COMPANION_SPEECH_PLACEMENT_EVENT: &str = "companion-speech-placement";
pub const SPEECH_BUBBLE_GAP: f64 = 4.0;

const SPEECH_INITIAL_WIDTH: f64 = 128.0;
const SPEECH_INITIAL_HEIGHT: f64 = 32.0;
const SPEECH_SIDE_GAP: f64 = 4.0;

// one speech window per companion instance, labelled companion-speech-<id>
pub fn speech_window_label(id: &str) -> String {
    format!("companion-speech-{id}")
}

fn instance_id_from_speech_label(label: &str) -> Option<String> {
    label
        .strip_prefix("companion-speech-")
        .map(|id| id.to_string())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SpeechBubblePlacement {
    Above,
    Left,
    Right,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompanionSpeechContentPayload {
    text: String,
    anchor_x: f64,
    anchor_y: f64,
    placement: SpeechBubblePlacement,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompanionSpeechPlacementPayload {
    placement: SpeechBubblePlacement,
}

#[derive(Debug, Clone, Copy)]
struct SpeechWindowState {
    visible: bool,
    anchor_x: f64,
    anchor_y: f64,
    width: f64,
    height: f64,
    placement: SpeechBubblePlacement,
}

impl Default for SpeechWindowState {
    fn default() -> Self {
        Self {
            visible: false,
            anchor_x: 0.0,
            anchor_y: 0.0,
            width: SPEECH_INITIAL_WIDTH,
            height: SPEECH_INITIAL_HEIGHT,
            placement: SpeechBubblePlacement::Above,
        }
    }
}

// per-instance speech state + pending bubble text, keyed by instance id
static SPEECH_STATES: LazyLock<Mutex<HashMap<String, SpeechWindowState>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static PENDING_SPEECH_TEXT: LazyLock<Mutex<HashMap<String, String>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn read_speech_state(id: &str) -> SpeechWindowState {
    SPEECH_STATES
        .lock()
        .ok()
        .and_then(|states| states.get(id).copied())
        .unwrap_or_default()
}

fn update_speech_state(id: &str, update: impl FnOnce(&mut SpeechWindowState)) {
    if let Ok(mut states) = SPEECH_STATES.lock() {
        let entry = states.entry(id.to_string()).or_default();
        update(entry);
    }
}

// builds the speech window only when needed. first-speech text is stored before
// lazy creation so the webview can recover it even if it mounts after the event.
pub fn ensure_speech_window(app: &AppHandle, id: &str) -> Result<(), String> {
    let label = speech_window_label(id);
    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(app, &label, WebviewUrl::default())
        .title("Companion Speech")
        .inner_size(SPEECH_INITIAL_WIDTH, SPEECH_INITIAL_HEIGHT)
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
        .map_err(|error| format!("failed to create companion speech window: {error}"))?;

    if let Ok(hwnd) = window.hwnd() {
        register_excluded_hwnd(hwnd.0 as isize);
    }

    Ok(())
}

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

fn clamp_to_monitor(
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    mon_left: f64,
    mon_top: f64,
    mon_right: f64,
    mon_bottom: f64,
) -> (f64, f64) {
    (
        x.clamp(mon_left, (mon_right - width).max(mon_left)),
        y.clamp(mon_top, (mon_bottom - height).max(mon_top)),
    )
}

struct ResolvedSpeechBounds {
    x: f64,
    y: f64,
    placement: SpeechBubblePlacement,
}

fn resolve_speech_bounds(
    anchor_x: f64,
    anchor_y: f64,
    anchor_y_offset: f64,
    speech_width: f64,
    speech_height: f64,
) -> Result<ResolvedSpeechBounds, String> {
    let bounds = query_desktop_bounds()?;
    let monitor = monitor_at_point(anchor_x, anchor_y, &bounds.monitors)
        .ok_or_else(|| "no monitors found".to_string())?;

    let mon_left = monitor.x as f64;
    let mon_top = monitor.y as f64;
    let mon_right = mon_left + monitor.width as f64;
    let mon_bottom = mon_top + monitor.height as f64;

    let sprite_left = anchor_x - ANCHOR_X;
    let sprite_right = sprite_left + SPRITE_WIDTH;
    let sprite_top = anchor_y - anchor_y_offset;
    let sprite_bottom = sprite_top + SPRITE_HEIGHT;

    let above_y = sprite_top - SPEECH_BUBBLE_GAP - speech_height;
    let above_x = anchor_x - speech_width / 2.0;

    if above_y >= mon_top {
        let (x, y) = clamp_to_monitor(
            above_x,
            above_y,
            speech_width,
            speech_height,
            mon_left,
            mon_top,
            mon_right,
            mon_bottom,
        );

        return Ok(ResolvedSpeechBounds {
            x,
            y,
            placement: SpeechBubblePlacement::Above,
        });
    }

    let left_space = sprite_left - SPEECH_SIDE_GAP - mon_left;
    let right_space = mon_right - sprite_right - SPEECH_SIDE_GAP;

    let placement = if left_space >= right_space {
        SpeechBubblePlacement::Left
    } else {
        SpeechBubblePlacement::Right
    };

    let side_y = (sprite_top + sprite_bottom) / 2.0 - speech_height / 2.0;
    let side_x = match placement {
        SpeechBubblePlacement::Left => sprite_left - SPEECH_SIDE_GAP - speech_width,
        SpeechBubblePlacement::Right => sprite_right + SPEECH_SIDE_GAP,
        SpeechBubblePlacement::Above => unreachable!(),
    };

    let (x, y) = clamp_to_monitor(
        side_x,
        side_y,
        speech_width,
        speech_height,
        mon_left,
        mon_top,
        mon_right,
        mon_bottom,
    );

    Ok(ResolvedSpeechBounds { x, y, placement })
}

fn emit_speech_placement(
    app: &AppHandle,
    id: &str,
    placement: SpeechBubblePlacement,
) -> Result<(), String> {
    let _ = app.emit_to(
        speech_window_label(id),
        COMPANION_SPEECH_PLACEMENT_EVENT,
        CompanionSpeechPlacementPayload { placement },
    );

    Ok(())
}

fn apply_companion_speech_bounds(
    app: &AppHandle,
    id: &str,
    anchor_x: f64,
    anchor_y: f64,
    anchor_y_offset: f64,
    speech_width: f64,
    speech_height: f64,
    show_window: bool,
) -> Result<SpeechBubblePlacement, String> {
    let previous = read_speech_state(id).placement;
    let resolved = resolve_speech_bounds(
        anchor_x,
        anchor_y,
        anchor_y_offset,
        speech_width,
        speech_height,
    )?;

    let window = app
        .get_webview_window(&speech_window_label(id))
        .ok_or_else(|| "companion speech window not found".to_string())?;

    window
        .set_size(LogicalSize::new(speech_width, speech_height))
        .map_err(|error| format!("failed to resize companion speech window: {error}"))?;

    window
        .set_position(PhysicalPosition::new(
            resolved.x.round() as i32,
            resolved.y.round() as i32,
        ))
        .map_err(|error| format!("failed to reposition companion speech window: {error}"))?;

    update_speech_state(id, |stored| {
        stored.placement = resolved.placement;
    });

    if previous != resolved.placement {
        emit_speech_placement(app, id, resolved.placement)?;
    }

    if show_window {
        window
            .show()
            .map_err(|error| format!("failed to show companion speech window: {error}"))?;
    }

    Ok(resolved.placement)
}

pub fn sync_companion_speech_position(
    app: &AppHandle,
    id: &str,
    anchor_x: f64,
    anchor_y: f64,
    anchor_y_offset: f64,
) -> Result<(), String> {
    let state = read_speech_state(id);

    if !state.visible {
        return Ok(());
    }

    if app.get_webview_window(&speech_window_label(id)).is_none() {
        return Ok(());
    }

    update_speech_state(id, |stored| {
        stored.anchor_x = anchor_x;
        stored.anchor_y = anchor_y;
    });

    let _ = apply_companion_speech_bounds(
        app,
        id,
        anchor_x,
        anchor_y,
        anchor_y_offset,
        state.width,
        state.height,
        false,
    )?;

    Ok(())
}

#[tauri::command]
pub fn take_companion_speech_content(
    window: tauri::WebviewWindow,
) -> Result<Option<String>, String> {
    let Some(id) = instance_id_from_speech_label(window.label()) else {
        return Ok(None);
    };

    let mut pending = PENDING_SPEECH_TEXT
        .lock()
        .map_err(|error| format!("failed to read pending speech content: {error}"))?;

    Ok(pending.remove(&id))
}

// async so the lazy speech-window build runs off the main thread (see the note
// on create_companion_instance_window — a sync build would deadlock).
#[tauri::command]
pub async fn show_companion_speech(
    window: tauri::WebviewWindow,
    text: String,
    anchor_x: f64,
    anchor_y: f64,
) -> Result<(), String> {
    let id = super::instance_id_from_companion_label(window.label())
        .ok_or_else(|| "speech requested from a non-companion window".to_string())?;

    let app = window.app_handle();
    {
        let mut pending = PENDING_SPEECH_TEXT
            .lock()
            .map_err(|error| format!("failed to store pending speech content: {error}"))?;
        pending.insert(id.clone(), text.clone());
    }

    ensure_speech_window(app, &id)?;

    update_speech_state(&id, |state| {
        state.visible = true;
        state.anchor_x = anchor_x;
        state.anchor_y = anchor_y;
        state.width = SPEECH_INITIAL_WIDTH;
        state.height = SPEECH_INITIAL_HEIGHT;
    });

    let placement = apply_companion_speech_bounds(
        app,
        &id,
        anchor_x,
        anchor_y,
        DEFAULT_ANCHOR_Y_OFFSET,
        SPEECH_INITIAL_WIDTH,
        SPEECH_INITIAL_HEIGHT,
        true,
    )?;

    let _ = app.emit_to(
        speech_window_label(&id),
        COMPANION_SPEECH_CONTENT_EVENT,
        CompanionSpeechContentPayload {
            text,
            anchor_x,
            anchor_y,
            placement,
        },
    );

    Ok(())
}

// hides the speech bubble for a specific instance id.
pub fn hide_companion_speech_for(app: &AppHandle, id: &str) -> Result<(), String> {
    if let Ok(mut pending) = PENDING_SPEECH_TEXT.lock() {
        pending.remove(id);
    }

    update_speech_state(id, |state| {
        state.visible = false;
    });

    let _ = app.emit_to(speech_window_label(id), COMPANION_SPEECH_DISMISS_EVENT, ());

    if let Some(window) = app.get_webview_window(&speech_window_label(id)) {
        window
            .close()
            .map_err(|error| format!("failed to close companion speech window: {error}"))?;
    }

    Ok(())
}

// closes the speech window for an instance and forgets its state. used when a
// companion is disabled/removed so its paired bubble goes away too.
pub fn destroy_companion_speech_window(app: &AppHandle, id: &str) -> Result<(), String> {
    let _ = hide_companion_speech_for(app, id);

    if let Some(window) = app.get_webview_window(&speech_window_label(id)) {
        window
            .close()
            .map_err(|error| format!("failed to close companion speech window: {error}"))?;
    }

    if let Ok(mut states) = SPEECH_STATES.lock() {
        states.remove(id);
    }

    Ok(())
}

#[tauri::command]
pub fn hide_companion_speech(window: tauri::WebviewWindow) -> Result<(), String> {
    let Some(id) = super::instance_id_from_companion_label(window.label()) else {
        return Ok(());
    };

    hide_companion_speech_for(window.app_handle(), &id)
}

#[tauri::command]
pub fn set_companion_speech_size(
    window: tauri::WebviewWindow,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let Some(id) = instance_id_from_speech_label(window.label()) else {
        return Ok(());
    };

    let state = read_speech_state(&id);
    if !state.visible {
        return Ok(());
    }

    update_speech_state(&id, |stored| {
        stored.width = width;
        stored.height = height;
    });

    let _ = apply_companion_speech_bounds(
        window.app_handle(),
        &id,
        state.anchor_x,
        state.anchor_y,
        DEFAULT_ANCHOR_Y_OFFSET,
        width,
        height,
        true,
    )?;

    Ok(())
}
