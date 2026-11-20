'use strict';

const canvas = document.querySelector('#city');
const ctx = canvas.getContext('2d');
const map = document.querySelector('#map');
const mapCtx = map.getContext('2d');
const mapBase = document.createElement('canvas');
mapBase.width = map.width;
mapBase.height = map.height;
const mode = document.querySelector('#mode');
const hint = document.querySelector('#hint');
const seedLabel = document.querySelector('#seed');

const blocks = 10;
const road = 108;
const lane = 13;
const carLength = 38;
const carWidth = 19;
const directions = [[1,0], [0,1], [-1,0], [0,-1]];
const roofs = ['#c5876e', '#8da6a6', '#c5aa79', '#85949f', '#aa8d9e', '#9fa383'];
const paints = ['#dc8469', '#77b8c1', '#daaf57', '#b0a2bf', '#d9d5c0', '#93b07b'];
const clothes = ['#b1ddf3', '#e29cb2', '#edcd90', '#b6e695'];
const keys = new Set();
const touchKeys = new Set();
const controlKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyE'];
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const distance = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
const point = (x,y) => ({x,y});
const rect = (x,y,w,h) => ({x,y,w,h});
const choose = (items, random) => items[Math.floor(random()*items.length)];
const moveTowards = (value,target,step) => value + clamp(target-value,-step,step);
let city, player, driving, random, width, height, pixelRatio;
let camera = point(0,0);
let message = '', messageTime = 0;

