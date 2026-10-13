mod capture;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, PhysicalPosition, WindowEvent,
};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

/// Name of the executable that owns the foreground window (e.g. "slack.exe"), or "" if unknown.
#[tauri::command]
fn active_app() -> String {
    #[cfg(windows)]
    {
        use windows::Win32::Foundation::CloseHandle;
        use windows::Win32::System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
        };
        use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

        unsafe {
            let hwnd = GetForegroundWindow();
            if hwnd.0.is_null() {
                return String::new();
            }
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
            if pid == 0 {
                return String::new();
            }
            let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
                return String::new();
            };
            let mut buf = [0u16; 1024];
            let mut len = buf.len() as u32;
            let ok = QueryFullProcessImageNameW(handle, PROCESS_NAME_WIN32, windows::core::PWSTR(buf.as_mut_ptr()), &mut len);
            let _ = CloseHandle(handle);
            if ok.is_err() {
                return String::new();
            }
            let path = String::from_utf16_lossy(&buf[..len as usize]);
            return path.rsplit(['\\', '/']).next().unwrap_or("").to_lowercase();
        }
    }
    #[cfg(not(windows))]
    {
        String::new()
    }
}

/// Sends Ctrl+V to the foreground application. The frontend has already put the text on the clipboard.
#[tauri::command]
fn paste_from_clipboard() -> Result<(), String> {
    use enigo::{Direction, Enigo, Key, Keyboard, Settings};
    std::thread::sleep(std::time::Duration::from_millis(120));
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.key(Key::Control, Direction::Press).map_err(|e| e.to_string())?;
    enigo.key(Key::Unicode('v'), Direction::Click).map_err(|e| e.to_string())?;
    enigo.key(Key::Control, Direction::Release).map_err(|e| e.to_string())?;
    Ok(())
}

#[derive(serde::Serialize)]
struct Diagnostics {
    version: String,
    debug: bool,
    exe: String,
    log_dir: String,
    data_dir: String,
    scheme_target: String,
    log_tail: String,
}

/// Facts that help debug a broken install, shown in the app's Diagnostics panel.
#[tauri::command]
fn diagnostics(app: tauri::AppHandle) -> Diagnostics {
    let log_dir = app.path().app_log_dir().map(|p| p.display().to_string()).unwrap_or_default();
    let data_dir = app.path().app_data_dir().map(|p| p.display().to_string()).unwrap_or_default();
    let exe = std::env::current_exe().map(|p| p.display().to_string()).unwrap_or_default();
    let log_tail = std::fs::read_to_string(format!("{log_dir}\\shunbo.log"))
        .map(|s| s.lines().rev().take(80).collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>().join("\n"))
        .unwrap_or_default();
    Diagnostics {
        version: app.package_info().version.to_string(),
        debug: cfg!(debug_assertions),
        exe,
        log_dir,
        data_dir,
        scheme_target: scheme_target(),
        log_tail,
    }
}

/// Which executable Windows will launch for `shunbo://` links.
fn scheme_target() -> String {
    #[cfg(windows)]
    {
        let out = std::process::Command::new("reg")
            .args(["query", r"HKCU\Software\Classes\shunbo\shell\open\command", "/ve"])
            .output();
        if let Ok(o) = out {
            let s = String::from_utf8_lossy(&o.stdout);
            if let Some(line) = s.lines().find(|l| l.contains("REG_SZ")) {
                return line.split("REG_SZ").nth(1).unwrap_or("").trim().to_string();
            }
        }
        String::from("(not registered)")
    }
    #[cfg(not(windows))]
    {
        String::new()
    }
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    log::info!("quit requested from UI");
    app.exit(0);
}

fn place_overlay(app: &tauri::AppHandle) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        if let Ok(Some(monitor)) = overlay.primary_monitor() {
            let size = monitor.size();
            let pos = monitor.position();
            if let Ok(win) = overlay.outer_size() {
                let x = pos.x + ((size.width as i32 - win.width as i32) / 2).max(0);
                let y = pos.y + (size.height as i32 - win.height as i32 - 72).max(0);
                let _ = overlay.set_position(PhysicalPosition::new(x, y));
            }
        }
        let _ = overlay.set_ignore_cursor_events(true);
        let _ = overlay.show();
    }
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .target(tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir { file_name: Some("shunbo".into()) }))
                .target(tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout))
                .max_file_size(2_000_000)
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            log::info!("second instance launched with args {args:?}; focusing existing window");
            show_main(app);
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(capture::CaptureState::default())
        .invoke_handler(tauri::generate_handler![
            active_app,
            paste_from_clipboard,
            diagnostics,
            quit_app,
            capture::meeting_capture_start,
            capture::meeting_capture_pause,
            capture::meeting_capture_levels,
            capture::meeting_capture_take,
            capture::meeting_capture_stop
        ])
        .setup(|app| {
            log::info!("Shunbo {} starting ({})", app.package_info().version, if cfg!(debug_assertions) { "debug" } else { "release" });

            // Only dev builds register the scheme at runtime. Release builds are registered by the
            // installer; registering here too would hijack sign-in links from an installed copy.
            // Opt in with SHUNBO_DEV_DEEPLINK=1 when you need the deep link to hit the dev build.
            #[cfg(all(debug_assertions, any(windows, target_os = "linux")))]
            if std::env::var("SHUNBO_DEV_DEEPLINK").is_ok() {
                use tauri_plugin_deep_link::DeepLinkExt;
                match app.deep_link().register("shunbo") {
                    Ok(()) => log::info!("dev build registered shunbo:// to this executable"),
                    Err(e) => log::warn!("could not register shunbo:// scheme: {e}"),
                }
            }
            log::info!("shunbo:// currently opens: {}", scheme_target());

            place_overlay(app.handle());

            let open = MenuItem::with_id(app, "open", "Open Shunbo", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Shunbo", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().expect("app icon"))
                .tooltip("Shunbo")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "quit" => {
                        log::info!("quit from tray");
                        app.exit(0)
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let app = window.app_handle().clone();
                let win = window.clone();
                // Ask every time: hide to tray (keeps the shortcut working) or quit.
                app.dialog()
                    .message("Keep Shunbo running in the tray so the shortcut keeps working, or quit completely?")
                    .title("Close Shunbo")
                    .kind(MessageDialogKind::Info)
                    .buttons(MessageDialogButtons::OkCancelCustom("Keep in tray".into(), "Quit".into()))
                    .show(move |keep| {
                        if keep {
                            log::info!("main window hidden to tray");
                            let _ = win.hide();
                            let _ = win.app_handle().emit("hidden-to-tray", ());
                        } else {
                            log::info!("quit from close dialog");
                            win.app_handle().exit(0);
                        }
                    });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Shunbo");
}
