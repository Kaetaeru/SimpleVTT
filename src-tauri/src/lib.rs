mod character_library;

use tauri::Manager;

fn character_library_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|path| path.join("character-library"))
        .map_err(|error| format!("failed to resolve SimpleVTT local data directory: {error}"))
}

#[tauri::command]
fn read_character_library_generations(
    app: tauri::AppHandle,
) -> Result<Vec<character_library::CharacterLibraryGenerationDto>, String> {
    let dir = character_library_dir(&app)?;
    character_library::read_generations_at(&dir)
}

#[tauri::command]
fn write_character_library_generation(
    app: tauri::AppHandle,
    request: character_library::WriteCharacterLibraryGenerationRequest,
) -> Result<(), String> {
    let dir = character_library_dir(&app)?;
    character_library::write_generation_at(&dir, &request)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_character_library_generations,
            write_character_library_generation
        ])
        .run(tauri::generate_context!())
        .expect("error while running SimpleVTT");
}
