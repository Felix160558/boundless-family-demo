/** Real, audio-only three-party WebRTC transport for the isolated prototype.
 * apiOrigin is the signaling server origin; an empty value never simulates peers.
 * Microphone capture is only requested by enableMicrophone().
 */
const LABELS={teacher:'老师',parent:'家长',student:'学生'};
const ERROR_TEXT={
  service_missing:'尚未配置联机会谈服务，当前仅可本地预览。',
  invalid_service:'会谈服务地址无效。',network:'暂时无法连接会谈服务，请检查网络。',
  room_not_found:'会谈室不存在或已结束，请向老师获取新的邀请。',room_expired:'本次会谈已到期，请重新创建会谈室。',
  invalid_invitation:'邀请链接无效，请使用对应身份的邀请链接。',role_taken:'这个身份已经有人进入，请使用另一个身份的邀请链接。',
  room_full:'会谈室已满。',session_expired:'连接已失效，正在尝试重新加入。',
  teacher_required:'只有老师可以控制共享报告。',invalid_page:'无法打开这一页。',
  rate_limited:'操作较频繁，请稍后再试。',server_busy:'会谈服务暂时繁忙，请稍后再试。',
  origin_not_allowed:'该网站尚未加入会谈服务的允许来源。',
  microphone_secure:'麦克风需要 HTTPS 安全连接，请通过安全网址进入。',
  microphone_unsupported:'此浏览器无法开启麦克风。',microphone_denied:'麦克风权限未开启，你仍可查看共享报告。',
  microphone_missing:'没有找到可用的麦克风。',microphone_busy:'麦克风暂时无法使用，请检查设备或其他应用。',
  not_joined:'请先进入会谈室。',webrtc_unavailable:'此浏览器不支持实时语音，可继续查看共享报告。',
  peer_connection:'一条语音连接未建立，请检查网络及中继服务配置。',
  invalid_response:'会谈服务返回了无法识别的响应。',
};
function errorOf(code,cause){return Object.assign(new Error(ERROR_TEXT[code] || '会谈连接发生问题，请稍后重试。'),{code,cause});}
function validPose(pose){
  try {
    const text=JSON.stringify(pose);if(!text || text.length>1800)return null;
    const value=JSON.parse(text);let count=0;
    function inspect(v,depth){
      if(++count>100 || depth>5)return false;
      if(typeof v==='number')return Number.isFinite(v)&&Math.abs(v)<=10000;
      if(typeof v==='boolean'||v===null)return true;
      if(Array.isArray(v))return v.length<=12&&v.every(x=>inspect(x,depth+1));
      if(v && typeof v==='object')return Object.keys(v).length<=12&&Object.entries(v).every(([k,x])=>!['__proto__','constructor','prototype'].includes(k)&&inspect(x,depth+1));
      return false;
    }
    return value && !Array.isArray(value)&&inspect(value,0) ? value:null;
  } catch{return null;}
}

