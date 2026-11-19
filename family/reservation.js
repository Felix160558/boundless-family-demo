import { TEACHERS, getTeacher, ROLE_NAMES, upcomingSlots, formatSlot, makeRoomCode, readAppointments, saveAppointment, meetingURL } from './demo-data.js?v=original-study-2';

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
  $('teacher-art').setAttribute('aria-label',`Fictional demo portrait of ${selectedTeacher.name}`);
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
  $('appointment-time').textContent=`${formatSlot(value.slot)} · Shanghai time`;
  $('appointment-time').dateTime=value.slot;
  $('appointment-topic').textContent=value.topic || 'Learning progress review';
  $('appointment-code').textContent=value.room;
  for (const role of Object.keys(ROLE_NAMES)) $('enter-'+role).href=meetingURL(value,role);
  $('appointment-feedback').textContent=message;
  $('appointment-summary').hidden=false; document.body.classList.add('has-appointment');
}

$('booking-form').addEventListener('submit',event=>{
  event.preventDefault();
  const slot = new FormData(event.currentTarget).get('slot');
  if (!slot || !upcomingSlots(selectedTeacher.id).some(item=>item.iso===slot)) { $('booking-feedback').textContent='Please select another demo time.'; return; }
  const appointment={room:makeRoomCode(),teacherId:selectedTeacher.id,slot,topic:$('topic-select').value,createdAt:new Date().toISOString()};
  const persisted=saveAppointment(appointment);
  showAppointment(appointment,persisted?'Demo booking saved in this browser. No teacher has been notified.':'This browser could not save the booking. Copy the demo links to keep them.');
  teacherDialog.close();
  $('appointment-summary').scrollIntoView({behavior:'auto',block:'nearest'});
  $('enter-teacher').focus({preventScroll:true});
});

function invitationText() {
  if (!currentAppointment) return '';
  const a=currentAppointment,t=getTeacher(a.teacherId);
  return [`Boundless Classroom · Demo invitation`,`${t.name} (fictional demo teacher)`,`${formatSlot(a.slot)} (Shanghai time)`,`Topic: ${a.topic || 'Learning progress review'}`,`Demo room: ${a.room}`,'',...Object.entries(ROLE_NAMES).map(([role,name])=>`${name} preview: ${meetingURL(a,role)}`),'','These links preview the meeting flow, not a real booking. For a live meeting, use the invitation created by the teacher inside the room.'].join('\n');
}
$('copy-invitation').addEventListener('click',async()=>{
  const text=invitationText(); if (!text) return;
  try { await navigator.clipboard.writeText(text); $('appointment-feedback').textContent='Demo invitation copied.'; }
  catch { $('invitation-text').value=text; $('invitation-dialog').showModal(); $('invitation-text').focus(); $('invitation-text').select(); }
});
$('select-invitation').addEventListener('click',()=>{ $('invitation-text').focus(); $('invitation-text').select(); });
const previous=readAppointments()[0]; if(previous)showAppointment(previous);

requestAnimationFrame(()=>{
  import('./lounge-view.js?v=original-study-2').then(({mountLounge})=>{
    lounge=mountLounge({container:$('lounge-scene'),gallery:$('portrait-gallery'),onPortrait:openTeacher,onError:()=>{$('room-hint').textContent='3D view unavailable. You can still select a teacher portrait.';}});
  }).catch(()=>{$('room-hint').textContent='The room has not loaded. You can still select a teacher portrait.';});
});
