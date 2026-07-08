use std::fs::{create_dir_all, OpenOptions};
use std::io::{Read, Write};
use std::sync::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use tauri::{Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;

// Holds the live claude PTY so input/resize can reach it. claude runs directly on this device —
// no server, no streaming.
#[derive(Default)]
struct Term {
    writer: Mutex<Option<Box<dyn Write + Send>>>,
    master: Mutex<Option<Box<dyn MasterPty + Send>>>,
}

#[tauri::command]
fn term_open(app: tauri::AppHandle, state: tauri::State<Term>, cols: u16, rows: u16, tool: Option<String>) -> Result<(), String> {
    // Which agent CLI to launch — constrained to the ones RAISEME supports.
    let tool = match tool.as_deref() {
        Some("codex") => "codex",
        Some("copilot") => "copilot",
        _ => "claude",
    };
    // #3 — host-side policy enforcement. The RAISEME app itself refuses to launch an agent the
    // admin hasn't allowed, so the picker's restriction is real at the launch boundary (not just
    // UI a devtools user could invoke around). Claude is the always-available baseline; codex/
    // copilot require an allow confirmed with the server. This can't stop a user running the CLI
    // entirely outside RAISEME — that's inherent to their own machine — it's governance, not a sandbox.
    if tool != "claude" && !tool_allowed(tool) {
        let _ = app.emit("term-data", format!("\x1b[31m[RAISEME] {tool} is not permitted by your organization's policy.\x1b[0m\r\n"));
        return Err(format!("{tool} not permitted by policy"));
    }
    let pair = native_pty_system()
        .openpty(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 })
        .map_err(|e| e.to_string())?;

    let _ = app.emit("term-data", format!("\x1b[2m[RAISEME] launching {tool}…\x1b[0m\r\n"));

    let bin = find_tool(tool).ok_or(format!("{tool} CLI not found"))?;
    let mut cmd = CommandBuilder::new(bin);
    // Claude resumes the previous conversation across app restarts (only once a first session exists,
    // so a fresh install doesn't `--continue` into nothing). Codex/Copilot start a fresh session.
    if tool == "claude" && read_config().get("hadSession").and_then(|v| v.as_bool()).unwrap_or(false) { cmd.arg("--continue"); }
    // Inherit the full environment (HOME, etc.) so the agent finds its config; augment PATH.
    for (k, v) in std::env::vars() { cmd.env(k, v); }
    cmd.cwd(std::env::var("HOME").unwrap_or_else(|_| ".".into()));
    cmd.env("TERM", "xterm-256color");
    let path = std::env::var("PATH").unwrap_or_default();
    cmd.env("PATH", format!("/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:{path}"));
    // Per-agent auth: each CLI uses its own login; we only inject a token the user explicitly saved.
    let cfg = read_config();
    match tool {
        "claude" => {
            if let Some(tok) = cfg.get("agentToken").and_then(|v| v.as_str()) {
                if tok.starts_with("sk-ant-oat") { cmd.env("CLAUDE_CODE_OAUTH_TOKEN", tok); }
                else if !tok.is_empty() { cmd.env("ANTHROPIC_API_KEY", tok); }
            }
        }
        "codex" => {
            if let Some(tok) = cfg.get("openaiToken").and_then(|v| v.as_str()) {
                if !tok.is_empty() { cmd.env("OPENAI_API_KEY", tok); }
            }
        }
        "copilot" => {
            if let Some(tok) = cfg.get("githubToken").and_then(|v| v.as_str()) {
                if !tok.is_empty() { cmd.env("GH_TOKEN", tok); cmd.env("GITHUB_TOKEN", tok); }
            }
        }
        _ => {}
    }

    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    set_config_bool("hadSession", true);
    drop(pair.slave);
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    *state.writer.lock().unwrap() = Some(pair.master.take_writer().map_err(|e| e.to_string())?);
    *state.master.lock().unwrap() = Some(pair.master);

    let app2 = app.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) | Err(_) => break,
                Ok(n) => { let _ = app2.emit("term-data", String::from_utf8_lossy(&buf[..n]).to_string()); }
            }
        }
        let _ = app.emit("term-exit", ());
    });
    std::thread::spawn(move || { let _ = child.wait(); });
    Ok(())
}

