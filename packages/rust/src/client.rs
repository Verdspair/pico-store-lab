//! Complete store acquisition workflow on top of the public protocol API.

use crate::{
    DownloadInfo, PicoAuth, PublicItem, RequestSpec, SdkError, SearchResults, StoreTarget,
    make_account_request, make_download_info_request_for, make_public_item_request_for_now,
    make_search_request, parse_download_info_for, parse_public_item_for, parse_search_results,
};
use md5::{Digest, Md5};
use serde_json::Value;
use std::collections::BTreeMap;
use std::fs::{self, File, OpenOptions};
use std::io::Read;
use std::path::Path;
use std::thread;
use std::time::Duration;

pub struct StoreResponse {
    pub body: String,
    pub token: String,
    pub cookies: BTreeMap<String, String>,
}

pub trait Transport {
    fn post(&self, request: &RequestSpec, retries: usize) -> Result<StoreResponse, SdkError>;
}

#[derive(Default)]
pub struct HttpTransport;

impl Transport for HttpTransport {
    fn post(&self, request: &RequestSpec, retries: usize) -> Result<StoreResponse, SdkError> {
        if retries == 0 {
            return Err(SdkError("at least one request attempt required".into()));
        }
        let mut last_error = String::new();
        for attempt in 0..retries {
            let mut builder = ureq::post(&request.url);
            for (key, value) in &request.headers {
                builder = builder.header(key, value);
            }
            match builder.send(&request.body) {
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
                    let body = response
                        .body_mut()
                        .read_to_string()
                        .map_err(|error| SdkError(error.to_string()))?;
                    return Ok(StoreResponse {
                        body,
                        token,
                        cookies,
                    });
                }
                Err(error) => {
                    if let ureq::Error::StatusCode(status) = error
                        && status < 500
                        && status != 429
                    {
                        return Err(SdkError(format!("PICO HTTP {status}")));
                    }
                    last_error = error.to_string();
                }
            }
            if attempt + 1 < retries {
                thread::sleep(Duration::from_secs((attempt + 1).min(5) as u64));
            }
        }
        Err(SdkError(format!("PICO request failed: {last_error}")))
    }
}

pub struct PicoStoreClient<T: Transport = HttpTransport> {
    pub transport: T,
}

impl Default for PicoStoreClient<HttpTransport> {
    fn default() -> Self {
        Self {
            transport: HttpTransport,
        }
    }
}

impl<T: Transport> PicoStoreClient<T> {
    pub fn new(transport: T) -> Self {
        Self { transport }
    }

    pub fn search(&self, word: &str, next_id: u64) -> Result<SearchResults, SdkError> {
        let spec = make_search_request(word, next_id)?;
        parse_search_results(&self.transport.post(&spec, 3)?.body)
    }

    pub fn item(&self, target: &StoreTarget) -> Result<PublicItem, SdkError> {
        let spec = make_public_item_request_for_now(target);
        parse_public_item_for(&self.transport.post(&spec, 3)?.body, target)
    }

    pub fn send_code(&self, email: &str) -> Result<(), SdkError> {
        let spec = make_account_request("send-code", email, None)?;
        account_data(&self.transport.post(&spec, 1)?.body)?;
        Ok(())
    }

    pub fn login(&self, email: &str, code: &str) -> Result<PicoAuth, SdkError> {
        let spec = make_account_request("login", email, Some(code))?;
        let response = self.transport.post(&spec, 1)?;
        let data = account_data(&response.body)?;
        let uid = data["user_id_str"]
            .as_str()
            .map(str::to_string)
            .or_else(|| data["user_id"].as_u64().map(|id| id.to_string()))
            .unwrap_or_else(|| "0".into());
        let auth = PicoAuth {
            uid,
            x_tt_token: response.token,
            cookies: response.cookies,
        };
        if auth.x_tt_token.is_empty() && auth.cookies.is_empty() {
            return Err(SdkError("PICO login returned no usable session".into()));
        }
        Ok(auth)
    }

    pub fn download_info(
        &self,
        target: &StoreTarget,
        auth: &PicoAuth,
    ) -> Result<DownloadInfo, SdkError> {
        let spec = make_download_info_request_for(auth, target)?;
        parse_download_info_for(&self.transport.post(&spec, 3)?.body, target)
    }

    pub fn download(
        &self,
        target: &StoreTarget,
        auth: &PicoAuth,
        output: &Path,
    ) -> Result<(), SdkError> {
        download_verified_apk(&self.download_info(target, auth)?, output)
    }
}