class VoicePeer {
  constructor({id,polite,initiator,iceServers,send,onStream,onState,onPose,onError}){
    this.id=id;this.closed=false;this.send=send;this.onError=onError;this.polite=polite;
    this.makingOffer=false;this.ignoreOffer=false;this.settingAnswer=false;this.candidates=[];this.queue=Promise.resolve();
    this.sender=null;this.streamRevision=0;this.streamQueue=Promise.resolve();this.restarts=0;this.channel=null;
    this.pc=new RTCPeerConnection({iceServers});this.remote=new MediaStream();
    this.pc.ontrack=({track})=>{if(!this.remote.getTracks().some(t=>t.id===track.id))this.remote.addTrack(track);onStream(this.remote);};
    this.pc.onicecandidate=({candidate})=>{if(candidate&&!this.closed)this.send({candidate:candidate.toJSON()}).catch(e=>this.fail(e));};
    this.pc.onconnectionstatechange=()=>{
      if(this.closed)return;
      onState(this.pc.connectionState);
      if(this.pc.connectionState==='failed' && this.restarts++<2){try{this.pc.restartIce();}catch{}}
    };
    this.pc.onnegotiationneeded=async()=>{
      if(this.closed)return;
      try{
        this.makingOffer=true;await this.pc.setLocalDescription();
        if(!this.closed)await this.send({description:{type:this.pc.localDescription.type,sdp:this.pc.localDescription.sdp}});
      }catch(e){this.fail(e);}finally{this.makingOffer=false;}
    };
    const bind=channel=>{
      if(channel.label!=='pose'){channel.close();return;}
      this.channel=channel;
      channel.onmessage=event=>{
        if(typeof event.data!=='string'||event.data.length>1900)return;
        let v;try{v=JSON.parse(event.data);}catch{return;}
        const pose=validPose(v);if(pose)onPose(pose);
      };
    };
    this.pc.ondatachannel=({channel})=>bind(channel);
    if(initiator)bind(this.pc.createDataChannel('pose',{ordered:false,maxRetransmits:0}));
  }
  fail(error){if(!this.closed)this.onError(error);}
  setStream(stream){
    const revision=++this.streamRevision,track=stream?.getAudioTracks()[0] || null;
    const promise=this.streamQueue.then(async()=>{
      if(this.closed||revision!==this.streamRevision)return;
      if(this.sender)await this.sender.replaceTrack(track);
      else if(track)this.sender=this.pc.addTrack(track,stream);
    });
    this.streamQueue=promise.catch(()=>{});return promise;
  }
  receive(signal){this.queue=this.queue.then(()=>this.apply(signal)).catch(e=>this.fail(e));return this.queue;}
  async apply({description,candidate}){
    if(this.closed)return;
    if(description){
      const ready=!this.makingOffer&&(this.pc.signalingState==='stable'||this.settingAnswer);
      const collision=description.type==='offer'&&!ready;
      this.ignoreOffer=!this.polite&&collision;if(this.ignoreOffer){this.candidates=[];return;}
      this.settingAnswer=description.type==='answer';
      try{await this.pc.setRemoteDescription(description);}finally{this.settingAnswer=false;}
      if(this.closed)return;
      for(const item of this.candidates.splice(0))await this.pc.addIceCandidate(item);
      if(description.type==='offer'){
        await this.pc.setLocalDescription();
        if(!this.closed)await this.send({description:{type:this.pc.localDescription.type,sdp:this.pc.localDescription.sdp}});
      }
    }else if(candidate&&!this.ignoreOffer){
      if(!this.pc.remoteDescription){if(this.candidates.length<128)this.candidates.push(candidate);}
      else await this.pc.addIceCandidate(candidate);
    }
  }
  pose(value){if(this.channel?.readyState==='open'&&this.channel.bufferedAmount<8192)this.channel.send(JSON.stringify(value));}
  close(){this.closed=true;this.candidates=[];this.channel?.close();this.pc.close();this.remote.getTracks().forEach(t=>t.stop());}
}

