use crate::{character_library, generation_store};
use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}};

const MARKER_PREFIX: &str = "connected-long-rest.";
const MARKER_SUFFIX: &str = ".json";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PrepareConnectedLongRestCharacterRequest {
    pub transaction_id: String,
    pub preparation_id: String,
    pub write: generation_store::WriteGenerationRequest,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConnectedLongRestCharacterIdentityRequest {
    pub transaction_id: String,
    pub preparation_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConnectedLongRestCharacterPreparationDto {
    pub transaction_id: String,
    pub preparation_id: String,
    pub phase: String,
    pub expected_generation: u64,
    pub next_generation: u64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PreparationMarker {
    transaction_id: String,
    preparation_id: String,
    phase: String,
    write: generation_store::WriteGenerationRequest,
}

fn required(value: &str, label: &str) -> Result<String, String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return Err(format!("{label} is required"));
    }
    Ok(normalized.to_owned())
}

fn marker_key(transaction_id: &str) -> String {
    transaction_id.as_bytes().iter().map(|byte| format!("{byte:02x}")).collect()
}

fn marker_path(dir: &Path, transaction_id: &str) -> PathBuf {
    dir.join(format!("{MARKER_PREFIX}{}{MARKER_SUFFIX}", marker_key(transaction_id)))
}

fn same_write(left: &generation_store::WriteGenerationRequest, right: &generation_store::WriteGenerationRequest) -> bool {
    left.expected_generation == right.expected_generation
        && left.next_generation == right.next_generation
        && left.payload == right.payload
}

fn dto(marker: &PreparationMarker) -> ConnectedLongRestCharacterPreparationDto {
    ConnectedLongRestCharacterPreparationDto {
        transaction_id: marker.transaction_id.clone(),
        preparation_id: marker.preparation_id.clone(),
        phase: marker.phase.clone(),
        expected_generation: marker.write.expected_generation,
        next_generation: marker.write.next_generation,
    }
}

fn read_marker(path: &Path) -> Result<Option<PreparationMarker>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("failed to read connected Long Rest Character preparation: {error}"))?;
    serde_json::from_str(&raw)
        .map(Some)
        .map_err(|error| format!("failed to decode connected Long Rest Character preparation: {error}"))
}