#[tauri::command]
fn term_input(state: tauri::State<Term>, data: String) -> Result<(), String> {
    if let Some(w) = state.writer.lock().unwrap().as_mut() {
        w.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        let _ = w.flush();
    }
    Ok(())
}

#[tauri::command]
fn term_resize(state: tauri::State<Term>, cols: u16, rows: u16) -> Result<(), String> {
    if let Some(m) = state.master.lock().unwrap().as_ref() {
        m.resize(PtySize { rows, cols, pixel_width: 0, pixel_height: 0 }).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// Native, on-device audit sink — appends a redacted entry to a JSONL file in the app
// data dir. The host owns this file; it persists beyond the webview's localStorage.
#[tauri::command]
fn native_log(app: tauri::AppHandle, entry: serde_json::Value) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut f = OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("audit.jsonl"))
        .map_err(|e| e.to_string())?;
    writeln!(f, "{}", entry).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

// Resolve an agent CLI binary (GUI/minimal-PATH safe). Each tool has an env override
// (RAISEME_CLAUDE / RAISEME_CODEX / RAISEME_COPILOT) plus the usual install locations.
fn find_tool(tool: &str) -> Option<String> {
    let home = std::env::var("HOME").unwrap_or_default();
    let (env_key, candidates): (&str, Vec<String>) = match tool {
        "codex" => ("RAISEME_CODEX", vec![
            format!("{home}/.local/bin/codex"),
            format!("{home}/.codex/bin/codex"),
            "/opt/homebrew/bin/codex".into(),
            "/usr/local/bin/codex".into(),
        ]),
        "copilot" => ("RAISEME_COPILOT", vec![
            format!("{home}/.local/bin/copilot"),
            format!("{home}/.npm-global/bin/copilot"),
            "/opt/homebrew/bin/copilot".into(),
            "/usr/local/bin/copilot".into(),
        ]),
        _ => ("RAISEME_CLAUDE", vec![
            format!("{home}/.local/bin/claude"),
            format!("{home}/.claude/local/claude"),
            "/opt/homebrew/bin/claude".into(),
            "/usr/local/bin/claude".into(),
        ]),
    };
    if let Ok(p) = std::env::var(env_key) {
        if std::path::Path::new(&p).exists() { return Some(p); }
    }
    candidates.into_iter().find(|p| std::path::Path::new(p).exists())
}

fn find_claude() -> Option<String> { find_tool("claude") }

// #3 — is this agent permitted for our tenant/device? Asks the server (authoritative), falling
// back to the frontend-cached allow-list on a network error, else deny. Unprovisioned installs
// (no server binding) are not restricted.
fn tool_allowed(tool: &str) -> bool {
    let cfg = read_config();
    let server = cfg.get("serverUrl").and_then(|v| v.as_str()).unwrap_or("");
    let token = cfg.get("installToken").and_then(|v| v.as_str()).unwrap_or("");
    if server.is_empty() || token.is_empty() { return true; }
    // Offline fallback: the allow-list the frontend persists to config on each policy poll.
    let cached = cfg.get("allowedTools").and_then(|v| v.as_array())
        .map(|a| a.iter().any(|x| x.as_str() == Some(tool)));
    let user = std::env::var("USER").or_else(|_| std::env::var("LOGNAME")).unwrap_or_default();
    let device = std::process::Command::new("hostname").output().ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();
    let client = match reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(4))
        .build() { Ok(c) => c, Err(_) => return cached.unwrap_or(false) };
    let resp = client
        .get(format!("{server}/api/policy"))
        .query(&[("user", user.as_str()), ("device", device.as_str())])
        .header("X-Install-Token", token)
        .send()
        .and_then(|r| r.json::<serde_json::Value>());
    match resp {
        Ok(j) => j.get("allowedTools").and_then(|v| v.as_array())
            .map(|a| a.iter().any(|x| x.as_str() == Some(tool)))
            .unwrap_or(true), // policy without an allow-list → not restricted
        Err(_) => cached.unwrap_or(false), // network/parse failure → last-known, else deny
    }
}

