mod generation_store;
mod character_library;
mod authoring_drafts;
mod installed_content;
mod campaign_library;
mod character_campaign_compound;
mod session_transport;

use std::sync::Mutex;
use tauri::Manager;

#[derive(Default)]
struct CharacterCampaignPersistenceState(Mutex<()>);

fn lock_character_campaign_persistence(
    state: &tauri::State<'_, CharacterCampaignPersistenceState>,
) -> Result<std::sync::MutexGuard<'_, ()>, String> {
    state.0.lock().map_err(|_| "Character/Campaign persistence lock is poisoned".to_owned())
}

fn local_data_root(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    if let Ok(root) = std::env::var("SIMPLEVTT_LOCAL_DATA_ROOT") {
        let root = root.trim();
        if !root.is_empty() {
            return Ok(std::path::PathBuf::from(root));
        }
    }

    app.path()
        .app_local_data_dir()
        .map_err(|error| format!("failed to resolve SimpleVTT local data directory: {error}"))
}

fn local_data_child(app: &tauri::AppHandle, child: &str) -> Result<std::path::PathBuf, String> {
    Ok(local_data_root(app)?.join(child))
}

#[tauri::command]
fn read_character_library_generations(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
) -> Result<Vec<character_library::CharacterLibraryGenerationDto>, String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    character_library::read_generations_at(&root.join("character-library"))
}

#[tauri::command]
fn write_character_library_generation(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: character_library::WriteCharacterLibraryGenerationRequest,
) -> Result<(), String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    character_library::write_generation_at(&root.join("character-library"), &request)
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

#[tauri::command]
fn read_installed_content_generations(
    app: tauri::AppHandle,
) -> Result<Vec<installed_content::InstalledContentGenerationDto>, String> {
    let dir = local_data_child(&app, "installed-content")?;
    installed_content::read_generations_at(&dir)
}

#[tauri::command]
fn write_installed_content_generation(
    app: tauri::AppHandle,
    request: installed_content::WriteInstalledContentGenerationRequest,
) -> Result<(), String> {
    let dir = local_data_child(&app, "installed-content")?;
    installed_content::write_generation_at(&dir, &request)
}

#[tauri::command]
fn read_campaign_library_generations(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
) -> Result<Vec<campaign_library::CampaignLibraryGenerationDto>, String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    campaign_library::read_generations_at(&root.join("campaign-library"))
}

#[tauri::command]
fn write_campaign_library_generation(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: campaign_library::WriteCampaignLibraryGenerationRequest,
) -> Result<(), String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    campaign_library::write_generation_at(&root.join("campaign-library"), &request)
}

#[tauri::command]
fn write_character_campaign_compound(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: character_campaign_compound::CharacterCampaignCompoundRequest,
) -> Result<(), String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::write_at(&root, &request)
}

#[tauri::command]
fn start_session_host(
    app: tauri::AppHandle,
    state: tauri::State<'_, session_transport::SessionTransportState>,
    bind_address: Option<String>,
) -> Result<session_transport::TransportStatusDto, String> {
    state.start_host(&app, bind_address.as_deref().unwrap_or("0.0.0.0:3210"))
}

#[tauri::command]
fn connect_session_client(
    app: tauri::AppHandle,
    state: tauri::State<'_, session_transport::SessionTransportState>,
    address: String,
) -> Result<session_transport::TransportStatusDto, String> {
    state.connect_client(&app, &address)
}

#[tauri::command]
fn send_session_message(
    state: tauri::State<'_, session_transport::SessionTransportState>,
    message: String,
) -> Result<usize, String> {
    state.send(&message)
}

#[tauri::command]
fn send_session_message_to(
    state: tauri::State<'_, session_transport::SessionTransportState>,
    peer: String,
    message: String,
) -> Result<usize, String> {
    state.send_to(&peer, &message)
}

#[tauri::command]
fn stop_session_transport(
    app: tauri::AppHandle,
    state: tauri::State<'_, session_transport::SessionTransportState>,
) -> Result<session_transport::TransportStatusDto, String> {
    state.stop(&app)
}

#[tauri::command]
fn get_session_transport_status(
    state: tauri::State<'_, session_transport::SessionTransportState>,
) -> Result<session_transport::TransportStatusDto, String> {
    state.status()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Ok(label) = std::env::var("SIMPLEVTT_INSTANCE_LABEL") {
                let label = label.trim();
                if !label.is_empty() {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.set_title(&format!("SimpleVTT - {label}"));
                    }
                }
            }
            Ok(())
        })
        .manage(CharacterCampaignPersistenceState::default())
        .manage(session_transport::SessionTransportState::default())
        .invoke_handler(tauri::generate_handler![
            read_character_library_generations,
            write_character_library_generation,
            read_authoring_draft_generations,
            write_authoring_draft_generation,
            read_installed_content_generations,
            write_installed_content_generation,
            read_campaign_library_generations,
            write_campaign_library_generation,
            write_character_campaign_compound,
            start_session_host,
            connect_session_client,
            send_session_message,
            send_session_message_to,
            stop_session_transport,
            get_session_transport_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running SimpleVTT");
}
