# v4.0.4 发布核对

实际基线：v4.0.3。

MetaOnticVideo v4.0.4

优化
- 收紧插件设置布局，客服移至卸载左侧；API验证仅在共用密钥时显示，避免将模型清单403误判为生成权限异常；隐藏详情页README。

验证
- 本地构建及测试通过。
- 本条按仅 Gitee 发布处理：未运行 GitHub 双平台 CI，也没做 Windows 桌面实测，Windows 兼容性只有构建与打包层面的保证。
- 宣传页安装地址已同步为 v4.0.4（/Users/simon/Documents/my_python/MetaOnticVideoService/frontend/public/promo/index.html，属服务端仓库，需在那里提交并部署）。
- 桌面GUI与付费调用未由发布脚本自动验证。

指南核对：核对客服入口位置、共用API密钥时验证按钮位于小眼睛右侧、独立密钥不显示验证、模型清单403不代表生成权限失败、只读探测不产生生成费用；同步本地指南Markdown与PDF，保留配置和任务，不在指南加入版本日志。
