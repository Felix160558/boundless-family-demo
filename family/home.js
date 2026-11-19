import * as THREE from '../three.module.min.js';

const dialog = document.getElementById('learning-dialog');
document.getElementById('open-learning').addEventListener('click', () => dialog.showModal());
document.getElementById('close-learning').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close(); } });

const container = document.getElementById('home-scene');
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'low-power' }); } catch { /* The two entry points remain available. */ }
if (renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1,1.5));
  container.append(renderer.domElement); container.classList.add('ready');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36,1,.1,80); camera.position.set(8,7.5,10); camera.lookAt(0,.3,0);
  const room = new THREE.Group(); room.rotation.y = -.35; scene.add(room);
  scene.add(new THREE.HemisphereLight('#cbd8ff','#152039',2.4));
  const light = new THREE.DirectionalLight('#eee4d6',2.1); light.position.set(3,6,4); scene.add(light);
  const mat = (color,extra={}) => new THREE.MeshStandardMaterial({color,roughness:.7,...extra});
  const floorMat = mat('#293a4e',{metalness:.25});
  const frameMat = mat('#9babbc',{metalness:.55,roughness:.35});
  const addBox=(w,h,d,x,y,z,material,parent=room)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);parent.add(m);return m;};
  addBox(6,.16,4.2,0,-.06,0,floorMat);
  const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6,.16,4.2)),new THREE.LineBasicMaterial({color:'#a5b8d0',transparent:true,opacity:.65}));edge.position.y=-.06;room.add(edge);
  for(const x of[-2.96,2.96])for(const z of[-2.04,2.04])addBox(.035,2.8,.035,x,1.4,z,frameMat);
  for(const z of[-2.04,2.04])addBox(5.96,.035,.035,0,2.8,z,frameMat);
  for(const x of[-2.96,2.96])addBox(.035,.035,4.1,x,2.8,0,frameMat);
  const glass = new THREE.MeshBasicMaterial({color:'#97b6e1',transparent:true,opacity:.05,side:THREE.DoubleSide,depthWrite:false});
  const back = new THREE.Mesh(new THREE.PlaneGeometry(5.9,2.75),glass);back.position.set(0,1.4,-2);room.add(back);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(4,2.75),glass);side.rotation.y=Math.PI/2;side.position.set(-2.96,1.4,0);room.add(side);
  addBox(2.9,1.35,.09,0,1.74,-1.92,mat('#c0cad6'));
  addBox(2.75,1.2,.02,0,1.74,-1.86,mat('#203453'));
  new THREE.TextureLoader().load(new URL('./assets/isp-program-logo.png',import.meta.url).href,map=>{map.colorSpace=THREE.SRGBColorSpace;const logo=new THREE.Mesh(new THREE.PlaneGeometry(2.1,2.1*map.image.height/map.image.width),new THREE.MeshBasicMaterial({map,toneMapped:false}));logo.position.set(0,1.74,-1.84);room.add(logo);renderer.render(scene,camera);});
  const tabletop = mat('#b3b6c0',{roughness:.5});
  const table = new THREE.Mesh(new THREE.CylinderGeometry(1.17,1.17,.09,48),tabletop);table.position.set(0,.83,.1);room.add(table);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,.78,20),frameMat);base.position.set(0,.41,.1);room.add(base);
  const positions = [[-1.57,.4,.3,'#ad9be0'],[1.57,.4,.3,'#87b6c6'],[0,.4,1.7,'#e0c298']];
  for(const [x,y,z,color] of positions){const actor=new THREE.Group();actor.position.set(x,y,z);actor.lookAt(0,y,.1);room.add(actor);const seat=mat('#53657b');addBox(.65,.09,.61,0,.03,0,seat,actor);addBox(.65,.61,.07,0,.34,-.28,seat,actor);for(const sx of[-.24,.24])for(const sz of[-.22,.22])addBox(.03,.44,.03,sx,-.22,sz,frameMat,actor);const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.2,.23,4,12),mat(color));torso.position.y=.56;actor.add(torso);const head=new THREE.Mesh(new THREE.SphereGeometry(.19,20,14),mat('#d9dee5'));head.position.y=1;actor.add(head);}
  const reduce=matchMedia('(prefers-reduced-motion:reduce)');let last=0;
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.render(scene,camera);};
  new ResizeObserver(resize).observe(container);resize();
  renderer.setAnimationLoop(time=>{if(document.hidden||reduce.matches||time-last<40)return;last=time;room.rotation.y=-.35+Math.sin(time*.00009)*.10;room.position.y=Math.sin(time*.00025)*.045;renderer.render(scene,camera);});
}
