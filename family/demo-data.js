export const TEACHERS = Object.freeze([
  { id: 'teacher-1', name: '陆老师', english: 'LEARNING & SCIENCE', field: '学科学习与方法', specialty: '化学 · 科学学习 · 解题思路', description: '从一份作业、一个没听懂的概念开始，一起找到学习中的具体困难。', focus: ['梳理知识理解与表达', '讨论可执行的学习方法', '确定下一阶段的小目标'], portrait: 0 },
  { id: 'teacher-2', name: '沈老师', english: 'FAMILY & CONNECTION', field: '家校沟通与陪伴', specialty: '学习习惯 · 家庭沟通 · 阶段反馈', description: '让孩子说出自己的感受，也让家长更清楚地了解学习中发生的变化。', focus: ['听见学生的想法与需要', '分享课堂与家庭中的观察', '约定彼此能做到的支持'], portrait: 1 },
  { id: 'teacher-3', name: '周老师', english: 'GROWTH & DIRECTION', field: '成长目标与规划', specialty: '阶段目标 · 学习路径 · 时间安排', description: '把长远的期待变成眼前可以实践的一步，让下一次进步有清楚的方向。', focus: ['回顾本阶段的收获', '讨论优先级与时间安排', '一起形成下一步计划'], portrait: 2 },
]);

export const getTeacher = id => TEACHERS.find(item => item.id === id) || TEACHERS[0];
export const ROLE_NAMES = Object.freeze({ teacher: '老师', parent: '家长', student: '学生' });
export const APPOINTMENT_KEY = 'isp_family_demo_appointments_v1';

const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
const fullDate = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const shortDay = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', weekday: 'short' });

export function formatSlot(iso) {
  const value = new Date(iso);
  return Number.isFinite(value.getTime()) ? fullDate.format(value) : '时间待确认';
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
    return values.filter(item => item && /^[A-Z0-9]{8,12}$/.test(item.room) && TEACHERS.some(t => t.id === item.teacherId) && Number.isFinite(new Date(item.slot).getTime())).slice(0, 12);
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
