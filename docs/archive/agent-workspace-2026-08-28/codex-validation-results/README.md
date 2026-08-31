# Codex Validation Results

이 디렉터리는 `.agents/CODEX_VALIDATION_QUEUE.md`의 검증 결과 전용이다.

- 파일명: `<validation_id>.md`
- Codex가 생성/갱신한다.
- 제품 코드는 이 결과 파일 작성 과정에서 수정하지 않는다.
- ChatGPT는 다음 작업 및 release gate 판단 전에 해당 validation id 결과를 읽는다.

필수 결과 형식:

```text
validation_id: VAL-...
target_sha: <exact SHA>
validator: Codex
started_at: <ISO timestamp>
finished_at: <ISO timestamp>
status: PASS | FAIL | BLOCKED

commands:
- <exact command> => PASS/FAIL

failures:
- <none or concise failure + relevant output>

suspected_files:
- <path or none>

notes:
- <environment/worktree details>
```

Primary Live worktree는 검증 때문에 수정/clean/reset하지 않는다.
