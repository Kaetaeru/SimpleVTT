use serde::{Deserialize, Serialize};
use std::{fs, path::{Path, PathBuf}};

const RECORD_PREFIX:&str="connected-party-stash-host.";
const RECORD_SUFFIX:&str=".json";

#[derive(Debug,Clone,Deserialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct WriteConnectedPartyStashHostRecordRequest{pub request_id:String,pub payload:String}

#[derive(Debug,Clone,Deserialize)]
#[serde(rename_all="camelCase")]
pub(crate) struct DeleteConnectedPartyStashHostRecordRequest{pub request_id:String}

#[derive(Debug,Clone,Deserialize,Serialize,PartialEq)]
#[serde(rename_all="camelCase")]
pub(crate) struct ConnectedPartyStashHostRecordDto{pub request_id:String,pub payload:String}

fn required(value:&str,label:&str)->Result<String,String>{let normalized=value.trim();if normalized.is_empty(){return Err(format!("{label} is required"));}Ok(normalized.to_owned())}
fn record_key(request_id:&str)->String{request_id.as_bytes().iter().map(|byte|format!("{byte:02x}")).collect()}
fn records_dir(root:&Path)->PathBuf{root.join("connected-party-stash-host")}
fn record_path(root:&Path,request_id:&str)->PathBuf{records_dir(root).join(format!("{RECORD_PREFIX}{}{RECORD_SUFFIX}",record_key(request_id)))}
fn temp_path(path:&Path)->Result<PathBuf,String>{let name=path.file_name().and_then(|value|value.to_str()).ok_or_else(||"Party Stash Host coordinator filename is invalid".to_owned())?;Ok(path.with_file_name(format!("{name}.tmp")))}

fn read_dto(path:&Path)->Result<ConnectedPartyStashHostRecordDto,String>{let raw=fs::read_to_string(path).map_err(|error|format!("failed to read Party Stash Host coordinator: {error}"))?;serde_json::from_str(&raw).map_err(|error|format!("failed to decode Party Stash Host coordinator: {error}"))}

pub(crate) fn write_at(root:&Path,request:&WriteConnectedPartyStashHostRecordRequest)->Result<(),String>{
    let request_id=required(&request.request_id,"Party Stash Host requestId")?;
    let payload=required(&request.payload,"Party Stash Host payload")?;
    let path=record_path(root,&request_id);
    let dto=ConnectedPartyStashHostRecordDto{request_id,payload};
    if path.exists(){let existing=read_dto(&path)?;if existing!=dto{return Err("Party Stash Host requestId already has different durable data".to_owned());}return Ok(());}
    let parent=path.parent().ok_or_else(||"Party Stash Host coordinator path has no parent".to_owned())?;
    fs::create_dir_all(parent).map_err(|error|format!("failed to create Party Stash Host coordinator directory: {error}"))?;
    let encoded=serde_json::to_vec(&dto).map_err(|error|format!("failed to encode Party Stash Host coordinator: {error}"))?;
    let temp=temp_path(&path)?;
    let result=(||->Result<(),String>{
        let mut file=fs::OpenOptions::new().create(true).truncate(true).write(true).open(&temp).map_err(|error|format!("failed to open Party Stash Host temp record: {error}"))?;
        use std::io::Write;
        file.write_all(&encoded).map_err(|error|format!("failed to write Party Stash Host coordinator: {error}"))?;
        file.sync_all().map_err(|error|format!("failed to flush Party Stash Host coordinator: {error}"))?;
        drop(file);
        fs::rename(&temp,&path).map_err(|error|format!("failed to commit Party Stash Host coordinator: {error}"))?;
        Ok(())
    })();
    if result.is_err(){let _=fs::remove_file(&temp);}result
}

pub(crate) fn read_all_at(root:&Path)->Result<Vec<ConnectedPartyStashHostRecordDto>,String>{
    let dir=records_dir(root);if !dir.exists(){return Ok(Vec::new());}
    let mut records=Vec::new();
    for entry in fs::read_dir(&dir).map_err(|error|format!("failed to read Party Stash Host coordinator directory: {error}"))?{
        let entry=entry.map_err(|error|format!("failed to read Party Stash Host coordinator entry: {error}"))?;
        if !entry.file_type().map_err(|error|format!("failed to inspect Party Stash Host coordinator: {error}"))?.is_file(){continue;}
        let Some(name)=entry.file_name().to_str().map(str::to_owned) else{continue;};
        if !name.starts_with(RECORD_PREFIX)||!name.ends_with(RECORD_SUFFIX){continue;}
        records.push(read_dto(&entry.path())?);
    }
    records.sort_by(|left,right|left.request_id.cmp(&right.request_id));Ok(records)
}

pub(crate) fn delete_at(root:&Path,request:&DeleteConnectedPartyStashHostRecordRequest)->Result<(),String>{
    let request_id=required(&request.request_id,"Party Stash Host requestId")?;let path=record_path(root,&request_id);if path.exists(){fs::remove_file(path).map_err(|error|format!("failed to delete Party Stash Host coordinator: {error}"))?;}Ok(())
}

#[cfg(test)]
mod tests{
    use super::*;use std::time::{SystemTime,UNIX_EPOCH};
    fn test_root(name:&str)->PathBuf{let nonce=SystemTime::now().duration_since(UNIX_EPOCH).expect("time").as_nanos();std::env::temp_dir().join(format!("simplevtt-party-stash-host-{name}-{}-{nonce}",std::process::id()))}
    #[test]
    fn coordinator_is_create_once_retry_safe_and_delete_idempotent(){
        let root=test_root("record");let request=WriteConnectedPartyStashHostRecordRequest{request_id:"stash.recover.1".into(),payload:"{\"version\":1}".into()};
        write_at(&root,&request).expect("write");write_at(&root,&request).expect("retry");
        let records=read_all_at(&root).expect("read");assert_eq!(records.len(),1);assert_eq!(records[0].request_id,"stash.recover.1");
        delete_at(&root,&DeleteConnectedPartyStashHostRecordRequest{request_id:"stash.recover.1".into()}).expect("delete");delete_at(&root,&DeleteConnectedPartyStashHostRecordRequest{request_id:"stash.recover.1".into()}).expect("delete retry");
        assert!(read_all_at(&root).expect("read empty").is_empty());let _=fs::remove_dir_all(root);
    }
}
