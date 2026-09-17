use anyhow::{Context, Result, bail};
use pico_store_lab::{PicoAuth, PicoStoreClient, StoreTarget};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::os::unix::fs::{OpenOptionsExt, PermissionsExt};
use std::path::Path;

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
    Ok(StoreTarget::new(
        &option(args, "--item-id")?,
        &option(args, "--package")?,
        "",
    )?)
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

fn run(args: &[String]) -> Result<()> {
    let chinese = args.iter().any(|value| value == "zh-CN");
    let command = args.iter().find(|value| {
        matches!(
            value.as_str(),
            "search" | "status" | "send-code" | "login" | "download"
        )
    });
    let client = PicoStoreClient::default();
    match command.map(String::as_str) {
        Some("search") => {
            let position = args
                .iter()
                .position(|value| value == "search")
                .context("search command")?;
            let word = args.get(position + 1).context("search word required")?;
            println!(
                "{}",
                serde_json::to_string_pretty(&client.search(word, 1)?)?
            );
        }
        Some("status") => {
            println!(
                "{}",
                serde_json::to_string_pretty(&client.item(&target(args)?)?)?
            );
        }
        Some("send-code") => {
            client.send_code(&option(args, "--email")?)?;
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
            let auth = client.login(&email, &code)?;
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
            client.download(&selected, &auth, Path::new(&output))?;
            println!(
                "{} {output}",
                if chinese {
                    "已校验 APK："
                } else {
                    "Verified APK:"
                }
            );
        }
        _ => println!(
            "Usage: pico-store [--locale en|zh-CN] <search|status|send-code|login|download> [WORD] [--item-id ID --package NAME] [--email ADDRESS] [--auth-file PATH] [--output APK]"
        ),
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
