import { TEACHERS, getTeacher, ROLE_NAMES, upcomingSlots, formatSlot, makeRoomCode, readAppointments, saveAppointment, meetingURL } from './demo-data.js';

const $ = id => document.getElementById(id);
const teacherDialog = $('teacher-dialog');
let selectedTeacher = TEACHERS[0], currentAppointment = null, lounge = null, highlightTimer;

for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => $(button.dataset.close).close());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom) dialog.close();
});

function openTeacher(id) {
  selectedTeacher = getTeacher(id);
  $('teacher-name').textContent = selectedTeacher.name;
  $('teacher-english').textContent = selectedTeacher.english;
  $('teacher-specialty').textContent = selectedTeacher.specialty;
  $('teacher-description').textContent = selectedTeacher.description;
  $('teacher-art').style.backgroundPosition = `${selectedTeacher.portrait*50}% center`;
  $('teacher-art').setAttribute('aria-label',`${selectedTeacher.name}的虚构演示画像`);
  $('teacher-focus').replaceChildren(...selectedTeacher.focus.map(text => { const li=document.createElement('li'); li.textContent=text; return li; }));
  $('slot-options').replaceChildren(...upcomingSlots(id).map((slot,index) => {
    const label=document.createElement('label'); label.className='slot-option';
    const input=document.createElement('input'); input.type='radio'; input.name='slot'; input.value=slot.iso; input.required=true; input.checked=index===0;
    const span=document.createElement('span'); span.textContent=slot.day;
    const small=document.createElement('small'); small.textContent=slot.time; span.append(small);
    label.append(input,span); return label;
  }));
  $('booking-feedback').textContent='';
  if (!teacherDialog.open) teacherDialog.showModal();
}

for (const button of document.querySelectorAll('[data-teacher]')) button.addEventListener('click', () => openTeacher(button.dataset.teacher));
$('choose-portrait').addEventListener('click', () => {
  lounge?.center(); $('portrait-gallery').classList.add('highlight');
  clearTimeout(highlightTimer); highlightTimer=setTimeout(()=>$('portrait-gallery').classList.remove('highlight'),4000);
  const first=[...document.querySelectorAll('[data-teacher]')].find(button=>!button.hidden);
  first?.focus({preventScroll:true});
});
$('center-view').addEventListener('click',()=>lounge?.center());
$('open-join').addEventListener('click',()=>{ $('join-dialog').showModal(); $('join-code').focus(); });
$('join-code').addEventListener('input',event=>{ event.target.value=event.target.value.replace(/[^a-z0-9]/gi,'').toUpperCase(); });
$('join-form').addEventListener('submit',event=>{
  event.preventDefault();
  const room=$('join-code').value.trim().toUpperCase();
  if (!/^[A-Z0-9]{8,12}$/.test(room)) return;
  window.location.assign(meetingURL({room},$('join-role').value));
});

function showAppointment(value, message='') {
  currentAppointment=value;
  const teacher=getTeacher(value.teacherId);
  $('appointment-teacher').textContent=`${teacher.name} · ${teacher.field}`;
  $('appointment-time').textContent=`${formatSlot(value.slot)} · 北京时间`;
  $('appointment-time').dateTime=value.slot;
  $('appointment-topic').textContent=value.topic || '阶段学习反馈';
  $('appointment-code').textContent=value.room;
  for (const role of Object.keys(ROLE_NAMES)) $('enter-'+role).href=meetingURL(value,role);
  $('appointment-feedback').textContent=message;
  $('appointment-summary').hidden=false; document.body.classList.add('has-appointment');
}

$('booking-form').addEventListener('submit',event=>{
  event.preventDefault();
  const slot = new FormData(event.currentTarget).get('slot');
  if (!slot || !upcomingSlots(selectedTeacher.id).some(item=>item.iso===slot)) { $('booking-feedback').textContent='请重新选择一个演示时段。'; return; }
  const appointment={room:makeRoomCode(),teacherId:selectedTeacher.id,slot,topic:$('topic-select').value,createdAt:new Date().toISOString()};
  const persisted=saveAppointment(appointment);
  showAppointment(appointment,persisted?'演示预约已保存在此浏览器，不会通知真实老师。':'此浏览器无法保存预约；当前入口仍可使用，请复制演示邀请。');
  teacherDialog.close();
  $('appointment-summary').scrollIntoView({behavior:'auto',block:'nearest'});
  $('enter-teacher').focus({preventScroll:true});
});

function invitationText() {
  if (!currentAppointment) return '';
  const a=currentAppointment,t=getTeacher(a.teacherId);
  return [`ISP 家庭会谈 · 演示邀请`,`${t.name}（虚构演示老师）`,`${formatSlot(a.slot)}（北京时间）`,`主题：${a.topic || '阶段学习反馈'}`,`演示房间：${a.room}`,'',...Object.entries(ROLE_NAMES).map(([role,name])=>`${name}身份预览：${meetingURL(a,role)}`),'','此邀请用于演示页面和会谈流程，不代表真实预约。在线会谈请使用老师在会谈室生成的邀请。'].join('\n');
}
$('copy-invitation').addEventListener('click',async()=>{
  const text=invitationText(); if (!text) return;
  try { await navigator.clipboard.writeText(text); $('appointment-feedback').textContent='演示邀请已复制。'; }
  catch { $('invitation-text').value=text; $('invitation-dialog').showModal(); $('invitation-text').focus(); $('invitation-text').select(); }
});
$('select-invitation').addEventListener('click',()=>{ $('invitation-text').focus(); $('invitation-text').select(); });
const previous=readAppointments()[0]; if(previous)showAppointment(previous);

requestAnimationFrame(()=>{
  import('./lounge-view.js?v=family-1').then(({mountLounge})=>{
    lounge=mountLounge({container:$('lounge-scene'),gallery:$('portrait-gallery'),onPortrait:openTeacher,onError:()=>{$('room-hint').textContent='当前设备未显示三维场景，仍可点击画像查看演示老师。';}});
  }).catch(()=>{$('room-hint').textContent='三维准备室暂未加载，仍可点击画像查看演示老师。';});
});
