# 包标识与 README 展示调整

实际 npm 包名改为 `dsh-metaontic-video`，锁文件根清单、浏览器模块加载、设置页挂载及导航、Cordis 预设模块引用同步调整。配置命名空间、组件 ID 和任务数据目录继续使用 `metaontic-video`，避免修改历史数据位置。

发布附件继续使用 `metaontic-video-X.Y.Z.tgz`；npm pack 后由跨平台 Node 脚本规范附件文件名，拒绝覆盖已有成品。本地正式包、测试包及两个平台流水线统一调用。安装检查从包内清单读取实际名称，同时适用于历史包。市场索引只接受包名匹配的标签；当前市场仍指向已经发布的旧包，不将历史标签冒充为新包名版本。

README 不展示版本更新条目；发布脚本只同步 README 安装链接，更新条目继续写入 CHANGELOG、releaseNotes 与发行版。既有公开标签及发行版不改写。

验证：构建通过、654 项自动测试通过、实际 Harness Schema 检查 11 个工具通过；本地 tgz 清单及预设模块引用检查通过。旧、新包名在相同 URL 的锁记录分别校验，保留合法旧记录。未安装到用户配置、未发布。

Windows/macOS：路径使用 node:path、文件规范化使用 Node rename；更新/打包脚本不新增 shell 平台依赖。本次未执行 Windows/macOS 双平台实际安装升级。包名变化属于新包身份；保留数据目录不等于验证了宿主旧包到新包的迁移。正式发布前必须验证旧包到新包的迁移、避免同时加载两份插件，并通过同一 tgz 双平台安装升级检查。

插件详情不展示仓库 README：中英文 locale 的 `meta.detail` 显式指向包内空白 `plugin-detail.md`，阻止宿主默认回退读取 README。保留仓库 README 与包内安装文档，不通过全局 CSS 隐藏宿主区域；该声明在 Windows/macOS 共用成品中一致。
