import * as THREE from '../three.module.min.js';
import { createCastleLounge } from '../live/castle-lounge.js?v=star-window-41';

// Reuses the original modeled lounge and its portrait meshes without changing
// the original source. The supplied ISP raster is used unchanged as a wall sign.
export function mountLounge({ container, gallery, onPortrait, onReady, onError }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
  catch (error) { onError?.(error); return { center() {}, dispose() {} }; }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#070c15');
  const camera = new THREE.PerspectiveCamera(55, 1, .06, 240);
  camera.rotation.order = 'YXZ';
  const lounge = createCastleLounge(scene);
  const points = [];
  for (let i = 0; i < 1600; i++) {
    const a = i * 2.399963, y = 1 - 2 * (i + .5) / 1600, radius = 95 + i % 31;
    points.push(Math.cos(a) * Math.sqrt(1 - y * y) * radius, y * radius, Math.sin(a) * Math.sqrt(1 - y * y) * radius);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: '#c5d7ee', size: .12, sizeAttenuation: true, transparent: true, opacity: .7 })));
  const signGroup = new THREE.Group();
  signGroup.position.set(2.1, 2.35, -7.08);
  const backing = new THREE.Mesh(new THREE.BoxGeometry(2.06, .76, .045), new THREE.MeshStandardMaterial({ color: '#372b20', roughness: .9 }));
  signGroup.add(backing);
  lounge.group.add(signGroup);
  let needsFrame = true;
  new THREE.TextureLoader().load(new URL('./assets/isp-program-logo.png', import.meta.url).href, map => {
    map.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.96 * map.image.height / map.image.width), new THREE.MeshBasicMaterial({ map, toneMapped: false }));
    sign.position.z = .03;
    sign.name = 'ISP PROGRAM / SUIS QP original supplied logo';
    signGroup.add(sign); needsFrame = true;
  }, undefined, () => { needsFrame = true; });
  const buttons = [...gallery.querySelectorAll('[data-teacher]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const center = new THREE.Vector3(), normal = new THREE.Vector3(), cameraPosition = new THREE.Vector3();
  let yaw = 0, pitch = 0, drag = null, lastTime = 0, disposed = false;
  lounge.group.userData.requestRender = () => { needsFrame = true; };

  function positionPortraits() {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); camera.getWorldPosition(cameraPosition);
    const width = container.clientWidth, height = container.clientHeight;
    for (const { id, mesh } of lounge.portraits) {
      const button = buttons.find(item => item.dataset.teacher === id);
      if (!button) continue;
      mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox;
      mesh.getWorldPosition(center);
      normal.set(0, 0, 1).transformDirection(mesh.matrixWorld);
      const projected = center.clone().project(camera);
      const corners = [[bounds.min.x,bounds.min.y],[bounds.max.x,bounds.min.y],[bounds.min.x,bounds.max.y],[bounds.max.x,bounds.max.y]].map(([x,y]) => new THREE.Vector3(x,y,0).applyMatrix4(mesh.matrixWorld).project(camera));
      const left = Math.min(...corners.map(p=>p.x)), right = Math.max(...corners.map(p=>p.x));
      const top = Math.max(...corners.map(p=>p.y)), bottom = Math.min(...corners.map(p=>p.y));
      button.hidden = normal.dot(cameraPosition.clone().sub(center)) <= 0 || projected.z < -1 || projected.z > 1 || right < -1 || left > 1 || bottom > 1 || top < -1;
      if (button.hidden) continue;
      button.style.left = `${(left+1)*width*.5}px`; button.style.top = `${(1-top)*height*.5}px`;
      button.style.width = `${(right-left)*width*.5}px`; button.style.height = `${(top-bottom)*height*.5}px`;
    }
  }
  function pose() { camera.rotation.set(pitch,yaw,0,'YXZ'); positionPortraits(); needsFrame = true; }
  function resize() {
    if (disposed) return;
    const width = container.clientWidth, height = container.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(width,height,false); camera.aspect = width/height; camera.fov = width < 680 ? 65 : 55;
    camera.updateProjectionMatrix(); lounge.layout(camera,width,height); pose();
  }
  const down = event => {
    if (event.button !== 0 || document.querySelector('dialog[open]')) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    container.setPointerCapture(event.pointerId); container.classList.add('is-looking');
  };
  const move = event => {
    if (drag?.id !== event.pointerId) return;
    yaw -= (event.clientX-drag.x)*.003; pitch = THREE.MathUtils.clamp(pitch-(event.clientY-drag.y)*.0025,-.65,.65);
    drag.x = event.clientX; drag.y = event.clientY; pose();
  };
  const up = event => { if (drag?.id === event.pointerId) { drag = null; container.classList.remove('is-looking'); } };
  const keyboard = event => {
    if (document.querySelector('dialog[open]') || event.target.closest('input,select,textarea,button,a')) return;
    const keys = { ArrowLeft:[.08,0], ArrowRight:[-.08,0], ArrowUp:[0,.06], ArrowDown:[0,-.06] };
    if (!keys[event.key]) return;
    event.preventDefault(); yaw += keys[event.key][0]; pitch = THREE.MathUtils.clamp(pitch+keys[event.key][1],-.65,.65); pose();
  };
  container.addEventListener('pointerdown', down); container.addEventListener('pointermove', move);
  for (const type of ['pointerup','pointercancel','lostpointercapture']) container.addEventListener(type, up);
  document.addEventListener('keydown', keyboard);
  const observer = new ResizeObserver(resize); observer.observe(container); resize();
  document.body.dataset.loungeReady = 'true'; onReady?.();
  renderer.setAnimationLoop(time => {
    if (disposed || document.hidden || (!needsFrame && (reduce.matches || time-lastTime < 33))) return;
    const elapsed = Math.min(.05,Math.max(0,(time-lastTime)/1000)); lastTime = time; needsFrame = false;
    lounge.update(time,elapsed,reduce.matches); renderer.render(scene,camera);
  });
  return {
    center() { yaw = 0; pitch = 0; pose(); },
    dispose() { disposed = true; renderer.setAnimationLoop(null); observer.disconnect(); document.removeEventListener('keydown',keyboard); renderer.dispose(); },
  };
}
