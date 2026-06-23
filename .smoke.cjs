/* Headless smoke test: stub THREE + DOM, boot the client offline, drive frames
   while teleporting the player to force chunk streaming load/unload. */
const fs = require('fs'), vm = require('vm');

// ---- minimal vector ----
class V3 {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}
  copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
  clone(){return new V3(this.x,this.y,this.z);}
  add(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  sub(v){this.x-=v.x;this.y-=v.y;this.z-=v.z;return this;}
  normalize(){return this;} multiplyScalar(){return this;}
  setScalar(s){this.x=this.y=this.z=s;return this;}
  distanceTo(v){return Math.hypot(this.x-v.x,this.y-v.y,this.z-v.z);}
  length(){return Math.hypot(this.x,this.y,this.z);}
}
class V2{constructor(x=0,y=0){this.x=x;this.y=y;}set(x,y){this.x=x;this.y=y;return this;}}

class Obj3D{
  constructor(){this.children=[];this.parent=null;this.position=new V3();this.rotation={x:0,y:0,z:0};
    this.scale=new V3(1,1,1);this.visible=true;this.userData={};this.material=null;this.geometry=null;this.name='';}
  add(o){if(o){o.parent=this;this.children.push(o);}return this;}
  remove(o){const i=this.children.indexOf(o);if(i>=0){this.children.splice(i,1);o.parent=null;}return this;}
  traverse(cb){cb(this);for(const c of this.children)c.traverse?c.traverse(cb):cb(c);}
  lookAt(){} updateMatrixWorld(){} setScalar(s){this.scale.setScalar(s);return this;}
  getWorldPosition(t){t=t||new V3();return t.copy(this.position);}
}
class Geometry{
  constructor(){this.attributes={position:{count:9,getX:()=>0,getY:()=>0,getZ:()=>0,setY(){},setX(){},setZ(){}}};}
  rotateX(){return this;} rotateY(){return this;} translate(){return this;}
  computeVertexNormals(){} setAttribute(){} dispose(){} center(){return this;}
}
class Material{constructor(o){Object.assign(this,o||{});} dispose(){}}

function geom(){return new Geometry();}
const THREE = {
  Scene:class extends Obj3D{constructor(){super();this.fog=null;}},
  Group:class extends Obj3D{},
  Mesh:class extends Obj3D{constructor(g,m){super();this.geometry=g;this.material=m;this.isMesh=true;}},
  Sprite:class extends Obj3D{constructor(m){super();this.material=m||{};this.isSprite=true;}},
  Line:class extends Obj3D{constructor(g,m){super();this.geometry=g;this.material=m;}},
  PerspectiveCamera:class extends Obj3D{constructor(){super();this.aspect=1;}updateProjectionMatrix(){}},
  WebGLRenderer:class{constructor(){this.domElement={addEventListener(){},style:{},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})};this.shadowMap={};}
    setSize(){}setPixelRatio(){}render(){}setClearColor(){}},
  WebGL1Renderer:class{constructor(){throw new Error('no');}},
  HemisphereLight:class extends Obj3D{}, DirectionalLight:class extends Obj3D{constructor(){super();this.shadow={mapSize:{width:0,height:0},camera:{}};}},
  AmbientLight:class extends Obj3D{}, PointLight:class extends Obj3D{},
  Vector2:V2, Vector3:V3,
  Color:class{constructor(){this.r=1;this.g=1;this.b=1;}setHex(){return this;}set(){return this;}},
  Fog:class{constructor(c,n,f){this.color=c;this.near=n;this.far=f;}},
  FogExp2:class{constructor(){}},
  Raycaster:class{constructor(){}setFromCamera(){}intersectObjects(){return [];}intersectObject(){return [];}},
  Float32BufferAttribute:class{constructor(){}},
  BufferAttribute:class{constructor(){}},
  CanvasTexture:class{constructor(){this.needsUpdate=false;}},
  Texture:class{constructor(){this.needsUpdate=false;}},
  DataTexture:class{constructor(){this.needsUpdate=false;}},
  TextureLoader:class{load(){return {};}},
  SpriteMaterial:Material, MeshBasicMaterial:Material, MeshToonMaterial:Material,
  MeshStandardMaterial:Material, MeshPhongMaterial:Material, LineBasicMaterial:Material, ShaderMaterial:Material,
  BoxGeometry:geom, CylinderGeometry:geom, SphereGeometry:geom, ConeGeometry:geom, PlaneGeometry:geom,
  CircleGeometry:geom, DodecahedronGeometry:geom, TorusGeometry:geom, BufferGeometry:Geometry,
  IcosahedronGeometry:geom, TetrahedronGeometry:geom, RingGeometry:geom, ExtrudeGeometry:geom, ShapeGeometry:geom,
  Shape:class{constructor(){}moveTo(){}lineTo(){}quadraticCurveTo(){}absarc(){}bezierCurveTo(){}},
  Path:class{constructor(){}absarc(){}},
  DoubleSide:2, BackSide:1, FrontSide:0, NearestFilter:0, RepeatWrapping:0, sRGBEncoding:0, AdditiveBlending:0,
  PCFSoftShadowMap:0, ACESFilmicToneMapping:0,
  Object3D:Obj3D,
  Box3:class{constructor(){}setFromObject(){return this;}getSize(t){return (t||new V3()).set(1,1,1);}getCenter(t){return t||new V3();}},
  Sphere:class{constructor(){}}, Matrix4:class{constructor(){}makeRotationY(){return this;}},
  Quaternion:class{constructor(){}}, Euler:class{constructor(){}}, Clock:class{getDelta(){return 0.016;}getElapsedTime(){return 0;}},
  CatmullRomCurve3:class{constructor(){}getPoints(){return [new V3()];}getPoint(){return new V3();}},
  GridHelper:class extends Obj3D{}, AxesHelper:class extends Obj3D{}, ArrowHelper:class extends Obj3D{},
  LOD:class extends Obj3D{addLevel(){}}, Points:class extends Obj3D{}, PointsMaterial:Material,
};

