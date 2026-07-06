use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;

use tauri::{AppHandle, Manager};

const BUILTIN_CHARACTER_ID: &str = "beyond-birthday";

fn collect_fingerprint_parts(
    root: &Path,
    path: PathBuf,
    parts: &mut Vec<String>,
) -> Result<(), String> {
    let metadata = match std::fs::metadata(&path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!(
                "failed to read character path metadata {}: {error}",
                path.display()
            ))
        }
    };
    let relative = path
        .strip_prefix(root)
        .unwrap_or(&path)
        .to_string_lossy()
        .replace('\\', "/");
    let modified_nanos = metadata
        .modified()
        .ok()
        .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();

    parts.push(format!(
        "{}:{}:{}:{}",
        if metadata.is_dir() { "d" } else { "f" },
        relative,
        metadata.len(),
        modified_nanos
    ));

    if !metadata.is_dir() {
        return Ok(());
    }

    let entries = match std::fs::read_dir(&path) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!(
                "failed to read character directory {}: {error}",
                path.display()
            ))
        }
    };

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        collect_fingerprint_parts(root, entry.path(), parts)?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_characters_folder_fingerprint(app: AppHandle) -> Result<String, String> {
    let characters_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data dir: {error}"))?
        .join("characters");

    if !characters_dir.exists() {
        return Ok(String::new());
    }

    let entries = std::fs::read_dir(&characters_dir)
        .map_err(|error| format!("failed to read characters folder: {error}"))?;
    let mut parts = Vec::new();

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        if entry.file_name() == BUILTIN_CHARACTER_ID {
            continue;
        }

        let path = entry.path();
        if path.is_dir() {
            collect_fingerprint_parts(&characters_dir, path, &mut parts)?;
        }
    }

    parts.sort_unstable();
    Ok(parts.join("\0"))
}

fn open_in_file_manager(path: &Path) -> Result<(), String> {
    let path_string = path
        .to_str()
        .ok_or_else(|| "characters folder path is not valid utf-8".to_string())?
        .to_string();

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&path_string)
            .spawn()
            .map_err(|error| format!("failed to open folder in explorer: {error}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path_string)
            .spawn()
            .map_err(|error| format!("failed to open folder in finder: {error}"))?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path_string)
            .spawn()
            .map_err(|error| format!("failed to open folder: {error}"))?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        let _ = path_string;
        Err("opening folders is not supported on this platform".to_string())
    }
}

#[tauri::command]
pub fn open_characters_folder(app: AppHandle) -> Result<(), String> {
    let characters_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data dir: {error}"))?
        .join("characters");

    std::fs::create_dir_all(&characters_dir)
        .map_err(|error| format!("failed to create characters folder: {error}"))?;

    open_in_file_manager(&characters_dir)
}

#[tauri::command]
pub fn open_character_folder(app: AppHandle, character_id: String) -> Result<(), String> {
    let character_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data dir: {error}"))?
        .join("characters")
        .join(character_id);

    if !character_dir.exists() {
        return Err("character folder does not exist".to_string());
    }

    open_in_file_manager(&character_dir)
}
