import * as THREE from '../three.module.min.js';
import { createSpaceSky } from '../space-sky.js?v=medieval-lounge-40';
import { createCatTeacher } from '../cat-teacher.js?v=teacher-presence-26';

// Deliberately reuses the architectural dimensions, materials, glass enclosure,
// desk and rounded-chair geometry of the original Boundless Classroom.
// The existing student's chair stays at (0.8, 2.06). Two matching chairs are
// added beside the same desk; no new meeting-room architectural theme.
export function createOriginalClassroom(scene, renderer, { onError = () => {} } = {}) {
  const room = new THREE.Group();
  room.name = 'Original Boundless Classroom · three chairs';
  scene.add(room);
  scene.background = new THREE.Color('#07090e');
  scene.fog = null;

  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const mats = {
    deck: new THREE.MeshPhysicalMaterial({ color:0xc5c7c3, roughness:.29, metalness:.38, clearcoat:.35, clearcoatRoughness:.3 }),
    edge: new THREE.MeshStandardMaterial({ color:0x343943, roughness:.27, metalness:.72 }),
    white: new THREE.MeshStandardMaterial({ color:0xe1e2da, roughness:.48, metalness:.2 }),
    dark: new THREE.MeshStandardMaterial({ color:0x202a35, roughness:.5, metalness:.45 }),
    glow: new THREE.MeshStandardMaterial({ color:0xeeeadc, emissive:0xd5d9d5, emissiveIntensity:.65, roughness:.5 })
  };
  const furniture = [];
  function mesh(geometry, material, parent=room, x=0, y=0, z=0) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x,y,z);
    item.castShadow = true; item.receiveShadow = true;
    parent.add(item);
    furniture.push(item);
    return item;
  }
  const box=(w,h,d,material,x=0,y=0,z=0,parent=room)=>mesh(new THREE.BoxGeometry(w,h,d),material,parent,x,y,z);
  const hemi=new THREE.HemisphereLight(0xcbd7e8,0x343039,1.55);
  const key=new THREE.DirectionalLight(0xfff3e1,2.7);
  key.position.set(-3,9,5);
  key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);
  key.shadow.camera.left=-9; key.shadow.camera.right=9;
  key.shadow.camera.top=8; key.shadow.camera.bottom=-8;
  key.shadow.normalBias=.035; key.shadow.bias=-.0002;
  const fill=new THREE.DirectionalLight(0x758fae,1.2);
  fill.position.set(7,4,-5);
  const lamp=new THREE.PointLight(0xfff3db,23,16,2);
  lamp.position.set(0,4,0);
  scene.add(hemi,key,fill);
  room.add(lamp);

  mesh(new THREE.CylinderGeometry(6.35,6.1,.32,112),mats.edge,room,0,-.28,0);
  mesh(new THREE.CylinderGeometry(6.24,6.24,.07,112),
    new THREE.MeshStandardMaterial({ color:0x343d48, roughness:.43, metalness:.58 }),room,0,-.075,0);
  function ring(radius,y,color,opacity) {
    const vertices=[];
    for(let i=0;i<=160;i++){
      const theta=i/160*Math.PI*2;
      vertices.push(new THREE.Vector3(Math.cos(theta)*radius,y,Math.sin(theta)*radius));
    }
    room.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(vertices),
      new THREE.LineBasicMaterial({color,transparent:true,opacity})));
  }
  ring(6.3,-.19,0xffe1b9,.9);
  const rim=mesh(new THREE.TorusGeometry(6.30,.014,8,160),
    new THREE.MeshBasicMaterial({color:0xffdfb7}),room,0,-.19,0);
  rim.rotation.x=Math.PI/2;
  const halo=mesh(new THREE.RingGeometry(6.22,6.43,160),
    new THREE.MeshBasicMaterial({color:0xe1c6a1,transparent:true,opacity:.10,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending}),room,0,-.19,0);
  halo.rotation.x=-Math.PI/2;
  ring(6.65,-.46,0xb4c7df,.14);
  ring(7.5,-.9,0x9cabc0,.045);
  box(9.2,.13,6.9,mats.deck,0,.025,0);

  // Preserve transparent glass walls and glass ceiling, not opaque blue walls.
  const glass=new THREE.MeshPhysicalMaterial({
    color:0xc4d2e1,transparent:true,opacity:.045,roughness:.08,metalness:.08,
    clearcoat:1,clearcoatRoughness:.08,side:THREE.DoubleSide,depthWrite:false
  });
  const glassEdges=new THREE.LineBasicMaterial({color:0xb8c8d8,transparent:true,opacity:.16,depthWrite:false});
  function pane(w,h,x,y,z,rx=0,ry=0) {
    const geom=new THREE.PlaneGeometry(w,h);
    const item=mesh(geom,glass,room,x,y,z);
    item.rotation.set(rx,ry,0);
    item.castShadow=false; item.receiveShadow=false;
    item.add(new THREE.LineSegments(new THREE.EdgesGeometry(geom),glassEdges));
  }
  pane(8.9,3.76,0,1.98,-3.3);
  pane(8.9,3.76,0,1.98,3.3);
  pane(6.6,3.76,-4.45,1.98,0,0,Math.PI/2);
  pane(6.6,3.76,4.45,1.98,0,0,Math.PI/2);
  pane(8.9,6.6,0,3.86,0,Math.PI/2);

  const seams=new THREE.LineBasicMaterial({color:0x4a515a,transparent:true,opacity:.18});
  for(let i=-3;i<=3;i++){
    const geom=new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(i*1.2,.096,-3.35),
      new THREE.Vector3(i*1.2,.096,3.35)
    ]);
    room.add(new THREE.Line(geom,seams));
  }
  const frame=new THREE.MeshStandardMaterial({color:0xc5c2b9,emissive:0xe2ceb0,emissiveIntensity:.11,roughness:.25,metalness:.65});
  for(const x of [-4.45,4.45])for(const z of [-3.3,3.3])box(.045,3.8,.045,frame,x,1.95,z);
  for(const x of [-4.45,4.45])box(.055,.055,6.65,frame,x,3.87,0);
  for(const z of [-3.3,3.3])box(8.95,.055,.055,frame,0,3.87,z);
  box(7.9,.028,.038,mats.glow,0,3.81,-3.26);
  box(.028,.028,5.9,mats.glow,-4.4,3.81,0);
  box(.028,.028,5.9,mats.glow,4.4,3.81,0);

  // Same original whiteboard proportions. The meeting report is drawn as a
  // separate 16:9 overlay on its surface by meeting-scene.js.
  box(5.55,2.6,.11,mats.dark,0,2.24,-2.8);
  const originalBoard=mesh(new THREE.PlaneGeometry(5.42,2.46),
    new THREE.MeshBasicMaterial({color:0xe6e7df,toneMapped:false}),room,0,2.24,-2.738);
  originalBoard.castShadow=false;
  for(const x of [-1.9,1.9])box(.065,1.1,.08,mats.edge,x,.62,-2.8);
  box(5.5,.04,.2,mats.white,0,.92,-2.7);

  // The original desk, copied without introducing an oval or meeting-room table.
  const desk=new THREE.Group();
  desk.position.set(.8,0,1.1);
  room.add(desk);
  const desktopShape=new THREE.Shape(),w=.925,d=.455,r=.055;
  desktopShape.moveTo(-w+r,-d);desktopShape.lineTo(w-r,-d);
  desktopShape.quadraticCurveTo(w,-d,w,-d+r);
  desktopShape.lineTo(w,d-r);desktopShape.quadraticCurveTo(w,d,w-r,d);
  desktopShape.lineTo(-w+r,d);desktopShape.quadraticCurveTo(-w,d,-w,d-r);
  desktopShape.lineTo(-w,-d+r);desktopShape.quadraticCurveTo(-w,-d,-w+r,-d);
  const desktopGeometry=new THREE.ExtrudeGeometry(desktopShape,{
    depth:.065,bevelEnabled:true,bevelSize:.012,bevelThickness:.01,
    bevelSegments:3,steps:1,curveSegments:10
  });
  desktopGeometry.rotateX(-Math.PI/2);desktopGeometry.translate(0,.91,0);
  mesh(desktopGeometry,new THREE.MeshPhysicalMaterial({
    color:0xc9c9b7,roughness:.43,clearcoat:.25,clearcoatRoughness:.32
  }),desk);
  for(const x of [-.76,.76])for(const z of [-.32,.32])box(.04,.82,.04,mats.edge,x,.49,z,desk);

  // Reuse the exact rounded-panel construction of the existing learner chair.
  function roundedChairPanel(width,height,thickness,radius,bevel) {
    const cornerSegments=32,edgeSegments=24,perimeter=[],quarter=[];
    const cx=width/2-radius,cy=height/2-radius,halfDepth=thickness/2;
    for(let i=0;i<=cornerSegments;i++){
      const angle=i/cornerSegments*Math.PI/2;
      quarter.push([i===cornerSegments?0:Math.cos(angle),i===0?0:Math.sin(angle)]);
    }
    for(let quadrant=0;quadrant<4;quadrant++)for(let i=0;i<=cornerSegments;i++){
      const [c,s]=quarter[quadrant%2===0?i:cornerSegments-i];
      if(quadrant===0)perimeter.push([cx,cy,c,s]);
      if(quadrant===1)perimeter.push([-cx,cy,-c,s]);
      if(quadrant===2)perimeter.push([-cx,-cy,-c,-s]);
      if(quadrant===3)perimeter.push([cx,-cy,c,-s]);
    }
    const positions=[],normals=[],indices=[],stride=perimeter.length;
    function addRing(sine,cosine,side) {
      const rr=radius-bevel+bevel*sine,z=side*(halfDepth-bevel+bevel*cosine);
      for(const [x,y,nx,ny] of perimeter){
        positions.push(x+nx*rr,y+ny*rr,z);
        normals.push(nx*sine,ny*sine,side*cosine);
      }
    }
    for(let i=0;i<=edgeSegments;i++){
      const angle=i/edgeSegments*Math.PI/2;
      addRing(i===edgeSegments?1:Math.sin(angle),i===edgeSegments?0:Math.cos(angle),1);
    }
    for(let i=edgeSegments;i>=0;i--){
      const angle=i/edgeSegments*Math.PI/2;
      addRing(i===edgeSegments?1:Math.sin(angle),i===edgeSegments?0:Math.cos(angle),-1);
    }
    const rings=positions.length/(stride*3);
    for(let ring=0;ring<rings-1;ring++)for(let i=0;i<stride;i++){
      const next=(i+1)%stride,a=ring*stride+i,b=a+stride,c=ring*stride+next,dd=c+stride;
      indices.push(a,b,c,c,b,dd);
    }
    const front=positions.length/3,back=front+1,last=(rings-1)*stride;
    positions.push(0,0,halfDepth,0,0,-halfDepth);
    normals.push(0,0,1,0,0,-1);
    for(let i=0;i<stride;i++){
      const next=(i+1)%stride;
      indices.push(front,i,next,back,last+next,last+i);
    }
    const geom=new THREE.BufferGeometry();
    geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geom.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geom.setIndex(indices);
    return geom;
  }
  const seatGeometry=roundedChairPanel(.62,.62,.09,.11,.017);
  seatGeometry.rotateX(-Math.PI/2);
  const backGeometry=roundedChairPanel(.61,.62,.065,.13,.014);
  const frontLeg=new THREE.CapsuleGeometry(.018,.444,12,32);
  const rearLeg=new THREE.CapsuleGeometry(.018,.934,12,32);
  function chair(x,z,angle) {
    const group=new THREE.Group();
    group.position.set(x,0,z);
    group.rotation.y=angle;
    group.name='Original learner chair';
    room.add(group);
    mesh(seatGeometry,mats.dark,group,0,.58,0);
    mesh(backGeometry,mats.white,group,0,.95,.29);
    for(const side of [-.25,.25]){
      mesh(frontLeg,mats.edge,group,side,.31,-.24);
      mesh(rearLeg,mats.edge,group,side,.555,.30);
    }
    return group;
  }
  chair(.8,2.06,0);               // Original chair: unchanged.
  chair(-.65,1.1,-Math.PI/2);     // Added parent chair beside the desk.
  chair(2.26,1.1,Math.PI/2);      // Added teacher chair opposite it.

  // Preserve the original cat teacher, asynchronously loaded just as on the
  // homepage. The new meeting room does not call any paid AI gateway.
  const teacher=createCatTeacher(()=>{});
  const teacherSpot=new THREE.Group();
  teacherSpot.position.set(-2.55,0,.35);
  teacher.group.position.set(0,.1,0);
  teacher.group.rotation.y=.25;
  teacherSpot.add(teacher.group);
  room.add(teacherSpot);
  let disposed=false;
  void Promise.resolve().then(()=>{ if(!disposed) return teacher.load(); }).catch(onError);
  const sky=createSpaceSky(scene,{compact:true});
  return {
    room,sky,teacher,
    update(time,dt,reducedMotion,xr) {
      sky.update(reducedMotion?0:dt);
      teacher.update(dt,{reducedMotion,xr,time:time/1000});
    },
    resize(height,pixelRatio) {sky.resize(height,pixelRatio);},
    dispose() {disposed=true;}
  };
}
