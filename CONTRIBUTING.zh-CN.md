# 参与贡献

[English](CONTRIBUTING.md)

感谢参与 PICO Store Lab。本项目独立于 PICO 和 VRChat。协议相关改动请附上可复核的依据，并明确区分已验证行为与推测。

提交前请保持一个 PR 对应一个逻辑改动；提交信息使用 Conventional Commits，例如 `feat(rust): ...`，分支使用 `feature/…`、`fix/…` 等对应类型。改变协议时同步更新 `contracts/v1/fixtures.json` 与各 SDK 测试。用户可见行为变化时同步维护中英文 README。

不要提交账号会话、验证码、签名 CDN 链接、APK、私钥或个人数据。测试应使用离线向量和模拟传输；协议或 UI 修改不应顺带公开镜像 APK。

代码审查重点：精确保留 64 位 ID，验证商品与包名；纯 SDK 不隐式访问网络或安装应用；重试与失败语义明确。Python 通过 PEP 风格和类型检查，TypeScript 使用严格编译，Rust 通过 fmt/Clippy，Kotlin 通过编译与单元测试。贡献代码按 [MIT](LICENSE) 授权，第三方应用和 APK 不受本代码许可证覆盖。
