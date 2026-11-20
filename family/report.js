// Public, fictional slides inspired by the supplied ISP/AA meeting materials.
// Do not put student rosters, staff assignments or private school records
// from the reference decks into this public GitHub Pages prototype.
export const REPORT_TITLE = 'Family learning conversation';

export const REPORT_PAGES = Object.freeze([
  {
    type: 'compass',
    eyebrow: '01  /  THE LEARNER AT THE CENTRE',
    title: 'One learner. Three perspectives.',
    subtitle: 'A meeting that connects academic progress with personal growth.',
    sections: [
      {title:'Academic pathways',body:'Understand the learning journey, choices and current strengths.'},
      {title:'Guidance and goals',body:'Turn broad ambitions into a practical direction.'},
      {title:'Habits and support',body:'Build confidence, healthy routines and room to explore.'},
    ],
    footer:'A shared view makes the next conversation more useful.',
  },
  {
    type: 'pathway',
    eyebrow: '02  /  LEARNING PATHWAYS',
    title: 'A four-year view',
    subtitle: 'Explore early. Make informed choices. Review direction over time.',
    sections: [
      {title:'G9  ·  Explore',body:'Interests and strong foundations'},
      {title:'G10  ·  Build',body:'Study habits and pathway options'},
      {title:'G11  ·  Focus',body:'Subjects, projects and evidence'},
      {title:'G12  ·  Prepare',body:'Applications and next destinations'},
    ],
    footer:'Pathways vary; IGCSE foundations and A Level / IB options are examples.',
  },
  {
    type: 'balance',
    eyebrow: '03  /  WHOLE-PERSON EDUCATION',
    title: 'Learning happens everywhere',
    subtitle:'An illustrative 5 : 3 : 2 conversation model.',
    sections:[
      {title:'In class',body:'Subjects, understanding and English literacy.'},
      {title:'Beyond class',body:'Projects, exploration and shared experiences.'},
      {title:'At home',body:'Curiosity, reflection and family support.'},
    ],
    footer:'5 : 3 : 2 is a discussion model, not a prescribed schedule.',
  },
  {
    type: 'agreement',
    eyebrow: '04  /  MOVING FORWARD TOGETHER',
    title: 'Leave with one clear next step',
    subtitle:'Make the conversation specific, kind and achievable.',
    sections:[
      {title:'Teacher',body:'Explain progress clearly. Recommend one next action.'},
      {title:'Student',body:'Share one challenge. Choose a small goal to try.'},
      {title:'Parent',body:'Listen with care. Support one helpful routine.'},
    ],
    footer:'One action  •  One owner  •  One agreed check-in.',
  },
].map(page=>Object.freeze({...page,sections:Object.freeze(page.sections.map(part=>Object.freeze(part)))})));

const W=1600, H=720;
const COLORS={
  navy:'#17417f',
  cobalt:'#2459a4',
  purple:'#8062d7',
  ink:'#1c2c47',
  muted:'#65758b',
  paper:'#f8fafc',
  paleBlue:'#ebf3fc',
  palePurple:'#f0edfc',
  paleTeal:'#e6f4f1',
  teal:'#428f89',
  line:'#dbe4ee',
};
const accents=[COLORS.cobalt,COLORS.purple,COLORS.teal];

