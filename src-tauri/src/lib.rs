mod generation_store;
mod character_library;
mod authoring_drafts;
mod installed_content;
mod campaign_library;
mod character_campaign_compound;
mod connected_long_rest_character;
mod connected_long_rest_character_guard;
mod connected_long_rest_host;
mod connected_owner_inventory;
mod connected_party_stash_host;
mod session_transport;

use std::sync::Mutex;
use tauri::Manager;

#[cfg(all(debug_assertions, feature = "tauri-e2e"))]
fn apply_e2e_process_arguments() {
    for argument in std::env::args().skip(1) {
        if let Some(value) = argument.strip_prefix("--simplevtt-data-root=") {
            if !value.trim().is_empty() {
                std::env::set_var("SIMPLEVTT_LOCAL_DATA_ROOT", value);
            }
        } else if let Some(value) = argument.strip_prefix("--simplevtt-instance-label=") {
            if !value.trim().is_empty() {
                std::env::set_var("SIMPLEVTT_INSTANCE_LABEL", value);
            }
        }
    }
}

#[derive(Default)]
struct CharacterCampaignPersistenceState(Mutex<()>);

fn lock_character_campaign_persistence<'a>(
    state: &'a tauri::State<'_, CharacterCampaignPersistenceState>,
) -> Result<std::sync::MutexGuard<'a, ()>, String> {
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
    let character_dir = root.join("character-library");
    connected_long_rest_character_guard::assert_no_prepared_at(&character_dir)?;
    character_library::write_generation_at(&character_dir, &request)
}

#[tauri::command]
fn prepare_connected_long_rest_character_generation(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: connected_long_rest_character::PrepareConnectedLongRestCharacterRequest,
) -> Result<connected_long_rest_character::ConnectedLongRestCharacterPreparationDto, String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_long_rest_character::prepare_at(&root.join("character-library"), &request)
}

#[tauri::command]
fn materialize_connected_long_rest_character_generation(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: connected_long_rest_character::ConnectedLongRestCharacterIdentityRequest,
) -> Result<connected_long_rest_character::ConnectedLongRestCharacterPreparationDto, String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_long_rest_character::materialize_at(&root.join("character-library"), &request)
}

#[tauri::command]
fn abort_connected_long_rest_character_generation(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: connected_long_rest_character::ConnectedLongRestCharacterIdentityRequest,
) -> Result<connected_long_rest_character::ConnectedLongRestCharacterPreparationDto, String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_long_rest_character::abort_at(&root.join("character-library"), &request)
}

#[tauri::command]
fn read_connected_long_rest_host_records(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
) -> Result<Vec<connected_long_rest_host::ConnectedLongRestHostRecordDto>, String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_long_rest_host::read_all_at(&root)
}

#[tauri::command]
fn write_connected_long_rest_host_record(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: connected_long_rest_host::WriteConnectedLongRestHostRecordRequest,
) -> Result<(), String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_long_rest_host::write_at(&root, &request)
}

#[tauri::command]
fn delete_connected_long_rest_host_record(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: connected_long_rest_host::DeleteConnectedLongRestHostRecordRequest,
) -> Result<(), String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_long_rest_host::delete_at(&root, &request)
}

#[tauri::command]
fn read_connected_owner_inventory_journal(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: connected_owner_inventory::OwnerInventoryJournalIdentityRequest,
) -> Result<Option<connected_owner_inventory::OwnerInventoryJournalDto>, String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_owner_inventory::read_request_at(&root.join("character-library"), &request)
}

#[tauri::command]
fn prepare_connected_owner_inventory_journal(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: connected_owner_inventory::PrepareOwnerInventoryJournalRequest,
) -> Result<connected_owner_inventory::OwnerInventoryJournalDto, String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_owner_inventory::prepare_at(&root.join("character-library"), &request)
}

#[tauri::command]
fn mark_connected_owner_inventory_applied(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: connected_owner_inventory::MarkOwnerInventoryAppliedRequest,
) -> Result<connected_owner_inventory::OwnerInventoryJournalDto, String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_owner_inventory::mark_applied_at(&root.join("character-library"), &request)
}

