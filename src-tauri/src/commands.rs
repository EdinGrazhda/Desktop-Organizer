use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct DesktopFile {
    pub name: String,
    pub path: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
}

#[derive(Serialize)]
pub struct StoredSlotItem {
    pub name: String,
    pub path: String,
    #[serde(rename = "isDir")]
    pub is_dir: bool,
}

#[derive(Serialize)]
pub struct StoredSlotSnapshot {
    pub name: String,
    pub items: Vec<StoredSlotItem>,
}

#[tauri::command]
pub fn scan_desktop() -> Result<Vec<DesktopFile>, String> {
    let desktop_path = get_desktop_path().ok_or("Could not resolve desktop path")?;
    let entries = fs::read_dir(&desktop_path).map_err(|e| e.to_string())?;

    let mut files: Vec<DesktopFile> = entries
        .filter_map(|e| e.ok())
        .map(|e| {
            let path = e.path();
            DesktopFile {
                name: e.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().replace('\\', "/"),
                is_dir: path.is_dir(),
            }
        })
        .collect();

    #[cfg(target_os = "windows")]
    {
        for game in scan_windows_game_shortcuts() {
            if files.iter().all(|f| f.path != game.path) {
                files.push(game);
            }
        }
    }

    Ok(files)
}

#[tauri::command]
pub fn open_item_path(path: String) -> Result<(), String> {
    let normalized = path.replace('/', "\\");
    if !std::path::Path::new(&normalized).exists() {
        return Err(format!("Path does not exist: {}", normalized));
    }

    #[cfg(target_os = "windows")]
    {
        let status = std::process::Command::new("cmd")
            .args(["/C", "start", "", &normalized])
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err(format!("Failed to open path: {}", normalized));
        }

        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let status = std::process::Command::new("open")
            .arg(&path)
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err(format!("Failed to open path: {}", path));
        }

        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let status = std::process::Command::new("xdg-open")
            .arg(&path)
            .status()
            .map_err(|e| e.to_string())?;

        if !status.success() {
            return Err(format!("Failed to open path: {}", path));
        }

        return Ok(());
    }

    #[allow(unreachable_code)]
    Err("Unsupported platform".into())
}

#[tauri::command]
pub fn move_item_to_slot(path: String, slot_name: String) -> Result<String, String> {
    let source_raw = if cfg!(target_os = "windows") {
        path.replace('/', "\\")
    } else {
        path.clone()
    };
    let source = PathBuf::from(source_raw);

    if !source.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let base_dir = get_desknest_storage_dir().ok_or("Could not resolve DeskNest storage path")?;
    let slot_dir = base_dir.join(sanitize_segment(&slot_name));
    fs::create_dir_all(&slot_dir).map_err(|e| e.to_string())?;

    let file_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid file/folder name")?
        .to_string();

    let destination = unique_destination(&slot_dir, &file_name);
    move_path(&source, &destination)?;

    Ok(destination.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
pub fn move_item_to_desktop(path: String) -> Result<String, String> {
    let source_raw = if cfg!(target_os = "windows") {
        path.replace('/', "\\")
    } else {
        path.clone()
    };
    let source = PathBuf::from(source_raw);

    if !source.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    let desktop_dir = get_desktop_path().ok_or("Could not resolve Desktop path")?;
    fs::create_dir_all(&desktop_dir).map_err(|e| e.to_string())?;

    if source.parent().is_some_and(|p| p == desktop_dir.as_path()) {
        return Ok(source.to_string_lossy().replace('\\', "/"));
    }

    let file_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid file/folder name")?
        .to_string();

    let destination = unique_destination(&desktop_dir, &file_name);
    move_path(&source, &destination)?;

    Ok(destination.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
pub fn save_slots_state(slots: serde_json::Value) -> Result<(), String> {
    if !slots.is_array() {
        return Err("Invalid slots payload: expected an array".into());
    }

    let state_path = get_slots_state_path().ok_or("Could not resolve DeskNest state path")?;
    if let Some(parent) = state_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let data = serde_json::to_vec_pretty(&slots).map_err(|e| e.to_string())?;
    fs::write(&state_path, data).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn load_slots_state() -> Result<Option<serde_json::Value>, String> {
    let state_path = get_slots_state_path().ok_or("Could not resolve DeskNest state path")?;
    if !state_path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(&state_path).map_err(|e| e.to_string())?;
    if raw.trim().is_empty() {
        return Ok(None);
    }

    let payload: serde_json::Value = serde_json::from_str(&raw).map_err(|e| e.to_string())?;
    if !payload.is_array() {
        return Err("Invalid slots state file: expected top-level array".into());
    }

    Ok(Some(payload))
}

#[tauri::command]
pub fn scan_slot_storage() -> Result<Vec<StoredSlotSnapshot>, String> {
    let storage_dir = get_desknest_storage_dir().ok_or("Could not resolve DeskNest storage path")?;
    if !storage_dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&storage_dir).map_err(|e| e.to_string())?;
    let mut snapshots = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let slot_path = entry.path();
        if !slot_path.is_dir() {
            continue;
        }

        let slot_name = entry.file_name().to_string_lossy().to_string();
        let slot_entries = fs::read_dir(&slot_path).map_err(|e| e.to_string())?;
        let mut items = Vec::new();

        for slot_entry in slot_entries {
            let slot_entry = slot_entry.map_err(|e| e.to_string())?;
            let path = slot_entry.path();
            let name = slot_entry.file_name().to_string_lossy().to_string();

            items.push(StoredSlotItem {
                name,
                path: path.to_string_lossy().replace('\\', "/"),
                is_dir: path.is_dir(),
            });
        }

        if !items.is_empty() {
            snapshots.push(StoredSlotSnapshot {
                name: slot_name,
                items,
            });
        }
    }

    Ok(snapshots)
}

#[tauri::command]
pub fn enable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_path = exe.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("reg")
            .args([
                "add",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "DeskNest",
                "/t",
                "REG_SZ",
                "/d",
                &exe_path,
                "/f",
            ])
            .output()
            .map_err(|e| e.to_string())?;
    }

    let _ = app;
    Ok(())
}

#[tauri::command]
pub fn disable_autostart(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("reg")
            .args([
                "delete",
                r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                "/v",
                "DeskNest",
                "/f",
            ])
            .output()
            .map_err(|e| e.to_string())?;
    }

    let _ = app;
    Ok(())
}

