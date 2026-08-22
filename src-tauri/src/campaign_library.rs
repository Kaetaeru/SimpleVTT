use crate::generation_store::{self, StoredGenerationDto, WriteGenerationRequest};
use std::path::Path;

pub(crate) const FILE_PREFIX: &str = "campaign-library.";
pub(crate) const LABEL: &str = "Campaign library";

pub(crate) type CampaignLibraryGenerationDto = StoredGenerationDto;
pub(crate) type WriteCampaignLibraryGenerationRequest = WriteGenerationRequest;

pub(crate) fn read_generations_at(dir: &Path) -> Result<Vec<CampaignLibraryGenerationDto>, String> {
    generation_store::read_generations_at(dir, FILE_PREFIX, LABEL)
}

pub(crate) fn write_generation_at(
    dir: &Path,
    request: &WriteCampaignLibraryGenerationRequest,
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
        std::env::temp_dir().join(format!("simplevtt-campaign-{name}-{}-{nonce}", std::process::id()))
    }

    fn request(expected_generation: u64, next_generation: u64, payload: &str) -> WriteCampaignLibraryGenerationRequest {
        WriteCampaignLibraryGenerationRequest {
            expected_generation,
            next_generation,
            payload: payload.to_owned(),
        }
    }

    #[test]
    fn campaign_library_uses_the_shared_atomic_generation_contract() {
        let dir = test_dir("write-read");
        write_generation_at(&dir, &request(0, 1, "campaign-1")).expect("first Campaign generation writes");
        let stale = write_generation_at(&dir, &request(0, 1, "stale"))
            .expect_err("stale Campaign writer must fail");
        assert!(stale.contains("stale Campaign library generation"));
        let generations = read_generations_at(&dir).expect("Campaign generations read");
        assert_eq!(generations.len(), 1);
        assert_eq!(generations[0].generation, 1);
        assert_eq!(generations[0].payload.as_deref(), Some("campaign-1"));
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn campaign_library_ignores_uncommitted_temp_files() {
        let dir = test_dir("temp");
        fs::create_dir_all(&dir).expect("directory");
        fs::write(dir.join("campaign-library.1.json.tmp"), "partial").expect("temp write");
        assert!(read_generations_at(&dir).expect("read").is_empty());
        write_generation_at(&dir, &request(0, 1, "committed")).expect("commit after temp");
        assert_eq!(read_generations_at(&dir).expect("read")[0].payload.as_deref(), Some("committed"));
        let _ = fs::remove_dir_all(dir);
    }
}
