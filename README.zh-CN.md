![PICO Store Lab 横幅](assets/brand/banner.svg)

# PICO Store Lab

[![CI](https://github.com/nkanf-dev/pico-store-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/nkanf-dev/pico-store-lab/actions/workflows/ci.yml)
[![MIT 许可证](https://img.shields.io/badge/license-MIT-b13a22.svg)](LICENSE)
[![发布版本](https://img.shields.io/github/v/release/nkanf-dev/pico-store-lab?include_prereleases&color=b13a22)](https://github.com/nkanf-dev/pico-store-lab/releases)

[English](README.md) · [参与贡献](CONTRIBUTING.zh-CN.md) · [安全报告](SECURITY.md) · [发布流程](RELEASING.zh-CN.md)

独立的 PICO 应用目录与头显端安装客户端，同时为开发者提供可复用的 SDK。你可以浏览推荐、搜索 PICO 应用、查看版本，并用自己的 PICO 账号获取应用。本项目是独立社区项目。

在线浏览：**[pico.kanglives.top](https://pico.kanglives.top)**。公开网页提供应用发现与版本信息；账号登录和 APK 安装在个人客户端进行。

<a id="player-guide"></a>
## 玩家指南：用自己的账号下载

你需要一个能够从对应地区 PICO 官方商店获取所选应用的账号。可先在网页浏览或搜索，再通过头显客户端或本机 CLI 登录与下载。公开网页不收取邮箱或验证码。

### 方案 A：在头显上完成下载与安装

1. 从 [GitHub 最新 Release](https://github.com/nkanf-dev/pico-store-lab/releases/latest) 下载 `pico-store-android.apk`。头显打开 USB 调试并连接电脑后：

   ```sh
   adb devices                         # 在头显中同意 USB 调试授权
   adb install -r pico-store-android.apk
   ```

   如果你的 PICO 系统提供 APK 安装器，也可以在头显里打开下载好的文件；这条路径目前尚未实机验证。此 APK 为实验性调试签名版本，无法保证覆盖其他签名的安装版本。
2. 在头显应用库的**未知来源**或类似的非商店应用区域，打开 **PICO Store Lab**（入口名称因 PICO OS 版本而异）。浏览推荐或搜索应用，选择后查看官方版本；常用应用可以收藏。
3. 输入自己的 PICO 账号邮箱，点击**发送验证码**，填写邮件中的验证码，再点击**登录 PICO 账户**。不要在公开网页输入验证码。
4. 点击**下载并安装**。客户端用你的账号向 PICO 请求所选应用，核对 MD5、包名和版本。如果 Android 跳到“允许此来源安装应用”设置，允许 **PICO Store Lab**，返回后**再点一次下载并安装**；最后确认系统安装提示。完成后从头显应用库打开所选应用。

若官方接口提示所在地区无商品或拒绝下载，请检查对应官方商品页及账号的可获取资格。本客户端不能替账号增加资格或修改地区。头显端的实际运行和应用库入口**仍待连接设备验证**。

### 方案 B：在 macOS 用 Rust Desktop CLI 下载

从[同一个 Release](https://github.com/nkanf-dev/pico-store-lab/releases/latest)下载 `pico-store-desktop-macos-arm64`。先按名称搜索，再把结果中的精确 `itemId` 和 `packageName` 填入 `status` 和 `download`。下面以 YouTube VR 为例；选择其他应用时替换商品字段，邮箱也换成你自己的。`login` 会交互式询问邮件验证码。

```sh
chmod +x ./pico-store-desktop-macos-arm64
./pico-store-desktop-macos-arm64 search 'YouTube VR'
./pico-store-desktop-macos-arm64 status --item-id 7270207384512020485 --package com.google.android.apps.youtube.vr.pico
./pico-store-desktop-macos-arm64 send-code --email you@example.com
./pico-store-desktop-macos-arm64 login --email you@example.com --auth-file ./pico-auth.json
./pico-store-desktop-macos-arm64 download --item-id 7270207384512020485 --package com.google.android.apps.youtube.vr.pico --auth-file ./pico-auth.json --output ./selected-app.apk
adb install -r ./selected-app.apk          # 可选：头显已连接且允许 USB 调试
```

输出必须是尚不存在的 `.apk` 路径；CLI 校验官方 MD5 后才放到该路径。不要把 `pico-auth.json`、APK 或带签名的 CDN 链接上传到 Issue。若 macOS 阻止运行未签名 CLI，审查源码后可用 `cargo run -p pico-store-desktop -- ...` 自行编译运行。

### 方案 C：Python CLI

安装 Python 3.11+，在虚拟环境中从本仓库安装 Python 包。先用 `search` 找精确商品字段，再走同样的账号流程。输出路径请选择新的 `.apk` 文件，并确认磁盘空间足够。

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install 'git+https://github.com/nkanf-dev/pico-store-lab.git#subdirectory=packages/python'
pico-store-py search 'YouTube VR'
pico-store-py status --item-id 7270207384512020485 --package com.google.android.apps.youtube.vr.pico
pico-store-py send-code --email you@example.com
pico-store-py login --email you@example.com --auth-file ./pico-auth.json
pico-store-py download --item-id 7270207384512020485 --package com.google.android.apps.youtube.vr.pico --auth-file ./pico-auth.json --output ./selected-app.apk
```

桌面 CLI 会把包下载到电脑；再用 ADB 或头显支持的安装器安装。Android 头显客户端则在设备上完成下载，并请求系统确认安装。

## 仓库组成

| 组件 | 语言 | 用途 | 本版验证状态 |
| --- | --- | --- | --- |
| `packages/ts` | TypeScript | 商店请求、精确 ID 解析、镜像与发布策略 | 严格编译、契约测试 |
| `packages/python` | Python | 带类型的协议、镜像策略和小型 CLI | Ruff PEP 检查、测试、wheel/sdist |
| `packages/rust` | Rust | 带类型的协议与镜像策略 | fmt、Clippy、测试 |
| `packages/kotlin` | Kotlin | 适配 Android 的协议与镜像策略 | JVM 单测、AAR 构建 |
| `apps/website` | TS SDK + Cloudflare Worker | 双语发布页、只增不退的版本追踪 | 本地与模拟测试；已部署 Cloudflare |
| `apps/desktop-rs` | Rust SDK | 桌面命令行登录与校验下载 | 编译与测试通过；暂无 GUI |
| `apps/android` | Kotlin SDK | PICO 端查询、登录、系统确认安装 | APK 构建通过；**尚未实机验证** |
| `apps/desktop` | 旧版 JavaScript | 已有原型和本地镜像同步 | 暂留作迁移参考 |

四套 SDK 共用一份[契约向量](contracts/v1/fixtures.json)做行为校验。SDK 负责构造和验证官方接口，不会暗中登录、安装或公开发布 APK。PICO 商品 ID 超出 JavaScript 安全整数范围，因此始终按精确十进制值处理。版本追踪遵循“高版本优先”、历史去重；上游失败时保留最近一次成功快照。

## 快速开始

这是单一 monorepo；只需运行你关注的语言部分：

```sh
# TypeScript SDK 与网站测试：Node.js 25+
npm ci
npm test
node apps/website/src/dev.js                 # http://127.0.0.1:8787

# Python SDK：Python 3.11+
PYTHONPATH=packages/python/src python3 -m unittest discover -s packages/python/tests
PYTHONPATH=packages/python/src python3 -m pico_store_lab --help

# Rust SDK 与桌面 CLI：Rust 1.85+
cargo test --workspace
cargo run -p pico-store-desktop -- --help

# Kotlin SDK 与 PICO Android 客户端：Java 17、Android SDK 35
cd apps/android
./gradlew testDebugUnitTest assembleDebug
```

Android 调试 APK 位于 `apps/android/app/build/outputs/apk/debug/app-debug.apk`。安装第三方包始终需要 Android 系统确认；待设备重新连通后再进行头显实机验收。

## 开发者 SDK 片段

下面展示如何从应用名称开始。SDK 构造和验证请求，HTTP 传输与账号交互由接入方提供；完整登录与下载流程可参考上面的 CLI 或头显客户端。

```ts
import { makeSearchRequest, parseOfficialJson, parseSearchResults } from '@nkanf-dev/pico-store-sdk';
const request = makeSearchRequest('YouTube VR');
const results = parseSearchResults(parseOfficialJson(await (await fetch(request.url, request)).text()));
console.log(results.items[0]); // 所选应用的精确 itemId 和 packageName
```

```python
from pico_store_lab import make_search_request
print(make_search_request("YouTube VR").url)
```

```rust
use pico_store_lab::make_search_request;
let request = make_search_request("YouTube VR", 1).unwrap();
println!("{}", request.url);
```

```kotlin
val request = PicoProtocol.searchRequest("YouTube VR")
val items = PicoProtocol.parseSearchResults(responseText)
println(request.url)
```

这轮只在 GitHub 发布源码与构建产物；PyPI、npm、crates.io、Maven Central 留待后续注册表发布，不会冒称已经上架。

## 账号、APK 与镜像边界

Rust 和 Python CLI 支持公开状态、邮箱验证码登录，以及指定路径的校验下载。账号文件请勿共享。旧版 JS CLI 还提供由用户指定目录的本地镜像同步，默认选择免费且小于 512 MiB 的 APK。Cloudflare 发布页每天检查公开版本元数据；不托管 APK 或账号会话，亦未配置 R2。MIT 许可证只覆盖**本项目代码**，不授予第三方 APK 的再分发权。

安全问题请参考 [SECURITY.md](SECURITY.md) 私下报告；开发与发布规范见[参与贡献](CONTRIBUTING.zh-CN.md)和[发布流程](RELEASING.zh-CN.md)。
