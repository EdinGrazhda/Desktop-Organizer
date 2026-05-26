use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

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

static PATH_RESOLUTION_CACHE: OnceLock<Mutex<HashMap<String, PathBuf>>> = OnceLock::new();
static NAME_RESOLUTION_CACHE: OnceLock<Mutex<HashMap<String, PathBuf>>> = OnceLock::new();

#[cfg(target_os = "windows")]
const THIS_PC_SHELL_TARGET: &str = "shell:MyComputerFolder";
#[cfg(target_os = "windows")]
const RECYCLE_BIN_SHELL_TARGET: &str = "shell:RecycleBinFolder";
#[cfg(target_os = "windows")]
const THIS_PC_GUID: &str = "20d04fe0-3aea-1069-a2d8-08002b30309d";
#[cfg(target_os = "windows")]
const RECYCLE_BIN_GUID: &str = "645ff040-5081-101b-9f08-00aa002f954e";

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

        append_windows_shell_items(&mut files);
    }

    Ok(files)
}

#[tauri::command]
pub fn open_item_path(path: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(shell_target) = canonical_windows_shell_target(&path) {
            open_windows_shell_target(shell_target)?;
            return Ok(shell_target.to_string());
        }
    }

    let resolved = resolve_existing_item_path(&path)
        .ok_or_else(|| format!("Path does not exist: {}", path))?;

    #[cfg(target_os = "windows")]
    {
        let resolved_str = resolved.to_string_lossy().to_string();
        let launch = std::process::Command::new("cmd")
            .args(["/C", "start", ""])
            .arg(&resolved_str)
            .spawn();

        if let Err(primary_err) = launch {
            std::process::Command::new("explorer")
                .arg(&resolved_str)
                .spawn()
                .map_err(|fallback_err| {
                    format!(
                        "Failed to open path: {} (cmd error: {}, explorer error: {})",
                        resolved_str, primary_err, fallback_err
                    )
                })?;
        }

        return Ok(resolved.to_string_lossy().replace('\\', "/"));
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&resolved)
            .spawn()
            .map_err(|e| e.to_string())?;

        return Ok(resolved.to_string_lossy().to_string());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        std::process::Command::new("xdg-open")
            .arg(&resolved)
            .spawn()
            .map_err(|e| e.to_string())?;

        return Ok(resolved.to_string_lossy().to_string());
    }

    #[allow(unreachable_code)]
    Err("Unsupported platform".into())
}

#[tauri::command]
pub fn resolve_item_path(path: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        if let Some(shell_target) = canonical_windows_shell_target(&path) {
            return Ok(shell_target.to_string());
        }
    }

    let resolved = resolve_existing_item_path(&path)
        .ok_or_else(|| format!("Path does not exist: {}", path))?;

    Ok(resolved.to_string_lossy().replace('\\', "/"))
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
    let backup_path = get_slots_state_backup_path(&state_path);
    if state_path.exists() {
        if let Err(err) = fs::copy(&state_path, &backup_path) {
            eprintln!(
                "DeskNest: failed to update slots backup at {}: {}",
                backup_path.to_string_lossy(),
                err
            );
        }
    }

    write_slots_payload_atomic(&state_path, &data)?;
    Ok(())
}

#[tauri::command]
pub fn load_slots_state() -> Result<Option<serde_json::Value>, String> {
    let state_path = get_slots_state_path().ok_or("Could not resolve DeskNest state path")?;
    let backup_path = get_slots_state_backup_path(&state_path);

    match read_slots_payload(&state_path) {
        Ok(Some(payload)) => Ok(Some(payload)),
        Ok(None) => match read_slots_payload(&backup_path) {
            Ok(Some(payload)) => Ok(Some(payload)),
            Ok(None) => Ok(None),
            Err(_) => Ok(None),
        },
        Err(main_err) => match read_slots_payload(&backup_path) {
            Ok(Some(payload)) => Ok(Some(payload)),
            Ok(None) => Err(main_err),
            Err(backup_err) => Err(format!(
                "Failed to load slots state. Main: {}. Backup: {}",
                main_err, backup_err
            )),
        },
    }
}

