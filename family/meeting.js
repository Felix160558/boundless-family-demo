import { familyConfig } from './config.js';
import { createMeetingScene } from './meeting-scene.js';
import { REPORT_PAGES, REPORT_TITLE } from './report.js';
import { createRoomClient } from './room-client.js';

const $ = id => document.getElementById(id);
const roles = ['teacher', 'parent', 'student'];
const roleNames = { teacher: '老师', parent: '家长', student: '学生' };
const roleLetters = { teacher: 'T', parent: 'P', student: 'S' };
const url = new URL(location.href);
const fragment = new URLSearchParams(url.hash.slice(1));
let role = roles.includes(url.searchParams.get('role')) ? url.searchParams.get('role') : 'teacher';
let ticket = fragment.get('invite') || '';
let roomId = /^[A-Za-z0-9_-]{6,64}$/.test(url.searchParams.get('room') || '') ? url.searchParams.get('room') : createDemoCode();
const teacherId = /^teacher-[123]$/.test(url.searchParams.get('teacher') || '') ? url.searchParams.get('teacher') : 'teacher-1';
const slot = url.searchParams.get('slot') || '';
const serviceReady = Boolean(familyConfig.signalingOrigin);
let entered = false, entering = false, leaving = false, page = 0;
let participants = [], invitations = null, scene = null, toastTimer;
let connection = { phase: 'idle', micEnabled: false, muted: true, audioBlocked: false };
const poses = new Map();
const hostCachePrefix = 'isp_family_meeting_host_v1:';

function createDemoCode() {
  const values = crypto.getRandomValues(new Uint8Array(8));
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(values, value => alphabet[value % alphabet.length]).join('');
}

function notify(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 5500);
}

function explain(error) {
  const codes = {
    role_taken: '这个身份已经在会谈中。请使用另一个身份的邀请链接。',
    room_full: '这个会谈室的三个席位已占用。',
    room_not_found: '会谈室尚未开放或已经结束，请向老师获取新的邀请。',
    room_expired: '这次会谈已经到期，请老师重新建立会谈室。',
    invalid_ticket: '邀请链接无效或已到期，请向老师获取新链接。',
    teacher_required: '共享报告由老师控制翻页。',
    service_unavailable: '联机服务尚未配置，当前只能在本机预览。',
    signaling_unconfigured: '联机服务尚未配置，当前只能在本机预览。',
    microphone_denied: '麦克风权限未开启。允许此网站使用麦克风后再试。',
  };
  if (codes[error?.code]) return codes[error.code];
  if (error?.name === 'NotAllowedError') return '操作没有获得设备许可。请检查浏览器的麦克风或 VR 权限。';
  return error?.message || '暂时没有完成，请稍后再试。';
}

function readHostCache(id) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(hostCachePrefix + id) || 'null');
    if (saved?.invitations?.teacher && saved.roomId && Number(new Date(saved.expiresAt)) > Date.now()) return saved;
  } catch {}
  return null;
}

function saveHostCache(data, previousId) {
  try {
    sessionStorage.setItem(hostCachePrefix + data.roomId, JSON.stringify(data));
    if (previousId !== data.roomId) sessionStorage.setItem(hostCachePrefix + previousId, JSON.stringify(data));
  } catch {}
}

function markRoomURL() {
  const current = new URL(location.href);
  current.searchParams.set('room', roomId);
  current.searchParams.set('role', role);
  current.searchParams.set('teacher', teacherId);
  current.hash = ticket ? new URLSearchParams({ invite: ticket }).toString() : '';
  history.replaceState(null, '', current);
  $('room-code').textContent = roomId;
}

function updateParticipants() {
  const visual = roles.map(itemRole => {
    const person = participants.find(person => person.role === itemRole);
    return person ? { ...person, pose: poses.get(itemRole) } : {
      role: itemRole, name: roleNames[itemRole], connected: false, micEnabled: false, speaking: false,
    };
  });
  scene?.setParticipants(visual);
  const list = $('participants');
  list.replaceChildren();
  visual.forEach(person => {
    const li = document.createElement('li');
    li.className = person.connected ? 'is-here' : 'waiting';
    const icon = document.createElement('i');
    icon.className = `role-symbol ${person.role}`;
    icon.textContent = roleLetters[person.role];
    icon.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.className = 'person-name';
    name.textContent = person.connected ? `${person.name || roleNames[person.role]}${person.isLocal ? ' · 你' : ''}` : roleNames[person.role];
    const status = document.createElement('span');
    status.className = 'person-state';
    status.textContent = person.connected ? (!serviceReady ? '本机' : person.micEnabled && !person.muted ? '麦克风开' : '已进入') : '等待进入';
    li.append(icon, name, status);
    list.append(li);
  });
  updateConnection();
}

