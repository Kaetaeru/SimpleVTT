use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

const FILE_SUFFIX: &str = ".json";
const RETAIN_COMMITTED_GENERATIONS: usize = 3;

#[cfg(all(debug_assertions, feature = "tauri-e2e"))]
const E2E_FAIL_NEXT_WRITE_MARKER: &str = ".simplevtt-e2e-fail-next-write";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StoredGenerationDto {
    pub generation: u64,
    pub payload: Option<String>,
    pub read_error: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WriteGenerationRequest {
    pub expected_generation: u64,
    pub next_generation: u64,
    pub payload: String,
}

fn generation_from_name(name: &str, file_prefix: &str) -> Option<u64> {
    let value = name.strip_prefix(file_prefix)?.strip_suffix(FILE_SUFFIX)?;
    if value.is_empty() || value.contains('.') {
        return None;
    }
    value.parse().ok()
}

fn committed_paths(dir: &Path, file_prefix: &str, label: &str) -> Result<Vec<(u64, PathBuf)>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(dir)
        .map_err(|error| format!("failed to read {label} directory: {error}"))?;
    let mut committed = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| format!("failed to read {label} directory entry: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("failed to inspect {label} entry: {error}"))?;
        if !file_type.is_file() {
            continue;
        }
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        if let Some(generation) = generation_from_name(&name, file_prefix) {
            committed.push((generation, entry.path()));
        }
    }
    committed.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(committed)
}

pub(crate) fn latest_generation_at(dir: &Path, file_prefix: &str, label: &str) -> Result<u64, String> {
    Ok(committed_paths(dir, file_prefix, label)?
        .first()
        .map(|(generation, _)| *generation)
        .unwrap_or(0))
}

pub(crate) fn generation_path(dir: &Path, file_prefix: &str, generation: u64) -> PathBuf {
    dir.join(format!("{file_prefix}{generation}{FILE_SUFFIX}"))
}

pub(crate) fn read_generations_at(
    dir: &Path,
    file_prefix: &str,
    label: &str,
) -> Result<Vec<StoredGenerationDto>, String> {
    fs::create_dir_all(dir)
        .map_err(|error| format!("failed to create {label} directory: {error}"))?;
    committed_paths(dir, file_prefix, label)?.into_iter().map(|(generation, path)| {
        match fs::read_to_string(&path) {
            Ok(payload) => Ok(StoredGenerationDto {
                generation,
                payload: Some(payload),
                read_error: None,
            }),
            Err(error) => Ok(StoredGenerationDto {
                generation,
                payload: None,
                read_error: Some(format!("failed to read {}: {error}", path.display())),
            }),
        }
    }).collect()
}

pub(crate) fn prune_old_generations(dir: &Path, file_prefix: &str, label: &str) {
    let Ok(committed) = committed_paths(dir, file_prefix, label) else {
        return;
    };
    for (_, path) in committed.into_iter().skip(RETAIN_COMMITTED_GENERATIONS) {
        let _ = fs::remove_file(path);
    }
}

#[cfg(all(debug_assertions, feature = "tauri-e2e"))]
fn maybe_fail_next_e2e_write(dir: &Path, label: &str) -> Result<(), String> {
    let marker = dir.join(E2E_FAIL_NEXT_WRITE_MARKER);
    if !marker.exists() {
        return Ok(());
    }
    fs::remove_file(&marker)
        .map_err(|error| format!("failed to consume {label} tauri-e2e fault marker: {error}"))?;
    Err(format!("simulated {label} write failure from tauri-e2e fault marker"))
}

fn write_generation_at_impl(
    dir: &Path,
    file_prefix: &str,
    label: &str,
    request: &WriteGenerationRequest,
    fail_after_temp_sync: bool,
) -> Result<(), String> {
    fs::create_dir_all(dir)
        .map_err(|error| format!("failed to create {label} directory: {error}"))?;

    #[cfg(all(debug_assertions, feature = "tauri-e2e"))]
    maybe_fail_next_e2e_write(dir, label)?;

    let committed = committed_paths(dir, file_prefix, label)?;
    let physical_generation = committed.first().map(|(generation, _)| *generation).unwrap_or(0);
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

    let final_path = generation_path(dir, file_prefix, request.next_generation);
    if final_path.exists() {
        return Err(format!("{label} generation already exists: {}", request.next_generation));
    }
    let temp_path = dir.join(format!("{file_prefix}{}{FILE_SUFFIX}.tmp", request.next_generation));

    let write_result = (|| -> Result<(), String> {
        let mut file = OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&temp_path)
            .map_err(|error| format!("failed to open {label} temp file: {error}"))?;
        file.write_all(request.payload.as_bytes())
            .map_err(|error| format!("failed to write {label} temp file: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("failed to flush {label} temp file: {error}"))?;
        drop(file);
        if fail_after_temp_sync {
            return Err(format!("simulated interrupted {label} save after temp sync"));
        }
        fs::rename(&temp_path, &final_path)
            .map_err(|error| format!("failed to commit {label} generation: {error}"))?;
        Ok(())
    })();

    if write_result.is_err() {
        let _ = fs::remove_file(&temp_path);
        return write_result;
    }

    prune_old_generations(dir, file_prefix, label);
    Ok(())
}

pub(crate) fn write_generation_at(
    dir: &Path,
    file_prefix: &str,
    label: &str,
    request: &WriteGenerationRequest,
) -> Result<(), String> {
    write_generation_at_impl(dir, file_prefix, label, request, false)
}

#[cfg(test)]
pub(crate) fn write_generation_at_with_fault_after_temp_sync(
    dir: &Path,
    file_prefix: &str,
    label: &str,
    request: &WriteGenerationRequest,
) -> Result<(), String> {
    write_generation_at_impl(dir, file_prefix, label, request, true)
}

#[cfg(all(test, feature = "tauri-e2e"))]
mod e2e_fault_tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir() -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock before unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("simplevtt-generation-store-e2e-{}-{nonce}", std::process::id()))
    }

    #[test]
    fn tauri_e2e_fault_marker_fails_exactly_one_generation_write() {
        let dir = temp_dir();
        fs::create_dir_all(&dir).expect("create temp generation dir");
        fs::write(dir.join(E2E_FAIL_NEXT_WRITE_MARKER), b"fail next write")
            .expect("write tauri-e2e fault marker");
        let request = WriteGenerationRequest {
            expected_generation: 0,
            next_generation: 1,
            payload: "{}".to_owned(),
        };

        let error = write_generation_at(&dir, "test.", "test generation", &request)
            .expect_err("fault marker should reject the first write");
        assert!(error.contains("simulated test generation write failure"));
        assert!(!dir.join(E2E_FAIL_NEXT_WRITE_MARKER).exists(), "fault marker must be consumed");

        write_generation_at(&dir, "test.", "test generation", &request)
            .expect("second write should succeed after one-shot fault is consumed");
        assert!(generation_path(&dir, "test.", 1).exists());
        let _ = fs::remove_dir_all(dir);
    }
}