function seeded(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function streetPositions() {
  const positions = [72];
  for (let i=0; i<blocks; i++) positions.push(positions[i] + 288 + Math.floor(random()*125));
  return positions;
}

function connect(a,b) {
  a.links.push(b);
  b.links.push(a);
}

function makeCity(seed) {
  random = seeded(seed);
  const xs = streetPositions();
  const ys = streetPositions();
  const world = {
    xs, ys, w:xs[blocks]+72, h:ys[blocks]+72,
    lots:[], buildings:[], parked:[], walkers:[], traffic:[],
    junctions:new Map(), edges:[],
  };
  for (let j=0; j<=blocks; j++) {
    for (let i=0; i<=blocks; i++) {
      world.junctions.set(j*11+i, {x:xs[i],y:ys[j],i,j,out:[], owner:null});
    }
  }
  for (const node of world.junctions.values()) {
    directions.forEach(([dx,dy], heading) => {
      const i=node.i+dx, j=node.j+dy;
      if (i<0 || i>blocks || j<0 || j>blocks) return;
      const next = world.junctions.get(j*11+i);
      const start = point(node.x+dx*road/2+dy*lane, node.y+dy*road/2-dx*lane);
      const end = point(next.x-dx*road/2+dy*lane, next.y-dy*road/2-dx*lane);
      const edge = {node,next,start,end,dx,dy,angle:heading*Math.PI/2,length:distance(start,end)};
      node.out.push(edge);
      world.edges.push(edge);
    });
  }
  for(let j=0; j<blocks; j++) {
    for(let i=0; i<blocks; i++) {
      const x=xs[i]+road/2, y=ys[j]+road/2;
      const w=xs[i+1]-road/2-x, h=ys[j+1]-road/2-y;
      const park=random()<0.14;
      const corners = [[8,8],[w/2,8],[w-8,8],[w-8,h/2],[w-8,h-8],[w/2,h-8],[8,h-8],[8,h/2]];
      const walk = corners.map(([px,py]) => ({x:x+px,y:y+py,links:[]}));
      walk.forEach((node,k) => connect(node,walk[(k+1)%walk.length]));
      const lot = {...rect(x,y,w,h),park,walk,trees:[]};
      if(i>0) connect(walk[7],world.lots.at(-1).walk[3]);
      if(j>0) connect(walk[1],world.lots[(j-1)*blocks+i].walk[5]);
      world.lots.push(lot);
      if(park) {
        for(let k=0;k<8;k++) lot.trees.push(point(x+25+random()*(w-50),y+25+random()*(h-50)));
      } else {
        const columns=random()<0.64?2:1, rows=random()<0.48?2:1;
        for(let row=0;row<rows;row++) {
          for(let col=0;col<columns;col++) {
            const cw=(w-32)/columns, ch=(h-32)/rows;
            world.buildings.push({...rect(x+21+col*cw,y+21+row*ch,cw-12-random()*14,ch-12-random()*14),colour:choose(roofs,random)});
          }
        }
      }
      const angle = Math.PI;
      if(random()<0.5 || (i===5 && j===5)) {
        world.parked.push({x:x+w/2+46,y:y-15,angle,colour:choose(paints,random),speed:0});
      }
      if(random()<0.26) {
        world.parked.push({x:x-15,y:y+h/2+46,angle:Math.PI/2,colour:choose(paints,random),speed:0});
      }
      for(let k=0;k<2;k++) {
        const start=choose(walk,random);
        world.walkers.push({x:start.x,y:start.y,target:start,previous:null,pause:random()*3,speed:25+random()*22,colour:choose(clothes,random)});
      }
    }
  }
  world.buildingGrid = new Map();
  for (const building of world.buildings) {
    const left = Math.floor(building.x/160), right = Math.floor((building.x+building.w)/160);
    const top = Math.floor(building.y/160), bottom = Math.floor((building.y+building.h)/160);
    for (let j=top;j<=bottom;j++) {
      for (let i=left;i<=right;i++) {
        const key=j*100+i;
        if(!world.buildingGrid.has(key)) world.buildingGrid.set(key,[]);
        world.buildingGrid.get(key).push(building);
      }
    }
  }
  const available=world.edges.slice();
  for(let i=0;i<130;i++) {
    const index=Math.floor(random()*available.length);
    const [edge]=available.splice(index,1);
    const t=28+random()*(edge.length-56);
    world.traffic.push({
      x:edge.start.x+edge.dx*t,y:edge.start.y+edge.dy*t,
      angle:edge.angle,colour:choose(paints,random),edge,t,
      speed:42,cruise:61+random()*36,turn:null,next:null,
    });
  }
  return world;
}

function nearbyBuildings(x,y,r) {
  const found=new Set();
  for(let j=Math.floor((y-r)/160);j<=Math.floor((y+r)/160);j++) {
    for(let i=Math.floor((x-r)/160);i<=Math.floor((x+r)/160);i++) {
      for(const building of city.buildingGrid.get(j*100+i) || []) found.add(building);
    }
  }
  return found;
}

function spriteBox(x,y,angle,length=carLength,width=carWidth) {
  return {x,y,c:Math.cos(angle),s:Math.sin(angle),l:length/2,w:width/2};
}

function overlaps(a,b) {
  const dx=b.x-a.x, dy=b.y-a.y;
  if(Math.abs(dx)>a.l+a.w+b.l+b.w || Math.abs(dy)>a.l+a.w+b.l+b.w) return false;
  for(const [x,y] of [[a.c,a.s],[-a.s,a.c],[b.c,b.s],[-b.s,b.c]]) {
    const ra=a.l*Math.abs(x*a.c+y*a.s)+a.w*Math.abs(y*a.c-x*a.s);
    const rb=b.l*Math.abs(x*b.c+y*b.s)+b.w*Math.abs(y*b.c-x*b.s);
    if(Math.abs(x*dx+y*dy)>=ra+rb) return false;
  }
  return true;
}

function blocksCar(x,y,angle,ignore) {
  const car=spriteBox(x,y,angle);
  const rx=car.l*Math.abs(car.c)+car.w*Math.abs(car.s);
  const ry=car.l*Math.abs(car.s)+car.w*Math.abs(car.c);
  if(x-rx<0 || y-ry<0 || x+rx>city.w || y+ry>city.h) return true;
  for(const b of nearbyBuildings(x,y,24)) {
    if(overlaps(car,spriteBox(b.x+b.w/2,b.y+b.h/2,0,b.w,b.h))) return true;
  }
  for(const list of [city.parked,city.traffic]) {
    for(const other of list) {
      if(other!==ignore && Math.abs(x-other.x)<43 && Math.abs(y-other.y)<43 &&
         overlaps(car,spriteBox(other.x,other.y,other.angle))) return true;
    }
  }
  return false;
}

function blocksWalker(x,y) {
  if(x<6 || y<6 || x>city.w-6 || y>city.h-6) return true;
  for(const b of nearbyBuildings(x,y,6)) {
    if(x+6>b.x && x-6<b.x+b.w && y+6>b.y && y-6<b.y+b.h) return true;
  }
  const walker=spriteBox(x,y,0,12,12);
  return [city.parked,city.traffic,driving?[driving]:[]].some(list => list.some(car =>
    Math.abs(car.x-x)<31 && Math.abs(car.y-y)<31 && overlaps(walker,spriteBox(car.x,car.y,car.angle))));
}

function updateWalkers(dt) {
  for(const walker of city.walkers) {
    if(walker.pause>0) {
      walker.pause-=dt;
      continue;
    }
    const target=walker.target;
    const d=distance(walker,target);
    const step=walker.speed*dt;
    if(d<=step) {
      walker.x=target.x;
      walker.y=target.y;
      const options=target.links.filter(node=>node!==walker.previous);
      walker.target=choose(options.length?options:target.links,random);
      walker.previous=target;
      if(random()<0.19) walker.pause=0.5+random()*2;
    } else {
      walker.x+=(target.x-walker.x)*step/d;
      walker.y+=(target.y-walker.y)*step/d;
    }
  }
}

function turnShape(from,to) {
  const a=from.end,b=to.start;
  const c=point(a.x+from.dx*50,a.y+from.dy*50);
  const d=point(b.x-to.dx*50,b.y-to.dy*50);
  return {a,b,c,d,t:0,length:Math.max(70,distance(a,b)*1.15)};
}

function turnPose(turn,t) {
  const {a,b,c,d}=turn;
  const s=1-t;
  const x=s*s*s*a.x+3*s*s*t*c.x+3*s*t*t*d.x+t*t*t*b.x;
  const y=s*s*s*a.y+3*s*s*t*c.y+3*s*t*t*d.y+t*t*t*b.y;
  const dx=s*s*(c.x-a.x)+2*s*t*(d.x-c.x)+t*t*(b.x-d.x);
  const dy=s*s*(c.y-a.y)+2*s*t*(d.y-c.y)+t*t*(b.y-d.y);
  return {x,y,angle:Math.atan2(dy,dx)};
}

function trafficObstacle(car,x,y,angle) {
  const bounds=spriteBox(x,y,angle);
  return [city.traffic,city.parked,driving?[driving]:[]].some(list=>list.some(other=>
    other!==car && Math.abs(x-other.x)<42 && Math.abs(y-other.y)<42 &&
    overlaps(bounds,spriteBox(other.x,other.y,other.angle))));
}

function updateTraffic(dt) {
  for(const car of city.traffic) {
    const {edge}=car;
    let targetSpeed=car.cruise;
    if(car.turn) {
      targetSpeed=56;
    } else {
      for(const ahead of city.traffic) {
        if(ahead.edge!==edge || ahead.turn || ahead.t<=car.t) continue;
        targetSpeed=Math.min(targetSpeed,Math.max(0,(ahead.t-car.t-44)*2.6));
      }
      if(edge.length-car.t<65) {
        if(!car.next) {
          const options=edge.next.out.filter(next=>next.next!==edge.node);
          car.next=choose(options,random);
        }
        const occupied=city.traffic.some(other=>other.edge===car.next && other.t<46 && !other.turn);
        if(edge.next.owner || occupied) targetSpeed=Math.min(targetSpeed,Math.max(0,(edge.length-car.t)*3));
      }
    }
    car.speed=moveTowards(car.speed,targetSpeed,135*dt);
    if(car.turn) {
      const t=Math.min(1,car.turn.t+car.speed*dt/car.turn.length);
      const pose=turnPose(car.turn,t);
      if(trafficObstacle(car,pose.x,pose.y,pose.angle)) {
        car.speed=0;
        continue;
      }
      Object.assign(car,pose);
      car.turn.t=t;
      if(t===1) {
        edge.next.owner=null;
        car.edge=car.next;
        car.t=0;
        car.turn=null;
        car.next=null;
      }
      continue;
    }
    const t=Math.min(edge.length,car.t+car.speed*dt);
    const x=edge.start.x+edge.dx*t, y=edge.start.y+edge.dy*t;
    if(trafficObstacle(car,x,y,edge.angle)) {
      car.speed=0;
      continue;
    }
    Object.assign(car,{x,y,t});
    const exitClear=car.next && !city.traffic.some(other=>other.edge===car.next && other.t<46 && !other.turn);
    if(t>=edge.length-0.5 && !edge.next.owner && exitClear) {
      edge.next.owner=car;
      car.turn=turnShape(edge,car.next);
    }
  }
}

function nearestParked() {
  let best=null;
  let range=48;
  for(const car of city.parked) {
    const d=distance(player,car);
    if(d<range) {
      range=d;
      best=car;
    }
  }
  return best;
}

function notifyPlayer(text) {
  message=text;
  messageTime=2;
}

function interact() {
  if(driving) {
    if(Math.abs(driving.speed)>18) {
      notifyPlayer('Slow down to get out');
      return;
    }
    const {x,y,angle}=driving;
    for(const side of [1,-1]) {
      const exit=point(x-Math.sin(angle)*24*side,y+Math.cos(angle)*24*side);
      if(blocksWalker(exit.x,exit.y)) continue;
      player=exit;
      driving.speed=0;
      city.parked.push(driving);
      driving=null;
      messageTime=0;
      return;
    }
    notifyPlayer('Both sides are blocked');
    return;
  }
  const car=nearestParked();
  if(car) {
    city.parked.splice(city.parked.indexOf(car),1);
    driving=car;
    messageTime=0;
  }
}

function held(...codes) {
  return codes.some(code=>keys.has(code) || touchKeys.has(code));
}

function updatePlayer(dt) {
  const horizontal=Number(held('ArrowRight','KeyD'))-Number(held('ArrowLeft','KeyA'));
  const vertical=Number(held('ArrowUp','KeyW'))-Number(held('ArrowDown','KeyS'));
  if(driving) {
    const car=driving;
    const target=vertical>0?275:vertical<0?-105:0;
    car.speed=moveTowards(car.speed,target,(vertical?300:205)*dt);
    const steering=horizontal*2.7*clamp(car.speed/95,-1,1)*dt;
    const angle=car.angle+steering;
    const x=car.x+Math.cos(angle)*car.speed*dt;
    const y=car.y+Math.sin(angle)*car.speed*dt;
    if(blocksCar(x,y,angle,car)) {
      car.speed=0;
    } else {
      Object.assign(car,{x,y,angle});
    }
    return;
  }
  const length=Math.hypot(horizontal,vertical);
  if(!length) return;
  const x=player.x+horizontal*135*dt/length;
  const y=player.y-vertical*135*dt/length;
  if(!blocksWalker(x,player.y)) player.x=x;
  if(!blocksWalker(player.x,y)) player.y=y;
}

function updateCamera() {
  const target=driving || player;
  const marginX=width*0.32, marginY=height*0.32;
  camera.x=clamp(clamp(camera.x,target.x-width+marginX,target.x-marginX),0,Math.max(0,city.w-width));
  camera.y=clamp(clamp(camera.y,target.y-height+marginY,target.y-marginY),0,Math.max(0,city.h-height));
}

function fill(context,colour,x,y,w,h) {
  context.fillStyle=colour;
  context.fillRect(x,y,w,h);
}

function visible(x,y,w=0,h=0) {
  return x+w>=camera.x && y+h>=camera.y && x<=camera.x+width && y<=camera.y+height;
}

function drawStreets() {
  fill(ctx,'#303d43',0,0,city.w,city.h);
  for(let k=0;k<blocks;k++) {
    const left=city.xs[k]+road/2, right=city.xs[k+1]-road/2;
    const top=city.ys[k]+road/2, bottom=city.ys[k+1]-road/2;
    for(const y of city.ys) {
      if(!visible(left,y-road/2,right-left,road)) continue;
      for(let x=left+10;x<right-10;x+=30) fill(ctx,'#a6986b',x,y-1,14,2);
      fill(ctx,'#53616a',left,y-28,right-left,1);
      fill(ctx,'#53616a',left,y+28,right-left,1);
      if(y!==city.ys[0] && y!==city.ys[blocks]) {
        for(let mark=-45;mark<48;mark+=10) fill(ctx,'#788587',(left+right)/2-7,y+mark,14,4);
      }
    }
    for(const x of city.xs) {
      if(!visible(x-road/2,top,road,bottom-top)) continue;
      for(let y=top+10;y<bottom-10;y+=30) fill(ctx,'#a6986b',x-1,y,2,14);
      fill(ctx,'#53616a',x-28,top,1,bottom-top);
      fill(ctx,'#53616a',x+28,top,1,bottom-top);
      if(x!==city.xs[0] && x!==city.xs[blocks]) {
        for(let mark=-45;mark<48;mark+=10) fill(ctx,'#788587',x+mark,(top+bottom)/2-7,4,14);
      }
    }
  }
}

function drawLot({x,y,w,h,park,trees}) {
  fill(ctx,'#a5a49a',x,y,w,h);
  fill(ctx,'#717978',x+2,y+2,w-4,h-4);
  fill(ctx,park?'#58765e':'#626b67',x+15,y+15,w-30,h-30);
  for(const tree of trees) {
    fill(ctx,'#344f3e',tree.x-9,tree.y-7,22,22);
    fill(ctx,'#75956d',tree.x-11,tree.y-11,19,19);
  }
}

function drawBuilding({x,y,w,h,colour}) {
  fill(ctx,'#353f40',x+5,y+7,w,h);
  fill(ctx,'#495459',x,y,w,h);
  fill(ctx,colour,x,y,w-3,h-4);
  fill(ctx,'#ffffff29',x+4,y+4,w-11,3);
  fill(ctx,'#00000022',x+13,y+15,w-31,h-34);
  fill(ctx,'#414e50',x+w-32,y+17,14,9);
  fill(ctx,'#d2cec0',x+w-32,y+16,12,3);
}

function drawCar(car,highlight) {
  ctx.save();
  ctx.translate(car.x,car.y);
  ctx.rotate(car.angle);
  if(highlight) fill(ctx,'#f5e67b',-22,-12,44,24);
  fill(ctx,'#182025',-19,-9.5,38,19);
  fill(ctx,car.colour,-18,-8.5,36,17);
  fill(ctx,'#2d414b',3,-7,6,14);
  fill(ctx,'#42515a',-12,-7,4,14);
  fill(ctx,'#faf2c5',16,-7,2,4);
  fill(ctx,'#faf2c5',16,3,2,4);
  fill(ctx,'#ad4545',-18,-7,2,4);
  fill(ctx,'#ad4545',-18,3,2,4);
  ctx.restore();
}

function render() {
  ctx.setTransform(pixelRatio,0,0,pixelRatio,0,0);
  fill(ctx,'#1b2729',0,0,width,height);
  ctx.translate(-Math.round(camera.x),-Math.round(camera.y));
  drawStreets();
  for(const lot of city.lots) if(visible(lot.x,lot.y,lot.w,lot.h)) drawLot(lot);
  for(const b of city.buildings) if(visible(b.x,b.y,b.w+7,b.h+9)) drawBuilding(b);
  const nearby=driving?null:nearestParked();
  for(const list of [city.parked,city.traffic]) {
    for(const car of list) if(visible(car.x-25,car.y-25,50,50)) drawCar(car,car===nearby);
  }
  for(const p of city.walkers) {
    if(!visible(p.x-5,p.y-5,10,10)) continue;
    fill(ctx,'#30392f',p.x-3,p.y-2,10,11);
    fill(ctx,p.colour,p.x-4,p.y-5,8,10);
  }
  if(driving) {
    drawCar(driving,true);
  } else {
    fill(ctx,'#263034',player.x-7,player.y-7,14,14);
    fill(ctx,'#f5e67b',player.x-5,player.y-5,10,10);
  }
  const target=driving || player;
  mapCtx.drawImage(mapBase,0,0);
  const sx=map.width/city.w, sy=map.height/city.h;
  mapCtx.strokeStyle='#b9c4c45c';
  mapCtx.strokeRect(camera.x*sx,camera.y*sy,Math.min(width,city.w)*sx,Math.min(height,city.h)*sy);
  fill(mapCtx,'#f5e67b',target.x*sx-2.5,target.y*sy-2.5,5,5);
  const status=driving?'Driving':'On foot';
  if(mode.textContent!==status) mode.textContent=status;
  const prompt=messageTime>0?message:nearby?'Enter parked car':driving && Math.abs(driving.speed)<18?'Exit car':'';
  if(hint.textContent!==prompt) hint.textContent=prompt;
}

function resize() {
  width=canvas.clientWidth;
  height=canvas.clientHeight;
  pixelRatio=Math.min(devicePixelRatio || 1,2);
  canvas.width=Math.round(width*pixelRatio);
  canvas.height=Math.round(height*pixelRatio);
  updateCamera();
}

function restart(seed) {
  city=makeCity(seed);
  const starter=city.lots[5*blocks+5];
  player=point(starter.x+starter.w/2+46,starter.y+8);
  driving=null;
  messageTime=0;
  camera=point(player.x-width/2,player.y-height/2);
  updateCamera();
  seedLabel.textContent=seed.toString(36).toUpperCase();
  const sx=map.width/city.w, sy=map.height/city.h;
  const c=mapBase.getContext('2d');
  fill(c,'#48585e',0,0,map.width,map.height);
  for(const lot of city.lots) fill(c,lot.park?'#789279':'#aaa598',lot.x*sx,lot.y*sy,lot.w*sx,lot.h*sy);
  for(const b of city.buildings) fill(c,'#626869',b.x*sx,b.y*sy,b.w*sx,b.h*sy);
}

const freshSeed=()=>crypto.getRandomValues(new Uint32Array(1))[0];
const url=new URL(location.href);
const rawSeed=url.searchParams.get('seed');
function newCity() {
  const seed=freshSeed();
  url.searchParams.set('seed',String(seed));
  try { history.replaceState(null,'',url); } catch {}
  restart(seed);
}
document.querySelector('#new').addEventListener('click',newCity);
document.querySelector('#interact').addEventListener('click',interact);
for(const button of document.querySelectorAll('#new,#interact')) {
  button.addEventListener('click',event=>{ if(event.detail) button.blur(); });
}
for(const button of document.querySelectorAll('[data-key]')) {
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    touchKeys.add(button.dataset.key);
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']) {
    button.addEventListener(event,()=>touchKeys.delete(button.dataset.key));
  }
}
addEventListener('keydown',event=>{
  if(!controlKeys.includes(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
  event.preventDefault();
  keys.add(event.code);
  if(event.code==='KeyE' && !event.repeat) interact();
});
addEventListener('keyup',event=>keys.delete(event.code));
addEventListener('blur',()=>{
  keys.clear();
  touchKeys.clear();
});
addEventListener('resize',resize);
const initialSeed=Number(rawSeed);
width=canvas.clientWidth;
height=canvas.clientHeight;
restart(rawSeed && Number.isInteger(initialSeed) && initialSeed>=0 && initialSeed<=0xffffffff?initialSeed:18126);
resize();
let previous=performance.now();
let elapsed=0;
const tick=1/60;
function frame(now) {
  elapsed+=Math.min(0.083,(now-previous)/1000);
  previous=now;
  while(elapsed>=tick) {
    updatePlayer(tick);
    updateTraffic(tick);
    updateWalkers(tick);
    updateCamera();
    messageTime-=tick;
    elapsed-=tick;
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
