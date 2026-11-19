/**
 * ISP Family Meeting — dependency-free, ephemeral signaling server.
 * Serves the separate prototype and relays WebRTC setup messages only.
 * No original Boundless gateway, paid APIs, recording or stored student data.
 */
import {createServer} from 'node:http';
import {randomBytes, timingSafeEqual} from 'node:crypto';
import {readFile, stat, realpath} from 'node:fs/promises';
import {resolve, dirname, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Math.max(1, Math.min(65535, Number(process.env.PORT) || 8787));
const ROOM_TTL = Math.max(30, Math.min(720, Number(process.env.ROOM_TTL_MINUTES) || 90)) * 60000;
const PEER_TTL = 45000;
const MAX_ROOMS = 100;
const MAX_EVENTS = 600;
const ROLES = ['teacher', 'parent', 'student'];
const LABELS = {teacher:'老师', parent:'家长', student:'学生'};
const rooms = new Map();
const sessions = new Map();
const buckets = new Map();
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.glb':'model/gltf-binary','.bin':'application/octet-stream','.pdf':'application/pdf','.txt':'text/plain; charset=utf-8'};
function origin(value) {
  if (!value) return '';
  const u = new URL(value);
  if (!['http:', 'https:'].includes(u.protocol) || u.origin !== value.replace(/\/$/, '') || u.username || u.password) throw new Error('Use a plain HTTP(S) origin without a path.');
  return u.origin;
}
const PUBLIC_ORIGIN = origin(process.env.PUBLIC_ORIGIN || '');
const ALLOWED_ORIGINS = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map(v=>v.trim()).filter(Boolean).map(origin));
function readIceServers() {
  if (!process.env.ICE_SERVERS_JSON) return [];
  const value = JSON.parse(process.env.ICE_SERVERS_JSON);
  if (!Array.isArray(value) || value.length > 12) throw new Error('ICE_SERVERS_JSON must be an array with at most 12 server entries.');
  return value.map(item=>{
    const urls = Array.isArray(item?.urls) ? item.urls : [item?.urls];
    if (!urls.length || urls.length > 8 || urls.some(u=>typeof u !== 'string' || u.length > 500 || !/^(stun|stuns|turn|turns):/i.test(u))) throw new Error('Invalid ICE server URL.');
    const out = {urls};
    if (item.username !== undefined) out.username = String(item.username).slice(0,512);
    if (item.credential !== undefined) out.credential = String(item.credential).slice(0,1024);
    return out;
  });
}
const ICE_SERVERS = readIceServers();
const secret = () => randomBytes(24).toString('base64url');
const sameSecret = (a,b) => typeof a==='string' && typeof b==='string' && /^[A-Za-z0-9_-]{32}$/.test(a) && /^[A-Za-z0-9_-]{32}$/.test(b) && timingSafeEqual(Buffer.from(a),Buffer.from(b));
const clean = (value,length=80) => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,length);
function fail(code,status=400) { throw Object.assign(new Error(code),{code,status}); }
function send(res,status,value) {
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(JSON.stringify(value));
}
function event(room,type,payload,to=null) {
  const bytes=Buffer.byteLength(JSON.stringify(payload));
  room.events.push({seq:++room.sequence,type,payload,to,bytes});room.eventBytes+=bytes;
  while(room.events.length>MAX_EVENTS || room.eventBytes>524288) room.eventBytes-=room.events.shift().bytes;
}
function participants(room) {
  return [...room.peers.values()].map(p=>({peerId:p.id,role:p.role,name:p.name,micEnabled:p.micEnabled,muted:p.muted,connected:true}));
}
function publishPeople(room) { event(room,'participants',participants(room)); }
function removePeer(room,peer) {
  if(!room.peers.has(peer.id)) return;
  room.peers.delete(peer.id); sessions.delete(peer.token); publishPeople(room);
}
function expireRoom(room) {
  for(const peer of room.peers.values()) sessions.delete(peer.token);
  rooms.delete(room.id);
}
function prune() {
  const now=Date.now();
  for(const room of rooms.values()) {
    if(room.expiresAt<=now) { expireRoom(room); continue; }
    for(const peer of [...room.peers.values()]) if(now-peer.lastSeen>PEER_TTL) removePeer(room,peer);
  }
  for(const [key,b] of buckets) if(now-b.start>120000) buckets.delete(key);
}
setInterval(prune,15000).unref();
function rate(req,group,limit) {
  const key=`${req.socket.remoteAddress || 'unknown'}:${group}`,now=Date.now();
  let b=buckets.get(key);
  if(!b || now-b.start>60000) {b={start:now,count:0};buckets.set(key,b);}
  if(++b.count>limit) fail('rate_limited',429);
  if(buckets.size>3000) buckets.delete(buckets.keys().next().value);
}
function getRoom(id) {
  if(typeof id!=='string' || !/^[A-Z0-9]{10}$/.test(id)) fail('invalid_room');
  const room=rooms.get(id);
  if(!room) fail('room_not_found',404);
  if(room.expiresAt<=Date.now()) {expireRoom(room);fail('room_expired',410);}
  return room;
}
function auth(req,room) {
  const match=/^Bearer ([A-Za-z0-9_-]{32})$/.exec(req.headers.authorization || '');
  const record=match && sessions.get(match[1]);
  if(!record || record.roomId!==room.id) fail('session_expired',401);
  const peer=room.peers.get(record.peerId);
  if(!peer || peer.token!==match[1]) fail('session_expired',401);
  peer.lastSeen=Date.now();
  return peer;
}
async function json(req) {
  if(!String(req.headers['content-type'] || '').startsWith('application/json')) fail('json_required',415);
  const chunks=[];let bytes=0;
  for await(const chunk of req) {
    bytes+=chunk.length;if(bytes>98304) fail('body_too_large',413);
    chunks.push(chunk);
  }
  try {const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value || Array.isArray(value) || typeof value!=='object')fail('invalid_body');return value;}
  catch(error){if(error.code)throw error;fail('invalid_json');}
}
function cors(req,res) {
  const requestOrigin=req.headers.origin;
  if(!requestOrigin) return;
  const host=req.headers.host || '';
  if(requestOrigin!==PUBLIC_ORIGIN && requestOrigin!==`http://${host}` && requestOrigin!==`https://${host}` && !ALLOWED_ORIGINS.has(requestOrigin)) fail('origin_not_allowed',403);
  res.setHeader('access-control-allow-origin',requestOrigin);
  res.setHeader('vary','Origin');
  res.setHeader('access-control-allow-methods','GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers','Content-Type,Authorization');
  res.setHeader('access-control-max-age','600');
}
function safeSignal(value) {
  if(!value || typeof value!=='object') fail('invalid_signal');
  if(value.description) {
    const d=value.description;
    if(!['offer','answer'].includes(d.type) || typeof d.sdp!=='string' || d.sdp.length>65536) fail('invalid_signal');
    return {description:{type:d.type,sdp:d.sdp}};
  }
  if(value.candidate && typeof value.candidate.candidate==='string' && value.candidate.candidate.length<=4096) {
    const c=value.candidate;
    if(c.sdpMid!=null && (typeof c.sdpMid!=='string' || c.sdpMid.length>64)) fail('invalid_signal');
    if(c.sdpMLineIndex!=null && (!Number.isInteger(c.sdpMLineIndex) || c.sdpMLineIndex<0 || c.sdpMLineIndex>64)) fail('invalid_signal');
    if(c.usernameFragment!=null && (typeof c.usernameFragment!=='string' || c.usernameFragment.length>256)) fail('invalid_signal');
    return {candidate:{candidate:c.candidate,sdpMid:c.sdpMid ?? null,sdpMLineIndex:c.sdpMLineIndex ?? null,...(c.usernameFragment ? {usernameFragment:c.usernameFragment}: {})}};
  }
  fail('invalid_signal');
}
async function api(req,res,url) {
  cors(req,res);
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  rate(req,'api',900);
  const action=url.pathname.slice('/api/'.length);
  if(action==='health' && req.method==='GET') return send(res,200,{ok:true,service:'isp-family-meeting',version:1,iceConfigured:ICE_SERVERS.length>0});
  if(action==='events' && req.method==='GET') {
    const room=getRoom(url.searchParams.get('roomId')),peer=auth(req,room);
    const cursor=Number(url.searchParams.get('cursor') || 0);
    if(!Number.isSafeInteger(cursor) || cursor<0) fail('invalid_cursor');
    const oldest=room.events[0]?.seq ?? room.sequence;
    if(cursor>room.sequence || cursor<oldest-1) return send(res,200,{cursor:room.sequence,resync:true,events:[]});
    const events=room.events.filter(e=>e.seq>cursor && (!e.to || e.to===peer.id)).map(({seq,type,payload})=>({seq,type,payload}));
    return send(res,200,{cursor:room.sequence,events});
  }
  if(req.method!=='POST') fail('method_not_allowed',405);
  const body=await json(req);
  if(action==='rooms') {
    rate(req,'create',8);prune();
    if(rooms.size>=MAX_ROOMS) fail('server_busy',503);
    let id;do{id=randomBytes(7).toString('hex').slice(0,10).toUpperCase();}while(rooms.has(id));
    const tickets=Object.fromEntries(ROLES.map(role=>[role,secret()]));
    const room={id,tickets,teacherId:clean(body.teacherId,30),slot:clean(body.slot,50),topic:clean(body.topic,100),expiresAt:Date.now()+ROOM_TTL,peers:new Map(),sequence:0,events:[],eventBytes:0,page:0};
    rooms.set(id,room);
    return send(res,201,{roomId:id,invitations:tickets,expiresAt:room.expiresAt});
  }
  const room=getRoom(body.roomId);
  if(action==='join') {
    rate(req,'join',60);
    if(!ROLES.includes(body.role) || !sameSecret(body.ticket,room.tickets[body.role])) fail('invalid_invitation',403);
    let occupied=[...room.peers.values()].find(p=>p.role===body.role);
    if(occupied && Date.now()-occupied.lastSeen>PEER_TTL) {removePeer(room,occupied);occupied=null;}
    if(occupied) {
      if(sameSecret(body.previousToken,occupied.token)) removePeer(room,occupied);
      else fail('role_taken',409);
    }
    if(room.peers.size>=3) fail('room_full',409);
    const peer={id:secret(),token:secret(),role:body.role,name:clean(body.name,30)||LABELS[body.role],micEnabled:false,muted:true,lastSeen:Date.now()};
    room.peers.set(peer.id,peer);sessions.set(peer.token,{roomId:room.id,peerId:peer.id});publishPeople(room);
    return send(res,200,{roomId:room.id,peerId:peer.id,token:peer.token,role:peer.role,cursor:room.sequence,participants:participants(room),page:room.page,expiresAt:room.expiresAt,iceServers:ICE_SERVERS});
  }
  const peer=auth(req,room);
  if(action==='signal') {
    if(typeof body.target!=='string' || !room.peers.has(body.target) || body.target===peer.id) fail('peer_not_found',404);
    event(room,'signal',{from:peer.id,signal:safeSignal(body.signal)},body.target);
    return send(res,200,{ok:true});
  }
  if(action==='page') {
    if(peer.role!=='teacher') fail('teacher_required',403);
    if(!Number.isInteger(body.page) || body.page<0 || body.page>3) fail('invalid_page');
    room.page=body.page;event(room,'page',{page:room.page});return send(res,200,{page:room.page});
  }
  if(action==='mic') {
    peer.micEnabled=body.micEnabled===true;peer.muted=body.muted!==false || !peer.micEnabled;publishPeople(room);return send(res,200,{ok:true});
  }
  if(action==='leave') {removePeer(room,peer);return send(res,200,{ok:true});}
  fail('not_found',404);
}
async function staticFile(req,res,url) {
  if(!['GET','HEAD'].includes(req.method)) fail('method_not_allowed',405);
  let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{fail('invalid_path');}
  if(pathname.includes('\\') || pathname.includes('\0') || pathname.split('/').some(s=>s.startsWith('.') || ['server','node_modules'].includes(s))) fail('not_found',404);
  if(pathname==='/family/config.js') {
    const serviceOrigin=PUBLIC_ORIGIN || `${req.socket.encrypted ? 'https':'http'}://${req.headers.host}`;
    const code=`// Generated by the isolated prototype server.\nexport const familyConfig=Object.freeze(${JSON.stringify({signalingOrigin:serviceOrigin})});\n`;
    res.writeHead(200,{'content-type':'text/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(req.method==='HEAD' ? undefined : code);return;
  }
  let path=resolve(ROOT,`.${pathname}`);
  if(path!==ROOT && !path.startsWith(ROOT+sep)) fail('not_found',404);
  try {
    let info=await stat(path);if(info.isDirectory()){path=resolve(path,'index.html');info=await stat(path);}
    const canonical=await realpath(path);if(!canonical.startsWith(ROOT+sep))fail('not_found',404);
    const type=mime[extname(path).toLowerCase()];
    if(!info.isFile() || !type) fail('not_found',404);
    const data=await readFile(path);
    res.writeHead(200,{'content-type':type,'content-length':data.length,'cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
    res.end(req.method==='HEAD' ? undefined : data);
  } catch(error) {if(error.code==='ENOENT' || error.code==='ENOTDIR')fail('not_found',404);throw error;}
}
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url || '/',`http://${req.headers.host || 'localhost'}`);
    if(url.pathname.startsWith('/api/')) await api(req,res,url);
    else await staticFile(req,res,url);
  } catch(error) {
    if(!res.headersSent) send(res,error.status || 500,{error:error.status ? error.code : 'server_error'});
    else res.end();
    // Do not log request URLs, authorization headers, invitations or SDP.
  }
});
server.requestTimeout=15000;server.headersTimeout=12000;server.keepAliveTimeout=5000;
server.listen(PORT,HOST,()=>console.log(`ISP Family Meeting server listening on ${HOST}:${PORT}. Temporary demo rooms; no recording. ICE servers ${ICE_SERVERS.length ? 'configured':'not configured'}.`));
for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(()=>process.exit(0)));
