export const TEACHERS = Object.freeze([
  { id: 'teacher-1', name: 'Teacher Lu', english: 'LEARNING & SCIENCE', field: 'Learning & study skills', specialty: 'Chemistry · Science · Problem solving', description: 'Start with an assignment or a difficult concept and find the next step together.', focus: ['Clarify concepts and explanations', 'Explore practical study methods', 'Set a manageable next goal'], portrait: 0 },
  { id: 'teacher-2', name: 'Teacher Shen', english: 'FAMILY & CONNECTION', field: 'School & family communication', specialty: 'Study habits · Communication · Progress reviews', description: 'Hear the student perspective and share observations from school and home.', focus: ['Listen to student ideas and needs', 'Share observations from school and home', 'Agree on practical support'], portrait: 1 },
  { id: 'teacher-3', name: 'Teacher Zhou', english: 'GROWTH & DIRECTION', field: 'Goals & planning', specialty: 'Learning goals · Study plans · Time management', description: 'Turn long-term goals into clear, achievable next steps.', focus: ['Review recent progress', 'Discuss priorities and time', 'Plan the next steps together'], portrait: 2 },
]);

export const getTeacher = id => TEACHERS.find(item => item.id === id) || TEACHERS[0];
export const ROLE_NAMES = Object.freeze({ teacher: 'Teacher', parent: 'Parent', student: 'Student' });
export const APPOINTMENT_KEY = 'isp_family_demo_appointments_v1';

// Display bookings saved by the earlier demo in the current interface language.
const legacyTopics = Object.freeze({
  '阶段学习反馈': 'Learning progress review',
  '学习方法与习惯': 'Study methods and habits',
  '家庭支持与沟通': 'Family support and communication',
  '下一阶段的学习目标': 'Next learning goals',
});

const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
const fullDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const shortDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', weekday: 'short' });

export function formatSlot(iso) {
  const value = new Date(iso);
  return Number.isFinite(value.getTime()) ? fullDate.format(value) : 'Time to be confirmed';
}

export function upcomingSlots(teacherId, now = new Date()) {
  const parts = Object.fromEntries(dateParts.formatToParts(now).map(item => [item.type, item.value]));
  const today = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00+08:00`);
  const index = Math.max(0, TEACHERS.findIndex(item => item.id === teacherId));
  return Array.from({ length: 4 }, (_, i) => {
    const value = new Date(today.getTime() + (i + 1) * 86400000 + (19 * 60 + (index % 2 ? 30 : 0)) * 60000);
    return { iso: value.toISOString(), day: shortDay.format(value), time: index % 2 ? '19:30–20:00' : '19:00–19:30' };
  });
}

export function makeRoomCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(bytes, n => alphabet[n % alphabet.length]).join('');
}

export function readAppointments() {
  try {
    const values = JSON.parse(localStorage.getItem(APPOINTMENT_KEY) || '[]');
    if (!Array.isArray(values)) return [];
    return values.filter(item => item && /^[A-Z0-9]{8,12}$/.test(item.room) && TEACHERS.some(t => t.id === item.teacherId) && Number.isFinite(new Date(item.slot).getTime())).slice(0, 12).map(item => ({...item, topic: legacyTopics[item.topic] || item.topic}));
  } catch { return []; }
}

export function saveAppointment(value) {
  const values = [value, ...readAppointments().filter(item => item.room !== value.room)].slice(0, 12);
  try { localStorage.setItem(APPOINTMENT_KEY, JSON.stringify(values)); return true; }
  catch { return false; }
}

export function meetingURL(appointment, role = 'teacher') {
  const url = new URL('./meeting.html', import.meta.url);
  url.searchParams.set('room', appointment.room);
  url.searchParams.set('role', Object.hasOwn(ROLE_NAMES, role) ? role : 'teacher');
  if (TEACHERS.some(item => item.id === appointment.teacherId)) url.searchParams.set('teacher', appointment.teacherId);
  if (appointment.slot) url.searchParams.set('slot', appointment.slot);
  return url.href;
}