// Writes the provision config (serverUrl + tenant) to ~/.raiseme/config.json — used when the
// user enrolls by pasting an installation token in the app.
#[tauri::command]
fn save_provision(config: serde_json::Value) -> Result<(), String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let dir = format!("{home}/.raiseme");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    // Merge into the existing config so enrolling doesn't clobber agent auth / other keys.
    let mut cfg = read_config();
    if !cfg.is_object() { cfg = serde_json::json!({}); }
    if let (Some(o), Some(n)) = (cfg.as_object_mut(), config.as_object()) {
        for (k, v) in n { o.insert(k.clone(), v.clone()); }
    }
    std::fs::write(format!("{dir}/config.json"), serde_json::to_string_pretty(&cfg).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Opens Terminal running the claude CLI so the user can complete the OAuth login interactively.
#[tauri::command]
fn open_login_terminal() -> Result<(), String> {
    let bin = find_claude().unwrap_or_else(|| "claude".into());
    let script = format!("tell application \"Terminal\"\nactivate\ndo script \"{}\"\nend tell", bin);
    std::process::Command::new("osascript").arg("-e").arg(&script).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

// Relaunch the app — used by idle-restart to pick up the latest installed build and resume the
// session. Re-running boot also re-checks for updates.
#[tauri::command]
fn restart_app(app: tauri::AppHandle) { app.restart(); }

// About-dialog metadata, including the live code signature read from the running bundle.
#[tauri::command]
fn about_info() -> serde_json::Value {
    // Whether the running bundle is Developer ID signed. We deliberately do NOT surface the
    // signing identity name / Team ID in the UI — only a boolean status.
    let mut signed = false;
    if let Ok(exe) = std::env::current_exe() {
        // exe = .../RAISEME.app/Contents/MacOS/raiseme → the .app bundle is 3 levels up.
        if let Some(bundle) = exe.ancestors().nth(3) {
            if let Ok(out) = std::process::Command::new("codesign").arg("-dvv").arg(bundle).output() {
                for line in String::from_utf8_lossy(&out.stderr).lines() {
                    if let Some(a) = line.strip_prefix("Authority=") {
                        if a.contains("Developer ID") { signed = true; break; }
                    }
                }
            }
        }
    }
    serde_json::json!({
        "version": env!("CARGO_PKG_VERSION"),
        "identifier": "run.glick.raiseme",
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "signed": signed
    })
}

// Silent auto-update: ask the update server if a newer build exists; if so, download it,
// verify its signature, and install it in place. Returns true when an update was installed
// (the caller then relaunches via restart_app). The replaced bundle is not quarantined, so the
// next launch skips Gatekeeper even while we're adhoc-signed.
#[tauri::command]
async fn check_and_install_update(app: tauri::AppHandle) -> Result<bool, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await.map_err(|e| e.to_string())? {
        Some(update) => {
            update.download_and_install(|_chunk, _total| {}, || {}).await.map_err(|e| e.to_string())?;
            Ok(true)
        }
        None => Ok(false),
    }
}

// Merge a boolean flag into ~/.raiseme/config.json without clobbering other keys.
fn set_config_bool(key: &str, val: bool) {
    let mut cfg = read_config();
    if !cfg.is_object() { cfg = serde_json::json!({}); }
    if let Some(o) = cfg.as_object_mut() { o.insert(key.to_string(), serde_json::Value::Bool(val)); }
    if let Ok(home) = std::env::var("HOME") {
        let _ = std::fs::create_dir_all(format!("{home}/.raiseme"));
        let _ = std::fs::write(format!("{home}/.raiseme/config.json"), serde_json::to_string_pretty(&cfg).unwrap_or_default());
    }
}

// Opens a URL in the system browser (keeps it out of the app's webview).
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    // Only http(s) — never hand `open` a file:// path, app bundle, or custom scheme.
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("blocked non-http URL".into());
    }
    let opener = if cfg!(target_os = "macos") { "open" } else if cfg!(target_os = "windows") { "explorer" } else { "xdg-open" };
    std::process::Command::new(opener).arg(url).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

