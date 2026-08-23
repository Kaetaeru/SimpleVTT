use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{fs, path::{Path, PathBuf}};

const MARKER_PREFIX: &str = "connected-owner-inventory.";
const MARKER_SUFFIX: &str = ".json";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct JournalMarker {
    version: u32,
    request_id: String,
    actor_id: String,
    command: Value,
    before: Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PrepareOwnerInventoryJournalRequest {
    pub request_id: String,
    pub actor_id: String,
    pub command: Value,
    pub before: Value,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OwnerInventoryJournalIdentityRequest {
    pub request_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MarkOwnerInventoryAppliedRequest {
    pub request_id: String,
    pub after: Value,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BeginOwnerInventoryUndoRequest {
    pub request_id: String,
    pub before_undo: Value,
    pub after_undo: Value,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FinalizeOwnerInventoryJournalRequest {
    pub request_id: String,
    pub outcome: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OwnerInventoryJournalDto {
    pub version: u32,
    pub request_id: String,
    pub actor_id: String,
    pub phase: String,
    pub command: Value,
    pub before: Value,
    pub after: Option<Value>,
    pub before_undo: Option<Value>,
    pub after_undo: Option<Value>,
    pub final_outcome: Option<String>,
}

fn required(value: &str, label: &str) -> Result<String, String> {
    let normalized = value.trim();
    if normalized.is_empty() { return Err(format!("{label} is required")); }
    Ok(normalized.to_owned())
}

fn marker_key(request_id: &str) -> String {
    request_id.as_bytes().iter().map(|byte| format!("{byte:02x}")).collect()
}

fn marker_path(dir: &Path, request_id: &str) -> PathBuf {
    dir.join(format!("{MARKER_PREFIX}{}{MARKER_SUFFIX}", marker_key(request_id)))
}

fn phase_path(marker: &Path, phase: &str) -> Result<PathBuf, String> {
    let name = marker.file_name().and_then(|value| value.to_str())
        .ok_or_else(|| "owner inventory journal filename is invalid".to_owned())?;
    Ok(marker.with_file_name(format!("{name}.{phase}")))
}

fn temp_path(path: &Path) -> Result<PathBuf, String> {
    let name = path.file_name().and_then(|value| value.to_str())
        .ok_or_else(|| "owner inventory journal filename is invalid".to_owned())?;
    Ok(path.with_file_name(format!("{name}.tmp")))
}

fn write_new_file(path: &Path, payload: &[u8], label: &str) -> Result<(), String> {
    if path.exists() { return Err(format!("{label} already exists")); }
    let parent = path.parent().ok_or_else(|| format!("{label} path has no parent"))?;
    fs::create_dir_all(parent).map_err(|error| format!("failed to create owner inventory journal directory: {error}"))?;
    let temp = temp_path(path)?;
    let result = (|| -> Result<(), String> {
        let mut file = fs::OpenOptions::new().create(true).truncate(true).write(true).open(&temp)
            .map_err(|error| format!("failed to open {label} temp file: {error}"))?;
        use std::io::Write;
        file.write_all(payload).map_err(|error| format!("failed to write {label}: {error}"))?;
        file.sync_all().map_err(|error| format!("failed to flush {label}: {error}"))?;
        drop(file);
        fs::rename(&temp, path).map_err(|error| format!("failed to commit {label}: {error}"))?;
        Ok(())
    })();
    if result.is_err() { let _ = fs::remove_file(&temp); }
    result
}

fn write_json_once<T: Serialize + for<'de> Deserialize<'de> + PartialEq>(path: &Path, payload: &T, label: &str) -> Result<(), String> {
    if path.exists() {
        let raw = fs::read_to_string(path).map_err(|error| format!("failed to read {label}: {error}"))?;
        let existing:T = serde_json::from_str(&raw).map_err(|error| format!("failed to decode {label}: {error}"))?;
        if existing != *payload { return Err(format!("{label} already exists with different data")); }
        return Ok(());
    }
    let bytes = serde_json::to_vec(payload).map_err(|error| format!("failed to encode {label}: {error}"))?;
    write_new_file(path, &bytes, label)
}

fn read_json<T: for<'de> Deserialize<'de>>(path: &Path, label: &str) -> Result<Option<T>, String> {
    if !path.exists() { return Ok(None); }
    let raw = fs::read_to_string(path).map_err(|error| format!("failed to read {label}: {error}"))?;
    serde_json::from_str(&raw).map(Some).map_err(|error| format!("failed to decode {label}: {error}"))
}

fn read_marker(path: &Path) -> Result<Option<JournalMarker>, String> {
    read_json(path, "owner inventory journal marker")
}

fn read_at(dir: &Path, request_id: &str) -> Result<Option<OwnerInventoryJournalDto>, String> {
    let id = required(request_id, "owner inventory requestId")?;
    let path = marker_path(dir, &id);
    let marker = match read_marker(&path)? { Some(value) => value, None => return Ok(None) };
    let applied:Option<MarkOwnerInventoryAppliedRequest> = read_json(&phase_path(&path, "applied")?, "owner inventory applied marker")?;
    let undoing:Option<BeginOwnerInventoryUndoRequest> = read_json(&phase_path(&path, "undoing")?, "owner inventory undoing marker")?;
    let undone = phase_path(&path, "undone")?.exists();
    let finalized:Option<FinalizeOwnerInventoryJournalRequest> = read_json(&phase_path(&path, "finalized")?, "owner inventory finalized marker")?;
    let phase = if finalized.is_some() { "finalized" } else if undone { "undone" } else if undoing.is_some() { "undoing" } else if applied.is_some() { "applied" } else { "prepared" };
    Ok(Some(OwnerInventoryJournalDto {
        version: marker.version,
        request_id: marker.request_id,
        actor_id: marker.actor_id,
        phase: phase.to_owned(),
        command: marker.command,
        before: marker.before,
        after: applied.map(|value| value.after),
        before_undo: undoing.as_ref().map(|value| value.before_undo.clone()),
        after_undo: undoing.map(|value| value.after_undo),
        final_outcome: finalized.map(|value| value.outcome),
    }))
}

pub(crate) fn prepare_at(dir: &Path, request: &PrepareOwnerInventoryJournalRequest) -> Result<OwnerInventoryJournalDto, String> {
    let request_id = required(&request.request_id, "owner inventory requestId")?;
    let actor_id = required(&request.actor_id, "owner inventory actorId")?;
    let path = marker_path(dir, &request_id);
    let marker = JournalMarker { version: 1, request_id: request_id.clone(), actor_id, command: request.command.clone(), before: request.before.clone() };
    if let Some(existing) = read_marker(&path)? {
        if existing != marker { return Err("owner inventory requestId already has a different journal".to_owned()); }
    } else {
        write_json_once(&path, &marker, "owner inventory journal marker")?;
    }
    read_at(dir, &request_id)?.ok_or_else(|| "owner inventory journal vanished after prepare".to_owned())
}

pub(crate) fn mark_applied_at(dir: &Path, request: &MarkOwnerInventoryAppliedRequest) -> Result<OwnerInventoryJournalDto, String> {
    let request_id = required(&request.request_id, "owner inventory requestId")?;
    let path = marker_path(dir, &request_id);
    if read_marker(&path)?.is_none() { return Err("owner inventory journal is missing".to_owned()); }
    if phase_path(&path, "undone")?.exists() { return Err("undone owner inventory transaction cannot become applied".to_owned()); }
    if phase_path(&path, "finalized")?.exists() { return read_at(dir, &request_id)?.ok_or_else(|| "owner inventory journal is missing".to_owned()); }
    write_json_once(&phase_path(&path, "applied")?, request, "owner inventory applied marker")?;
    read_at(dir, &request_id)?.ok_or_else(|| "owner inventory journal vanished after apply".to_owned())
}

pub(crate) fn begin_undo_at(dir: &Path, request: &BeginOwnerInventoryUndoRequest) -> Result<OwnerInventoryJournalDto, String> {
    let request_id = required(&request.request_id, "owner inventory requestId")?;
    let path = marker_path(dir, &request_id);
    if read_marker(&path)?.is_none() { return Err("owner inventory journal is missing".to_owned()); }
    if phase_path(&path, "finalized")?.exists() { return Err("finalized owner inventory transaction cannot begin undo".to_owned()); }
    if phase_path(&path, "undone")?.exists() { return read_at(dir, &request_id)?.ok_or_else(|| "owner inventory journal is missing".to_owned()); }
    write_json_once(&phase_path(&path, "undoing")?, request, "owner inventory undoing marker")?;
    read_at(dir, &request_id)?.ok_or_else(|| "owner inventory journal vanished after undo begin".to_owned())
}

pub(crate) fn mark_undone_at(dir: &Path, request: &OwnerInventoryJournalIdentityRequest) -> Result<OwnerInventoryJournalDto, String> {
    let request_id = required(&request.request_id, "owner inventory requestId")?;
    let path = marker_path(dir, &request_id);
    if read_marker(&path)?.is_none() { return Err("owner inventory journal is missing".to_owned()); }
    if phase_path(&path, "finalized")?.exists() { return read_at(dir, &request_id)?.ok_or_else(|| "owner inventory journal is missing".to_owned()); }
    let undone_path = phase_path(&path, "undone")?;
    if !undone_path.exists() { write_new_file(&undone_path, b"undone", "owner inventory undone marker")?; }
    read_at(dir, &request_id)?.ok_or_else(|| "owner inventory journal vanished after undo".to_owned())
}

pub(crate) fn finalize_at(dir: &Path, request: &FinalizeOwnerInventoryJournalRequest) -> Result<OwnerInventoryJournalDto, String> {
    let request_id = required(&request.request_id, "owner inventory requestId")?;
    if request.outcome != "applied" && request.outcome != "undone" { return Err("owner inventory final outcome must be applied or undone".to_owned()); }
    let path = marker_path(dir, &request_id);
    let current = read_at(dir, &request_id)?.ok_or_else(|| "owner inventory journal is missing".to_owned())?;
    if current.phase == "prepared" || current.phase == "undoing" { return Err("owner inventory transaction is not settled and cannot be finalized".to_owned()); }
    if request.outcome == "applied" && current.phase != "applied" && current.final_outcome.as_deref() != Some("applied") { return Err("owner inventory applied finalization does not match journal phase".to_owned()); }
    if request.outcome == "undone" && current.phase != "undone" && current.final_outcome.as_deref() != Some("undone") { return Err("owner inventory undone finalization does not match journal phase".to_owned()); }
    write_json_once(&phase_path(&path, "finalized")?, request, "owner inventory finalized marker")?;
    read_at(dir, &request_id)?.ok_or_else(|| "owner inventory journal vanished after finalize".to_owned())
}

pub(crate) fn read_request_at(dir: &Path, request: &OwnerInventoryJournalIdentityRequest) -> Result<Option<OwnerInventoryJournalDto>, String> {
    read_at(dir, &request.request_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_dir(name: &str) -> PathBuf {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).expect("time").as_nanos();
        std::env::temp_dir().join(format!("simplevtt-owner-inventory-{name}-{}-{nonce}", std::process::id()))
    }

    fn prepare_request() -> PrepareOwnerInventoryJournalRequest {
        PrepareOwnerInventoryJournalRequest {
            request_id: "stash.tx.1".to_owned(),
            actor_id: "char.remote".to_owned(),
            command: serde_json::json!({"operation":"grant-currency","amount":5}),
            before: serde_json::json!({"goldGp":10,"items":[]}),
        }
    }

    #[test]
    fn journal_phases_are_append_only_and_idempotent() {
        let dir = test_dir("phases");
        let prepared = prepare_at(&dir, &prepare_request()).expect("prepare");
        assert_eq!(prepared.phase, "prepared");
        let applied_request = MarkOwnerInventoryAppliedRequest { request_id:"stash.tx.1".to_owned(), after:serde_json::json!({"goldGp":15,"items":[]}) };
        assert_eq!(mark_applied_at(&dir, &applied_request).expect("applied").phase, "applied");
        assert_eq!(mark_applied_at(&dir, &applied_request).expect("applied retry").phase, "applied");
        let undo = BeginOwnerInventoryUndoRequest { request_id:"stash.tx.1".to_owned(), before_undo:serde_json::json!({"goldGp":15,"items":[]}), after_undo:serde_json::json!({"goldGp":10,"items":[]}) };
        assert_eq!(begin_undo_at(&dir, &undo).expect("undoing").phase, "undoing");
        assert_eq!(mark_undone_at(&dir, &OwnerInventoryJournalIdentityRequest{request_id:"stash.tx.1".to_owned()}).expect("undone").phase, "undone");
        let final_request = FinalizeOwnerInventoryJournalRequest { request_id:"stash.tx.1".to_owned(), outcome:"undone".to_owned() };
        let finalized = finalize_at(&dir, &final_request).expect("finalize");
        assert_eq!(finalized.phase, "finalized");
        assert_eq!(finalized.final_outcome.as_deref(), Some("undone"));
        assert_eq!(finalize_at(&dir, &final_request).expect("finalize retry").phase, "finalized");
        let _ = fs::remove_dir_all(dir);
    }
}
