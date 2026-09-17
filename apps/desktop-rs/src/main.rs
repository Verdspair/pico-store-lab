use anyhow::{Context, Result, bail};
use md5::{Digest, Md5};
use pico_store_lab::{
    PicoAuth, RequestSpec, StoreTarget, make_account_request, make_download_info_request_for,
    make_public_item_request_for_now, make_search_request, parse_download_info_for,
    parse_public_item_for, parse_search_results,
};
use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::Path;
use std::thread;
use std::time::Duration;

struct HttpResult {
    body: String,
    token: String,
    cookies: BTreeMap<String, String>,
}

fn post(request: &RequestSpec, retries: usize) -> Result<HttpResult> {
    let mut last_error = None;
    for attempt in 0..retries {
        let mut builder = ureq::post(&request.url);
        for (key, value) in &request.headers {
            builder = builder.header(key, value);
        }
        let result = builder.send(&request.body);
        match result {
            Ok(mut response) => {
                let token = response
                    .headers()
                    .get("x-tt-token")
                    .and_then(|value| value.to_str().ok())
                    .unwrap_or("")
                    .to_string();
                let mut cookies = BTreeMap::new();
                for value in response.headers().get_all("set-cookie") {
                    if let Ok(line) = value.to_str()
                        && let Some((key, val)) =
                            line.split(';').next().and_then(|part| part.split_once('='))
                    {
                        cookies.insert(key.to_string(), val.to_string());
                    }
                }
                return Ok(HttpResult {
                    body: response
                        .body_mut()
                        .read_to_string()
                        .context("read PICO response")?,
                    token,
                    cookies,
                });
            }
            Err(error) => last_error = Some(error),
        }
        if attempt + 1 < retries {
            thread::sleep(Duration::from_secs((attempt + 1).min(5) as u64));
        }
    }
    bail!("PICO request failed: {}", last_error.context("no attempt")?)
}

fn option(args: &[String], name: &str) -> Result<String> {
    let index = args
        .iter()
        .position(|value| value == name)
        .context(format!("{name} is required"))?;
    args.get(index + 1)
        .cloned()
        .context(format!("{name} value is required"))
}

fn target(args: &[String]) -> Result<StoreTarget> {
    StoreTarget::new(&option(args, "--item-id")?, &option(args, "--package")?, "")
        .map_err(|error| anyhow::anyhow!(error.to_string()))
}

fn auth_file(path: &Path) -> Result<PicoAuth> {
    if fs::metadata(path)?.permissions().mode() & 0o077 != 0 {
        bail!("auth file must not be readable by other users");
    }
    let auth: PicoAuth = serde_json::from_slice(&fs::read(path)?)?;
    if auth.x_tt_token.is_empty() && auth.cookies.is_empty() {
        bail!("invalid auth file");
    }
    Ok(auth)
}

fn download(url: &str, expected_md5: &str, output: &Path) -> Result<()> {
    if !url.starts_with("https://") || output.extension().and_then(|x| x.to_str()) != Some("apk") {
        bail!("HTTPS APK URL and .apk output are required");
    }
    if output.exists() {
        bail!("output APK already exists; choose a new path");
    }
    let temporary = output.with_extension("part.apk");
    let mut last_error = None;
    for attempt in 0..8 {
        let start = fs::metadata(&temporary).map(|meta| meta.len()).unwrap_or(0);
        let mut builder = ureq::get(url);
        if start > 0 {
            builder = builder.header("Range", format!("bytes={start}-"));
        }
        match builder.call() {
            Ok(mut response) => {
                if start > 0 {
                    let range = response
                        .headers()
                        .get("content-range")
                        .and_then(|value| value.to_str().ok())
                        .unwrap_or("");
                    if response.status().as_u16() != 206
                        || !range.starts_with(&format!("bytes {start}-"))
                    {
                        bail!("CDN refused a safe resume range");
                    }
                }
                let mut file = OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&temporary)?;
                let mut reader = response.body_mut().as_reader();
                let mut buffer = [0u8; 65536];
                let copy_result: std::io::Result<()> = (|| {
                    loop {
                        let count = reader.read(&mut buffer)?;
                        if count == 0 {
                            return Ok(());
                        }
                        file.write_all(&buffer[..count])?;
                    }
                })();
                if let Err(error) = copy_result {
                    last_error = Some(error.to_string());
                } else {
                    let mut digest = Md5::new();
                    let mut file = File::open(&temporary)?;
                    loop {
                        let count = file.read(&mut buffer)?;
                        if count == 0 {
                            break;
                        }
                        digest.update(&buffer[..count]);
                    }
                    if format!("{:x}", digest.finalize()) == expected_md5 {
                        fs::hard_link(&temporary, output)
                            .context("create verified APK without overwrite")?;
                        fs::remove_file(temporary)?;
                        return Ok(());
                    }
                    bail!("APK digest mismatch");
                }
            }
            Err(error) => last_error = Some(error.to_string()),
        }
        if attempt < 7 {
            thread::sleep(Duration::from_secs((attempt + 1).min(5)));
        }
    }
    bail!("APK download failed: {}", last_error.unwrap_or_default())
}

