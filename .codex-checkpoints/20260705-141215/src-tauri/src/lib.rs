mod companion;
mod data_folder;
mod main_window;
mod tray;

use companion::{
    cancel_walk_picker, create_companion_instance_window, create_companion_menu_window,
    create_companion_speech_instance_window, create_walk_picker_window,
    destroy_companion_instance_window, get_desktop_bounds, get_window_surfaces, get_work_area,
    hide_companion_menu, hide_companion_speech, hide_walk_picker, hit_title_bar_at,
    hit_window_bottom_at, hit_window_surface_at, hit_window_wall_at,
    register_excluded_hwnds_from_app, resize_companion_menu, set_companion_position,
    set_companion_speech_size, set_companion_window_size, show_companion_menu,
    show_companion_speech, show_walk_picker, submit_target_picker, take_companion_speech_content,
};
use data_folder::{get_characters_folder_fingerprint, open_characters_folder};
use main_window::{configure_main_window, handle_window_event};
use tray::create_tray;

const AUTOSTART_ARG: &str = "--autostart";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let launched_from_autostart =
        std::env::args_os().any(|argument| argument == std::ffi::OsStr::new(AUTOSTART_ARG));

    tauri::Builder::default()
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .arg(AUTOSTART_ARG)
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            configure_main_window(app.handle(), !launched_from_autostart)?;
            // companion instance windows are spawned on demand by the dashboard;
            // the shared menu + picker windows are created up front
            create_companion_menu_window(app.handle())?;
            create_walk_picker_window(app.handle())?;
            register_excluded_hwnds_from_app(app.handle())?;
            create_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            handle_window_event(window, event);
        })
        .invoke_handler(tauri::generate_handler![
            get_work_area,
            get_desktop_bounds,
            get_window_surfaces,
            hit_title_bar_at,
            hit_window_wall_at,
            hit_window_bottom_at,
            hit_window_surface_at,
            set_companion_position,
            set_companion_window_size,
            create_companion_instance_window,
            create_companion_speech_instance_window,
            destroy_companion_instance_window,
            show_companion_speech,
            hide_companion_speech,
            set_companion_speech_size,
            take_companion_speech_content,
            show_companion_menu,
            resize_companion_menu,
            hide_companion_menu,
            show_walk_picker,
            hide_walk_picker,
            submit_target_picker,
            cancel_walk_picker,
            get_characters_folder_fingerprint,
            open_characters_folder,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::ExitRequested { api, code, .. } = event {
                // user closed the dashboard — keep companion + tray running
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}
