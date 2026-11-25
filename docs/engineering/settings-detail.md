# 设置页详情与README回退

宿主dsh-plugin-detail的localeDetail直接读取包内locale/<language>.json（例如locale/zh.json），不通过package.json exports解析。之前build开头删除物理locale文件，仅生成dist/locale，且files未纳入根locale；因而源码meta.detail虽然指向空plugin-detail.md，重建安装后宿主仍找不到声明，回退README.md。不是设置组件增加了介绍，也不是用户缓存操作造成。

构建同时生成两处一致JSON，模块导出继续指向dist/locale；详情读取物理locale。files显式包含locale/*.json及plugin-detail.md，物理生成物加入gitignore。局部host/client构建不再删除物理locale。npm中文readme元数据和仓库README独立保留。

验证从本机真实宿主app.asar只读提取dsh-plugin-detail模块，直接调用其localFiles/readPackageDocument：已安装旧包返回origin=readme、path=README.md、1218字符；修复后构建产物zh-CN和en均返回origin=locale、path=plugin-detail.md、空正文。未修改宿主文件。package-description自动回归覆盖两处语言文件一致及空详情声明，成品安装检查额外验证物理路径和详情文件。Windows/macOS共用同一包内相对路径；未进行Windows桌面验证。

验证结果：构建、717项自动测试、局部host构建后语言文件保留、同一tgz的macOS临时profile安装升级检查通过。本地desktop已安装独立路径成品，dist与物理locale哈希一致；真实宿主详情读取中英文均返回空plugin-detail.md。CLI不提供界面热加载成功回包，未宣称桌面页面已实测刷新。
