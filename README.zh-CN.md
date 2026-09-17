![PICO Store Lab 横幅](assets/brand/banner.svg)

# PICO Store Lab

[![CI](https://github.com/nkanf-dev/pico-store-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/nkanf-dev/pico-store-lab/actions/workflows/ci.yml)
[![MIT 许可证](https://img.shields.io/badge/license-MIT-b13a22.svg)](LICENSE)
[![发布版本](https://img.shields.io/github/v/release/nkanf-dev/pico-store-lab?include_prereleases&color=b13a22)](https://github.com/nkanf-dev/pico-store-lab/releases)

[English](README.md) · [参与贡献](CONTRIBUTING.zh-CN.md) · [安全报告](SECURITY.md) · [发布流程](RELEASING.zh-CN.md)

面向开发者的独立 PICO 发布追踪与 SDK 工具集。首个支持的商品是 **PICO 原生 VRChat**（`com.vrchat.android`），并非 Google Play 手机版。本项目与 PICO、VRChat 官方均无隶属关系。

在线发布页：**[pico.kanglives.top](https://pico.kanglives.top)**。公开网页只追踪版本元数据；账号登录和 APK 安装留在个人客户端。

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

Android 调试 APK 位于 `apps/android/app/build/outputs/apk/debug/app-debug.apk`。安装第三方包始终需要 Android 系统确认；PICO 账号会话仅保存在原生进程内存中，退出即失效。待设备重新连通后再进行头显实机验收。

## SDK 示例

```ts
import { makePublicItemRequest } from '@nkanf-dev/pico-store-sdk';
const request = makePublicItemRequest();
console.log(request.url);
```

```python
from pico_store_lab import make_public_item_request
print(make_public_item_request().url)
```

```rust
use pico_store_lab::make_public_item_request;
let request = make_public_item_request();
println!("{}", request.url);
```

```kotlin
val request = PicoProtocol.publicItemRequest()
println(request.url)
```

这轮只在 GitHub 发布源码与构建产物；PyPI、npm、crates.io、Maven Central 留待后续注册表发布，不会冒称已经上架。

## 账号、APK 与镜像边界

Rust 和 Python CLI 支持公开状态、邮箱验证码登录，以及指定路径的校验下载。账号文件请勿共享。旧版 JS CLI 还提供由用户指定目录的本地镜像同步，默认选择免费且小于 512 MiB 的 APK。Cloudflare 发布页每天检查公开版本元数据；不托管 APK 或账号会话，亦未配置 R2。MIT 许可证只覆盖**本项目代码**，不授予第三方 APK 的再分发权。

安全问题请参考 [SECURITY.md](SECURITY.md) 私下报告；开发与发布规范见[参与贡献](CONTRIBUTING.zh-CN.md)和[发布流程](RELEASING.zh-CN.md)。
