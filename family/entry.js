// Reuse the original homepage renderer and styling. No AI gateway or chat client.
const study = document.getElementById('study-dialog');
const studyButton = document.getElementById('open-study');
const loading = document.getElementById('scene-loading');
const note = document.getElementById('fallback-note');
let space;

studyButton.addEventListener('click', () => study.showModal());
document.getElementById('close-study').addEventListener('click', () => study.close());
study.addEventListener('click', event => {
  if (event.target !== study) return;
  const rect = study.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) study.close();
});
study.addEventListener('close', () => studyButton.focus({ preventScroll: true }));
document.getElementById('enter-vr').addEventListener('click', () => {
  location.assign(new URL('./meeting.html?role=teacher', import.meta.url).href);
});

function showNote(message, fallback = false) {
  note.textContent = message;
  note.hidden = false;
  if (fallback) document.body.classList.add('fallback');
  loading.hidden = true;
}
function loadingLabel(message) {
  loading.replaceChildren(document.createElement('span'), document.createTextNode(' ' + message));
  loading.hidden = false;
}
const startupTimer = setTimeout(() => {
  if (!space) showNote('The 3D classroom is taking longer to load. You can still open Study or Reservation.', true);
}, 45000);

import('../space-scene.js?v=medieval-lounge-40').then(({ createSpace }) => {
  clearTimeout(startupTimer);
  space = createSpace(document.getElementById('universe'), (state, detail) => {
    if (state === 'ready' || state === 'restored') {
      document.body.classList.remove('fallback');
      note.hidden = true;
      loading.hidden = true;
    }
    if (state === 'teacher-loading') loadingLabel('Loading the cat teacher');
    if (state === 'teacher-progress') loadingLabel('Loading the cat teacher · ' + detail + '%');
    if (state === 'teacher-ready') loading.hidden = true;
    if (state === 'teacher-error') showNote('The cat teacher could not load. Refresh to try again; Study and Reservation remain accessible.');
    if (state === 'teacher-detail-error') showNote('Some character details could not load. Refresh to try again.');
    if (state === 'teacher-tail-error') showNote('The cat teacher is loaded, but its tail animation is unavailable. Refresh to try again.');
    if (state === 'teacher-tail-ready') note.hidden = true;
    if (state === 'lost') showNote('The 3D view was interrupted. Refresh to restore it; Study and Reservation remain accessible.', true);
  });
  space.setMode('home');
}).catch(() => {
  clearTimeout(startupTimer);
  showNote('The 3D classroom could not load. Refresh to try again; Study and Reservation remain accessible.', true);
});