function roundedPath(ctx,x,y,w,h,r=18){
  const d=Math.min(r,w/2,h/2);
  ctx.beginPath();
  ctx.moveTo(x+d,y);ctx.lineTo(x+w-d,y);ctx.quadraticCurveTo(x+w,y,x+w,y+d);
  ctx.lineTo(x+w,y+h-d);ctx.quadraticCurveTo(x+w,y+h,x+w-d,y+h);
  ctx.lineTo(x+d,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-d);
  ctx.lineTo(x,y+d);ctx.quadraticCurveTo(x,y,x+d,y);ctx.closePath();
}
function roundedFill(ctx,x,y,w,h,r,color){
  roundedPath(ctx,x,y,w,h,r);ctx.fillStyle=color;ctx.fill();
}
function text(ctx,content,x,y,size=30,color=COLORS.ink,weight=400,align='left'){
  ctx.fillStyle=color;ctx.font=weight+' '+size+'px Arial, sans-serif';
  ctx.textAlign=align;ctx.textBaseline='alphabetic';ctx.fillText(content,x,y);
}
function wrap(ctx,content,x,y,maxWidth,size=29,leading=41,maxLines=3,color=COLORS.muted){
  ctx.font='400 '+size+'px Arial, sans-serif';
  const words=String(content).split(/\s+/),lines=[];
  let current='';
  for(const word of words){
    const candidate=current?current+' '+word:word;
    if(current&&ctx.measureText(candidate).width>maxWidth){lines.push(current);current=word;}
    else current=candidate;
  }
  if(current)lines.push(current);
  for(let i=0;i<Math.min(maxLines,lines.length);i++){
    text(ctx,lines[i],x,y+i*leading,size,color);
  }
}
function base(ctx,page,index){
  ctx.fillStyle=COLORS.paper;ctx.fillRect(0,0,W,H);
  ctx.fillStyle=COLORS.navy;ctx.fillRect(0,0,W,102);
  ctx.fillStyle=COLORS.purple;ctx.fillRect(0,0,13,102);
  text(ctx,'ISP',76,74,60,'#a88eff',800);
  text(ctx,'PROGRAM  /  SUIS QP',215,64,26,'#f0f2fc',700);
  text(ctx,'FAMILY LEARNING CONVERSATION',W-82,65,21,'#dfe9fa',500,'right');
  text(ctx,page.eyebrow,81,150,21,COLORS.cobalt,700);
  text(ctx,page.title,78,218,68,COLORS.ink,700);
  text(ctx,page.subtitle,81,269,29,COLORS.muted,400);
  ctx.strokeStyle=COLORS.line;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(82,651);ctx.lineTo(W-82,651);ctx.stroke();
  text(ctx,page.footer,82,686,24,COLORS.muted,400);
  text(ctx,String(index+1).padStart(2,'0')+' / 04',W-82,686,22,COLORS.cobalt,700,'right');
}
function card(ctx,{x,y,w,h,index,heading,body,accent,pale,number}){
  roundedFill(ctx,x,y,w,h,19,'#ffffff');
  ctx.strokeStyle=COLORS.line;ctx.lineWidth=2;roundedPath(ctx,x,y,w,h,19);ctx.stroke();
  roundedFill(ctx,x+22,y+23,74,61,12,pale);
  text(ctx,number||String(index+1).padStart(2,'0'),x+59,y+65,32,accent,800,'center');
  text(ctx,heading,x+26,y+146,34,COLORS.ink,700);
  wrap(ctx,body,x+26,y+201,w-55,28,42,3,COLORS.muted);
  roundedFill(ctx,x+26,y+h-31,w-52,5,2,accent);
}
function compass(ctx,page){
  const x0=79,gap=36,w=(W-158-gap*2)/3;
  page.sections.forEach((s,i)=>card(ctx,{x:x0+i*(w+gap),y:310,w,h:306,index:i,heading:s.title,body:s.body,accent:accents[i],pale:[COLORS.paleBlue,COLORS.palePurple,COLORS.paleTeal][i]}));
}
function pathway(ctx,page){
  const x0=78,gap=24,w=(W-156-gap*3)/4;
  page.sections.forEach((s,i)=>{
    const x=x0+i*(w+gap),y=307,h=307;
    roundedFill(ctx,x,y,w,h,16,'#ffffff');
    ctx.strokeStyle=COLORS.line;ctx.lineWidth=2;roundedPath(ctx,x,y,w,h,16);ctx.stroke();
    roundedFill(ctx,x+20,y+20,w-40,96,12,i===1||i===3?COLORS.palePurple:COLORS.paleBlue);
    const grade=['G9','G10','G11','G12'][i];
    text(ctx,grade,x+37,y+85,68,i===1||i===3?COLORS.purple:COLORS.cobalt,800);
    text(ctx,s.title.split('·')[1].trim(),x+25,y+172,38,COLORS.ink,700);
    wrap(ctx,s.body,x+25,y+225,w-49,28,41,2,COLORS.muted);
  });
}
function balance(ctx,page){
  const x=79,y=314,w=W-158,h=174;
  const colors=[COLORS.cobalt,COLORS.purple,COLORS.teal],ratios=[.5,.3,.2],figures=['5','3','2'],captions=['IN CLASS','BEYOND CLASS','AT HOME'];
  roundedPath(ctx,x,y,w,h,18);ctx.save();ctx.clip();
  let pos=x;
  for(let i=0;i<ratios.length;i++){
    const seg=w*ratios[i];
    ctx.fillStyle=colors[i];ctx.fillRect(pos,y,seg,h);
    text(ctx,figures[i],pos+seg/2,y+109,94,'#ffffff',800,'center');
    text(ctx,captions[i],pos+seg/2,y+145,23,'#f3f5ff',700,'center');
    pos+=seg;
  }
  ctx.restore();
  const col=(W-158-2*33)/3;
  page.sections.forEach((s,i)=>{
    const left=79+i*(col+33);
    text(ctx,s.title,left,552,30,colors[i],700);
    wrap(ctx,s.body,left,597,col-18,24,32,2,COLORS.muted);
  });
}
function agreement(ctx,page){
  const x0=79,gap=36,w=(W-158-gap*2)/3;
  page.sections.forEach((s,i)=>card(ctx,{x:x0+i*(w+gap),y:310,w,h:306,index:i,heading:s.title,body:s.body,accent:accents[i],pale:[COLORS.paleBlue,COLORS.palePurple,COLORS.paleTeal][i],number:['T','S','P'][i]}));
}
export function paintReport(context,pageIndex=0,width=1600,height=720){
  const index=Math.max(0,Math.min(REPORT_PAGES.length-1,Math.trunc(Number(pageIndex)||0)));
  const page=REPORT_PAGES[index];
  context.save();
  context.setTransform(width/W,0,0,height/H,0,0);
  context.clearRect(0,0,W,H);
  base(context,page,index);
  if(page.type==='compass')compass(context,page);
  else if(page.type==='pathway')pathway(context,page);
  else if(page.type==='balance')balance(context,page);
  else agreement(context,page);
  context.restore();
  return page;
}
export function createReportCanvas(pageIndex=0,{width=1600,height=720}={}){
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');
  if(!context)throw new Error('This browser cannot draw the family meeting slides.');
  paintReport(context,pageIndex,width,height);
  return canvas;
}
