# 发布流程

[English](RELEASING.md)

首个发布渠道是 GitHub。PyPI、npm、crates.io、Maven Central 的实际上传留待下一轮，届时再核验包名与各平台身份。

1. 同步更新四套 SDK 与 Android 的版本号、变更记录；保持中英文 README 示例不含产品版本号，并检查稳定的 Release 附件名称。
2. 等待 CI 全绿，或本地完成同等检查；构建 Python wheel/sdist、TS 包、Rust crate 检查、Kotlin AAR 和 Android APK。实机未验证的行为不能写成已完成。
3. 审查 Git 历史和打包内容，排除密钥、会话、APK、签名链接和大文件。
4. 应用远端 D1 迁移后用 Wrangler 部署 `apps/website`，核验 `https://pico.kanglives.top/`、`/api/catalog`、`/api/search` 和 `/api/releases`。公开接口只能包含元数据，不能含账号凭据或 APK 数据。若推迟部署，需要在发布说明中说明。
5. 为已验证提交打 `vX.Y.Z` 标签并创建 GitHub Release，仅附 SDK/构建产物和校验值。发布说明明确区分已验证结果、限制和延期的注册表发布。
6. 从 GitHub 核验公开仓库、标签、产物列表和校验值。发布失败时报告确切阶段，不声称成功。

MIT 只授权本项目代码，不授权再分发第三方 APK。
