use tauri::{AppHandle, LogicalSize, Manager, Size, WebviewWindow, Window, WindowEvent};

const MAIN_WINDOW_LABEL: &str = "main";
const DEFAULT_MAIN_WIDTH: f64 = 1160.0;
const DEFAULT_MAIN_HEIGHT: f64 = 832.0;
const MIN_MAIN_WIDTH: f64 = 960.0;
const MIN_MAIN_HEIGHT: f64 = 640.0;
const MONITOR_MARGIN: f64 = 80.0;

fn fit_main_window_to_monitor(window: &WebviewWindow) -> Result<(), String> {
    let Some(monitor) = window
        .current_monitor()
        .map_err(|error| format!("failed to read current monitor: {error}"))?
    else {
        return Ok(());
    };

    let monitor_size = monitor.size().to_logical::<f64>(monitor.scale_factor());
    let available_width = (monitor_size.width - MONITOR_MARGIN).max(1.0);
    let available_height = (monitor_size.height - MONITOR_MARGIN).max(1.0);
    let width = DEFAULT_MAIN_WIDTH
        .min(available_width)
        .max(MIN_MAIN_WIDTH.min(available_width));
    let height = DEFAULT_MAIN_HEIGHT
        .min(available_height)
        .max(MIN_MAIN_HEIGHT.min(available_height));

    window
        .set_size(Size::Logical(LogicalSize::new(width, height)))
        .map_err(|error| format!("failed to size main window: {error}"))
}

pub fn configure_main_window(app: &AppHandle, show_on_launch: bool) -> Result<(), String> {
    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "main window not found".to_string())?;

    main_window
        .set_icon(tauri::include_image!("icons/32x32.png"))
        .map_err(|error| format!("failed to set main window icon: {error}"))?;

    fit_main_window_to_monitor(&main_window)?;

    if show_on_launch {
        main_window
            .center()
            .map_err(|error| format!("failed to center main window: {error}"))?;
        main_window
            .show()
            .map_err(|error| format!("failed to show main window: {error}"))?;
    }

    Ok(())
}

pub fn handle_window_event(window: &Window, event: &WindowEvent) {
    if window.label() != MAIN_WINDOW_LABEL {
        return;
    }

    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
}

pub fn show_dashboard(app: &AppHandle) {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return;
    };

    let _ = window.unminimize();
    let _ = window.center();
    let _ = window.show();
    let _ = window.set_focus();
}
