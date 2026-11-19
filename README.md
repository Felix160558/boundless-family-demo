# ISP 家庭会谈 · Boundless Family

面向老师、家长、学生的独立网站原型。基于 Boundless Classroom 的已有视觉与准备室进行开发，原项目继续保留。

## 当前版本

- 首页左侧“学习区”保留入口和功能说明。
- 右侧进入原来的三维准备室；墙上三幅老师画像可点击查看资料。
- 三位老师、预约时段、学习报告均明确标为虚构演示数据。
- 选择画像、查看老师、选择演示时段、保存本地预约、进入会谈室。
- 新会谈室保留三个固定席位，支持两人先开始、第三人随后加入。
- 简单人物、静态背景、单一共享报告；老师控制四页报告的翻页。
- 用户提供的 ISP PROGRAM / SUIS QP 图片原样用于准备室及会谈室，包括三维墙面标识。
- Quest/WebXR 入口和头显内的基础手柄按钮已编写。

## 两种运行方式

### GitHub Pages 前端

静态网站可以直接从仓库根目录发布，无构建步骤。入口是 `index.html`，资源和页面链接都采用相对路径，兼容 GitHub Pages 的仓库子路径。

当前 `family/config.js` 的 `signalingOrigin` 为空。因此静态发布提供明确标注的本机预览，不会伪造已在线的家长、学生，也不会开启麦克风或调用原项目的 AI 服务。

新仓库创建后，在它自己的 Settings → Pages 中选择 Deploy from a branch，选定发布分支与 `/(root)`。不要修改原仓库的 Pages 配置。发布成功后的实际网址以 GitHub 返回结果为准。

### 独立会谈服务

`server/server.mjs` 已包含真实的三角色房间管理、邀请凭证、语音信令、共享页码与恢复逻辑。使用 Node.js 内置模块，没有额外 npm 依赖。

```sh
node server/server.mjs
```

默认在 `http://127.0.0.1:8787` 同时提供前端和服务。本机服务会自动为前端提供自己的连接配置。

真实的跨设备使用仍需独立 HTTPS 部署、前端来源配置及合适的 STUN/TURN 配置。服务尚未对外部署，未开通付费服务。详情见 [会谈服务说明](server/README.md)。

## 测试状态

本轮仅执行必要的 JavaScript 语法及源文件链接/接口核对。

根据用户要求，浏览器体验、语音、跨网络与 Quest 真机测试留到后续。不能把代码实现状态写成“三台 Quest 已流畅运行”或“已完成真实多人会谈”。

## 原项目隔离

- 原仓库：`Felix160558/boundless-classroom`。
- 基线提交：`b9a793568caf2e45d3e11da1be6f9a58410d4434`。
- 新实现位于 `family/` 与 `server/`，首页已替换为独立家庭会谈入口。
- 原准备室模型、画像及第三方许可文件保留。
- 猫老师模型与原始纹理保留在副本中，但新首页和新会谈室不加载它们。
- 旧 AI 网关地址在此副本中置空；新预约与会话使用独立存储键。
- 本地保留 `family-meeting-poc` 工作分支，源仓库的推送地址已禁用。

原版本说明见 [原项目说明存档](SOURCE_PROJECT_README.md)。

## 主要源文件

| 位置 | 内容 |
| --- | --- |
| `index.html`、`family/home.*` | 独立首页与学习区说明 |
| `family/reservation.*`、`family/lounge-view.js` | 准备室、墙面画像与演示预约 |
| `family/demo-data.js` | 虚构老师、北京时间演示时段及隔离的本地预约 |
| `family/meeting.*` | 会谈入口、参与者、邀请与控制 |
| `family/meeting-scene.js` | 轻量三维空间与 WebXR |
| `family/report.js` | 四页示例报告与三维面板纹理 |
| `family/room-client.js` | 三人 WebRTC 语音、位姿与状态同步客户端 |
| `server/` | 独立会谈服务源码与配置说明 |

## 上游资料

- [GitHub Pages 发布来源配置](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Meta 网页体验托管说明](https://developers.meta.com/vr/documentation/web/web-hosting/)
- [Meta WebXR 刷新率控制](https://developers.meta.com/vr/documentation/web/webxr-frames/)

这些资料支持部署与开发方式；不构成本项目已经通过设备测试的证据。
