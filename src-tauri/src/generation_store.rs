use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

const FILE_SUFFIX: &str = ".json";
const RETAIN_COMMITTED_GENERATIONS: usize = 3;

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

fn write_generation_at_impl(
    dir: &Path,
    file_prefix: &str,
    label: &str,
    request: &WriteGenerationRequest,
    fail_after_temp_sync: bool,
) -> Result<(), String> {
    fs::create_dir_all(dir)
        .map_err(|error| format!("failed to create {label} directory: {error}"))?;

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