#[tauri::command]
fn begin_connected_owner_inventory_undo(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: connected_owner_inventory::BeginOwnerInventoryUndoRequest,
) -> Result<connected_owner_inventory::OwnerInventoryJournalDto, String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_owner_inventory::begin_undo_at(&root.join("character-library"), &request)
}

#[tauri::command]
fn mark_connected_owner_inventory_undone(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: connected_owner_inventory::OwnerInventoryJournalIdentityRequest,
) -> Result<connected_owner_inventory::OwnerInventoryJournalDto, String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_owner_inventory::mark_undone_at(&root.join("character-library"), &request)
}

#[tauri::command]
fn finalize_connected_owner_inventory_journal(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: connected_owner_inventory::FinalizeOwnerInventoryJournalRequest,
) -> Result<connected_owner_inventory::OwnerInventoryJournalDto, String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_owner_inventory::finalize_at(&root.join("character-library"), &request)
}

#[tauri::command]
fn read_connected_party_stash_host_records(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
) -> Result<Vec<connected_party_stash_host::ConnectedPartyStashHostRecordDto>, String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_party_stash_host::read_all_at(&root)
}

#[tauri::command]
fn write_connected_party_stash_host_record(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: connected_party_stash_host::WriteConnectedPartyStashHostRecordRequest,
) -> Result<(), String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_party_stash_host::write_at(&root, &request)
}

#[tauri::command]
fn delete_connected_party_stash_host_record(
    app: tauri::AppHandle,
    persistence: tauri::State<'_, CharacterCampaignPersistenceState>,
    request: connected_party_stash_host::DeleteConnectedPartyStashHostRecordRequest,
) -> Result<(), String> {
    let _guard = lock_character_campaign_persistence(&persistence)?;
    let root = local_data_root(&app)?;
    character_campaign_compound::recover_at(&root)?;
    connected_party_stash_host::delete_at(&root, &request)
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
    character_campaign_compound::recover_at(&root)?;
    connected_long_rest_character_guard::assert_no_prepared_at(&root.join("character-library"))?;
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
    #[cfg(all(debug_assertions, feature = "tauri-e2e"))]
    apply_e2e_process_arguments();

    let instance_label = std::env::var("SIMPLEVTT_INSTANCE_LABEL")
        .ok()
        .map(|label| label.trim().to_string())
        .filter(|label| !label.is_empty());
    let mut context = tauri::generate_context!();
    if let Some(label) = instance_label.as_deref() {
        let profile = label
            .chars()
            .map(|character| {
                if character.is_ascii_alphanumeric() || matches!(character, '-' | '_') {
                    character.to_ascii_lowercase()
                } else {
                    '-'
                }
            })
            .collect::<String>();
        for window in &mut context.config_mut().app.windows {
            window.data_directory = Some(std::path::PathBuf::from(format!(
                "acceptance-{profile}"
            )));
        }
    }

    let builder = tauri::Builder::default();
    #[cfg(all(debug_assertions, feature = "tauri-e2e"))]
    let builder = builder.plugin(tauri_plugin_wdio_webdriver::init());

    builder
        .setup(move |app| {
            if let Some(label) = instance_label.as_deref() {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_title(&format!("SimpleVTT - {label}"));
                }
            }
            Ok(())
        })
        .manage(CharacterCampaignPersistenceState::default())
        .manage(session_transport::SessionTransportState::default())
        .invoke_handler(tauri::generate_handler![
            read_character_library_generations,
            write_character_library_generation,
            prepare_connected_long_rest_character_generation,
            materialize_connected_long_rest_character_generation,
            abort_connected_long_rest_character_generation,
            read_connected_long_rest_host_records,
            write_connected_long_rest_host_record,
            delete_connected_long_rest_host_record,
            read_connected_owner_inventory_journal,
            prepare_connected_owner_inventory_journal,
            mark_connected_owner_inventory_applied,
            begin_connected_owner_inventory_undo,
            mark_connected_owner_inventory_undone,
            finalize_connected_owner_inventory_journal,
            read_connected_party_stash_host_records,
            write_connected_party_stash_host_record,
            delete_connected_party_stash_host_record,
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
        .run(context)
        .expect("error while running SimpleVTT");
}
