use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
};

const FILE_PREFIX: &str = "character-library.";
const FILE_SUFFIX: &str = ".json";
const RETAIN_COMMITTED_GENERATIONS: usize = 3;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CharacterLibraryGenerationDto {
    pub generation: u64,
    pub payload: Option<String>,
    pub read_error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WriteCharacterLibraryGenerationRequest {
    pub expected_generation: u64,
    pub next_generation: u64,
    pub payload: String,
}

fn generation_from_name(name: &str) -> Option<u64> {
    let value = name.strip_prefix(FILE_PREFIX)?.strip_suffix(FILE_SUFFIX)?;
    if value.is_empty() || value.contains('.') {
        return None;
    }
    value.parse().ok()
}

fn committed_paths(dir: &Path) -> Result<Vec<(u64, PathBuf)>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let entries = fs::read_dir(dir)
        .map_err(|error| format!("failed to read Character library directory: {error}"))?;
    let mut committed = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|error| format!("failed to read Character library directory entry: {error}"))?;
        let file_type = entry
            .file_type()
            .map_err(|error| format!("failed to inspect Character library entry: {error}"))?;
        if !file_type.is_file() {
            continue;
        }
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        if let Some(generation) = generation_from_name(&name) {
            committed.push((generation, entry.path()));
        }
    }
    committed.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(committed)
}

pub(crate) fn read_generations_at(dir: &Path) -> Result<Vec<CharacterLibraryGenerationDto>, String> {
    fs::create_dir_all(dir)
        .map_err(|error| format!("failed to create Character library directory: {error}"))?;
    committed_paths(dir)?.into_iter().map(|(generation, path)| {
        match fs::read_to_string(&path) {
            Ok(payload) => Ok(CharacterLibraryGenerationDto {
                generation,
                payload: Some(payload),
                read_error: None,
            }),
            Err(error) => Ok(CharacterLibraryGenerationDto {
                generation,
                payload: None,
                read_error: Some(format!("failed to read {}: {error}", path.display())),
            }),
        }
    }).collect()
}

fn prune_old_generations(dir: &Path) {
    let Ok(committed) = committed_paths(dir) else {
        return;
    };
    for (_, path) in committed.into_iter().skip(RETAIN_COMMITTED_GENERATIONS) {
        let _ = fs::remove_file(path);
    }
}

pub(crate) fn write_generation_at(
    dir: &Path,
    request: &WriteCharacterLibraryGenerationRequest,
) -> Result<(), String> {
    fs::create_dir_all(dir)
        .map_err(|error| format!("failed to create Character library directory: {error}"))?;

    let committed = committed_paths(dir)?;
    let physical_generation = committed.first().map(|(generation, _)| *generation).unwrap_or(0);
    if physical_generation != request.expected_generation {
        return Err(format!(
            "stale Character library generation: expected {}, current {}",
            request.expected_generation, physical_generation
        ));
    }
    if request.next_generation != request.expected_generation + 1 {
        return Err(format!(
            "invalid next Character library generation: expected {}, received {}",
            request.expected_generation + 1,
            request.next_generation
        ));
    }

    let final_path = dir.join(format!("{FILE_PREFIX}{}{FILE_SUFFIX}", request.next_generation));
    if final_path.exists() {
        return Err(format!("Character library generation already exists: {}", request.next_generation));
    }
    let temp_path = dir.join(format!("{FILE_PREFIX}{}{FILE_SUFFIX}.tmp", request.next_generation));

    let write_result = (|| -> Result<(), String> {
        let mut file = OpenOptions::new()
            .create(true)
            .truncate(true)
            .write(true)
            .open(&temp_path)
            .map_err(|error| format!("failed to open Character library temp file: {error}"))?;
        file.write_all(request.payload.as_bytes())
            .map_err(|error| format!("failed to write Character library temp file: {error}"))?;
        file.sync_all()
            .map_err(|error| format!("failed to flush Character library temp file: {error}"))?;
        drop(file);
        fs::rename(&temp_path, &final_path)
            .map_err(|error| format!("failed to commit Character library generation: {error}"))?;
        Ok(())
    })();

    if write_result.is_err() {
        let _ = fs::remove_file(&temp_path);
        return write_result;
    }

    prune_old_generations(dir);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_dir(name: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time")
            .as_nanos();
        std::env::temp_dir().join(format!("simplevtt-{name}-{}-{nonce}", std::process::id()))
    }

    fn request(expected_generation: u64, next_generation: u64, payload: &str) -> WriteCharacterLibraryGenerationRequest {
        WriteCharacterLibraryGenerationRequest {
            expected_generation,
            next_generation,
            payload: payload.to_owned(),
        }
    }

    #[test]
    fn writes_immutable_generation_and_reads_it_back() {
        let dir = test_dir("write-read");
        write_generation_at(&dir, &request(0, 1, "{\"storageRevision\":1}"))
            .expect("first generation writes");
        let generations = read_generations_at(&dir).expect("generations read");
        assert_eq!(generations.len(), 1);
        assert_eq!(generations[0].generation, 1);
        assert_eq!(generations[0].payload.as_deref(), Some("{\"storageRevision\":1}"));
        assert!(generations[0].read_error.is_none());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn rejects_stale_writer_without_replacing_committed_generation() {
        let dir = test_dir("stale");
        write_generation_at(&dir, &request(0, 1, "first")).expect("first generation writes");
        let error = write_generation_at(&dir, &request(0, 1, "stale"))
            .expect_err("stale writer must fail");
        assert!(error.contains("stale Character library generation"));
        let generations = read_generations_at(&dir).expect("generations read");
        assert_eq!(generations[0].payload.as_deref(), Some("first"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn ignores_uncommitted_temp_file_when_reading_and_advancing() {
        let dir = test_dir("temp");
        fs::create_dir_all(&dir).expect("directory");
        fs::write(dir.join("character-library.1.json.tmp"), "partial").expect("temp write");
        assert!(read_generations_at(&dir).expect("read").is_empty());
        write_generation_at(&dir, &request(0, 1, "committed")).expect("commit after temp");
        assert_eq!(read_generations_at(&dir).expect("read")[0].payload.as_deref(), Some("committed"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn keeps_recent_committed_generations_only_after_successful_commit() {
        let dir = test_dir("prune");
        for generation in 1..=5 {
            write_generation_at(&dir, &request(generation - 1, generation, &format!("gen-{generation}")))
                .expect("generation writes");
        }
        let generations = read_generations_at(&dir).expect("read");
        let ids: Vec<_> = generations.into_iter().map(|item| item.generation).collect();
        assert_eq!(ids, vec![5, 4, 3]);
        let _ = fs::remove_dir_all(dir);
    }
}