fn read_slots_payload(path: &Path) -> Result<Option<serde_json::Value>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let raw = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read {}: {}", path.to_string_lossy(), e))?;
    if raw.trim().is_empty() {
        return Ok(None);
    }

    let payload: serde_json::Value = serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse {}: {}", path.to_string_lossy(), e))?;
    if !payload.is_array() {
        return Err(format!(
            "Invalid slots state file {}: expected top-level array",
            path.to_string_lossy()
        ));
    }

    Ok(Some(payload))
}

fn write_slots_payload_atomic(state_path: &Path, data: &[u8]) -> Result<(), String> {
    let temp_path = get_slots_state_temp_path(state_path);

    {
        let mut file = fs::File::create(&temp_path).map_err(|e| {
            format!(
                "Failed to create temporary state file {}: {}",
                temp_path.to_string_lossy(),
                e
            )
        })?;

        file.write_all(data).map_err(|e| {
            format!(
                "Failed to write temporary state file {}: {}",
                temp_path.to_string_lossy(),
                e
            )
        })?;

        file.sync_all().map_err(|e| {
            format!(
                "Failed to flush temporary state file {}: {}",
                temp_path.to_string_lossy(),
                e
            )
        })?;
    }

    #[cfg(target_os = "windows")]
    {
        if state_path.exists() {
            fs::remove_file(state_path).map_err(|e| {
                format!(
                    "Failed to replace state file {}: {}",
                    state_path.to_string_lossy(),
                    e
                )
            })?;
        }
    }

    fs::rename(&temp_path, state_path).map_err(|e| {
        format!(
            "Failed to finalize state file {}: {}",
            state_path.to_string_lossy(),
            e
        )
    })?;

    Ok(())
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
                "N'Rend",
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
                "N'Rend",
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

fn resolve_existing_item_path(path: &str) -> Option<PathBuf> {
    let source = path.trim().trim_matches('"');
    if source.is_empty() {
        return None;
    }

    let normalized = if cfg!(target_os = "windows") {
        source.replace('/', "\\")
    } else {
        source.to_string()
    };
    let candidate = PathBuf::from(normalized);
    let input_key = normalize_lookup_key(&candidate);

    if candidate.exists() {
        remember_resolution(&input_key, None, &candidate);
        return Some(candidate);
    }

    if let Some(cached) = lookup_cached_path(&input_key) {
        return Some(cached);
    }

    let target_name = candidate
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.trim().to_lowercase())?;
    if target_name.is_empty() {
        return None;
    }

    if let Some(cached) = lookup_cached_name(&target_name) {
        remember_resolution(&input_key, Some(&target_name), &cached);
        return Some(cached);
    }

    let file_name = candidate.file_name()?.to_os_string();

    let mut roots: Vec<PathBuf> = Vec::new();

    if let Some(parent) = candidate.parent() {
        if parent.exists() {
            roots.push(parent.to_path_buf());
        }
    }

    if let Some(storage_dir) = get_desknest_storage_dir() {
        roots.push(storage_dir);
    }
    if let Some(desktop_dir) = get_desktop_path() {
        roots.push(desktop_dir);
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(public_dir) = std::env::var("PUBLIC") {
            roots.push(PathBuf::from(public_dir).join("Desktop"));
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            roots.push(
                PathBuf::from(appdata)
                    .join("Microsoft")
                    .join("Windows")
                    .join("Start Menu")
                    .join("Programs"),
            );
        }
        if let Ok(program_data) = std::env::var("PROGRAMDATA") {
            roots.push(
                PathBuf::from(program_data)
                    .join("Microsoft")
                    .join("Windows")
                    .join("Start Menu")
                    .join("Programs"),
            );
        }
    }

    // Quick direct checks first before recursive scans.
    for root in &roots {
        let direct = root.join(&file_name);
        if direct.exists() {
            remember_resolution(&input_key, Some(&target_name), &direct);
            return Some(direct);
        }
    }

    for root in roots {
        if let Some(found) = find_entry_by_name(&root, &target_name, 0, 6) {
            remember_resolution(&input_key, Some(&target_name), &found);
            return Some(found);
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn canonical_windows_shell_target(input: &str) -> Option<&'static str> {
    let key = input
        .trim()
        .trim_matches('"')
        .replace('\\', "/")
        .trim()
        .to_lowercase();

    if key.is_empty() {
        return None;
    }

    if key == "shell:mycomputerfolder"
        || key == "this pc"
        || key == "thispc"
        || key == "my computer"
        || key == "computer"
        || key.contains(THIS_PC_GUID)
    {
        return Some(THIS_PC_SHELL_TARGET);
    }

    if key == "shell:recyclebinfolder"
        || key == "recycle bin"
        || key == "recyclebin"
        || key.contains(RECYCLE_BIN_GUID)
    {
        return Some(RECYCLE_BIN_SHELL_TARGET);
    }

    None
}

#[cfg(target_os = "windows")]
fn open_windows_shell_target(target: &str) -> Result<(), String> {
    let launch = std::process::Command::new("explorer").arg(target).spawn();

    if let Err(primary_err) = launch {
        std::process::Command::new("cmd")
            .args(["/C", "start", ""])
            .arg(target)
            .spawn()
            .map_err(|fallback_err| {
                format!(
                    "Failed to open shell target: {} (explorer error: {}, cmd error: {})",
                    target, primary_err, fallback_err
                )
            })?;
    }

    Ok(())
}

fn normalize_lookup_key(path: &Path) -> String {
    path.to_string_lossy().to_lowercase()
}

fn path_cache() -> &'static Mutex<HashMap<String, PathBuf>> {
    PATH_RESOLUTION_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn name_cache() -> &'static Mutex<HashMap<String, PathBuf>> {
    NAME_RESOLUTION_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn lookup_cached_path(key: &str) -> Option<PathBuf> {
    let cache = path_cache().lock().ok()?;
    let cached = cache.get(key)?.clone();
    drop(cache);

    if cached.exists() {
        Some(cached)
    } else {
        None
    }
}

fn lookup_cached_name(name: &str) -> Option<PathBuf> {
    let cache = name_cache().lock().ok()?;
    let cached = cache.get(name)?.clone();
    drop(cache);

    if cached.exists() {
        Some(cached)
    } else {
        None
    }
}

fn remember_resolution(input_key: &str, target_name: Option<&str>, resolved: &Path) {
    if let Ok(mut cache) = path_cache().lock() {
        cache.insert(input_key.to_string(), resolved.to_path_buf());
    }

    if let Some(name) = target_name {
        if let Ok(mut cache) = name_cache().lock() {
            cache.insert(name.to_string(), resolved.to_path_buf());
        }
    }
}

fn find_entry_by_name(
    root: &Path,
    target_name_lower: &str,
    depth: usize,
    max_depth: usize,
) -> Option<PathBuf> {
    if depth > max_depth || !root.exists() {
        return None;
    }

    let entries = fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        let entry_name = entry.file_name().to_string_lossy().to_lowercase();
        if entry_name == target_name_lower {
            return Some(path);
        }

        if path.is_dir() {
            if let Some(found) = find_entry_by_name(&path, target_name_lower, depth + 1, max_depth) {
                return Some(found);
            }
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

fn get_slots_state_backup_path(state_path: &Path) -> PathBuf {
    state_path.with_extension("json.bak")
}

fn get_slots_state_temp_path(state_path: &Path) -> PathBuf {
    state_path.with_extension("json.tmp")
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
fn append_windows_shell_items(files: &mut Vec<DesktopFile>) {
    let shell_items = [
        DesktopFile {
            name: "This PC".to_string(),
            path: THIS_PC_SHELL_TARGET.to_string(),
            is_dir: false,
        },
        DesktopFile {
            name: "Recycle Bin".to_string(),
            path: RECYCLE_BIN_SHELL_TARGET.to_string(),
            is_dir: false,
        },
    ];

    for item in shell_items {
        if files.iter().all(|existing| {
            !existing
                .path
                .eq_ignore_ascii_case(item.path.as_str())
        }) {
            files.push(item);
        }
    }
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
