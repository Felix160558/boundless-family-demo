import { familyConfig } from './config.js';
import { createMeetingScene } from './meeting-scene.js?v=meeting-no-seat-1';
import { REPORT_PAGES, REPORT_TITLE } from './report.js?v=original-study-2';
import { createRoomClient } from './room-client.js?v=original-study-2';

const $ = id => document.getElementById(id);
const roles = ['teacher', 'parent', 'student'];
const roleNames = { teacher: 'Teacher', parent: 'Parent', student: 'Student' };
const roleLetters = { teacher: 'T', parent: 'P', student: 'S' };
const url = new URL(location.href);
const fragment = new URLSearchParams(url.hash.slice(1));
const role = roles.includes(url.searchParams.get('role')) ? url.searchParams.get('role') : 'teacher';
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
    role_taken: 'This role is already in the meeting. Use an invitation for another role.',
    room_full: 'All three seats are occupied.',
    room_not_found: 'This room is not open or has ended. Ask the teacher for a new invitation.',
    room_expired: 'This meeting has expired. Ask the teacher to create a new room.',
    invalid_ticket: 'This invitation is invalid or expired. Ask the teacher for a new link.',
    teacher_required: 'The teacher controls the shared report.',
    service_unavailable: 'Live service is not connected. Local preview only.',
    signaling_unconfigured: 'Live service is not connected. Local preview only.',
    microphone_denied: 'Microphone permission is off. Allow microphone access and try again.',
  };
  if (codes[error?.code]) return codes[error.code];
  if (error?.name === 'NotAllowedError') return 'Permission was not granted. Check microphone or VR permissions.';
  return error?.message || 'Could not complete this action. Please try again.';
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
    name.textContent = person.connected ? `${person.name || roleNames[person.role]}${person.isLocal ? ' · you' : ''}` : roleNames[person.role];
    const status = document.createElement('span');
    status.className = 'person-state';
    status.textContent = person.connected ? (!serviceReady ? 'Local' : person.micEnabled && !person.muted ? 'Mic on' : 'Joined') : 'Waiting';
    li.append(icon, name, status);
    list.append(li);
  });
  updateConnection();
}

function updateConnection() {
  document.body.dataset.connected = String(serviceReady && connection.phase === 'connected');
  let message;
  if (!serviceReady) message = 'Local preview · Live service not connected';
  else if (!entered && !entering) message = ticket ? 'Invitation received · Select Join room' : 'Live mode · Waiting to create a room';
  else if (connection.phase === 'connected') {
    const count = participants.filter(person => person.connected).length;
    message = `Room connected · ${count} / 3 present`;
  } else message = connection.message || ({ joining: 'Connecting to the room…', reconnecting: 'Connection interrupted. Reconnecting…', disconnected: 'Disconnected from the meeting', error: 'Could not connect to the meeting' }[connection.phase] || 'Preparing the meeting…');
  $('connection-status').textContent = message;
  $('microphone').disabled = !serviceReady || connection.phase !== 'connected';
  $('microphone-label').textContent = connection.micEnabled ? (connection.muted ? 'Unmute' : 'Mic on') : 'Enable mic';
  $('microphone').setAttribute('aria-pressed', String(connection.micEnabled && !connection.muted));
  $('resume-audio').hidden = !connection.audioBlocked;
  scene?.setMicState(connection.micEnabled && !connection.muted);
}

function renderReport(index) {
  page = Math.max(0, Math.min(REPORT_PAGES.length - 1, Number(index) || 0));
  const data = REPORT_PAGES[page];
  scene?.setReportPage(page);
  $('page-number').textContent = `${String(page + 1).padStart(2, '0')} / ${String(REPORT_PAGES.length).padStart(2, '0')}`;
  $('report-page-label').textContent = `Page ${page + 1} / ${REPORT_PAGES.length}`;
  $('previous-page').disabled = role !== 'teacher' || page === 0;
  $('next-page').disabled = role !== 'teacher' || page === REPORT_PAGES.length - 1;
  $('page-authority').textContent = role === 'teacher' ? (serviceReady ? 'Teacher controls shared pages' : 'Teacher view · Local pages') : 'Following the teacher';
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
  if (role !== 'teacher') { notify('The teacher controls the shared report.'); return; }
  const next = Math.max(0, Math.min(REPORT_PAGES.length - 1, page + delta));
  if (serviceReady) {
    if (connection.phase !== 'connected') { notify('Join the room to share page changes.'); return; }
    try { await client.setPage(next); } catch (error) { notify(explain(error)); }
  } else renderReport(next);
}