function updateConnection() {
  document.body.dataset.connected = String(serviceReady && connection.phase === 'connected');
  let message;
  if (!serviceReady) message = '本机预览 · 跨设备会谈待连接服务';
  else if (!entered && !entering) message = ticket ? '已收到邀请 · 选择进入会谈' : '联机模式 · 等待建立会谈';
  else if (connection.phase === 'connected') {
    const count = participants.filter(person => person.connected).length;
    message = `房间已连接 · ${count} / 3 人在场`;
  } else message = connection.message || ({ joining: '正在连接会谈室…', reconnecting: '连接中断，正在尝试恢复…', disconnected: '会谈连接已断开', error: '会谈连接未成功' }[connection.phase] || '正在准备会谈…');
  $('connection-status').textContent = message;
  $('microphone').disabled = !serviceReady || connection.phase !== 'connected';
  $('microphone-label').textContent = connection.micEnabled ? (connection.muted ? '取消静音' : '麦克风已开') : '开启麦克风';
  $('microphone').setAttribute('aria-pressed', String(connection.micEnabled && !connection.muted));
  $('resume-audio').hidden = !connection.audioBlocked;
  scene?.setMicState(connection.micEnabled && !connection.muted);
}

function renderReport(index) {
  page = Math.max(0, Math.min(REPORT_PAGES.length - 1, Number(index) || 0));
  const data = REPORT_PAGES[page];
  scene?.setReportPage(page);
  $('page-number').textContent = `${String(page + 1).padStart(2, '0')} / ${String(REPORT_PAGES.length).padStart(2, '0')}`;
  $('report-page-label').textContent = `第 ${page + 1} / ${REPORT_PAGES.length} 页`;
  $('previous-page').disabled = role !== 'teacher' || page === 0;
  $('next-page').disabled = role !== 'teacher' || page === REPORT_PAGES.length - 1;
  $('page-authority').textContent = role === 'teacher' ? (serviceReady ? '老师翻页，所有人同步' : '老师视角 · 本机翻页') : '跟随老师翻页';
  const article = $('report-content');
  article.replaceChildren();
  const title = document.createElement('h3');
  title.textContent = data.title;
  const subtitle = document.createElement('p');
  subtitle.className = 'report-subtitle';
  subtitle.textContent = data.subtitle || '';
  article.append(title, subtitle);
  for (const entry of data.sections || []) {
    const section = document.createElement('section');
    const heading = document.createElement('h4');
    heading.textContent = entry.title;
    section.append(heading);
    if (entry.body) {
      const body = document.createElement('p');
      body.textContent = entry.body;
      section.append(body);
    }
    if (entry.items) {
      const ul = document.createElement('ul');
      for (const item of entry.items) { const li = document.createElement('li'); li.textContent = item; ul.append(li); }
      section.append(ul);
    }
    article.append(section);
  }
}

async function changePage(delta) {
  if (role !== 'teacher') { notify('共享报告由老师控制翻页。'); return; }
  const next = Math.max(0, Math.min(REPORT_PAGES.length - 1, page + delta));
  if (serviceReady) {
    if (connection.phase !== 'connected') { notify('连接会谈室后，老师可以同步翻页。'); return; }
    try { await client.setPage(next); } catch (error) { notify(explain(error)); }
  } else renderReport(next);
}

async function microphone() {
  if (!serviceReady || connection.phase !== 'connected') { notify('当前为本机预览。联机服务连接后可以开启三方语音。'); return; }
  try {
    if (!connection.micEnabled) await client.enableMicrophone();
    else await client.setMuted(!connection.muted);
  } catch (error) { notify(explain(error)); }
}