fn account_data(body: &str) -> Result<Value, SdkError> {
    let root: Value = serde_json::from_str(body).map_err(|error| SdkError(error.to_string()))?;
    if root["message"] != "success" {
        return Err(SdkError("PICO account request rejected".into()));
    }
    Ok(root["data"].clone())
}

pub fn download_verified_apk(info: &DownloadInfo, output: &Path) -> Result<(), SdkError> {
    if !info.url.starts_with("https://")
        || output.extension().and_then(|x| x.to_str()) != Some("apk")
    {
        return Err(SdkError(
            "HTTPS APK URL and .apk output are required".into(),
        ));
    }
    if output.exists() {
        return Err(SdkError("output APK already exists".into()));
    }
    let temporary = output.with_extension("part.apk");
    let mut last_error = String::new();
    for attempt in 0..8 {
        let start = fs::metadata(&temporary).map(|meta| meta.len()).unwrap_or(0);
        let mut builder = ureq::get(&info.url);
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
                        return Err(SdkError("CDN refused a safe resume range".into()));
                    }
                }
                let mut file = OpenOptions::new()
                    .create(true)
                    .append(true)
                    .open(&temporary)
                    .map_err(|error| SdkError(error.to_string()))?;
                let mut reader = response.body_mut().as_reader();
                let mut buffer = [0u8; 65536];
                if let Err(error) = std::io::copy(&mut reader, &mut file) {
                    last_error = error.to_string();
                } else {
                    let mut digest = Md5::new();
                    let mut file =
                        File::open(&temporary).map_err(|error| SdkError(error.to_string()))?;
                    loop {
                        let count = file
                            .read(&mut buffer)
                            .map_err(|error| SdkError(error.to_string()))?;
                        if count == 0 {
                            break;
                        }
                        digest.update(&buffer[..count]);
                    }
                    if format!("{:x}", digest.finalize()) == info.md5 {
                        fs::hard_link(&temporary, output)
                            .map_err(|error| SdkError(error.to_string()))?;
                        fs::remove_file(temporary).map_err(|error| SdkError(error.to_string()))?;
                        return Ok(());
                    }
                    return Err(SdkError("APK digest mismatch".into()));
                }
            }
            Err(error) => last_error = error.to_string(),
        }
        if attempt < 7 {
            thread::sleep(Duration::from_secs((attempt + 1).min(5)));
        }
    }
    Err(SdkError(format!("APK download failed: {last_error}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    struct FixtureTransport;

    impl Transport for FixtureTransport {
        fn post(&self, request: &RequestSpec, retries: usize) -> Result<StoreResponse, SdkError> {
            assert!(retries > 0);
            let body = if request.url.contains("search/aggregation") {
                r#"{"code":0,"data":{"search_list":[{"items":[{"item_id":7288745304105664518,"package_name":"com.vrchat.android"}]}]}}"#.into()
            } else if request.url.contains("item/info") {
                serde_json::from_str::<Value>(include_str!("../../../contracts/v1/fixtures.json"))
                    .unwrap()["publicResponse"]
                    .as_str()
                    .unwrap()
                    .into()
            } else if request.url.contains("send_code") {
                r#"{"message":"success"}"#.into()
            } else if request.url.contains("code_login") {
                r#"{"message":"success","data":{"user_id_str":"123"}}"#.into()
            } else {
                serde_json::from_str::<Value>(include_str!("../../../contracts/v1/fixtures.json"))
                    .unwrap()["downloadResponse"]
                    .as_str()
                    .unwrap()
                    .into()
            };
            Ok(StoreResponse {
                body,
                token: "token".into(),
                cookies: BTreeMap::from([("sessionid".into(), "abc".into())]),
            })
        }
    }

    #[test]
    fn full_client_flow_uses_injected_transport() {
        let client = PicoStoreClient::new(FixtureTransport);
        let found = client.search("sample", 1).unwrap();
        let target =
            StoreTarget::new(&found.items[0].item_id, &found.items[0].package_name, "").unwrap();
        assert_eq!(client.item(&target).unwrap().version_code, 972240);
        client.send_code("test@example.com").unwrap();
        let auth = client.login("test@example.com", "123456").unwrap();
        assert_eq!(auth.cookies["sessionid"], "abc");
        assert_eq!(
            client.download_info(&target, &auth).unwrap().size,
            333887069
        );
    }
}
