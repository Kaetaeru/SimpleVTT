use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, fs, path::{Path, PathBuf}};

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

fn version_prefix(transaction_id: &str) -> String {
    format!("{RECORD_PREFIX}{}.", record_key(transaction_id))
}

fn version_path(root: &Path, transaction_id: &str, version: u64) -> PathBuf {
    records_dir(root).join(format!("{}{version}{RECORD_SUFFIX}", version_prefix(transaction_id)))
}

fn temp_path(path: &Path) -> Result<PathBuf, String> {
    let name = path.file_name().and_then(|value| value.to_str())
        .ok_or_else(|| "connected Long Rest Host record filename is invalid".to_owned())?;
    Ok(path.with_file_name(format!("{name}.tmp")))
}

fn parse_version(name: &str, transaction_id: &str) -> Option<u64> {
    let prefix = version_prefix(transaction_id);
    let raw = name.strip_prefix(&prefix)?.strip_suffix(RECORD_SUFFIX)?;
    raw.parse().ok()
}

fn versions(root: &Path, transaction_id: &str) -> Result<Vec<(u64,PathBuf)>, String> {
    let dir = records_dir(root);
    if !dir.exists() { return Ok(Vec::new()); }
    let mut found=Vec::new();
    for entry in fs::read_dir(&dir).map_err(|error| format!("failed to read connected Long Rest Host record directory: {error}"))? {
        let entry=entry.map_err(|error| format!("failed to read connected Long Rest Host record entry: {error}"))?;
        if !entry.file_type().map_err(|error| format!("failed to inspect connected Long Rest Host record: {error}"))?.is_file() { continue; }
        let Some(name)=entry.file_name().to_str().map(str::to_owned) else { continue; };
        if let Some(version)=parse_version(&name,transaction_id) { found.push((version,entry.path())); }
    }
    found.sort_by(|left,right|right.0.cmp(&left.0));
    Ok(found)
}

fn read_dto(path: &Path) -> Result<ConnectedLongRestHostRecordDto, String> {
    let raw=fs::read_to_string(path).map_err(|error| format!("failed to read connected Long Rest Host record: {error}"))?;
    serde_json::from_str(&raw).map_err(|error| format!("failed to decode connected Long Rest Host record: {error}"))
}

pub(crate) fn write_at(root: &Path, request: &WriteConnectedLongRestHostRecordRequest) -> Result<(), String> {
    let transaction_id=required(&request.transaction_id,"connected Long Rest Host transactionId")?;
    let payload=required(&request.payload,"connected Long Rest Host payload")?;
    let current=versions(root,&transaction_id)?.first().map(|(version,_)|*version).unwrap_or(0);
    let next_version=current+1;
    let path=version_path(root,&transaction_id,next_version);
    let parent=path.parent().ok_or_else(||"connected Long Rest Host record path has no parent".to_owned())?;
    fs::create_dir_all(parent).map_err(|error|format!("failed to create connected Long Rest Host record directory: {error}"))?;
    let dto=ConnectedLongRestHostRecordDto{transaction_id,payload};
    let encoded=serde_json::to_vec(&dto).map_err(|error|format!("failed to encode connected Long Rest Host record: {error}"))?;
    let temp=temp_path(&path)?;
    let write_result=(||->Result<(),String>{
        let mut file=std::fs::OpenOptions::new().create(true).truncate(true).write(true).open(&temp)
            .map_err(|error|format!("failed to open connected Long Rest Host temp record: {error}"))?;
        use std::io::Write;
        file.write_all(&encoded).map_err(|error|format!("failed to write connected Long Rest Host record: {error}"))?;
        file.sync_all().map_err(|error|format!("failed to flush connected Long Rest Host record: {error}"))?;
        drop(file);
        fs::rename(&temp,&path).map_err(|error|format!("failed to commit connected Long Rest Host record: {error}"))?;
        Ok(())
    })();
    if write_result.is_err(){let _=fs::remove_file(&temp);}
    write_result
}

pub(crate) fn read_all_at(root: &Path) -> Result<Vec<ConnectedLongRestHostRecordDto>, String> {
    let dir=records_dir(root);
    if !dir.exists(){return Ok(Vec::new());}
    let mut latest:BTreeMap<String,(u64,ConnectedLongRestHostRecordDto)>=BTreeMap::new();
    for entry in fs::read_dir(&dir).map_err(|error|format!("failed to read connected Long Rest Host record directory: {error}"))?{
        let entry=entry.map_err(|error|format!("failed to read connected Long Rest Host record entry: {error}"))?;
        if !entry.file_type().map_err(|error|format!("failed to inspect connected Long Rest Host record: {error}"))?.is_file(){continue;}
        let Some(name)=entry.file_name().to_str().map(str::to_owned) else{continue;};
        if !name.starts_with(RECORD_PREFIX)||!name.ends_with(RECORD_SUFFIX){continue;}
        let dto=read_dto(&entry.path())?;
        let Some(version)=parse_version(&name,&dto.transaction_id) else{continue;};
        let replace=latest.get(&dto.transaction_id).map(|(current,_)|version>*current).unwrap_or(true);
        if replace{latest.insert(dto.transaction_id.clone(),(version,dto));}
    }
    Ok(latest.into_values().map(|(_,dto)|dto).collect())
}

pub(crate) fn delete_at(root: &Path, request: &DeleteConnectedLongRestHostRecordRequest) -> Result<(), String> {
    let transaction_id=required(&request.transaction_id,"connected Long Rest Host transactionId")?;
    for (_,path) in versions(root,&transaction_id)?{
        fs::remove_file(path).map_err(|error|format!("failed to delete connected Long Rest Host record: {error}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests{
    use super::*;
    use std::time::{SystemTime,UNIX_EPOCH};

    fn test_root(name:&str)->PathBuf{
        let nonce=SystemTime::now().duration_since(UNIX_EPOCH).expect("system time").as_nanos();
        std::env::temp_dir().join(format!("simplevtt-connected-rest-host-{name}-{}-{nonce}",std::process::id()))
    }

    #[test]
    fn append_only_versions_recover_latest_and_delete_together(){
        let root=test_root("record");
        let first=WriteConnectedLongRestHostRecordRequest{transaction_id:"tx.1".into(),payload:"{\"phase\":\"owner-prepared\"}".into()};
        write_at(&root,&first).expect("first write");
        let second=WriteConnectedLongRestHostRecordRequest{transaction_id:"tx.1".into(),payload:"{\"phase\":\"committed\"}".into()};
        write_at(&root,&second).expect("second write");
        assert_eq!(versions(&root,"tx.1").expect("versions").len(),2);
        assert_eq!(read_all_at(&root).expect("read")[0].payload,second.payload);
        delete_at(&root,&DeleteConnectedLongRestHostRecordRequest{transaction_id:"tx.1".into()}).expect("delete");
        assert!(read_all_at(&root).expect("read deleted").is_empty());
        let _=fs::remove_dir_all(root);
    }
}
