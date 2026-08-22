use serde::Deserialize;
use std::{fs, path::Path};

const MARKER_PREFIX: &str = "connected-long-rest.";
const MARKER_SUFFIX: &str = ".json";

#[derive(Deserialize)]
struct MarkerIdentity {
    transaction_id: String,
}

fn phase_path(path: &Path, phase: &str) -> Result<std::path::PathBuf, String> {
    let name=path.file_name().and_then(|value|value.to_str())
        .ok_or_else(||"connected Long Rest Character marker filename is invalid".to_owned())?;
    Ok(path.with_file_name(format!("{name}.{phase}")))
}

/**
 * A prepared connected Long Rest owns the next Character generation until the
 * Host either commits or aborts. Normal Character mutations must not advance
 * the generation in that window or the later global commit could become a
 * durable Campaign-only partial success.
 */
pub(crate) fn assert_no_prepared_at(dir:&Path)->Result<(),String>{
    if !dir.exists(){return Ok(());}
    for entry in fs::read_dir(dir).map_err(|error|format!("failed to inspect connected Long Rest Character write barrier: {error}"))?{
        let entry=entry.map_err(|error|format!("failed to inspect connected Long Rest Character marker: {error}"))?;
        if !entry.file_type().map_err(|error|format!("failed to inspect connected Long Rest Character marker type: {error}"))?.is_file(){continue;}
        let Some(name)=entry.file_name().to_str().map(str::to_owned) else{continue;};
        if !name.starts_with(MARKER_PREFIX)||!name.ends_with(MARKER_SUFFIX){continue;}
        let path=entry.path();
        if phase_path(&path,"materialized")?.exists()||phase_path(&path,"aborted")?.exists(){continue;}
        let raw=fs::read_to_string(&path).map_err(|error|format!("failed to read connected Long Rest Character preparation for write barrier: {error}"))?;
        let marker:MarkerIdentity=serde_json::from_str(&raw).map_err(|error|format!("failed to decode connected Long Rest Character preparation for write barrier: {error}"))?;
        return Err(format!("Character library write is locked by prepared connected Long Rest transaction: {}",marker.transaction_id));
    }
    Ok(())
}

#[cfg(test)]
mod tests{
    use super::*;
    use std::time::{SystemTime,UNIX_EPOCH};

    fn test_dir(name:&str)->std::path::PathBuf{
        let nonce=SystemTime::now().duration_since(UNIX_EPOCH).expect("system time").as_nanos();
        std::env::temp_dir().join(format!("simplevtt-rest-guard-{name}-{}-{nonce}",std::process::id()))
    }

    #[test]
    fn blocks_only_live_prepared_markers(){
        let dir=test_dir("prepared");
        fs::create_dir_all(&dir).expect("dir");
        let base=dir.join("connected-long-rest.74682e31.json");
        fs::write(&base,r#"{"transaction_id":"tx.1"}"#).expect("marker");
        assert!(assert_no_prepared_at(&dir).expect_err("prepared must lock").contains("tx.1"));
        fs::write(base.with_file_name("connected-long-rest.74682e31.json.aborted"),"aborted").expect("phase");
        assert_no_prepared_at(&dir).expect("aborted unlocks");
        let _=fs::remove_dir_all(dir);
    }
}
