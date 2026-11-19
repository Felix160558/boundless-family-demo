import * as THREE from '../three.module.min.js';
import { createCastleLounge } from '../live/castle-lounge.js?v=star-window-41';
import { createSpaceSky } from '../space-sky.js?v=medieval-lounge-40';

// Reuses the original modeled lounge and its portrait meshes without changing
// the original source. The ISP elements are a transparent vector wall mark.
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
  // Hide the unpainted WebGL buffer until the complete first frame is rendered.
  renderer.domElement.style.opacity = '0';
  renderer.domElement.style.transition = 'opacity 260ms ease';
  container.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#07090e');
  const galaxy = new THREE.Group();
  galaxy.rotation.set(.25, -.47, .045);
  scene.add(galaxy);
  const sky = createSpaceSky(galaxy, { compact: true });
  const camera = new THREE.PerspectiveCamera(55, 1, .06, 600);
  camera.rotation.order = 'YXZ';
  const lounge = createCastleLounge(scene);
  const signGroup = new THREE.Group();
  signGroup.position.set(2.1, 2.35, -7.08);
  lounge.group.add(signGroup);
  let needsFrame = true;
  new THREE.TextureLoader().load(new URL('./assets/isp-program-mark.svg', import.meta.url).href, map => {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.96, 1.96 * map.image.height / map.image.width), new THREE.MeshBasicMaterial({ map, toneMapped: false, transparent: true, alphaTest: .02, depthWrite: false }));
    sign.position.z = .03;
    sign.name = 'ISP PROGRAM / SUIS QP transparent wordmark';
    signGroup.add(sign); needsFrame = true;
  }, undefined, () => { needsFrame = true; });
  const buttons = [...gallery.querySelectorAll('[data-teacher]')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const center = new THREE.Vector3(), normal = new THREE.Vector3(), cameraPosition = new THREE.Vector3();
  let yaw = 0, pitch = 0, drag = null, lastTime = 0, disposed = false, firstFrameShown = false, paintedFrames = 0;
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
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.setSize(width,height,false); camera.aspect = width/height; camera.fov = width < 680 ? 65 : 55;
    sky.resize(height, renderer.getPixelRatio());
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
  // The ready state also moves the portrait hotspots; only flip it after render.
  renderer.setAnimationLoop(time => {
    if (disposed || document.hidden || (!needsFrame && (reduce.matches || time-lastTime < 33))) return;
    const elapsed = Math.min(.05,Math.max(0,(time-lastTime)/1000)); lastTime = time; needsFrame = false;
    sky.update(reduce.matches ? 0 : elapsed);
    lounge.update(time,elapsed,reduce.matches); renderer.render(scene,camera);
    if (!firstFrameShown && ++paintedFrames >= 2) {
      firstFrameShown = true;
      document.body.dataset.loungeReady = 'true';
      renderer.domElement.style.opacity = '1';
      onReady?.();
    }
  });
  return {
    center() { yaw = 0; pitch = 0; pose(); },
    dispose() { disposed = true; renderer.setAnimationLoop(null); observer.disconnect(); document.removeEventListener('keydown',keyboard); renderer.dispose(); },
  };
}