// ---- DOM stub ----
function makeCanvas(){
  const ctx={canvas:null,fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'',globalAlpha:1,
    fillRect(){},strokeRect(){},clearRect(){},beginPath(){},arc(){},moveTo(){},lineTo(){},stroke(){},fill(){},
    closePath(){},save(){},restore(){},clip(){},fillText(){},strokeText(){},measureText:()=>({width:10}),
    createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),
    drawImage(){},translate(){},rotate(){},scale(){},setTransform(){},rect(){},quadraticCurveTo(){},
    getImageData:()=>({data:new Uint8ClampedArray(4)}),putImageData(){},ellipse(){},arcTo(){},roundRect(){}};
  const el=makeEl('canvas'); el.width=150;el.height=150;el.getContext=()=>ctx;ctx.canvas=el;
  el.toDataURL=()=>'data:,'; return el;
}
function makeEl(tag){
  const e={tagName:(tag||'div').toUpperCase(),style:{setProperty(){}},dataset:{},children:[],classList:{
      _s:new Set(),add(...c){c.forEach(x=>this._s.add(x));},remove(...c){c.forEach(x=>this._s.delete(x));},
      toggle(c,f){const has=this._s.has(c);const on=f===undefined?!has:!!f;if(on)this._s.add(c);else this._s.delete(c);return on;},
      contains(c){return this._s.has(c);}},
    _html:'',textContent:'',value:'',checked:false,width:150,height:150,
    appendChild(c){this.children.push(c);return c;},removeChild(c){const i=this.children.indexOf(c);if(i>=0)this.children.splice(i,1);},
    setAttribute(){},getAttribute(){return null;},removeAttribute(){},
    addEventListener(){},removeEventListener(){},
    querySelector(){return makeEl('div');},querySelectorAll(){return [];},
    getContext(){return makeCanvas().getContext();},getBoundingClientRect:()=>({left:0,top:0,width:800,height:600,right:800,bottom:600}),
    focus(){},blur(){},click(){},closest(){return null;},insertBefore(c){this.children.push(c);return c;},
    remove(){if(this.parent){this.parent.removeChild(this);}},scrollIntoView(){},
    getContextAttributes(){return {};},
    requestPointerLock(){},requestFullscreen(){return Promise.resolve();},
  };
  Object.defineProperty(e,'innerHTML',{get(){return e._html;},set(v){e._html=v;}});
  Object.defineProperty(e,'firstChild',{get(){return e.children[0]||null;}});
  return e;
}
const elCache={};
const document={
  getElementById(id){return elCache[id]||(elCache[id]=(id.includes('canvas')||id==='minimap'||id==='wmcanvas'||id==='game')?makeCanvas():makeEl('div'));},
  createElement(tag){return tag==='canvas'?makeCanvas():makeEl(tag);},
  querySelector(){return makeEl('div');},querySelectorAll(){return [];},
  addEventListener(){},removeEventListener(){},
  body:makeEl('body'),documentElement:makeEl('html'),
  createElementNS(){return makeEl('div');},
  fonts:{add(){},ready:Promise.resolve()},
};
document.body.classList; document.documentElement.style.setProperty=()=>{};

