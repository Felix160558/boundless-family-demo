# 独立会谈服务

此服务属于 **ISP Family Meeting 可行性原型**，与原 Boundless Classroom 的 AI 网关、数据及部署无关。使用 Node.js 内置模块，没有需要安装的 npm 依赖，也不会自动调用任何付费服务。

## 已实现的代码

- 一个房间最多包含老师、家长、学生各一人；两人也可先开始。
- 角色分别持有不同的随机邀请凭证；其他角色的响应不会包含老师凭证。
- 每位参与者有独立会话和音频连接；使用 WebRTC 三人 mesh。
- 麦克风由用户主动开启；只有声音和小型姿态数据经 WebRTC 传递，没有视频采集、录像或语音转写。
- 共享报告共四页，由老师翻页；新加入者读取当前页。
- 心跳、加入/离开事件、短暂中断后的重新加入、过期清理。
- 所有房间、参与者和信令只驻留服务进程内存。进程重启或会谈到期后清除。

**这些是实现状态，不能视为跨网络、浏览器、音频或 Quest 真机测试结果。用户已将此类测试安排到后续。**

## GitHub Pages 和服务的关系

GitHub Pages 部署的是静态前端，不能运行这个 Node 服务。

当 `family/config.js` 中的 `familyConfig.signalingOrigin` 为空时，网站只提供明确标注的本地预览；此时不会连接一个伪造的房间，也不会把占位人物显示为在线用户。

要启用真实跨设备会谈，需要将此服务部署在一个独立的 HTTPS 服务器上，再把 `familyConfig.signalingOrigin` 设置为该服务器的 **origin**，例如 `https://meeting-api.example.org`。示例地址仅说明格式，不是已部署服务。

服务端的 `ALLOWED_ORIGINS` 必须包含前端实际 origin。对于 GitHub Pages，origin 为 `https://用户名.github.io`，不含仓库路径。邀请凭证放在页面 URL 的 fragment 中（例如 `#invite=...`），不应放进查询参数、分析日志或公开说明文件。

## 本地启动

需要 Node.js 18 或更新版本，从项目根目录运行：

```sh
node server/server.mjs
```

默认仅监听 `127.0.0.1:8787`。服务会同时提供静态前端，并为 `/family/config.js` 返回指向本服务的配置，因此可直接访问 `http://127.0.0.1:8787`。

局域网 HTTP 地址不等同于 HTTPS 安全上下文。给 Quest 和远端设备使用时，应使用有效 HTTPS 部署；本说明不会要求绕过证书警告。

## 配置项

| 环境变量 | 默认值 | 作用 |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | 监听接口；托管环境按其要求设置 |
| `PORT` | `8787` | 监听端口 |
| `PUBLIC_ORIGIN` | 未设置 | 使用反向代理时填写外部 HTTPS origin |
| `ALLOWED_ORIGINS` | 空 | 允许调用 API 的额外前端 origin，逗号分隔 |
| `ROOM_TTL_MINUTES` | `90` | 房间存活分钟数，可设置 30–720 |
| `ICE_SERVERS_JSON` | `[]` | 由运营者配置的 STUN/TURN 服务列表 |

默认不连接第三方 STUN/TURN 服务。仅提供信令服务器不能保证不同家庭、学校及移动网络之间建立 WebRTC 连接。对外使用前需要配置适合使用环境的 STUN/TURN，并在实际网络验证。TURN 的使用权限和流量费用由对应服务决定，本原型不会自行开通。

`ICE_SERVERS_JSON` 使用标准 `RTCIceServer` 结构；生产环境宜使用限时 TURN 凭证。它们仅通过已加入房间的响应发送给浏览器，不能写入公开仓库或静态配置。原型尚未实现向某个 TURN 供应商申请短时凭证。

## 前端接口

```js
import {createRoomClient} from './room-client.js';
const client = createRoomClient({
  apiOrigin: familyConfig.signalingOrigin,
  onState(state) {},
  onParticipants(people) {},
  onPage(pageIndex) {},
  onPose({peerId, role, pose}) {},
  onError(error) {},
});
```

| 方法 | 结果 |
| --- | --- |
| `createRoom({teacherId, slot, topic})` | `{roomId, invitations:{teacher,parent,student}, expiresAt}` |
| `join({roomId, role, ticket, name})` | 实际房间快照；缺少凭证或同角色已占用时拒绝 |
| `enableMicrophone()` | 由明确用户动作调用；请求音频权限 |
| `setMuted(boolean)` | 调整已获授权麦克风的静音状态 |
| `setPage(index)` | 老师更新共享页码，索引范围 0–3 |
| `sendPose(pose)` | 约 12 次/秒以内发送小型姿态对象 |
| `resumeAudio()` | 由用户动作恢复被浏览器阻止的音频播放 |
| `leave()` / `dispose()` | 释放语音、连接和会话；`dispose` 还移除页面监听 |

`onState` 包含 `phase`、`message`、`micEnabled`、`muted`、`audioBlocked`。`phase` 为 `idle`、`joining`、`connected`、`reconnecting`、`disconnected`、`error` 之一。

`onParticipants` 只报告服务端实际成员，字段包含 `peerId`、`role`、`name`、`connected`、`micEnabled`、`muted`、`isLocal`、`connectionState`、`speaking`。服务端成员在线与两两媒体连接成功是不同状态，界面应分别表达。

## 服务端 API

所有写请求都使用 JSON。加入后的请求使用 `Authorization: Bearer <session token>`，不要把会话令牌放在 URL 中。

- `POST /api/rooms`：创建短期房间。
- `POST /api/join`：凭角色邀请加入；允许同浏览器使用旧会话凭证恢复。
- `GET /api/events?roomId=...&cursor=...`：读取有界事件增量。
- `POST /api/signal`：只向同房间的指定成员传递 SDP/ICE。
- `POST /api/page`：老师翻页。
- `POST /api/mic`：更新麦克风状态。
- `POST /api/leave`：退出。
- `GET /api/health`：无敏感信息的服务状态。

## 当前边界

这是短期演示服务，没有持久账号、真实师资身份审核、正式预约容量锁定或长期存储。创建房间不会通知真实老师。房间与会话都有容量、请求速率和过期限制；标准输出不记录邀请凭证、授权头、SDP 或请求 URL。正式给家庭使用前，仍需根据实际部署加入运营监测、持久身份和服务保障。
