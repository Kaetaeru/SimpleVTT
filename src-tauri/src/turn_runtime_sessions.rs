use crate::generation_store::{self, StoredGenerationDto, WriteGenerationRequest};
use std::path::Path;

const FILE_PREFIX: &str = "turn-runtime-sessions.";
const LABEL: &str = "Turn runtime sessions";

pub(crate) type TurnRuntimeSessionGenerationDto = StoredGenerationDto;
pub(crate) type WriteTurnRuntimeSessionGenerationRequest = WriteGenerationRequest;

pub(crate) fn read_generations_at(dir: &Path) -> Result<Vec<TurnRuntimeSessionGenerationDto>, String> {
    generation_store::read_generations_at(dir, FILE_PREFIX, LABEL)
}

pub(crate) fn write_generation_at(
    dir: &Path,
    request: &WriteTurnRuntimeSessionGenerationRequest,
) -> Result<(), String> {
    generation_store::write_generation_at(dir, FILE_PREFIX, LABEL, request)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, path::PathBuf, time::{SystemTime, UNIX_EPOCH}};

    fn test_dir(name: &str) -> PathBuf {
        let nonce=SystemTime::now().duration_since(UNIX_EPOCH).expect("system time").as_nanos();
        std::env::temp_dir().join(format!("simplevtt-turn-runtime-{name}-{}-{nonce}",std::process::id()))
    }

    #[test]
    fn turn_runtime_sessions_use_shared_atomic_generation_contract() {
        let dir=test_dir("write-read");
        let request=WriteTurnRuntimeSessionGenerationRequest {
            expected_generation:0,
            next_generation:1,
            payload:"checkpoint-1".to_owned(),
        };
        write_generation_at(&dir,&request).expect("turn runtime generation writes");
        let generations=read_generations_at(&dir).expect("turn runtime generations read");
        assert_eq!(generations.len(),1);
        assert_eq!(generations[0].generation,1);
        assert_eq!(generations[0].payload.as_deref(),Some("checkpoint-1"));
        let _=fs::remove_dir_all(dir);
    }
}