fn run(args: &[String]) -> Result<()> {
    let chinese = args.iter().any(|value| value == "zh-CN");
    let command = args.iter().find(|value| {
        matches!(
            value.as_str(),
            "search" | "status" | "send-code" | "login" | "download"
        )
    });
    match command.map(String::as_str) {
        Some("search") => {
            let position = args
                .iter()
                .position(|value| value == "search")
                .context("search command")?;
            let word = args.get(position + 1).context("search word required")?;
            let results = parse_search_results(&post(&make_search_request(word, 1)?, 3)?.body)?;
            println!("{}", serde_json::to_string_pretty(&results)?);
        }
        Some("status") => {
            let selected = target(args)?;
            let item = parse_public_item_for(
                &post(&make_public_item_request_for_now(&selected), 3)?.body,
                &selected,
            )?;
            println!("{}", serde_json::to_string_pretty(&item)?);
        }
        Some("send-code") => {
            let email = option(args, "--email")?;
            let request = make_account_request("send-code", &email, None)?;
            let body: serde_json::Value = serde_json::from_str(&post(&request, 1)?.body)?;
            if body["message"] != "success" {
                bail!("PICO account rejected the request");
            }
            println!(
                "{}",
                if chinese {
                    "PICO 验证码邮件已发送。"
                } else {
                    "PICO verification email sent."
                }
            );
        }
        Some("login") => {
            let email = option(args, "--email")?;
            let path = option(args, "--auth-file")?;
            let code = rpassword::prompt_password(if chinese {
                "PICO 邮箱验证码："
            } else {
                "PICO email code: "
            })?;
            let request = make_account_request("login", &email, Some(&code))?;
            let result = post(&request, 1)?;
            let body: serde_json::Value = serde_json::from_str(&result.body)?;
            if body["message"] != "success" {
                bail!("PICO account rejected the request");
            }
            let auth = PicoAuth {
                uid: body["data"]["user_id_str"]
                    .as_str()
                    .map(str::to_string)
                    .or_else(|| body["data"]["user_id"].as_u64().map(|id| id.to_string()))
                    .unwrap_or_else(|| "0".into()),
                x_tt_token: result.token,
                cookies: result.cookies,
            };
            if auth.x_tt_token.is_empty() && auth.cookies.is_empty() {
                bail!("PICO login returned no usable session");
            }
            let mut file = OpenOptions::new()
                .write(true)
                .create_new(true)
                .mode(0o600)
                .open(&path)?;
            file.write_all(serde_json::to_string(&auth)?.as_bytes())?;
            println!(
                "{} {path}",
                if chinese {
                    "私有会话已保存："
                } else {
                    "Private session saved:"
                }
            );
        }
        Some("download") => {
            let selected = target(args)?;
            let auth = auth_file(Path::new(&option(args, "--auth-file")?))?;
            let output = option(args, "--output")?;
            let info = parse_download_info_for(
                &post(&make_download_info_request_for(&auth, &selected)?, 3)?.body,
                &selected,
            )?;
            download(&info.url, &info.md5, Path::new(&output))?;
            println!(
                "{} {output}",
                if chinese {
                    "已校验 APK："
                } else {
                    "Verified APK:"
                }
            );
        }
        _ => {
            println!(
                "Usage: pico-store [--locale en|zh-CN] <search|status|send-code|login|download> [WORD] [--item-id ID --package NAME] [--email ADDRESS] [--auth-file PATH] [--output APK]"
            );
        }
    }
    Ok(())
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if let Err(error) = run(&args) {
        eprintln!("Error: {error:#}");
        std::process::exit(1);
    }
}
