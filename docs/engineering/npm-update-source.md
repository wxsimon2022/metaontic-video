# 在线更新来源统一与宿主契约

设置页与侧边栏共用createUpdateActions。已安装npm包必须调用pluginManager.updateBundle(name,version,{requestId})，不能调用新增installBundle；当前宿主带HMR时，installBundle会拒绝所有已存在的包名，不区分是否有新版本。

原生升级结果结构为RemoteResult.value.result，含from/to、step以及可能的restore；仅完成install阶段且结果成功才能进入运行版本核验。失败恢复由宿主管理，客户端不直接卸载或改变包管理策略。通信异常不重放请求。目标已安装或already-installed竞态时重新读取版本，并验证运行构建，不能仅凭错误码报告成功。

固定版本仍记录为dsh-metaontic-video@X.Y.Z，由宿主选择镜像。宿主不支持将tgz或历史链接来源直接按npm升级，界面给出一次性迁移指引；目录链接保留原阻止直接替换规则。开发成品仍记录真实来源，不能伪装为正式npm包。

Windows与macOS使用相同宿主API，没有新增路径或外部命令。回归覆盖原生返回结构、准确版本/阶段、已装目标、竞态、旧来源、通信不明、失败恢复与不直接卸载。模拟检查不等同实际桌面升级；发版须通过双平台成品安装CI。