export function createRoomClient({apiOrigin='',onState=()=>{},onParticipants=()=>{},onPage=()=>{},onPose=()=>{},onError=()=>{}}={}){
  let base='';
  if(apiOrigin){try{const u=new URL(apiOrigin,location.href);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw 0;base=u.origin;}catch{throw errorOf('invalid_service');}}
  const peers=new Map(),audioElements=new Map(),analysers=new Map();
  let session=null,joinDetails=null,people=[],cursor=0,generation=0,pollTimer=null,pollAbort=null,failures=0;
  let microphone=null,capturing=null,muted=true,audioContext=null,meterTimer=null,lastPose=0;
  let micQueue=Promise.resolve(),pageQueue=Promise.resolve();
  let state={phase:'idle',message:base?'尚未进入会谈室。':ERROR_TEXT.service_missing,micEnabled:false,muted:true,audioBlocked:false};
  const currentPeople=()=>people.map(p=>({...p,isLocal:p.peerId===session?.peerId,speaking:analysers.get(p.peerId)?.speaking===true,connectionState:p.peerId===session?.peerId?'connected':peers.get(p.peerId)?.pc.connectionState || 'connecting'}));
  const emitPeople=()=>onParticipants(currentPeople());
  const emitState=patch=>{state={...state,...patch,micEnabled:Boolean(microphone),muted};onState({...state});};
  const report=error=>{const e=typeof error?.code==='string'?error:errorOf('network',error);onError(e);return e;};
  function storageKey(roomId,role){return `isp_family_session_v1:${roomId}:${role}`;}
  function savedToken(roomId,role){try{return sessionStorage.getItem(storageKey(roomId,role)) || '';}catch{return '';}}
  function saveToken(roomId,role,token){try{if(token)sessionStorage.setItem(storageKey(roomId,role),token);else sessionStorage.removeItem(storageKey(roomId,role));}catch{}}
  async function request(path,body,{token=session?.token,signal,keepalive=false}={}){
    if(!base)throw errorOf('service_missing');
    const controller=signal?null:new AbortController();
    const timer=controller?setTimeout(()=>controller.abort(),12000):null;
    try{
      const response=await fetch(`${base}/api/${path}`,{
        method:body===undefined?'GET':'POST',headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},
        body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store',signal:signal || controller.signal,keepalive,
      });
      let value;try{value=await response.json();}catch{throw errorOf('invalid_response');}
      if(!response.ok)throw Object.assign(errorOf(value.error || 'network'),{status:response.status});
      return value;
    }catch(error){if(typeof error?.code==='string')throw error;throw errorOf('network',error);}finally{if(timer)clearTimeout(timer);}
  }
  function ensureAudioContext(){
    if(!audioContext){const Audio=globalThis.AudioContext || globalThis.webkitAudioContext;if(Audio){try{audioContext=new Audio();}catch{}}}
    return audioContext;
  }
  function meter(peerId,stream){
    const context=audioContext;if(!context||analysers.has(peerId)||!stream.getAudioTracks().length)return;
    try{
      const source=context.createMediaStreamSource(stream),analyser=context.createAnalyser();analyser.fftSize=256;source.connect(analyser);
      analysers.set(peerId,{source,analyser,buffer:new Uint8Array(256),speaking:false});
      if(!meterTimer)meterTimer=setInterval(()=>{
        let changed=false;
        for(const [id,item] of analysers){
          item.analyser.getByteTimeDomainData(item.buffer);let power=0;
          for(const v of item.buffer){const x=(v-128)/128;power+=x*x;}
          const p=people.find(person=>person.peerId===id);
          const speaking=Boolean(p?.micEnabled&&!p?.muted&&Math.sqrt(power/item.buffer.length)>.025);
          if(speaking!==item.speaking){item.speaking=speaking;changed=true;}
        }
        if(changed)emitPeople();
      },180);
    }catch{}
  }
  function removeMeter(id){const m=analysers.get(id);if(m){try{m.source.disconnect();m.analyser.disconnect();}catch{}analysers.delete(id);}}
  async function playAudio(audio){
    try{await audio.play();}catch{emitState({audioBlocked:true});}
  }
  function attachAudio(id,stream){
    let audio=audioElements.get(id);
    if(!audio){audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');audio.setAttribute('aria-hidden','true');audio.style.display='none';document.body.append(audio);audioElements.set(id,audio);}
    if(audio.srcObject!==stream)audio.srcObject=stream;
    meter(id,stream);void playAudio(audio);
  }
  function dropPeer(id){
    peers.get(id)?.close();peers.delete(id);removeMeter(id);
    const audio=audioElements.get(id);if(audio){audio.pause();audio.srcObject=null;audio.remove();audioElements.delete(id);}
  }
  function reconcile(next){
    people=next.map(p=>({...p}));
    const wanted=new Set(people.filter(p=>p.peerId!==session?.peerId).map(p=>p.peerId));
    for(const id of peers.keys())if(!wanted.has(id))dropPeer(id);
    if(globalThis.RTCPeerConnection&&session){
      for(const person of people){
        if(person.peerId===session.peerId||peers.has(person.peerId))continue;
        const g=generation,token=session.token,roomId=session.roomId;
        let peer;
        try { peer=new VoicePeer({id:person.peerId,polite:session.peerId.localeCompare(person.peerId)>0,initiator:session.peerId.localeCompare(person.peerId)<0,iceServers:session.iceServers || [],
          send:signal=>g===generation?request('signal',{roomId,target:person.peerId,signal},{token}):Promise.resolve(),
          onStream:stream=>{if(g===generation)attachAudio(person.peerId,stream);},
          onState:connection=>{if(g!==generation)return;emitPeople();if(connection==='failed')report(errorOf('peer_connection'));},
          onPose:pose=>{if(g===generation)onPose({peerId:person.peerId,role:person.role,pose});},
          onError:error=>{if(g===generation&&peers.has(person.peerId))report(error);},
        }); } catch(error) { report(errorOf('peer_connection',error)); continue; }
        peers.set(person.peerId,peer);
        if(microphone)void peer.setStream(microphone).catch(report);
      }
    }
    if(session&&microphone)meter(session.peerId,microphone);
    emitPeople();
  }
  async function publishMic(){
    if(!session)return;
    const current=session,g=generation;
    const local=people.find(p=>p.peerId===current.peerId);if(local){local.micEnabled=Boolean(microphone);local.muted=muted;emitPeople();}
    const payload={roomId:current.roomId,micEnabled:Boolean(microphone),muted};
    const update=micQueue.then(()=>g===generation?request('mic',payload,{token:current.token}):undefined);
    micQueue=update.catch(()=>{});await update;
    if(g===generation)emitState({});
  }
  function schedulePoll(g,ms=800){clearTimeout(pollTimer);pollTimer=setTimeout(()=>void poll(g),ms);}
  async function restore(g){
    if(!session||!joinDetails||g!==generation)return;
    const previous=session;
    const restored=await request('join',{...joinDetails,previousToken:previous.token},{token:null});
    if(g!==generation){void request('leave',{roomId:restored.roomId},{token:restored.token}).catch(()=>{});return;}
    for(const id of [...peers.keys()])dropPeer(id);removeMeter(previous.peerId);
    session=restored;cursor=restored.cursor;saveToken(restored.roomId,restored.role,restored.token);
    onPage(restored.page);reconcile(restored.participants);await publishMic();
  }
  async function poll(g){
    if(!session||g!==generation)return;
    const controller=new AbortController();pollAbort=controller;const timer=setTimeout(()=>controller.abort(),10000);
    try{
      const data=await request(`events?roomId=${encodeURIComponent(session.roomId)}&cursor=${cursor}`,undefined,{signal:controller.signal});
      if(g!==generation)return;
      if(data.resync){emitState({phase:'reconnecting',message:'正在恢复会谈状态…'});await restore(g);}
      else{
        cursor=data.cursor;
        for(const event of data.events || []){
          if(event.type==='participants')reconcile(event.payload);
          else if(event.type==='page')onPage(event.payload.page);
          else if(event.type==='signal')await peers.get(event.payload.from)?.receive(event.payload.signal);
        }
      }
      failures=0;emitState({phase:'connected',message:'已进入联机会谈室。'});schedulePoll(g);
    }catch(error){
      if(g!==generation||!session)return;
      if(error.code==='session_expired'){
        try{emitState({phase:'reconnecting',message:'正在重新加入会谈…'});await restore(g);failures=0;schedulePoll(g);return;}catch(rejoinError){error=rejoinError;}
      }
      if(['room_expired','room_not_found','invalid_invitation','role_taken','origin_not_allowed'].includes(error.code)||Date.now()>session.expiresAt){
        report(error);await leave();emitState({phase:'error',message:error.message});return;
      }
      failures++;emitState({phase:'reconnecting',message:'连接暂时中断，正在尝试恢复…'});schedulePoll(g,Math.min(8000,1000*2**Math.min(3,failures-1)));
    }finally{clearTimeout(timer);if(pollAbort===controller)pollAbort=null;}
  }
  async function createRoom({teacherId='',slot='',topic='家庭学习会谈'}={}){
    try{return await request('rooms',{teacherId,slot,topic},{token:null});}catch(error){throw report(error);}
  }
  async function join({roomId,role,ticket,name}={}){
    if(!base)throw report(errorOf('service_missing'));
    if(!Object.hasOwn(LABELS,role)||!ticket)throw report(errorOf('invalid_invitation'));
    if(session)await leave();
    const g=++generation;joinDetails={roomId:String(roomId || '').toUpperCase(),role,ticket,name:name || LABELS[role]};
    emitState({phase:'joining',message:'正在进入会谈室…',audioBlocked:false});
    ensureAudioContext();if(audioContext)void audioContext.resume().catch(()=>{});
    try{
      const joined=await request('join',{...joinDetails,previousToken:savedToken(joinDetails.roomId,role)},{token:null});
      if(g!==generation){void request('leave',{roomId:joined.roomId},{token:joined.token}).catch(()=>{});return null;}
      session=joined;cursor=joined.cursor;saveToken(joined.roomId,role,joined.token);onPage(joined.page);reconcile(joined.participants);
      emitState({phase:'connected',message:'已进入联机会谈室。'});
      if(!globalThis.RTCPeerConnection)report(errorOf('webrtc_unavailable'));
      schedulePoll(g,100);return joined;
    }catch(error){if(g===generation)emitState({phase:'error',message:error.message});throw report(error);}
  }
  async function enableMicrophone(){
    if(!session)throw report(errorOf('not_joined'));
    if(microphone){await setMuted(false);return microphone;}
    if(capturing)return capturing;
    if(!globalThis.isSecureContext)throw report(errorOf('microphone_secure'));
    if(!navigator.mediaDevices?.getUserMedia)throw report(errorOf('microphone_unsupported'));
    const g=generation;void resumeAudio();
    capturing=(async()=>{
      let stream;
      try{
        stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
        if(g!==generation||!session){stream.getTracks().forEach(t=>t.stop());return null;}
        microphone=stream;muted=false;
        stream.getAudioTracks()[0].addEventListener('ended',()=>{
          if(microphone!==stream)return;
          microphone=null;muted=true;removeMeter(session?.peerId);for(const peer of peers.values())void peer.setStream(null).catch(report);
          void publishMic().catch(report);emitState({});
        },{once:true});
        await Promise.all([...peers.values()].map(p=>p.setStream(stream).catch(report)));
        if(g!==generation||!session){stream.getTracks().forEach(t=>t.stop());return null;}
        meter(session.peerId,stream);emitState({});await publishMic().catch(report);return stream;
      }catch(error){
        if(g!==generation){stream?.getTracks().forEach(t=>t.stop());return null;}
        const code=(typeof error?.code==='string'?error.code:null) || ({NotAllowedError:'microphone_denied',NotFoundError:'microphone_missing',NotReadableError:'microphone_busy'}[error.name]) || 'microphone_busy';
        throw report(errorOf(code,error));
      }finally{if(g===generation)capturing=null;}
    })();return capturing;
  }
  async function setMuted(value){
    if(!session)throw report(errorOf('not_joined'));
    if(!microphone&&!value)return enableMicrophone();
    muted=Boolean(value);microphone?.getAudioTracks().forEach(t=>t.enabled=!muted);emitState({});
    try{await publishMic();}catch(error){report(error);}return muted;
  }
  async function setPage(page){
    if(!session)throw report(errorOf('not_joined'));
    if(session.role!=='teacher')throw report(errorOf('teacher_required'));
    const current=session,g=generation;
    const update=pageQueue.then(async()=>{
      if(g!==generation)return null;
      const result=await request('page',{roomId:current.roomId,page},{token:current.token});
      if(g===generation)onPage(result.page);return result.page;
    });
    pageQueue=update.catch(()=>{});
    try{return await update;}catch(error){throw report(error);}
  }
  function sendPose(value){
    if(!session)return;const now=performance.now();if(now-lastPose<80)return;
    const pose=validPose(value);if(!pose)return;lastPose=now;
    for(const peer of peers.values()){try{peer.pose(pose);}catch{}}
  }
  async function resumeAudio(){
    ensureAudioContext();if(audioContext){try{await audioContext.resume();}catch{}}
    let blocked=false;
    for(const [id,audio] of audioElements){try{await audio.play();if(audio.srcObject)meter(id,audio.srcObject);}catch{blocked=true;}}
    if(session&&microphone)meter(session.peerId,microphone);
    emitState({audioBlocked:blocked});return !blocked;
  }
  async function leave({preserveResume=false}={}){
    const previous=session;generation++;clearTimeout(pollTimer);pollTimer=null;pollAbort?.abort();pollAbort=null;
    session=null;joinDetails=null;cursor=0;failures=0;people=[];micQueue=Promise.resolve();pageQueue=Promise.resolve();
    microphone?.getTracks().forEach(t=>t.stop());microphone=null;muted=true;capturing=null;
    for(const id of [...peers.keys()])dropPeer(id);for(const id of [...analysers.keys()])removeMeter(id);
    clearInterval(meterTimer);meterTimer=null;if(audioContext){void audioContext.close().catch(()=>{});audioContext=null;}
    emitPeople();emitState({phase:'disconnected',message:'已离开会谈室。',audioBlocked:false});
    if(previous){if(!preserveResume)saveToken(previous.roomId,previous.role,'');try{await request('leave',{roomId:previous.roomId},{token:previous.token,keepalive:true});}catch{}}
  }
  function unload(){if(session)void leave({preserveResume:true});}
  globalThis.addEventListener('pagehide',unload);
  return {available:Boolean(base),createRoom,join,leave,enableMicrophone,setMuted,setPage,sendPose,resumeAudio,
    get connected(){return Boolean(session)&&state.phase==='connected';},
    get snapshot(){return session?{roomId:session.roomId,peerId:session.peerId,role:session.role,participants:currentPeople(),expiresAt:session.expiresAt}:null;},
    async dispose(){globalThis.removeEventListener('pagehide',unload);await leave();},
  };
}