async function microphone() {
  if (!serviceReady || connection.phase !== 'connected') { notify('Local preview only. Connect the live service to enable voice.'); return; }
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
    onXRState({ active }) { document.body.dataset.xr = String(active); $('vr-label').textContent = active ? 'Exit VR' : 'Enter VR'; },
    onError(error) { notify(explain(error)); },
  });
} catch (error) {
  const notice = document.createElement('div');
  notice.className = 'scene-failure';
  const title = document.createElement('strong'); title.textContent = '3D view unavailable';
  const detail = document.createElement('p'); detail.textContent = 'You can still read the sample report. Use a WebGL browser to view the room.';
  notice.append(title, detail); $('meeting-scene').append(notice);
  $('enter-vr').disabled = true;
}

// Reservation and invitation links already identify the role. A participant
// enters directly with that role and its fixed seat; no seat chooser is shown.
function initializeRole() {
  document.body.dataset.role = role;
  scene?.setRole(role);
  $('display-name').placeholder = role === 'parent' ? 'e.g. Alex (parent)' : role === 'student' ? 'e.g. Alex' : 'e.g. Teacher Chen';
  $('enter-room').textContent = serviceReady ? (role === 'teacher' && !ticket ? 'Create room' : 'Join room') : 'Enter preview';
  $('entry-note').textContent = serviceReady ? 'Mic starts only when enabled · Fictional sample report' : 'Local preview · Live service not connected';
  renderReport(page);
}
initializeRole();
$('report-title').textContent = REPORT_TITLE;
$('room-code').textContent = roomId;
if (slot && Number.isFinite(Date.parse(slot))) {
  $('appointment-line').textContent = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(slot)) + ' · Shanghai time · Demo booking';
} else $('appointment-line').textContent = 'Three seats · One shared learning report';

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
          const created = await client.createRoom({ teacherId, slot, topic: 'Learning progress meeting · Demo' });
          invitations = created.invitations; roomId = created.roomId; ticket = invitations.teacher;
          saveHostCache(created, previousId);
        }
      }
      if (!ticket) throw Object.assign(new Error('Use the parent or student invitation created by the teacher inside the room.'), { code: 'invite_required' });
      await client.join({ roomId, role, ticket, name });
    } else {
      participants = [{ peerId: 'local-preview', role, name, connected: true, isLocal: true, micEnabled: false, muted: true }];
    }
    entered = true;
    $('arrival').hidden = true; $('session-info').hidden = false; $('meeting-dock').hidden = false;
    document.body.dataset.entered = 'true';
    markRoomURL(); updateParticipants(); renderReport(page);
    $('invite-people').hidden = serviceReady && (!invitations || role !== 'teacher');
    if (!serviceReady) $('invite-people').textContent = 'Share preview';
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
  $('invite-title').textContent = serviceReady ? 'Invite parent and student' : 'Share preview';
  $('invite-description').textContent = serviceReady ? 'Share the matching invitation with each participant. Two people can begin; the third can join later.' : 'Preview the room from different seats. Devices are not connected and do not share audio.';
  for (const invitedRole of ['parent', 'student']) {
    const row = document.createElement('section'); row.className = 'invite-row';
    const heading = document.createElement('h3'); heading.textContent = `${roleNames[invitedRole]}${serviceReady ? ' invitation' : ' preview'}`;
    const input = document.createElement('input'); input.type = 'url'; input.readOnly = true; input.className = 'text-input'; input.value = invitationURL(invitedRole); input.setAttribute('aria-label', `${roleNames[invitedRole]} link`);
    const actions = document.createElement('div'); actions.className = 'invite-actions';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Copy link';
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(input.value); $('copy-feedback').textContent = `${roleNames[invitedRole]} link copied.`; }
      catch { input.focus(); input.select(); $('copy-feedback').textContent = 'Link selected. Copy it manually.'; }
    });
    const open = document.createElement('a'); open.href = input.value; open.target = '_blank'; open.rel = 'noopener noreferrer'; open.textContent = 'Open view';
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