async function onSceneAction(action) {
  if (action === 'previous') await changePage(-1);
  else if (action === 'next') await changePage(1);
  else if (action === 'microphone') await microphone();
  else if (action === 'exit') { try { await scene?.exitVR(); } catch {} }
}

const client = createRoomClient({
  apiOrigin: familyConfig.signalingOrigin,
  onState(value) { connection = { ...connection, ...value }; updateConnection(); },
  onParticipants(value) { participants = value; updateParticipants(); },
  onPage(index) { renderReport(index); },
  onPose({ role: peerRole, pose }) { if (peerRole !== role) { poses.set(peerRole, pose); updateScenePoses(); } },
  onError(error) { notify(explain(error)); },
});

function updateScenePoses() {
  scene?.setParticipants(roles.map(itemRole => {
    const person = participants.find(person => person.role === itemRole);
    return { role: itemRole, name: roleNames[itemRole], connected: false, ...person, pose: poses.get(itemRole) };
  }));
}

try {
  scene = createMeetingScene($('meeting-scene'), {
    role,
    onAction: onSceneAction,
    onPose(pose) { if (entered && serviceReady && connection.phase === 'connected') client.sendPose(pose); },
    onXRState({ active }) { document.body.dataset.xr = String(active); $('vr-label').textContent = active ? '退出 VR' : '进入 VR'; },
    onError(error) { notify(explain(error)); },
  });
} catch (error) {
  const notice = document.createElement('div');
  notice.className = 'scene-failure';
  const title = document.createElement('strong'); title.textContent = '三维场景暂时无法显示';
  const detail = document.createElement('p'); detail.textContent = '仍可以查看示例报告；请使用支持 WebGL 的浏览器再打开空间。';
  notice.append(title, detail); $('meeting-scene').append(notice);
  $('enter-vr').disabled = true;
}

function chooseRole(value) {
  if (!roles.includes(value) || entered) return;
  role = value;
  document.body.dataset.role = role;
  const input = document.querySelector(`input[name="role"][value="${role}"]`);
  input.checked = true;
  scene?.setRole(role);
  $('display-name').placeholder = role === 'parent' ? '例如：林同学家长' : role === 'student' ? '例如：林同学' : '例如：陈老师';
  $('enter-room').textContent = serviceReady ? (role === 'teacher' && !ticket ? '建立会谈室' : '加入会谈室') : '进入空间预览';
  $('entry-note').textContent = serviceReady ? '麦克风由你手动开启 · 学习报告为虚构示例' : '本机空间预览 · 尚未连接跨设备会谈服务';
  renderReport(page);
}

document.querySelectorAll('input[name="role"]').forEach(input => {
  input.addEventListener('change', () => chooseRole(input.value));
  if (ticket && input.value !== role) input.disabled = true;
});
chooseRole(role);
$('report-title').textContent = REPORT_TITLE;
$('room-code').textContent = roomId;
if (slot && Number.isFinite(Date.parse(slot))) {
  $('appointment-line').textContent = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(slot)) + ' · 上海时间 · 演示预约';
} else $('appointment-line').textContent = '三个席位 · 一份共同的学习报告';

async function enterRoom() {
  if (entered || entering) return;
  entering = true; $('entry-error').hidden = true; $('enter-room').disabled = true;
  try {
    const name = $('display-name').value.trim().slice(0, 24) || roleNames[role];
    if (serviceReady) {
      if (role === 'teacher') {
        const cached = readHostCache(roomId);
        if (cached) { invitations = cached.invitations; roomId = cached.roomId; ticket = cached.invitations.teacher; }
        if (!ticket) {
          const previousId = roomId;
          const created = await client.createRoom({ teacherId, slot, topic: '家庭学习进展会谈 · 演示' });
          invitations = created.invitations; roomId = created.roomId; ticket = invitations.teacher;
          saveHostCache(created, previousId);
        }
      }
      if (!ticket) throw Object.assign(new Error('请使用老师在会谈室内生成的家长或学生邀请链接。'), { code: 'invite_required' });
      await client.join({ roomId, role, ticket, name });
    } else {
      participants = [{ peerId: 'local-preview', role, name, connected: true, isLocal: true, micEnabled: false, muted: true }];
    }
    entered = true;
    $('arrival').hidden = true; $('session-info').hidden = false; $('meeting-dock').hidden = false;
    document.body.dataset.entered = 'true';
    markRoomURL(); updateParticipants(); renderReport(page);
    $('invite-people').hidden = serviceReady && (!invitations || role !== 'teacher');
    if (!serviceReady) $('invite-people').textContent = '分享预览';
  } catch (error) {
    $('entry-error').textContent = explain(error); $('entry-error').hidden = false;
  } finally { entering = false; $('enter-room').disabled = false; updateConnection(); }
}
$('enter-room').addEventListener('click', enterRoom);
$('previous-page').addEventListener('click', () => void changePage(-1));
$('next-page').addEventListener('click', () => void changePage(1));
$('microphone').addEventListener('click', () => void microphone());
$('resume-audio').addEventListener('click', () => { void client.resumeAudio().catch(error => notify(explain(error))); });
$('open-report').addEventListener('click', () => $('report-dialog').showModal());
$('close-report').addEventListener('click', () => $('report-dialog').close());
$('close-invite').addEventListener('click', () => $('invite-dialog').close());

