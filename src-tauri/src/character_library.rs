use crate::generation_store::{self, StoredGenerationDto, WriteGenerationRequest};
use std::path::Path;

const FILE_PREFIX: &str = "character-library.";
const LABEL: &str = "Character library";

pub(crate) type CharacterLibraryGenerationDto = StoredGenerationDto;
pub(crate) type WriteCharacterLibraryGenerationRequest = WriteGenerationRequest;

pub(crate) fn read_generations_at(dir: &Path) -> Result<Vec<CharacterLibraryGenerationDto>, String> {
    generation_store::read_generations_at(dir, FILE_PREFIX, LABEL)
}

pub(crate) fn write_generation_at(
    dir: &Path,
    request: &WriteCharacterLibraryGenerationRequest,
) -> Result<(), String> {
    generation_store::write_generation_at(dir, FILE_PREFIX, LABEL, request)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

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
    fn interrupted_save_after_temp_sync_preserves_previous_commit_and_allows_retry() {
        let dir = test_dir("interrupted-save");
        write_generation_at(&dir, &request(0, 1, "stable"))
            .expect("stable generation writes");

        let error = generation_store::write_generation_at_with_fault_after_temp_sync(
            &dir,
            FILE_PREFIX,
            LABEL,
            &request(1, 2, "candidate"),
        )
        .expect_err("fault must interrupt before commit rename");
        assert!(error.contains("simulated interrupted Character library save after temp sync"));
        assert!(!dir.join("character-library.2.json").exists());
        assert!(!dir.join("character-library.2.json.tmp").exists());

        let after_failure = read_generations_at(&dir).expect("stable generation remains readable");
        assert_eq!(after_failure.len(), 1);
        assert_eq!(after_failure[0].generation, 1);
        assert_eq!(after_failure[0].payload.as_deref(), Some("stable"));

        write_generation_at(&dir, &request(1, 2, "retry"))
            .expect("retry commits next generation");
        let after_retry = read_generations_at(&dir).expect("retry generation reads");
        assert_eq!(after_retry[0].generation, 2);
        assert_eq!(after_retry[0].payload.as_deref(), Some("retry"));
        assert_eq!(after_retry[1].generation, 1);
        assert_eq!(after_retry[1].payload.as_deref(), Some("stable"));
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
