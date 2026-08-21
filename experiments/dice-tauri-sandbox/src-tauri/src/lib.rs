#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("주사위 물리 테스트 앱을 실행하지 못했습니다.");
}
