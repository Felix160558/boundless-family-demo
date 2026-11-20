import * as THREE from '../three.module.min.js';
import {REPORT_PAGES, createReportCanvas, paintReport} from './report.js?v=original-study-2';
import {createOriginalClassroom} from './original-classroom.js?v=meeting-no-cat-1';

const ROLE_DETAILS = Object.freeze({
  teacher: {label:'Teacher', color:0x9e8bea, seat:[2.26,1.32,1.10]},
  parent: {label:'Parent', color:0x6ab9c1, seat:[-.65,1.32,1.10]},
  student: {label:'Student', color:0xe5b78a, seat:[.8,1.32,2.06]},
});
const ROLES = Object.keys(ROLE_DETAILS);
const FONT = 'Arial, sans-serif';
const LOGO_URL = new URL('./assets/isp-program-mark.svg', import.meta.url).href;
const clamp = THREE.MathUtils.clamp;
const noOperation = () => {};

function validRole(role) { return Object.hasOwn(ROLE_DETAILS, role) ? role : 'teacher'; }
function seatHeading(role) {
  const [x,,z] = ROLE_DETAILS[role].seat;
  return Math.atan2(x, z + 3.5);
}

function readPosition(value, limit = 1.4) {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) return null;
  return new THREE.Vector3(...value.map(number=>clamp(number,-limit,limit)));
}
function readQuaternion(value) {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(Number.isFinite)) return null;
  const quaternion = new THREE.Quaternion(...value);
  return quaternion.lengthSq() > .01 ? quaternion.normalize() : null;
}