fn get_desktop_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(profile) = std::env::var("USERPROFILE") {
            return Some(std::path::PathBuf::from(profile).join("Desktop"));
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = std::env::var("HOME") {
            return Some(std::path::PathBuf::from(home).join("Desktop"));
        }
    }
    None
}

fn get_desknest_root_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(profile) = std::env::var("USERPROFILE") {
            return Some(PathBuf::from(profile).join("Documents").join("DeskNest"));
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = std::env::var("HOME") {
            return Some(PathBuf::from(home).join("Documents").join("DeskNest"));
        }
    }
    None
}

fn get_desknest_storage_dir() -> Option<PathBuf> {
    get_desknest_root_dir().map(|root| root.join("Slots"))
}

fn get_slots_state_path() -> Option<PathBuf> {
    get_desknest_root_dir().map(|root| root.join("state").join("slots.json"))
}

fn sanitize_segment(input: &str) -> String {
    let mut cleaned = input
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            _ => c,
        })
        .collect::<String>();

    cleaned = cleaned.trim().trim_matches('.').to_string();
    if cleaned.is_empty() {
        "General".to_string()
    } else {
        cleaned
    }
}

fn unique_destination(directory: &Path, file_name: &str) -> PathBuf {
    let initial = directory.join(file_name);
    if !initial.exists() {
        return initial;
    }

    let path = Path::new(file_name);
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("item");
    let ext = path.extension().and_then(|e| e.to_str());

    for i in 1..10000 {
        let next_name = match ext {
            Some(ext) => format!("{} ({}).{}", stem, i, ext),
            None => format!("{} ({})", stem, i),
        };
        let next = directory.join(next_name);
        if !next.exists() {
            return next;
        }
    }

    directory.join(format!("{}.moved", file_name))
}

fn move_path(source: &Path, destination: &Path) -> Result<(), String> {
    if fs::rename(source, destination).is_ok() {
        return Ok(());
    }

    if source.is_dir() {
        copy_dir_recursive(source, destination)?;
        fs::remove_dir_all(source).map_err(|e| e.to_string())?;
    } else {
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::copy(source, destination).map_err(|e| e.to_string())?;
        fs::remove_file(source).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn copy_dir_recursive(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination).map_err(|e| e.to_string())?;
    let entries = fs::read_dir(source).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let from = entry.path();
        let to = destination.join(entry.file_name());

        if from.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            fs::copy(&from, &to).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn scan_windows_game_shortcuts() -> Vec<DesktopFile> {
    let mut roots = Vec::new();
    if let Ok(appdata) = std::env::var("APPDATA") {
        roots.push(
            std::path::PathBuf::from(appdata)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs"),
        );
    }
    if let Ok(program_data) = std::env::var("PROGRAMDATA") {
        roots.push(
            std::path::PathBuf::from(program_data)
                .join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs"),
        );
    }

    let game_keywords = [
        "game",
        "steam",
        "steamapps",
        "epic games",
        "epic",
        "riot",
        "battle.net",
        "blizzard",
        "ubisoft",
        "origin",
        "ea",
        "rockstar",
        "minecraft",
        "fortnite",
        "valorant",
        "league",
        "dota",
        "gta",
        "counter-strike",
    ];

    let non_game_keywords = [
        "uninstall",
        "installer",
        "install",
        "setup",
        "update",
        "updater",
        "patch",
        "readme",
        "manual",
        "support",
        "helper",
        "crash",
        "diagnostic",
        "redist",
        "redistributable",
    ];

    let mut candidates = Vec::new();
    for root in roots {
        let mut files = Vec::new();
        collect_files_recursive(&root, &mut files);
        for path in files {
            let ext = path
                .extension()
                .and_then(|e| e.to_str())
                .unwrap_or("")
                .to_lowercase();
            if ext != "lnk" && ext != "url" {
                continue;
            }

            let lower_path = path.to_string_lossy().to_lowercase();
            let lower_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_lowercase();

            let looks_like_game = game_keywords
                .iter()
                .any(|k| lower_path.contains(k) || lower_name.contains(k));
            if !looks_like_game {
                continue;
            }

            let looks_like_non_game = non_game_keywords
                .iter()
                .any(|k| lower_path.contains(k) || lower_name.contains(k));
            if looks_like_non_game {
                continue;
            }

            candidates.push(DesktopFile {
                name: path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("Unknown")
                    .to_string(),
                path: path.to_string_lossy().replace('\\', "/"),
                is_dir: false,
            });
        }
    }

    candidates
}

#[cfg(target_os = "windows")]
fn collect_files_recursive(root: &std::path::Path, output: &mut Vec<std::path::PathBuf>) {
    if !root.exists() {
        return;
    }
    if let Ok(entries) = fs::read_dir(root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_files_recursive(&path, output);
            } else {
                output.push(path);
            }
        }
    }
}
