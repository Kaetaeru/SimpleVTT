use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(
        std::env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is required"),
    );
    let shared_icon = manifest_dir.join("../../../src-tauri/icons/icon.ico");

    let windows = tauri_build::WindowsAttributes::new().window_icon_path(shared_icon);
    let attributes = tauri_build::Attributes::new().windows_attributes(windows);

    tauri_build::try_build(attributes).expect("failed to build SimpleVTT Dice Lab");
}