export function createMeetingScene(container, {
  role = 'teacher', onAction = noOperation, onPose = noOperation,
  onXRState = noOperation, onError = noOperation,
} = {}) {
  if (!container) throw new Error('The meeting scene container is missing.');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'}); }
  catch (error) { onError(error); throw error; }

  let disposed = false, localRole = validRole(role), pageIndex = 0, micEnabled = false;
  let xrSession = null, openingXR = false, alignXR = false, yaw = 0, pitch = -.025;
  let drag = null, previousFrame = 0, previousPose = 0, previousDesktopFrame = 0;
  const geometries = new Set(), materials = new Set(), textures = new Set(), eventCleanups = [];
  const roleState = new Map(ROLES.map(key=>[key,{role:key,connected:false,name:'',micEnabled:false,speaking:false,pose:null}]));
  const avatars = new Map(), controllers = [], buttonMeshes = [];
  const worldPosition = new THREE.Vector3(), worldQuaternion = new THREE.Quaternion();
  const seatPosition = new THREE.Vector3(), inverseSeatQuaternion = new THREE.Quaternion();
  const seatQuaternion = new THREE.Quaternion(), headForward = new THREE.Vector3();
  const raycaster = new THREE.Raycaster(), rayOrigin = new THREE.Vector3(), rayDirection = new THREE.Vector3();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  renderer.domElement.setAttribute('aria-hidden','true');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;';
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(61,1,.045,600);
  camera.rotation.order = 'YXZ';
  const rig = new THREE.Group();
  rig.add(camera);
  scene.add(rig);

  const material = (color, extra = {}) => {
    const result = new THREE.MeshStandardMaterial({color,roughness:.88,metalness:0,...extra});
    materials.add(result); return result;
  };
  const basic = (color, extra = {}) => {
    const result = new THREE.MeshBasicMaterial({color,...extra});
    materials.add(result); return result;
  };
  function mesh(geometry, surface, position, parent=scene) {
    geometries.add(geometry);
    const object=new THREE.Mesh(geometry,surface);
    if(position)object.position.set(...position);
    parent.add(object);return object;
  }
  function canvasTexture(canvas) {
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.minFilter=THREE.LinearFilter;
    texture.magFilter=THREE.LinearFilter;
    texture.generateMipmaps=false;
    textures.add(texture);
    return texture;
  }
  function makeTextCanvas(width,height) {
    const canvas=document.createElement('canvas');
    canvas.width=width;canvas.height=height;
    return canvas;
  }

  // The exact architectural design of the original Boundless Classroom:
  // glass walls/ceiling, floating circular stage, original desk and cat teacher.
  // Only two matching chairs are added beside the original learner chair.
  const classroom=createOriginalClassroom(scene,renderer);

  function makeAvatar(key) {
    const details = ROLE_DETAILS[key];
    const group = new THREE.Group();
    group.position.set(...details.seat);
    group.rotation.y=seatHeading(key);
    scene.add(group);
    const skin = material(0xd6dbe3);
    const clothing = material(details.color);
    const head = new THREE.Group();
    group.add(head);
    mesh(new THREE.SphereGeometry(.135,14,10),skin,[0,0,0],head);
    const faceMaterial=basic(0x24374a);
    mesh(new THREE.SphereGeometry(.012,6,4),faceMaterial,[-.046,.014,-.119],head);
    mesh(new THREE.SphereGeometry(.012,6,4),faceMaterial,[.046,.014,-.119],head);
    const torso=mesh(new THREE.CapsuleGeometry(.15,.23,4,10),clothing,[0,-.32,.025],group);
    torso.scale.set(1.18,1,.7);
    const leftHand=mesh(new THREE.SphereGeometry(.052,8,6),skin,[-.26,-.36,-.20],group);
    const rightHand=mesh(new THREE.SphereGeometry(.052,8,6),skin,[.26,-.36,-.20],group);
    const ringSurface=basic(details.color);
    const speakingRing=mesh(new THREE.TorusGeometry(.18,.009,5,28),ringSurface,[0,.22,0],group);
    speakingRing.rotation.x=Math.PI/2;
    const labelCanvas=makeTextCanvas(640,192);
    const labelTexture=canvasTexture(labelCanvas);
    const label=mesh(new THREE.PlaneGeometry(.72,.216),basic(0xffffff,{map:labelTexture}),[0,-.59,-.39],group);
    label.rotation.x=-.52;
    const targetHeadPosition=new THREE.Vector3(),targetHeadQuaternion=new THREE.Quaternion();
    const targetLeftPosition=new THREE.Vector3(-.26,-.36,-.20),targetRightPosition=new THREE.Vector3(.26,-.36,-.20);
    const avatar={group,head,torso,leftHand,rightHand,speakingRing,label,labelCanvas,labelTexture,labelKey:'',targetHeadPosition,targetHeadQuaternion,targetLeftPosition,targetRightPosition};
    avatars.set(key,avatar);
    return avatar;
  }
  ROLES.forEach(makeAvatar);

  // Keep the existing four-page report on the original physical whiteboard.
  const reportCanvas=createReportCanvas(0);
  const reportContext=reportCanvas.getContext('2d');
  const reportTexture=canvasTexture(reportCanvas);
  const reportPanel=mesh(new THREE.PlaneGeometry(4.29,2.41),
    basic(0xffffff,{map:reportTexture,toneMapped:false}),[0,2.24,-2.724],classroom.room);
  reportPanel.renderOrder=1;

  // Transparent ISP lettering, placed just over the original whiteboard.
  const logoTexture=new THREE.TextureLoader().load(LOGO_URL,loaded=>{
    if(disposed){loaded.dispose();return;}
    loaded.colorSpace=THREE.SRGBColorSpace;
    const aspect=loaded.image.width/loaded.image.height;
    logoPlate.scale.set(1.24,1.24/aspect,1);
  },undefined,()=>onError(new Error('The school wordmark could not load. Please refresh.')));
  textures.add(logoTexture);
  logoTexture.colorSpace=THREE.SRGBColorSpace;
  const logoPlate=mesh(new THREE.PlaneGeometry(1,1),
    basic(0xffffff,{map:logoTexture,toneMapped:false,transparent:true,alphaTest:.02,depthWrite:false}),
    [0,3.67,-2.70],classroom.room);
  logoPlate.scale.set(1.24,.30,1);

  const controlsGroup=new THREE.Group();
  scene.add(controlsGroup);
  controlsGroup.visible=false;
  const controls=[
    {action:'previous',label:'Previous'},
    {action:'next',label:'Next'},
    {action:'microphone',label:'Enable mic'},
    {action:'exit',label:'Exit VR'},
  ];
  for(const control of controls){
    const canvas=makeTextCanvas(640,224);
    const texture=canvasTexture(canvas);
    const button=mesh(new THREE.PlaneGeometry(.28,.098),basic(0xffffff,{map:texture,toneMapped:false}),[0,0,0],controlsGroup);
    button.userData={...control,canvas,texture,enabled:true,signature:''};
    buttonMeshes.push(button);
  }

  function paintButton(button,enabled,highlighted=false){
    const label=button.userData.action==='microphone'?(micEnabled?'Mute mic':'Enable mic'):button.userData.label;
    const signature=`${label}|${enabled}|${highlighted}`;
    if(signature===button.userData.signature)return;
    button.userData.signature=signature;button.userData.enabled=enabled;
    const ctx=button.userData.canvas.getContext('2d');
    ctx.fillStyle=enabled?(highlighted?'#4c4f80':'#22344e'):'#1b293a';ctx.fillRect(0,0,640,224);
    ctx.fillStyle=enabled?'#a497ef':'#465367';ctx.fillRect(0,0,640,7);
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`500 73px ${FONT}`;
    ctx.fillStyle=enabled?'#f0f2f7':'#7e8b9b';ctx.fillText(label,320,115,600);
    button.userData.texture.needsUpdate=true;
  }
  function refreshControls(){
    const shown=buttonMeshes.filter(button=>localRole==='teacher'||!['previous','next'].includes(button.userData.action));
    for(const button of buttonMeshes){
      button.visible=shown.includes(button);
      const action=button.userData.action;
      const enabled=action==='previous'?localRole==='teacher'&&pageIndex>0:action==='next'?localRole==='teacher'&&pageIndex<REPORT_PAGES.length-1:true;
      button.position.x=(shown.indexOf(button)-(shown.length-1)/2)*.305;
      paintButton(button,enabled);
    }
    const forward=new THREE.Vector3(0,0,-.88).applyQuaternion(seatQuaternion);
    controlsGroup.position.copy(seatPosition).add(forward);controlsGroup.position.y-=.49;
    controlsGroup.rotation.set(-.48,seatHeading(localRole),0,'YXZ');
  }

  function refreshAvatar(key){
    const state=roleState.get(key),avatar=avatars.get(key),details=ROLE_DETAILS[key];
    const isSelf=key===localRole;
    const present=isSelf||state.connected===true;
    avatar.head.visible=present&&!isSelf;
    avatar.torso.visible=present;
    avatar.leftHand.visible=present;avatar.rightHand.visible=present;
    avatar.speakingRing.visible=state.connected===true&&state.speaking===true&&!isSelf;
    const title=isSelf?`${details.label} · You`:state.connected?`${details.label}${state.name?' · '+String(state.name).slice(0,16):''}`:`Waiting for ${details.label.toLowerCase()}`;
    const subtitle=isSelf&&!state.connected?'Local preview':state.connected?(state.speaking?'Speaking':state.micEnabled?'Mic on':'Mic off'):'Not in the room';
    const labelKey=`${title}|${subtitle}|${present}`;
    if(labelKey!==avatar.labelKey){
      avatar.labelKey=labelKey;
      const ctx=avatar.labelCanvas.getContext('2d');
      ctx.fillStyle='#172638';ctx.fillRect(0,0,640,192);
      ctx.fillStyle=present?`#${details.color.toString(16).padStart(6,'0')}`:'#5b687b';ctx.fillRect(0,0,640,6);
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`500 47px ${FONT}`;ctx.fillStyle=present?'#edf1f5':'#9aa6b6';ctx.fillText(title,320,74,604);
      ctx.font=`400 31px ${FONT}`;ctx.fillStyle='#9aa9bc';ctx.fillText(subtitle,320,139,604);
      avatar.labelTexture.needsUpdate=true;
    }
    const pose=state.pose;
    if(pose&&typeof pose==='object'){
      const headPosition=readPosition(pose.head?.position,.65),headQuaternion=readQuaternion(pose.head?.quaternion);
      if(headPosition)avatar.targetHeadPosition.copy(headPosition);
      if(headQuaternion)avatar.targetHeadQuaternion.copy(headQuaternion);
      const left=readPosition(pose.leftHand?.position),right=readPosition(pose.rightHand?.position);
      if(left)avatar.targetLeftPosition.copy(left);
      if(right)avatar.targetRightPosition.copy(right);
    }else{
      avatar.targetHeadPosition.set(0,0,0);avatar.targetHeadQuaternion.identity();
      avatar.targetLeftPosition.set(-.26,-.36,-.20);avatar.targetRightPosition.set(.26,-.36,-.20);
    }
  }

  function setRole(nextRole){
    localRole=validRole(nextRole);
    seatPosition.set(...ROLE_DETAILS[localRole].seat);
    seatQuaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),seatHeading(localRole));
    inverseSeatQuaternion.copy(seatQuaternion).invert();
    yaw=0;pitch=-.025;
    if(xrSession)alignXR=true;
    else{
      rig.position.copy(seatPosition);rig.quaternion.copy(seatQuaternion);
      camera.position.set(0,0,0);camera.rotation.set(pitch,yaw,0,'YXZ');
    }
    ROLES.forEach(refreshAvatar);refreshControls();
  }
  function setParticipants(participants=[]){
    const supplied=new Map();
    for(const participant of participants){
      if(participant&&ROLES.includes(participant.role))supplied.set(participant.role,participant);
    }
    for(const key of ROLES){
      const value=supplied.get(key);
      roleState.set(key,{role:key,connected:value?.connected===true,name:typeof value?.name==='string'?value.name:'',micEnabled:value?.micEnabled===true&&value?.muted!==true,speaking:value?.speaking===true&&value?.muted!==true,pose:value?.pose||null});
      refreshAvatar(key);
    }
  }
  function setReportPage(value){
    const next=clamp(Math.trunc(Number(value)||0),0,REPORT_PAGES.length-1);
    if(next!==pageIndex){pageIndex=next;paintReport(reportContext,pageIndex,reportCanvas.width,reportCanvas.height);reportTexture.needsUpdate=true;}
    refreshControls();
  }
  function setMicState(enabled){
    micEnabled=Boolean(enabled);
    const state=roleState.get(localRole);state.micEnabled=micEnabled;
    refreshAvatar(localRole);refreshControls();
  }

  function activeHit(controller){
    controller.updateWorldMatrix(true,false);
    controller.getWorldPosition(rayOrigin);
    controller.getWorldQuaternion(worldQuaternion);
    rayDirection.set(0,0,-1).applyQuaternion(worldQuaternion);
    raycaster.set(rayOrigin,rayDirection);raycaster.far=3;
    return raycaster.intersectObjects(buttonMeshes.filter(button=>button.visible&&button.userData.enabled),false)[0]||null;
  }
  for(let index=0;index<2;index++){
    const controller=renderer.xr.getController(index);
    rig.add(controller);
    const lineGeometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]);
    const lineMaterial=new THREE.LineBasicMaterial({color:0xb9a8ff});
    geometries.add(lineGeometry);materials.add(lineMaterial);
    const line=new THREE.Line(lineGeometry,lineMaterial);line.scale.z=1.2;controller.add(line);
    const data={controller,line,source:null};controllers.push(data);
    const connected=event=>{data.source=event.data;};
    const disconnected=()=>{data.source=null;};
    const select=()=>{if(!xrSession)return;const hit=activeHit(controller);if(hit)onAction(hit.object.userData.action);};
    controller.addEventListener('connected',connected);controller.addEventListener('disconnected',disconnected);controller.addEventListener('selectstart',select);
    eventCleanups.push(()=>{controller.removeEventListener('connected',connected);controller.removeEventListener('disconnected',disconnected);controller.removeEventListener('selectstart',select);});
  }

  function resize(){
    if(disposed||renderer.xr.isPresenting)return;
    const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
    renderer.setSize(width,height,false);camera.aspect=width/height;
    camera.fov=width<640?69:61;camera.updateProjectionMatrix();
    classroom.resize(height,renderer.getPixelRatio());
  }
  const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;
  resizeObserver?.observe(container);
  if(!resizeObserver){window.addEventListener('resize',resize);eventCleanups.push(()=>window.removeEventListener('resize',resize));}

  const surface=renderer.domElement;
  const pointerDown=event=>{
    if(xrSession||event.button!==0)return;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY};surface.setPointerCapture(event.pointerId);
  };
  const pointerMove=event=>{
    if(!drag||drag.id!==event.pointerId||xrSession)return;
    yaw-=((event.clientX-drag.x)/Math.max(400,container.clientWidth))*2.4;
    pitch=clamp(pitch-(event.clientY-drag.y)/Math.max(400,container.clientHeight)*1.5,-.72,.72);
    drag.x=event.clientX;drag.y=event.clientY;camera.rotation.set(pitch,yaw,0,'YXZ');
  };
  const pointerEnd=event=>{if(drag?.id===event.pointerId)drag=null;};
  surface.addEventListener('pointerdown',pointerDown);surface.addEventListener('pointermove',pointerMove);
  for(const name of ['pointerup','pointercancel','lostpointercapture'])surface.addEventListener(name,pointerEnd);
  eventCleanups.push(()=>{surface.removeEventListener('pointerdown',pointerDown);surface.removeEventListener('pointermove',pointerMove);for(const name of ['pointerup','pointercancel','lostpointercapture'])surface.removeEventListener(name,pointerEnd);});

  function resetAfterXR(session){
    if(xrSession!==session)return;
    xrSession=null;alignXR=false;controlsGroup.visible=false;
    if(disposed)return;
    setRole(localRole);resize();
    onXRState({active:false,frameRate:null,supportedFrameRates:[]});
  }
  async function enterVR(){
    if(disposed)throw new Error('This meeting room is closed.');
    if(xrSession)return;
    if(openingXR)return;
    if(!globalThis.isSecureContext||!navigator.xr)throw new Error('Open this room over HTTPS in Quest Browser.');
    openingXR=true;
    let session;
    try{
      if(!await navigator.xr.isSessionSupported('immersive-vr'))throw new Error('Immersive VR is unavailable in this browser. Please use Quest Browser.');
      session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor']});
      if(disposed){await session.end();return;}
      let referenceType='local-floor';
      try{await session.requestReferenceSpace('local-floor');}catch{referenceType='local';}
      renderer.xr.setReferenceSpaceType(referenceType);
      xrSession=session;alignXR=true;drag=null;controlsGroup.visible=true;
      session.addEventListener('end',()=>resetAfterXR(session),{once:true});
      await renderer.xr.setSession(session);
      if(xrSession!==session)return;
      const supportedFrameRates=Array.from(session.supportedFrameRates||[]);
      if(supportedFrameRates.includes(72)&&typeof session.updateTargetFrameRate==='function'){
        try{await session.updateTargetFrameRate(72);}catch{/* Keep the supported runtime-selected refresh rate. */}
      }
      onXRState({active:true,frameRate:session.frameRate??null,supportedFrameRates});
    }catch(error){
      if(session){try{await session.end();}catch{}resetAfterXR(session);}
      onError(error);throw error;
    }finally{openingXR=false;}
  }
  async function exitVR(){if(xrSession)await xrSession.end();}

  function relativeTransform(object,positionLimit=1.4){
    object.getWorldPosition(worldPosition);object.getWorldQuaternion(worldQuaternion);
    const position=worldPosition.clone().sub(seatPosition).applyQuaternion(inverseSeatQuaternion);
    const quaternion=inverseSeatQuaternion.clone().multiply(worldQuaternion).normalize();
    return{position:position.toArray().map(value=>clamp(value,-positionLimit,positionLimit)),quaternion:quaternion.toArray()};
  }

  renderer.setAnimationLoop((time,xrFrame)=>{
    if(disposed||document.hidden&&!renderer.xr.isPresenting)return;
    const immersive=renderer.xr.isPresenting;
    if(!immersive&&time-previousDesktopFrame<1000/40)return;
    if(!immersive)previousDesktopFrame=time;
    const dt=Math.min(Math.max((time-previousFrame)/1000,0),.06);previousFrame=time;
    if(immersive&&alignXR&&xrFrame){
      const viewer=xrFrame.getViewerPose(renderer.xr.getReferenceSpace());
      if(viewer){
        const {position,orientation}=viewer.transform;
        worldQuaternion.set(orientation.x,orientation.y,orientation.z,orientation.w);
        headForward.set(0,0,-1).applyQuaternion(worldQuaternion);
        const trackedYaw=Math.atan2(-headForward.x,-headForward.z);
        rig.rotation.set(0,seatHeading(localRole)-trackedYaw,0);
        worldPosition.set(position.x,position.y,position.z).applyQuaternion(rig.quaternion);
        rig.position.copy(seatPosition).sub(worldPosition);rig.updateMatrixWorld(true);alignXR=false;
      }
    }
    const alpha=reducedMotion.matches?1:1-Math.exp(-dt*14);
    for(const [key,avatar] of avatars){
      if(key===localRole)continue;
      avatar.head.position.lerp(avatar.targetHeadPosition,alpha);
      avatar.head.quaternion.slerp(avatar.targetHeadQuaternion,alpha);
      avatar.leftHand.position.lerp(avatar.targetLeftPosition,alpha);
      avatar.rightHand.position.lerp(avatar.targetRightPosition,alpha);
      if(avatar.speakingRing.visible)avatar.speakingRing.position.copy(avatar.head.position).add(new THREE.Vector3(0,.22,0));
    }
    if(immersive){
      controlsGroup.updateWorldMatrix(true,true);
      const highlighted=new Set();
      for(const data of controllers){
        const hit=data.source?activeHit(data.controller):null;
        data.line.visible=Boolean(data.source);data.line.scale.z=hit?hit.distance:1.1;
        if(hit)highlighted.add(hit.object);
      }
      for(const button of buttonMeshes)if(button.visible)paintButton(button,button.userData.enabled,highlighted.has(button));
    }
    classroom.update(time,dt,reducedMotion.matches,immersive);
    renderer.render(scene,camera);
    if(time-previousPose>=1000/12&&!alignXR){
      previousPose=time;
      const viewedCamera=immersive?renderer.xr.getCamera():camera;
      const pose={head:relativeTransform(viewedCamera,.65)};
      if(immersive){
        for(const data of controllers){
          if(data.source?.handedness==='left')pose.leftHand=relativeTransform(data.controller);
          if(data.source?.handedness==='right')pose.rightHand=relativeTransform(data.controller);
        }
      }
      onPose(pose);
    }
  });

  function dispose(){
    if(disposed)return;
    disposed=true;classroom.dispose();resizeObserver?.disconnect();
    renderer.setAnimationLoop(null);
    if(xrSession)void xrSession.end().catch(noOperation);
    eventCleanups.forEach(cleanup=>cleanup());
    textures.forEach(texture=>texture.dispose());materials.forEach(surface=>surface.dispose());geometries.forEach(geometry=>geometry.dispose());
    renderer.dispose();renderer.domElement.remove();
  }

  setRole(localRole);resize();
  return{setRole,setParticipants,setReportPage,setMicState,enterVR,exitVR,resize,dispose};
}