function invitationURL(invitedRole) {
  const link = new URL('./meeting.html', location.href);
  link.searchParams.set('room', roomId); link.searchParams.set('role', invitedRole); link.searchParams.set('teacher', teacherId);
  if (slot) link.searchParams.set('slot', slot);
  if (serviceReady && invitations?.[invitedRole]) link.hash = new URLSearchParams({ invite: invitations[invitedRole] }).toString();
  return link.href;
}

$('invite-people').addEventListener('click', () => {
  const target = $('invite-links'); target.replaceChildren(); $('copy-feedback').textContent = '';
  $('invite-title').textContent = serviceReady ? '邀请家长与学生' : '分享空间预览';
  $('invite-description').textContent = serviceReady ? '每个身份有独立的邀请链接。把对应链接交给参与者；两个人到场即可开始，第三人可随后加入。' : '这些链接展示同一个房间设计的不同座位视角。目前各设备独立预览，不会互相连接或同步声音。';
  for (const invitedRole of ['parent', 'student']) {
    const row = document.createElement('section'); row.className = 'invite-row';
    const heading = document.createElement('h3'); heading.textContent = `${roleNames[invitedRole]}${serviceReady ? '邀请' : '视角预览'}`;
    const input = document.createElement('input'); input.type = 'url'; input.readOnly = true; input.className = 'text-input'; input.value = invitationURL(invitedRole); input.setAttribute('aria-label', `${roleNames[invitedRole]}链接`);
    const actions = document.createElement('div'); actions.className = 'invite-actions';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = '复制链接';
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(input.value); $('copy-feedback').textContent = `${roleNames[invitedRole]}链接已复制。`; }
      catch { input.focus(); input.select(); $('copy-feedback').textContent = '链接已选中，请手动复制。'; }
    });
    const open = document.createElement('a'); open.href = input.value; open.target = '_blank'; open.rel = 'noopener noreferrer'; open.textContent = '打开此视角';
    actions.append(button, open); row.append(heading, input, actions); target.append(row);
  }
  $('invite-dialog').showModal();
});

$('enter-vr').addEventListener('click', async () => {
  if (!scene) return;
  $('enter-vr').disabled = true;
  try {
    if (document.body.dataset.xr === 'true') await scene.exitVR();
    else await scene.enterVR();
  } catch (error) { notify(explain(error)); }
  finally { $('enter-vr').disabled = false; }
});

async function leaveRoom(event) {
  event?.preventDefault();
  if (leaving) return;
  leaving = true;
  try { await scene?.exitVR(); } catch {}
  try { await client.leave(); } catch {}
  scene?.dispose();
  location.assign(new URL('./reservation.html', location.href).href);
}
$('leave-room').addEventListener('click', leaveRoom);
$('back-to-lounge').addEventListener('click', leaveRoom);
window.addEventListener('resize', () => scene?.resize());
window.addEventListener('pagehide', () => { void client.leave(); scene?.dispose(); });
for (const id of ['report-dialog', 'invite-dialog']) $(id).addEventListener('click', event => {
  if (event.target !== $(id)) return;
  const bounds = $(id).getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) $(id).close();
});
updateParticipants(); renderReport(0); updateConnection();
