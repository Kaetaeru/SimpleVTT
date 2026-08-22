use crate::{
    campaign_library,
    character_library,
    generation_store::{self, WriteGenerationRequest},
};
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

const CHARACTER_DIR: &str = "character-library";
const CAMPAIGN_DIR: &str = "campaign-library";
const COMMIT_MARKER: &str = "character-campaign-compound.commit.json";
const COMMIT_MARKER_TEMP: &str = "character-campaign-compound.commit.json.tmp";
const COMPOUND_STAGE_SUFFIX: &str = ".compound.tmp";

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterCampaignCompoundRequest {
    pub transaction_id: String,
    pub character: WriteGenerationRequest,
    pub campaign: WriteGenerationRequest,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum FaultPoint {
    BeforeCommitMarker,
    AfterCommitMarker,
    AfterCharacterMaterialized,
}

fn participant_dirs(root: &Path) -> (PathBuf, PathBuf) {
    (root.join(CHARACTER_DIR), root.join(CAMPAIGN_DIR))
}

fn stage_path(dir: &Path, file_prefix: &str, generation: u64) -> PathBuf {
    let final_path = generation_store::generation_path(dir, file_prefix, generation);
    PathBuf::from(format!("{}{COMPOUND_STAGE_SUFFIX}", final_path.display()))
}

fn marker_path(root: &Path) -> PathBuf {
    root.join(COMMIT_MARKER)
}

fn marker_temp_path(root: &Path) -> PathBuf {
    root.join(COMMIT_MARKER_TEMP)
}

fn write_synced_file(path: &Path, payload: &str, label: &str, create_new: bool) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create {label} directory: {error}"))?;
    }
    let mut options = OpenOptions::new();
    options.write(true);
    if create_new {
        options.create_new(true);
    } else {
        options.create(true).truncate(true);
    }
    let mut file = options
        .open(path)
        .map_err(|error| format!("failed to open {label}: {error}"))?;
    file.write_all(payload.as_bytes())
        .map_err(|error| format!("failed to write {label}: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("failed to flush {label}: {error}"))?;
    Ok(())
}

fn validate_participant(
    dir: &Path,
    file_prefix: &str,
    label: &str,
    request: &WriteGenerationRequest,
) -> Result<(), String> {
    fs::create_dir_all(dir)
        .map_err(|error| format!("failed to create {label} directory: {error}"))?;
    let physical_generation = generation_store::latest_generation_at(dir, file_prefix, label)?;
    if physical_generation != request.expected_generation {
        return Err(format!(
            "stale {label} generation: expected {}, current {}",
            request.expected_generation, physical_generation
        ));
    }
    if request.next_generation != request.expected_generation + 1 {
        return Err(format!(
            "invalid next {label} generation: expected {}, received {}",
            request.expected_generation + 1,
            request.next_generation
        ));
    }
    let final_path = generation_store::generation_path(dir, file_prefix, request.next_generation);
    if final_path.exists() {
        return Err(format!("{label} generation already exists: {}", request.next_generation));
    }
    Ok(())
}

fn remove_if_exists(path: &Path) {
    if path.exists() {
        let _ = fs::remove_file(path);
    }
}

fn cleanup_orphan_stages(root: &Path) {
    let (character_dir, campaign_dir) = participant_dirs(root);
    for dir in [character_dir, campaign_dir] {
        let Ok(entries) = fs::read_dir(dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if name.ends_with(COMPOUND_STAGE_SUFFIX) {
                let _ = fs::remove_file(path);
            }
        }
    }
    remove_if_exists(&marker_temp_path(root));
}

fn cleanup_precommit(root: &Path, request: &CharacterCampaignCompoundRequest) {
    let (character_dir, campaign_dir) = participant_dirs(root);
    remove_if_exists(&stage_path(
        &character_dir,
        character_library::FILE_PREFIX,
        request.character.next_generation,
    ));
    remove_if_exists(&stage_path(
        &campaign_dir,
        campaign_library::FILE_PREFIX,
        request.campaign.next_generation,
    ));
    remove_if_exists(&marker_temp_path(root));
}

fn stage_participant(
    dir: &Path,
    file_prefix: &str,
    label: &str,
    request: &WriteGenerationRequest,
) -> Result<(), String> {
    let path = stage_path(dir, file_prefix, request.next_generation);
    write_synced_file(&path, &request.payload, &format!("{label} compound stage"), true)
}

fn write_commit_marker(root: &Path, request: &CharacterCampaignCompoundRequest) -> Result<(), String> {
    fs::create_dir_all(root)
        .map_err(|error| format!("failed to create compound transaction root: {error}"))?;
    let final_path = marker_path(root);
    if final_path.exists() {
        return Err("another committed Character/Campaign transaction requires recovery".to_owned());
    }
    let temp_path = marker_temp_path(root);
    let payload = serde_json::to_string(request)
        .map_err(|error| format!("failed to encode Character/Campaign commit marker: {error}"))?;
    write_synced_file(&temp_path, &payload, "Character/Campaign commit marker temp file", true)?;
    fs::rename(&temp_path, &final_path)
        .map_err(|error| format!("failed to commit Character/Campaign transaction marker: {error}"))?;
    Ok(())
}

fn verify_payload(path: &Path, expected: &str, label: &str) -> Result<(), String> {
    let actual = fs::read_to_string(path)
        .map_err(|error| format!("failed to read committed {label}: {error}"))?;
    if actual != expected {
        return Err(format!("committed {label} payload does not match the compound transaction marker"));
    }
    Ok(())
}

fn materialize_participant(
    dir: &Path,
    file_prefix: &str,
    label: &str,
    request: &WriteGenerationRequest,
) -> Result<(), String> {
    fs::create_dir_all(dir)
        .map_err(|error| format!("failed to create {label} directory: {error}"))?;
    let final_path = generation_store::generation_path(dir, file_prefix, request.next_generation);
    let staged_path = stage_path(dir, file_prefix, request.next_generation);

    if final_path.exists() {
        verify_payload(&final_path, &request.payload, label)?;
        remove_if_exists(&staged_path);
        return Ok(());
    }

    let physical_generation = generation_store::latest_generation_at(dir, file_prefix, label)?;
    if physical_generation != request.expected_generation {
        return Err(format!(
            "cannot recover committed Character/Campaign transaction: {label} expected generation {}, current {}",
            request.expected_generation, physical_generation
        ));
    }
    if request.next_generation != request.expected_generation + 1 {
        return Err(format!(
            "cannot recover committed Character/Campaign transaction: invalid next {label} generation {}",
            request.next_generation
        ));
    }

    if staged_path.exists() {
        verify_payload(&staged_path, &request.payload, &format!("{label} staged generation"))?;
    } else {
        write_synced_file(
            &staged_path,
            &request.payload,
            &format!("{label} recovery stage"),
            true,
        )?;
    }

    fs::rename(&staged_path, &final_path)
        .map_err(|error| format!("failed to materialize committed {label} generation: {error}"))?;
    verify_payload(&final_path, &request.payload, label)?;
    Ok(())
}

fn finalize_committed(root: &Path, request: &CharacterCampaignCompoundRequest) -> Result<(), String> {
    let (character_dir, campaign_dir) = participant_dirs(root);
    materialize_participant(
        &character_dir,
        character_library::FILE_PREFIX,
        character_library::LABEL,
        &request.character,
    )?;
    materialize_participant(
        &campaign_dir,
        campaign_library::FILE_PREFIX,
        campaign_library::LABEL,
        &request.campaign,
    )?;
    generation_store::prune_old_generations(
        &character_dir,
        character_library::FILE_PREFIX,
        character_library::LABEL,
    );
    generation_store::prune_old_generations(
        &campaign_dir,
        campaign_library::FILE_PREFIX,
        campaign_library::LABEL,
    );
    fs::remove_file(marker_path(root))
        .map_err(|error| format!("failed to clear completed Character/Campaign transaction marker: {error}"))?;
    cleanup_orphan_stages(root);
    Ok(())
}

pub(crate) fn recover_at(root: &Path) -> Result<(), String> {
    let marker = marker_path(root);
    if !marker.exists() {
        cleanup_orphan_stages(root);
        return Ok(());
    }
    let payload = fs::read_to_string(&marker)
        .map_err(|error| format!("failed to read committed Character/Campaign transaction marker: {error}"))?;
    let request: CharacterCampaignCompoundRequest = serde_json::from_str(&payload)
        .map_err(|error| format!("committed Character/Campaign transaction marker is corrupt: {error}"))?;
    finalize_committed(root, &request)
}

fn write_at_impl(
    root: &Path,
    request: &CharacterCampaignCompoundRequest,
    fault: Option<FaultPoint>,
) -> Result<(), String> {
    if request.transaction_id.trim().is_empty() {
        return Err("Character/Campaign compound transaction id is required".to_owned());
    }
    recover_at(root)?;
    let (character_dir, campaign_dir) = participant_dirs(root);

    validate_participant(
        &character_dir,
        character_library::FILE_PREFIX,
        character_library::LABEL,
        &request.character,
    )?;
    validate_participant(
        &campaign_dir,
        campaign_library::FILE_PREFIX,
        campaign_library::LABEL,
        &request.campaign,
    )?;

    let staged = (|| -> Result<(), String> {
        stage_participant(
            &character_dir,
            character_library::FILE_PREFIX,
            character_library::LABEL,
            &request.character,
        )?;
        stage_participant(
            &campaign_dir,
            campaign_library::FILE_PREFIX,
            campaign_library::LABEL,
            &request.campaign,
        )?;
        validate_participant(
            &character_dir,
            character_library::FILE_PREFIX,
            character_library::LABEL,
            &request.character,
        )?;
        validate_participant(
            &campaign_dir,
            campaign_library::FILE_PREFIX,
            campaign_library::LABEL,
            &request.campaign,
        )?;
        Ok(())
    })();
    if let Err(error) = staged {
        cleanup_precommit(root, request);
        return Err(error);
    }

    if fault == Some(FaultPoint::BeforeCommitMarker) {
        cleanup_precommit(root, request);
        return Err("simulated Character/Campaign failure before commit marker".to_owned());
    }

    if let Err(error) = write_commit_marker(root, request) {
        cleanup_precommit(root, request);
        return Err(error);
    }

    if fault == Some(FaultPoint::AfterCommitMarker) {
        return Err("simulated Character/Campaign interruption after commit marker".to_owned());
    }

    materialize_participant(
        &character_dir,
        character_library::FILE_PREFIX,
        character_library::LABEL,
        &request.character,
    )?;
    if fault == Some(FaultPoint::AfterCharacterMaterialized) {
        return Err("simulated Character/Campaign interruption after Character materialization".to_owned());
    }
    materialize_participant(
        &campaign_dir,
        campaign_library::FILE_PREFIX,
        campaign_library::LABEL,
        &request.campaign,
    )?;

    generation_store::prune_old_generations(
        &character_dir,
        character_library::FILE_PREFIX,
        character_library::LABEL,
    );
    generation_store::prune_old_generations(
        &campaign_dir,
        campaign_library::FILE_PREFIX,
        campaign_library::LABEL,
    );
    fs::remove_file(marker_path(root))
        .map_err(|error| format!("failed to clear completed Character/Campaign transaction marker: {error}"))?;
    cleanup_orphan_stages(root);
    Ok(())
}

pub(crate) fn write_at(root: &Path, request: &CharacterCampaignCompoundRequest) -> Result<(), String> {
    write_at_impl(root, request, None)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_root(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        std::env::temp_dir().join(format!("simplevtt-compound-{name}-{}-{nonce}", std::process::id()))
    }

    fn write_request(expected_generation: u64, next_generation: u64, payload: &str) -> WriteGenerationRequest {
        WriteGenerationRequest {
            expected_generation,
            next_generation,
            payload: payload.to_owned(),
        }
    }

    fn seed(root: &Path) {
        let (character_dir, campaign_dir) = participant_dirs(root);
        character_library::write_generation_at(&character_dir, &write_request(0, 1, "character-1"))
            .expect("seed Character generation");
        campaign_library::write_generation_at(&campaign_dir, &write_request(0, 1, "campaign-1"))
            .expect("seed Campaign generation");
    }

    fn request() -> CharacterCampaignCompoundRequest {
        CharacterCampaignCompoundRequest {
            transaction_id: "rest:test:1".to_owned(),
            character: write_request(1, 2, "character-2"),
            campaign: write_request(1, 2, "campaign-2"),
        }
    }

    #[test]
    fn failure_before_commit_marker_leaves_both_previous_generations_visible() {
        let root = test_root("precommit-failure");
        seed(&root);
        let error = write_at_impl(&root, &request(), Some(FaultPoint::BeforeCommitMarker))
            .expect_err("precommit fault must fail");
        assert!(error.contains("before commit marker"));

        let (character_dir, campaign_dir) = participant_dirs(&root);
        let characters = character_library::read_generations_at(&character_dir).expect("Character read");
        let campaigns = campaign_library::read_generations_at(&campaign_dir).expect("Campaign read");
        assert_eq!(characters[0].generation, 1);
        assert_eq!(characters[0].payload.as_deref(), Some("character-1"));
        assert_eq!(campaigns[0].generation, 1);
        assert_eq!(campaigns[0].payload.as_deref(), Some("campaign-1"));
        assert!(!marker_path(&root).exists());
        assert!(!stage_path(&character_dir, character_library::FILE_PREFIX, 2).exists());
        assert!(!stage_path(&campaign_dir, campaign_library::FILE_PREFIX, 2).exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn committed_interruption_recovers_both_generations_before_normal_reads_resume() {
        let root = test_root("committed-recovery");
        seed(&root);
        let error = write_at_impl(&root, &request(), Some(FaultPoint::AfterCharacterMaterialized))
            .expect_err("committed interruption must surface");
        assert!(error.contains("after Character materialization"));
        assert!(marker_path(&root).exists(), "commit marker remains until recovery completes");

        let (character_dir, campaign_dir) = participant_dirs(&root);
        let raw_characters = character_library::read_generations_at(&character_dir).expect("raw Character read");
        let raw_campaigns = campaign_library::read_generations_at(&campaign_dir).expect("raw Campaign read");
        assert_eq!(raw_characters[0].generation, 2, "first participant may already be materialized on disk");
        assert_eq!(raw_campaigns[0].generation, 1, "second participant remains old until recovery");

        recover_at(&root).expect("committed transaction recovery");
        let characters = character_library::read_generations_at(&character_dir).expect("recovered Character read");
        let campaigns = campaign_library::read_generations_at(&campaign_dir).expect("recovered Campaign read");
        assert_eq!(characters[0].generation, 2);
        assert_eq!(characters[0].payload.as_deref(), Some("character-2"));
        assert_eq!(campaigns[0].generation, 2);
        assert_eq!(campaigns[0].payload.as_deref(), Some("campaign-2"));
        assert!(!marker_path(&root).exists());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn interruption_immediately_after_commit_marker_is_also_recoverable() {
        let root = test_root("marker-recovery");
        seed(&root);
        write_at_impl(&root, &request(), Some(FaultPoint::AfterCommitMarker))
            .expect_err("marker fault must surface");
        assert!(marker_path(&root).exists());

        recover_at(&root).expect("recover from marker-only commit");
        let (character_dir, campaign_dir) = participant_dirs(&root);
        assert_eq!(character_library::read_generations_at(&character_dir).expect("Character read")[0].generation, 2);
        assert_eq!(campaign_library::read_generations_at(&campaign_dir).expect("Campaign read")[0].generation, 2);
        assert!(!marker_path(&root).exists());
        let _ = fs::remove_dir_all(root);
    }
}