// Inventories other AI tools installed on the device + the OS, to report to the RAISEME server.
#[tauri::command]
fn device_ai_tools() -> serde_json::Value {
    let apps: [(&str, &str); 12] = [
        ("ChatGPT", "/Applications/ChatGPT.app"),
        ("Claude", "/Applications/Claude.app"),
        ("Copilot", "/Applications/Copilot.app"),
        ("ChatGPT Atlas", "/Applications/ChatGPT Atlas.app"),
        ("Cursor", "/Applications/Cursor.app"),
        ("Perplexity", "/Applications/Perplexity.app"),
        ("Ollama", "/Applications/Ollama.app"),
        ("LM Studio", "/Applications/LM Studio.app"),
        ("Msty", "/Applications/Msty.app"),
        ("Jan", "/Applications/Jan.app"),
        ("Raycast", "/Applications/Raycast.app"),
        ("Windsurf", "/Applications/Windsurf.app"),
    ];
    let mut tools: Vec<String> = apps.iter().filter(|(_, p)| std::path::Path::new(p).exists()).map(|(n, _)| n.to_string()).collect();

    // CLI AI tools on common paths
    let home = std::env::var("HOME").unwrap_or_default();
    let cli: [(&str, [String; 4]); 4] = [
        ("claude CLI", [format!("{home}/.local/bin/claude"), format!("{home}/.claude/local/claude"), "/opt/homebrew/bin/claude".into(), "/usr/local/bin/claude".into()]),
        ("ollama CLI", [format!("{home}/.ollama"), "/opt/homebrew/bin/ollama".into(), "/usr/local/bin/ollama".into(), String::new()]),
        ("aider", [format!("{home}/.local/bin/aider"), "/opt/homebrew/bin/aider".into(), "/usr/local/bin/aider".into(), String::new()]),
        ("gh copilot", [format!("{home}/.local/share/gh/extensions/gh-copilot"), String::new(), String::new(), String::new()]),
    ];
    for (name, paths) in &cli {
        if paths.iter().any(|p| !p.is_empty() && std::path::Path::new(p).exists()) { tools.push(name.to_string()); }
    }

    let os_version = std::process::Command::new("sw_vers").arg("-productVersion").output().ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_default();

    serde_json::json!({ "os": std::env::consts::OS, "osVersion": os_version, "tools": tools })
}

// --- browser + extension inventory ---
fn chromium_profiles(base: &str) -> Vec<std::path::PathBuf> {
    let mut out = vec![];
    if let Ok(rd) = std::fs::read_dir(base) {
        for e in rd.flatten() {
            let p = e.path();
            if p.join("Extensions").is_dir() { out.push(p); }
        }
    }
    out
}

fn resolve_ext_name(ver: &std::path::Path, m: &serde_json::Value, id: &str) -> String {
    let name = m.get("name").and_then(|v| v.as_str()).unwrap_or(id);
    if !name.starts_with("__MSG_") { return name.to_string(); }
    let key = name.trim_start_matches("__MSG_").trim_end_matches("__");
    let locale = m.get("default_locale").and_then(|v| v.as_str()).unwrap_or("en");
    for loc in [locale, "en", "en_US"] {
        if let Ok(t) = std::fs::read_to_string(ver.join(format!("_locales/{loc}/messages.json"))) {
            if let Ok(j) = serde_json::from_str::<serde_json::Value>(&t) {
                if let Some(o) = j.as_object() {
                    if let Some(v) = o.iter().find(|(k, _)| k.eq_ignore_ascii_case(key)).map(|(_, v)| v) {
                        if let Some(msg) = v.get("message").and_then(|x| x.as_str()) { return msg.to_string(); }
                    }
                }
            }
        }
    }
    id.to_string()
}

fn ext_broad(m: &serde_json::Value) -> bool {
    let broad = ["<all_urls>", "*://*/*", "http://*/*", "https://*/*", "tabs", "webRequest", "webRequestBlocking", "cookies", "clipboardRead", "history", "debugger"];
    let has = |key: &str| m.get(key).and_then(|v| v.as_array())
        .map(|a| a.iter().any(|p| broad.contains(&p.as_str().unwrap_or("")))).unwrap_or(false);
    has("host_permissions") || has("permissions")
}

