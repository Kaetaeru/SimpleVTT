mod generation_store;
mod character_library;
mod authoring_drafts;

use tauri::Manager;

fn local_data_child(app: &tauri::AppHandle, child: &str) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|path| path.join(child))
        .map_err(|error| format!("failed to resolve SimpleVTT local data directory: {error}"))
}

#[tauri::command]
fn read_character_library_generations(
    app: tauri::AppHandle,
) -> Result<Vec<character_library::CharacterLibraryGenerationDto>, String> {
    let dir = local_data_child(&app, "character-library")?;
    character_library::read_generations_at(&dir)
}

#[tauri::command]
fn write_character_library_generation(
    app: tauri::AppHandle,
    request: character_library::WriteCharacterLibraryGenerationRequest,
) -> Result<(), String> {
    let dir = local_data_child(&app, "character-library")?;
    character_library::write_generation_at(&dir, &request)
}

#[tauri::command]
fn read_authoring_draft_generations(
    app: tauri::AppHandle,
) -> Result<Vec<authoring_drafts::AuthoringDraftGenerationDto>, String> {
    let dir = local_data_child(&app, "authoring-drafts")?;
    authoring_drafts::read_generations_at(&dir)
}

#[tauri::command]
fn write_authoring_draft_generation(
    app: tauri::AppHandle,
    request: authoring_drafts::WriteAuthoringDraftGenerationRequest,
) -> Result<(), String> {
    let dir = local_data_child(&app, "authoring-drafts")?;
    authoring_drafts::write_generation_at(&dir, &request)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_character_library_generations,
            write_character_library_generation,
            read_authoring_draft_generations,
            write_authoring_draft_generation
        ])
        .run(tauri::generate_context!())
        .expect("error while running SimpleVTT");
}
