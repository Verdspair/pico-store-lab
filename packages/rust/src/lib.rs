//! Typed PICO store protocol and mirror policy primitives.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fmt;
use std::time::{SystemTime, UNIX_EPOCH};
use url::Url;

pub const PICO_ITEM_ID: &str = "7288745304105664518";
pub const PICO_PACKAGE: &str = "com.vrchat.android";
pub const STORE_HOST: &str = "https://appstore-us.picoxr.com";
pub const ACCOUNT_HOST: &str = "https://matrix-us.picovr.com";
pub const OFFICIAL_STORE_URL: &str =
    "https://store-global.picoxr.com/jp/detail/1/7288745304105664518";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SdkError(pub String);

impl fmt::Display for SdkError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(formatter)
    }
}

impl std::error::Error for SdkError {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RequestSpec {
    pub url: String,
    pub method: &'static str,
    pub headers: BTreeMap<String, String>,
    pub body: String,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PicoAuth {
    pub uid: String,
    pub x_tt_token: String,
    pub cookies: BTreeMap<String, String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct PublicItem {
    pub item_id: String,
    pub package_name: String,
    pub name: String,
    pub version_code: u64,
    pub price: String,
    pub currency: String,
    pub icon_url: Option<String>,
    pub official_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct DownloadInfo {
    pub item_id: String,
    pub package_name: String,
    pub version_code: u64,
    pub version: String,
    pub size: u64,
    pub md5: String,
    pub url: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MirrorPolicy {
    pub enabled: bool,
    pub free_only: bool,
    pub max_bytes: u64,
}

impl Default for MirrorPolicy {
    fn default() -> Self {
        Self {
            enabled: true,
            free_only: true,
            max_bytes: 512 * 1024 * 1024,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MirrorReason {
    Eligible,
    Disabled,
    NotFree,
    OverSizeLimit,
}

pub fn mirror_decision(
    price: &str,
    size: u64,
    policy: &MirrorPolicy,
) -> Result<MirrorReason, SdkError> {
    if size == 0 {
        return Err(SdkError("invalid APK size".into()));
    }
    if !policy.enabled {
        return Ok(MirrorReason::Disabled);
    }
    if policy.free_only
        && !(price == "0"
            || price.starts_with("0.") && price[2..].chars().all(|c| c == '0') && price.len() > 2)
    {
        return Ok(MirrorReason::NotFree);
    }
    if size > policy.max_bytes {
        return Ok(MirrorReason::OverSizeLimit);
    }
    Ok(MirrorReason::Eligible)
}

fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before Unix epoch")
        .as_secs()
}

fn store_url(path: &str, uid: &str, language: &str, timestamp: u64) -> String {
    let mut url = Url::parse(STORE_HOST).expect("constant store URL");
    url.set_path(path);
    url.query_pairs_mut()
        .append_pair("manifest_version_code", "400900005")
        .append_pair("device_name", "A9210")
        .append_pair("uid", uid)
        .append_pair("app_id", "314431")
        .append_pair("app_language", language)
        .append_pair("client_type", "1")
        .append_pair("zone_name", "Asia/Shanghai")
        .append_pair("timestamp", &timestamp.to_string());
    url.into()
}

pub fn make_public_item_request() -> RequestSpec {
    make_public_item_request_at(current_timestamp())
}

pub fn make_public_item_request_at(timestamp: u64) -> RequestSpec {
    RequestSpec {
        url: store_url("/api/app/v1/item/info", "0", "ja", timestamp),
        method: "POST",
        headers: BTreeMap::from([
            ("Content-Type".into(), "application/json".into()),
            ("Locale".into(), "ja".into()),
        ]),
        body: format!(r#"{{"package_name":"{PICO_PACKAGE}"}}"#),
    }
}

fn item_id(value: &Value) -> Option<String> {
    match value {
        Value::Number(number) => Some(number.to_string()),
        Value::String(text) => Some(text.clone()),
        _ => None,
    }
}

fn text_or(value: Option<&Value>, fallback: &str) -> String {
    match value {
        Some(Value::String(text)) if !text.is_empty() => text.clone(),
        Some(Value::Number(number)) => number.to_string(),
        _ => fallback.into(),
    }
}

pub fn parse_public_item(text: &str) -> Result<PublicItem, SdkError> {
    let root: Value = serde_json::from_str(text).map_err(|error| SdkError(error.to_string()))?;
    if root.get("code").and_then(Value::as_i64) != Some(0) {
        return Err(SdkError("PICO item lookup failed".into()));
    }
    let data = root
        .get("data")
        .ok_or_else(|| SdkError("missing item data".into()))?;
    if item_id(&data["item_id"]).as_deref() != Some(PICO_ITEM_ID)
        || data["package_name"].as_str() != Some(PICO_PACKAGE)
    {
        return Err(SdkError(
            "PICO returned an unexpected item or package".into(),
        ));
    }
    let version = data["version_code"]
        .as_u64()
        .filter(|value| *value > 0)
        .ok_or_else(|| SdkError("PICO returned an invalid version code".into()))?;
    let icon = data["icon"]
        .as_str()
        .filter(|value| value.starts_with("https://"))
        .map(str::to_owned);
    Ok(PublicItem {
        item_id: PICO_ITEM_ID.into(),
        package_name: PICO_PACKAGE.into(),
        name: text_or(data.get("name"), "VRChat"),
        version_code: version,
        price: text_or(data.get("price"), ""),
        currency: text_or(data.get("currency"), ""),
        icon_url: icon,
        official_url: OFFICIAL_STORE_URL.into(),
    })
}

pub fn encode_account_field(value: &str) -> String {
    value
        .as_bytes()
        .iter()
        .map(|byte| format!("{:02x}", byte ^ 5))
        .collect()
}

pub fn make_account_request(
    kind: &str,
    email: &str,
    code: Option<&str>,
) -> Result<RequestSpec, SdkError> {
    let valid_email = email.split_once('@').is_some_and(|(local, domain)| {
        !local.is_empty()
            && !local.contains('@')
            && domain
                .split_once('.')
                .is_some_and(|(left, right)| !left.is_empty() && !right.is_empty())
            && !email.chars().any(char::is_whitespace)
    });
    if !valid_email {
        return Err(SdkError("valid email required".into()));
    }
    if kind != "send-code" && kind != "login" || kind == "login" && code.unwrap_or("").is_empty() {
        return Err(SdkError("invalid account action or missing code".into()));
    }
    let path = if kind == "send-code" {
        "/passport/email/send_code/"
    } else {
        "/passport/app/email/code_login/"
    };
    let mut url = Url::parse(ACCOUNT_HOST).expect("constant account URL");
    url.set_path(path);
    url.query_pairs_mut()
        .append_pair("multi_login", "1")
        .append_pair("account_sdk_source", "app")
        .append_pair("passport-sdk-version", "30490")
        .append_pair("aid", "308733")
        .append_pair("device_platform", "android");
    let fields: Vec<(&str, String)> = if kind == "send-code" {
        vec![
            ("email", encode_account_field(email)),
            ("type", encode_account_field("13")),
            ("email_logic_type", "0".into()),
            ("mix_mode", "1".into()),
        ]
    } else {
        vec![
            ("email", encode_account_field(email)),
            ("ect_type", "13".into()),
            ("code", encode_account_field(code.unwrap_or_default())),
            ("mix_mode", "1".into()),
            ("email_logic_type", "0".into()),
        ]
    };
    let mut encoded = url::form_urlencoded::Serializer::new(String::new());
    encoded.extend_pairs(fields);
    Ok(RequestSpec {
        url: url.into(),
        method: "POST",
        headers: BTreeMap::from([(
            "Content-Type".into(),
            "application/x-www-form-urlencoded".into(),
        )]),
        body: encoded.finish(),
    })
}

pub fn make_download_info_request(auth: &PicoAuth) -> Result<RequestSpec, SdkError> {
    if auth.x_tt_token.is_empty() && auth.cookies.is_empty() {
        return Err(SdkError("authenticated PICO session required".into()));
    }
    let mut headers = BTreeMap::from([
        ("Content-Type".into(), "application/json".into()),
        ("Locale".into(), "ja".into()),
    ]);
    if !auth.x_tt_token.is_empty() {
        headers.insert("X-Tt-Token".into(), auth.x_tt_token.clone());
    }
    if !auth.cookies.is_empty() {
        headers.insert(
            "Cookie".into(),
            auth.cookies
                .iter()
                .map(|(key, value)| format!("{key}={value}"))
                .collect::<Vec<_>>()
                .join("; "),
        );
    }
    Ok(RequestSpec {
        url: store_url(
            "/api/app/v1/download/info",
            &auth.uid,
            "ja",
            current_timestamp(),
        ),
        method: "POST",
        headers,
        body: format!(r#"{{"item_id":{PICO_ITEM_ID},"package_name":"{PICO_PACKAGE}"}}"#),
    })
}

pub fn parse_download_info(text: &str) -> Result<DownloadInfo, SdkError> {
    let root: Value = serde_json::from_str(text).map_err(|error| SdkError(error.to_string()))?;
    if root.get("code").and_then(Value::as_i64) != Some(0) {
        return Err(SdkError("PICO download info failed".into()));
    }
    let data = root
        .get("data")
        .ok_or_else(|| SdkError("missing download data".into()))?;
    let package = data
        .get("package")
        .ok_or_else(|| SdkError("missing package data".into()))?;
    if item_id(&data["item_id"]).as_deref() != Some(PICO_ITEM_ID)
        || package["package_name"].as_str() != Some(PICO_PACKAGE)
    {
        return Err(SdkError(
            "PICO returned an unexpected download package".into(),
        ));
    }
    let version = package["version_code"].as_u64().filter(|value| *value > 0);
    let size = package["size"].as_u64().filter(|value| *value > 0);
    let md5 = package["md5"]
        .as_str()
        .filter(|value| value.len() == 32 && value.chars().all(|c| c.is_ascii_hexdigit()));
    let url = package["path"]
        .as_str()
        .filter(|value| value.starts_with("https://"));
    match (version, size, md5, url) {
        (Some(version_code), Some(size), Some(md5), Some(url)) => Ok(DownloadInfo {
            item_id: PICO_ITEM_ID.into(),
            package_name: PICO_PACKAGE.into(),
            version_code,
            version: text_or(package.get("version"), ""),
            size,
            md5: md5.to_ascii_lowercase(),
            url: url.into(),
        }),
        _ => Err(SdkError("PICO returned incomplete APK metadata".into())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Fixture {
        item_id: String,
        package_name: String,
        version_code: u64,
        apk_size: u64,
        md5: String,
        public_response: String,
        download_response: String,
    }

    #[test]
    fn shared_contract_fixture() {
        let fixture: Fixture =
            serde_json::from_str(include_str!("../../../contracts/v1/fixtures.json")).unwrap();
        let request = make_public_item_request_at(1);
        assert!(request.url.contains("device_name=A9210"));
        assert_eq!(
            serde_json::from_str::<Value>(&request.body).unwrap()["package_name"],
            fixture.package_name
        );
        let item = parse_public_item(&fixture.public_response).unwrap();
        let download = parse_download_info(&fixture.download_response).unwrap();
        assert_eq!(item.item_id, fixture.item_id);
        assert_eq!(item.version_code, fixture.version_code);
        assert_eq!(download.size, fixture.apk_size);
        assert_eq!(download.md5, fixture.md5);
        assert_eq!(
            mirror_decision(&item.price, download.size, &MirrorPolicy::default()).unwrap(),
            MirrorReason::Eligible
        );
    }

    #[test]
    fn rejects_wrong_package() {
        let wrong = r#"{"code":0,"data":{"item_id":7288745304105664518,"package_name":"bad","version_code":1}}"#;
        assert!(parse_public_item(wrong).is_err());
    }
}