// Inventories installed browsers and their extensions (name, id, broad-access flag).
#[tauri::command]
fn device_browsers() -> serde_json::Value {
    let home = std::env::var("HOME").unwrap_or_default();
    let mut result = vec![];
    let chromium = [
        ("Google Chrome", "/Applications/Google Chrome.app", "Google/Chrome"),
        ("Microsoft Edge", "/Applications/Microsoft Edge.app", "Microsoft Edge"),
        ("Brave", "/Applications/Brave Browser.app", "BraveSoftware/Brave-Browser"),
        ("Arc", "/Applications/Arc.app", "Arc/User Data"),
        ("Vivaldi", "/Applications/Vivaldi.app", "Vivaldi"),
        ("Opera", "/Applications/Opera.app", "com.operasoftware.Opera"),
    ];
    for (name, app, sub) in chromium {
        if !std::path::Path::new(app).exists() { continue; }
        let mut exts = vec![];
        let mut seen = std::collections::HashSet::new();
        for profile in chromium_profiles(&format!("{home}/Library/Application Support/{sub}")) {
            if let Ok(rd) = std::fs::read_dir(profile.join("Extensions")) {
                for id_entry in rd.flatten() {
                    if exts.len() >= 100 { break; }
                    let id = id_entry.file_name().to_string_lossy().to_string();
                    if id.starts_with('.') || id == "Temp" || !seen.insert(id.clone()) { continue; }
                    let ver = std::fs::read_dir(id_entry.path()).ok()
                        .and_then(|r| r.flatten().map(|e| e.path()).find(|p| p.is_dir()));
                    if let Some(ver) = ver {
                        if let Ok(t) = std::fs::read_to_string(ver.join("manifest.json")) {
                            if let Ok(m) = serde_json::from_str::<serde_json::Value>(&t) {
                                exts.push(serde_json::json!({ "name": resolve_ext_name(&ver, &m, &id), "id": id, "broad": ext_broad(&m) }));
                            }
                        }
                    }
                }
            }
        }
        result.push(serde_json::json!({ "browser": name, "extensions": exts }));
    }
    if std::path::Path::new("/Applications/Firefox.app").exists() {
        let mut exts = vec![];
        if let Ok(rd) = std::fs::read_dir(format!("{home}/Library/Application Support/Firefox/Profiles")) {
            for p in rd.flatten() {
                if let Ok(t) = std::fs::read_to_string(p.path().join("extensions.json")) {
                    if let Ok(j) = serde_json::from_str::<serde_json::Value>(&t) {
                        if let Some(addons) = j.get("addons").and_then(|a| a.as_array()) {
                            for a in addons {
                                if a.get("type").and_then(|t| t.as_str()) != Some("extension") { continue; }
                                if a.get("location").and_then(|l| l.as_str()) != Some("app-profile") { continue; }
                                let id = a.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let nm = a.pointer("/defaultLocale/name").and_then(|v| v.as_str()).unwrap_or(&id).to_string();
                                exts.push(serde_json::json!({ "name": nm, "id": id, "broad": false }));
                            }
                        }
                    }
                }
            }
        }
        result.push(serde_json::json!({ "browser": "Firefox", "extensions": exts }));
    }
    // Safari uses Apple App Extensions (.appex registered with the system), not profile manifests —
    // enumerate them with pluginkit. We skip Apple's own built-ins to show third-party extensions only.
    if std::path::Path::new("/Applications/Safari.app").exists() {
        let mut exts = vec![];
        let mut seen = std::collections::HashSet::new();
        for proto in ["com.apple.Safari.web-extension", "com.apple.Safari.extension", "com.apple.Safari.content-blocker"] {
            if let Ok(out) = std::process::Command::new("pluginkit").args(["-m", "-A", "-v", "-p", proto]).output() {
                for line in String::from_utf8_lossy(&out.stdout).lines() {
                    if exts.len() >= 100 { break; }
                    let id = line.split_whitespace().find(|t| t.contains('.')).unwrap_or("").split('(').next().unwrap_or("").to_string();
                    if id.is_empty() || id.starts_with("com.apple.") || !seen.insert(id.clone()) { continue; }
                    let name = id.rsplit('.').next().unwrap_or(&id).to_string();
                    exts.push(serde_json::json!({ "name": name, "id": id, "broad": false }));
                }
            }
        }
        result.push(serde_json::json!({ "browser": "Safari", "extensions": exts }));
    }
    serde_json::json!(result)
}