fn write_marker(path: &Path, marker: &PreparationMarker) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "connected Long Rest Character preparation path has no parent".to_owned())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("failed to create Character library directory: {error}"))?;
    let temp = path.with_extension("json.tmp");
    let payload = serde_json::to_vec(marker)
        .map_err(|error| format!("failed to encode connected Long Rest Character preparation: {error}"))?;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .truncate(true)
        .write(true)
        .open(&temp)
        .map_err(|error| format!("failed to open connected Long Rest Character preparation temp file: {error}"))?;
    use std::io::Write;
    file.write_all(&payload)
        .map_err(|error| format!("failed to write connected Long Rest Character preparation: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("failed to flush connected Long Rest Character preparation: {error}"))?;
    drop(file);
    fs::rename(&temp, path)
        .map_err(|error| format!("failed to commit connected Long Rest Character preparation marker: {error}"))?;
    Ok(())
}

fn committed_payload(dir: &Path, generation: u64) -> Result<Option<String>, String> {
    let path = generation_store::generation_path(dir, character_library::FILE_PREFIX, generation);
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(&path)
        .map(Some)
        .map_err(|error| format!("failed to read committed Character library generation {}: {error}", generation))
}

fn verify_materialized(dir: &Path, marker: &PreparationMarker) -> Result<(), String> {
    let current = generation_store::latest_generation_at(dir, character_library::FILE_PREFIX, character_library::LABEL)?;
    if current != marker.write.next_generation {
        return Err(format!(
            "connected Long Rest Character generation is not materialized: expected {}, current {}",
            marker.write.next_generation, current
        ));
    }
    let payload = committed_payload(dir, marker.write.next_generation)?
        .ok_or_else(|| "materialized Character generation payload is missing".to_owned())?;
    if payload != marker.write.payload {
        return Err("materialized Character generation does not match the prepared payload".to_owned());
    }
    Ok(())
}

pub(crate) fn prepare_at(
    dir: &Path,
    request: &PrepareConnectedLongRestCharacterRequest,
) -> Result<ConnectedLongRestCharacterPreparationDto, String> {
    let transaction_id = required(&request.transaction_id, "connected Long Rest transactionId")?;
    let preparation_id = required(&request.preparation_id, "connected Long Rest preparationId")?;
    if request.write.next_generation != request.write.expected_generation + 1 {
        return Err(format!(
            "invalid next Character library generation: expected {}, received {}",
            request.write.expected_generation + 1,
            request.write.next_generation
        ));
    }
    let path = marker_path(dir, &transaction_id);
    if let Some(existing) = read_marker(&path)? {
        if existing.transaction_id != transaction_id
            || existing.preparation_id != preparation_id
            || !same_write(&existing.write, &request.write)
        {
            return Err("connected Long Rest transaction already has a different Character preparation".to_owned());
        }
        if existing.phase == "materialized" {
            verify_materialized(dir, &existing)?;
        }
        return Ok(dto(&existing));
    }

    let current = generation_store::latest_generation_at(dir, character_library::FILE_PREFIX, character_library::LABEL)?;
    if current != request.write.expected_generation {
        return Err(format!(
            "stale Character library generation: expected {}, current {}",
            request.write.expected_generation, current
        ));
    }
    let marker = PreparationMarker {
        transaction_id,
        preparation_id,
        phase: "prepared".to_owned(),
        write: request.write.clone(),
    };
    write_marker(&path, &marker)?;
    Ok(dto(&marker))
}

pub(crate) fn materialize_at(
    dir: &Path,
    request: &ConnectedLongRestCharacterIdentityRequest,
) -> Result<ConnectedLongRestCharacterPreparationDto, String> {
    let transaction_id = required(&request.transaction_id, "connected Long Rest transactionId")?;
    let preparation_id = required(&request.preparation_id, "connected Long Rest preparationId")?;
    let path = marker_path(dir, &transaction_id);
    let mut marker = read_marker(&path)?
        .ok_or_else(|| "connected Long Rest Character preparation is missing".to_owned())?;
    if marker.transaction_id != transaction_id || marker.preparation_id != preparation_id {
        return Err("connected Long Rest Character preparation identity mismatch".to_owned());
    }
    if marker.phase == "aborted" {
        return Err("aborted connected Long Rest Character preparation cannot be materialized".to_owned());
    }
    if marker.phase == "materialized" {
        verify_materialized(dir, &marker)?;
        return Ok(dto(&marker));
    }

    let current = generation_store::latest_generation_at(dir, character_library::FILE_PREFIX, character_library::LABEL)?;
    if current == marker.write.expected_generation {
        character_library::write_generation_at(dir, &marker.write)?;
    } else if current == marker.write.next_generation {
        verify_materialized(dir, &marker)?;
    } else {
        return Err(format!(
            "stale Character library generation during connected Long Rest materialization: expected {} or {}, current {}",
            marker.write.expected_generation, marker.write.next_generation, current
        ));
    }
    marker.phase = "materialized".to_owned();
    write_marker(&path, &marker)?;
    Ok(dto(&marker))
}

pub(crate) fn abort_at(
    dir: &Path,
    request: &ConnectedLongRestCharacterIdentityRequest,
) -> Result<ConnectedLongRestCharacterPreparationDto, String> {
    let transaction_id = required(&request.transaction_id, "connected Long Rest transactionId")?;
    let preparation_id = required(&request.preparation_id, "connected Long Rest preparationId")?;
    let path = marker_path(dir, &transaction_id);
    let mut marker = read_marker(&path)?
        .ok_or_else(|| "connected Long Rest Character preparation is missing".to_owned())?;
    if marker.transaction_id != transaction_id || marker.preparation_id != preparation_id {
        return Err("connected Long Rest Character preparation identity mismatch".to_owned());
    }
    if marker.phase == "materialized" {
        verify_materialized(dir, &marker)?;
        return Err("materialized connected Long Rest Character preparation cannot be aborted".to_owned());
    }
    if marker.phase == "aborted" {
        return Ok(dto(&marker));
    }
    let current = generation_store::latest_generation_at(dir, character_library::FILE_PREFIX, character_library::LABEL)?;
    if current != marker.write.expected_generation {
        return Err(format!(
            "cannot abort connected Long Rest Character preparation after Character generation advanced: expected {}, current {}",
            marker.write.expected_generation, current
        ));
    }
    marker.phase = "aborted".to_owned();
    write_marker(&path, &marker)?;
    Ok(dto(&marker))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_dir(name: &str) -> PathBuf {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).expect("system time").as_nanos();
        std::env::temp_dir().join(format!("simplevtt-connected-rest-{name}-{}-{nonce}", std::process::id()))
    }

    fn prepare_request() -> PrepareConnectedLongRestCharacterRequest {
        PrepareConnectedLongRestCharacterRequest {
            transaction_id: "long-rest.remote.1".to_owned(),
            preparation_id: "character-stage.1".to_owned(),
            write: generation_store::WriteGenerationRequest {
                expected_generation: 0,
                next_generation: 1,
                payload: "candidate".to_owned(),
            },
        }
    }

    #[test]
    fn prepare_is_durable_but_not_visible_until_materialize() {
        let dir = test_dir("prepare-materialize");
        let request = prepare_request();
        let prepared = prepare_at(&dir, &request).expect("prepare succeeds");
        assert_eq!(prepared.phase, "prepared");
        assert!(character_library::read_generations_at(&dir).expect("read generations").is_empty());

        let identity = ConnectedLongRestCharacterIdentityRequest {
            transaction_id: request.transaction_id.clone(),
            preparation_id: request.preparation_id.clone(),
        };
        let materialized = materialize_at(&dir, &identity).expect("materialize succeeds");
        assert_eq!(materialized.phase, "materialized");
        assert_eq!(character_library::read_generations_at(&dir).expect("read generations")[0].payload.as_deref(), Some("candidate"));
        let repeated = materialize_at(&dir, &identity).expect("materialize retry is idempotent");
        assert_eq!(repeated.phase, "materialized");
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn aborted_preparation_never_becomes_visible() {
        let dir = test_dir("abort");
        let request = prepare_request();
        prepare_at(&dir, &request).expect("prepare succeeds");
        let identity = ConnectedLongRestCharacterIdentityRequest {
            transaction_id: request.transaction_id.clone(),
            preparation_id: request.preparation_id.clone(),
        };
        let aborted = abort_at(&dir, &identity).expect("abort succeeds");
        assert_eq!(aborted.phase, "aborted");
        assert!(materialize_at(&dir, &identity).is_err());
        assert!(character_library::read_generations_at(&dir).expect("read generations").is_empty());
        let _ = fs::remove_dir_all(dir);
    }
}
