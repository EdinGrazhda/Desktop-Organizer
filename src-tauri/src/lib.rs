mod commands;

use commands::{
    scan_desktop,
    scan_slot_storage,
    enable_autostart,
    disable_autostart,
    open_item_path,
    resolve_item_path,
    save_slots_state,
    load_slots_state,
    move_item_to_slot,
    move_item_to_desktop,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_desktop,
            scan_slot_storage,
            enable_autostart,
            disable_autostart,
            open_item_path,
            resolve_item_path,
            save_slots_state,
            load_slots_state,
            move_item_to_slot,
            move_item_to_desktop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