// Checks for pending macOS software/security updates (posture signal). Can be slow — call async.
#[tauri::command]
fn os_patch_status() -> serde_json::Value {
    match std::process::Command::new("softwareupdate").arg("-l").output() {
        Ok(o) => {
            let s = format!("{}{}", String::from_utf8_lossy(&o.stdout), String::from_utf8_lossy(&o.stderr));
            if s.contains("No new software available") {
                return serde_json::json!({ "upToDate": true, "count": 0, "titles": [] });
            }
            let titles: Vec<String> = s.lines()
                .filter(|l| l.trim_start().starts_with("Title:"))
                .map(|l| l.trim().trim_start_matches("Title:").trim().trim_end_matches(',').to_string())
                .collect();
            let labels = s.lines().filter(|l| l.trim_start().starts_with("* Label:")).count();
            let count = if titles.is_empty() { labels } else { titles.len() };
            serde_json::json!({ "upToDate": count == 0, "count": count, "titles": titles })
        }
        Err(e) => serde_json::json!({ "upToDate": null, "count": 0, "error": e.to_string() })
    }
}

fn read_config() -> serde_json::Value {
    std::env::var("HOME").ok()
        .and_then(|h| std::fs::read_to_string(format!("{h}/.raiseme/config.json")).ok())
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_else(|| serde_json::json!({}))
}

// Persists the agent auth (method + token) to the local config.
#[tauri::command]
fn set_agent_auth(method: String, token: String) -> Result<(), String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    std::fs::create_dir_all(format!("{home}/.raiseme")).map_err(|e| e.to_string())?;
    let mut cfg = read_config();
    if !cfg.is_object() { cfg = serde_json::json!({}); }
    cfg["authMethod"] = serde_json::Value::String(method);
    cfg["agentToken"] = serde_json::Value::String(token);
    std::fs::write(format!("{home}/.raiseme/config.json"), serde_json::to_string_pretty(&cfg).unwrap())
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Fallback agent path: the local claude CLI (uses its own OAuth login). RAISEME has already
// pre-flight reviewed the prompt on the JS side.
#[tauri::command]
fn run_agent(prompt: String) -> Result<String, String> {
    let bin = find_claude().ok_or("claude CLI not found — paste an OAuth token or API key in setup")?;
    let out = std::process::Command::new(bin)
        .arg("-p").arg(&prompt)
        .output()
        .map_err(|e| e.to_string())?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        Err(format!("{}{}", String::from_utf8_lossy(&out.stderr), String::from_utf8_lossy(&out.stdout)).trim().to_string())
    }
}

// Native OS identity for the security dashboard — metadata only, no content.
#[tauri::command]
fn identity() -> serde_json::Value {
    let user = std::env::var("USER")
        .or_else(|_| std::env::var("LOGNAME"))
        .unwrap_or_else(|_| "unknown".into());
    let device = std::process::Command::new("hostname")
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "unknown".into());
    let cfg = read_config();
    let tenant = cfg.get("tenant").and_then(|t| t.as_str()).unwrap_or("unprovisioned").to_string();
    let install_token = cfg.get("installToken").and_then(|t| t.as_str()).unwrap_or("").to_string();
    serde_json::json!({ "user": user, "device": device, "platform": std::env::consts::OS, "tenant": tenant, "installToken": install_token, "appVersion": env!("CARGO_PKG_VERSION") })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Term::default())
        .invoke_handler(tauri::generate_handler![native_log, app_version, identity, run_agent, save_provision, set_agent_auth, open_url, open_login_terminal, restart_app, check_and_install_update, about_info, term_open, term_input, term_resize, device_ai_tools, os_patch_status, device_browsers])
        .run(tauri::generate_context!())
        .expect("error while running RAISEME");
}
