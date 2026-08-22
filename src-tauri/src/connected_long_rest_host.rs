use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}};

const RECORD_PREFIX: &str = "connected-long-rest-host.";
const RECORD_SUFFIX: &str = ".json";

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WriteConnectedLongRestHostRecordRequest {
    pub transaction_id: String,
    pub payload: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeleteConnectedLongRestHostRecordRequest {
    pub transaction_id: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ConnectedLongRestHostRecordDto {
    pub transaction_id: String,
    pub payload: String,
}

fn required(value: &str, label: &str) -> Result<String, String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return Err(format!("{label} is required"));
    }
    Ok(normalized.to_owned())
}

fn record_key(transaction_id: &str) -> String {
    transaction_id.as_bytes().iter().map(|byte| format!("{byte:02x}")).collect()
}

fn records_dir(root: &Path) -> PathBuf {
    root.join("connected-long-rest-host")
}

fn record_path(root: &Path, transaction_id: &str) -> PathBuf {
    records_dir(root).join(format!("{RECORD_PREFIX}{}{RECORD_SUFFIX}", record_key(transaction_id)))
}

fn temp_path(path: &Path) -> Result<PathBuf, String> {
    let name = path.file_name().and_then(|value| value.to_str())
        .ok_or_else(|| "connected Long Rest Host record filename is invalid".to_owned())?;
    Ok(path.with_file_name(format!("{name}.tmp")))
}

fn write_replaceable(path: &Path, payload: &[u8]) -> Result<(), String> {
    let parent = path.parent().ok_or_else(|| "connected Long Rest Host record path has no parent".to_owned())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("failed to create connected Long Rest Host record directory: {error}"))?;
    let temp = temp_path(path)?;
    let write_result = (|| -> Result<(), String> {
        let mut file = std::fs::OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&temp)
            .map_err(|error| format!("failed to open connected Long Rest Host temp record: {error}"))?;
        use std::io::Write;
        file.write_all(payload)
            .map_err(|error| format!("failed to write connected Long Rest Host record: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("failed to flush connected Long Rest Host record: {error}"))?;
        drop(file);

        // std::fs::rename does not replace an existing target on Windows. The
        // durable record is therefore versioned by an adjacent .next file and
        // readers prefer it when present. Promotion never requires overwrite.
        let next = path.with_file_name(format!("{}.next", path.file_name().and_then(|v|v.to_str()).ok_or_else(|| "invalid Host record filename".to_owned())?));
        if next.exists() {
            fs::remove_file(&next).map_err(|error| format!("failed to clear stale connected Long Rest Host next record: {error}"))?;
        }
        fs::rename(&temp, &next)
            .map_err(|error| format!("failed to stage connected Long Rest Host record: {error}"))?;
        Ok(())
    })();
    if write_result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    write_result
}

fn read_one(path: &Path) -> Result<ConnectedLongRestHostRecordDto, String> {
    let next = path.with_file_name(format!("{}.next", path.file_name().and_then(|v|v.to_str()).ok_or_else(|| "invalid Host record filename".to_owned())?));
    let source = if next.exists() { next } else { path.to_path_buf() };
    let raw = fs::read_to_string(&source)
        .map_err(|error| format!("failed to read connected Long Rest Host record: {error}"))?;
    serde_json::from_str(&raw)
        .map_err(|error| format!("failed to decode connected Long Rest Host record: {error}"))
}

pub(crate) fn write_at(root: &Path, request: &WriteConnectedLongRestHostRecordRequest) -> Result<(), String> {
    let transaction_id = required(&request.transaction_id, "connected Long Rest Host transactionId")?;
    let payload = required(&request.payload, "connected Long Rest Host payload")?;
    let dto = ConnectedLongRestHostRecordDto { transaction_id: transaction_id.clone(), payload };
    let encoded = serde_json::to_vec(&dto)
        .map_err(|error| format!("failed to encode connected Long Rest Host record: {error}"))?;
    let path = record_path(root, &transaction_id);
    if !path.exists() {
        // First version may use the canonical path directly.
        let parent = path.parent().ok_or_else(|| "connected Long Rest Host record path has no parent".to_owned())?;
        fs::create_dir_all(parent).map_err(|error| format!("failed to create connected Long Rest Host record directory: {error}"))?;
        let temp = temp_path(&path)?;
        let mut file = std::fs::OpenOptions::new().create(true).truncate(true).write(true).open(&temp)
            .map_err(|error| format!("failed to open connected Long Rest Host temp record: {error}"))?;
        use std::io::Write;
        file.write_all(&encoded).map_err(|error| format!("failed to write connected Long Rest Host record: {error}"))?;
        file.sync_all().map_err(|error| format!("failed to flush connected Long Rest Host record: {error}"))?;
        drop(file);
        fs::rename(&temp, &path).map_err(|error| format!("failed to commit connected Long Rest Host record: {error}"))?;
        return Ok(());
    }
    write_replaceable(&path, &encoded)
}

pub(crate) fn read_all_at(root: &Path) -> Result<Vec<ConnectedLongRestHostRecordDto>, String> {
    let dir = records_dir(root);
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut records = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|error| format!("failed to read connected Long Rest Host record directory: {error}"))? {
        let entry = entry.map_err(|error| format!("failed to read connected Long Rest Host record entry: {error}"))?;
        let file_type = entry.file_type().map_err(|error| format!("failed to inspect connected Long Rest Host record: {error}"))?;
        if !file_type.is_file() { continue; }
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else { continue; };
        if !name.starts_with(RECORD_PREFIX) || !name.ends_with(RECORD_SUFFIX) { continue; }
        records.push(read_one(&entry.path())?);
    }
    records.sort_by(|left,right|left.transaction_id.cmp(&right.transaction_id));
    Ok(records)
}

pub(crate) fn delete_at(root: &Path, request: &DeleteConnectedLongRestHostRecordRequest) -> Result<(), String> {
    let transaction_id = required(&request.transaction_id, "connected Long Rest Host transactionId")?;
    let path = record_path(root, &transaction_id);
    let next = path.with_file_name(format!("{}.next", path.file_name().and_then(|v|v.to_str()).ok_or_else(|| "invalid Host record filename".to_owned())?));
    if path.exists() { fs::remove_file(&path).map_err(|error| format!("failed to delete connected Long Rest Host record: {error}"))?; }
    if next.exists() { fs::remove_file(&next).map_err(|error| format!("failed to delete connected Long Rest Host next record: {error}"))?; }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_root(name: &str) -> PathBuf {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).expect("system time").as_nanos();
        std::env::temp_dir().join(format!("simplevtt-connected-rest-host-{name}-{}-{nonce}", std::process::id()))
    }

    #[test]
    fn stores_updates_reads_and_deletes_opaque_host_records() {
        let root = test_root("record");
        let first = WriteConnectedLongRestHostRecordRequest { transaction_id:"tx.1".into(), payload:"{\"phase\":\"owner-prepared\"}".into() };
        write_at(&root,&first).expect("first write");
        assert_eq!(read_all_at(&root).expect("read")[0].payload, first.payload);
        let second = WriteConnectedLongRestHostRecordRequest { transaction_id:"tx.1".into(), payload:"{\"phase\":\"committed\"}".into() };
        write_at(&root,&second).expect("update write");
        assert_eq!(read_all_at(&root).expect("read updated")[0].payload, second.payload);
        delete_at(&root,&DeleteConnectedLongRestHostRecordRequest{transaction_id:"tx.1".into()}).expect("delete");
        assert!(read_all_at(&root).expect("read deleted").is_empty());
        let _ = fs::remove_dir_all(root);
    }
}