const listeners={};
const window={
  innerWidth:1280,innerHeight:720,devicePixelRatio:1,
  addEventListener(t,f){(listeners[t]=listeners[t]||[]).push(f);},removeEventListener(){},
  requestAnimationFrame:(cb)=>{rafQ.push(cb);return rafQ.length;},cancelAnimationFrame(){},
  matchMedia:()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}),
  setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
  performance:{now:()=>nowMs},
  location:{href:'http://localhost/',protocol:'http:',host:'localhost',hostname:'localhost'},
  navigator:{userAgent:'node',maxTouchPoints:0,vibrate(){}},
  AudioContext:function(){return audioStub();},webkitAudioContext:function(){return audioStub();},
  localStorage:lsStub(),
  screen:{orientation:{lock:()=>Promise.resolve(),unlock(){}},width:1280,height:720},
  WebSocket:function(){this.send=()=>{};this.close=()=>{};this.readyState=0;},
  devicePixelRatio:1, alert(){}, prompt:()=>null, confirm:()=>true,
};
function audioStub(){
  const node={connect(){return node;},disconnect(){},start(){},stop(){},
    gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}},
    frequency:{value:440,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},
    type:'sine',Q:{value:1},detune:{value:0},buffer:null,loop:false,playbackRate:{value:1},onended:null,pan:{value:0}};
  return {createGain:()=>({...node,gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},cancelScheduledValues(){}}}),
    createOscillator:()=>({...node}),createBufferSource:()=>({...node}),
    createBuffer:()=>({getChannelData:()=>new Float32Array(256),numberOfChannels:1,length:256}),
    createBiquadFilter:()=>({...node}),createStereoPanner:()=>({...node}),createWaveShaper:()=>({...node}),
    createDynamicsCompressor:()=>({...node}),createConvolver:()=>({...node}),createAnalyser:()=>({...node,getByteFrequencyData(){}}),
    decodeAudioData:()=>Promise.resolve({}),destination:node,currentTime:0,sampleRate:44100,
    resume:()=>Promise.resolve(),suspend:()=>Promise.resolve(),state:'running',listener:{}};
}
function lsStub(){const m={};return{getItem:k=>k in m?m[k]:null,setItem:(k,v)=>{m[k]=String(v);},removeItem:k=>{delete m[k];},clear:()=>{for(const k in m)delete m[k];}};}

let rafQ=[], nowMs=0;

// ---- assemble sandbox ----
const sandbox={THREE,document,window,console,
  requestAnimationFrame:window.requestAnimationFrame,cancelAnimationFrame:window.cancelAnimationFrame,
  setTimeout:()=>0,clearTimeout:()=>{},setInterval:()=>0,clearInterval:()=>{},
  matchMedia:window.matchMedia,performance:window.performance,localStorage:window.localStorage,
  navigator:window.navigator,location:window.location,screen:window.screen,
  AudioContext:window.AudioContext,webkitAudioContext:window.webkitAudioContext,WebSocket:window.WebSocket,
  Image:function(){return {addEventListener(){},onload:null,onerror:null,set src(v){if(this.onload)this.onload();},get src(){return '';}};},
  alert:()=>{},prompt:()=>null,confirm:()=>true,Math,Date,JSON,Object,Array,String,Number,Boolean,
  isNaN,isFinite,parseInt,parseFloat,encodeURIComponent,decodeURIComponent,
  Uint8Array,Uint8ClampedArray,Float32Array,Int32Array,Uint32Array,ArrayBuffer,Map,Set,WeakMap,Promise,Symbol,Error,
};
sandbox.addEventListener=window.addEventListener; sandbox.removeEventListener=window.removeEventListener;
sandbox.dispatchEvent=()=>true; sandbox.getComputedStyle=()=>({getPropertyValue:()=>''});
sandbox.scrollTo=()=>{}; sandbox.focus=()=>{}; sandbox.innerWidth=1280; sandbox.innerHeight=720; sandbox.devicePixelRatio=1;
sandbox.globalThis=sandbox; sandbox.window=sandbox; sandbox.self=sandbox;
vm.createContext(sandbox);

function run(code,label){ try{ vm.runInContext(code,sandbox,{filename:label}); }catch(e){ console.error('LOAD FAIL ['+label+']:',e.message); console.error(e.stack.split('\n').slice(0,4).join('\n')); process.exit(1); } }

// load shared world-data + patchnotes (UMD assign to globalThis)
run(fs.readFileSync('shared/world-data.js','utf8'),'world-data.js');
run(fs.readFileSync('patchnotes.js','utf8'),'patchnotes.js');

// extract + run the inline engine script
const html=fs.readFileSync('index.html','utf8');
const m=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/i.exec(html);
run(m[1],'inline-engine');

// expose test hooks into the engine's top-level lexical scope
run('globalThis.__tp=function(x,z){player.pos.set(x,0,z);};'
  +'globalThis.__report=function(){return {chunks:chunks.size,trees:trees.length,ore:oreNodes.length,grass:grassTufts.length,enemies:enemies.length,half:HALF,scale:MAP.SCALE,towns:MAP.TOWNS.length};};','hooks');

// boot offline
try{ sandbox.startGame(false); }catch(e){ console.error('startGame FAIL:',e.message,'\n',e.stack.split('\n').slice(0,5).join('\n')); process.exit(1); }

// drive frames, teleporting the player far across the map to force chunk streaming
function frame(ms){ nowMs=ms; const q=rafQ; rafQ=[]; for(const cb of q){ try{cb(nowMs);}catch(e){ console.error('FRAME FAIL:',e.message,'\n',e.stack.split('\n').slice(0,6).join('\n')); process.exit(1);} } }
let t=0;
for(let i=0;i<8;i++){ frame(t+=160); }      // settle at spawn (chunks build)
// teleport across the map in steps
const stops=[[800,-630],[-875,385],[420,1155],[-1155,-840],[1365,455],[0,40]];
for(const [x,z] of stops){ sandbox.__tp(x,z); for(let i=0;i<6;i++) frame(t+=160); }

// report
const R=sandbox.__report?sandbox.__report():{};
console.log('SMOKE OK', JSON.stringify(R));
