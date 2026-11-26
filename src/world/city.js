import * as THREE from 'three';
import { G } from '../core/g.js';
import { GeoB, rng, hash, TAU, M4, clamp, V3 } from '../core/util.js';
import { N, PITCH, ROAD, BLOCK, HALF, EDGE, WATER_Y, roadC, blockC, MAP, DISTRICTS, POIS, POI, BANK_ROOF, SIGNS, VSIGNS, ADS, setOuterDistrict } from './citydata.js';
import { Outer, height as outerHeight, world } from './outer.js';
import { installCityPlus, inPark, PARK_EDGES, PARK_NODES } from './cityplus.js';

export const U = { uNight: { value: 0 }, uTime: { value: 0 }, uWet: { value: 0 }, uGlitch: { value: 0 } };
const NOISE = `
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return vn(p)*.55+vn(p*2.1+7.)*.28+vn(p*4.3+3.)*.17;}`;

// Shared material for buildings/ground slabs. aB = (style, seed, litFraction | glow, floorHeight)
export function makeBuildingMat() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, metalness: 0 });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 aB; flat varying vec4 vB; varying vec2 vM; varying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvB=aB; vM=uv; vWP=(modelMatrix*vec4(position,1.)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
      flat varying vec4 vB; varying vec2 vM; varying vec3 vWP; uniform float uNight,uTime,uWet,uGlitch; vec3 gEm=vec3(0.); float gR=.9, gMt=0.;${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      { int st=int(vB.x+.5); vec3 dc=diffuseColor.rgb; float sd=vB.y;
        if(st==1||st==2||st==3||st==4||st==10){
          float fh=max(vB.w,2.6); float ww= st==1?1.7: st==2?2.7: st==3?3.1: st==10?3.5: 4.6; bool shop=(st==4||st==10||st==3)&&vM.y<3.9;
          if(shop){ww=st==4?5.2:4.4;fh=3.9;}
          vec2 g=vec2(vM.x/ww,vM.y/fh),id=floor(g),f=fract(g),fw=fwidth(g)+1e-4; float lod=smoothstep(.35,1.1,max(fw.x,fw.y));
          vec4 r= shop?vec4(.07,.94,.1,.8): st==1?vec4(.05,.96,.12,.97): st==2?vec4(.14,.86,.24,.86): vec4(.27,.73,.3,.8);
          float w=smoothstep(r.x-fw.x,r.x+fw.x,f.x)*(1.-smoothstep(r.y-fw.x,r.y+fw.x,f.x))*smoothstep(r.z-fw.y,r.z+fw.y,f.y)*(1.-smoothstep(r.w-fw.y,r.w+fw.y,f.y));
          float cov=(r.y-r.x)*(r.w-r.z); w=mix(w,cov,lod);
          float rn=h21(id+sd*17.3); float on=step(1.-vB.z*(shop?1.6:1.),rn); on=mix(on,vB.z,lod*.8);
          if(st==10){ vec2 b=vec2(vM.x*2.2,vM.y*5.); b.x+=mod(floor(b.y),2.)*.5; vec2 bf=fract(b); float mort=step(.06,bf.x)*step(.12,bf.y); mort=mix(mort,1.,smoothstep(.1,.5,fwidth(b.y))); dc*=mix(.62,.85+.25*h21(floor(b)),mort);} else { float pn=step(.02,f.x)*step(.03,f.y); dc*=mix(.8,1.,max(pn,lod)); }
          dc*=.82+.3*vn(vM*.35+sd); dc*=.72+.28*smoothstep(0.,7.,vM.y+3.*vn(vM*.8));
          float frame=w; vec3 gl=mix(vec3(.05,.075,.1),dc*.22,.35);
          float fl=h21(id*3.1+sd); vec3 lc=fl<.55?vec3(1.,.78,.46): fl<.78?vec3(.72,.86,1.): fl<.87?vec3(1.,.35,.75): fl<.94?vec3(.25,1.,.85): vec3(.55,.35,1.);
          if(st==1) lc=mix(vec3(.75,.87,1.),lc,.4); sd=floor(sd);
          float ins=.55+.45*smoothstep(.1,.9,f.y)+.25*step(.5,h21(floor(vec2(f.x*5.,0.))+id)); float flick=step(.985,h21(id+sd+floor(uTime*.15)));
          float br=on*(1.-flick)*(.35+.75*h21(id*7.7+sd));
          if(shop){ float kind=h21(id*1.7+sd); lc=mix(lc,vec3(1.,.88,.7),.45); br=on*(.55+.5*h21(id+sd)); vec2 q=vec2(f.x,(f.y-.1)/.7);
            float mul=step(.02,abs(q.x-.5))*step(.02,abs(q.x-.25))*step(.02,abs(q.x-.75)); float shelf=step(.12,fract(q.y*4.)); float goods=step(.35,h21(floor(vec2(q.x*16.,q.y*4.))+id*3.))*step(.2,fract(q.x*16.)); vec3 gc=.35+.65*vec3(h21(floor(q*vec2(16.,4.))+1.),h21(floor(q*vec2(16.,4.))+2.),h21(floor(q*vec2(16.,4.))+3.));
            float ppl=smoothstep(.06,.03,abs(q.x-.3-.4*h21(id+9.)))*step(q.y,.62)+smoothstep(.05,.03,length((q-vec2(.3+.4*h21(id+9.),.7))*vec2(1.,.6)));
            if(kind<.16){ float sl=.5+.5*sin(q.y*70.); dc=mix(dc,vec3(.16,.17,.18)*(.6+.4*sl),frame); w=0.; frame=0.; br=0.; }
            else if(kind<.62){ ins=.22+.75*goods*shelf*step(q.y,.8)+.35*smoothstep(.75,1.,q.y); lc=mix(lc,lc*gc*1.4,goods*shelf); } else { ins=.4+.5*smoothstep(0.,1.,q.y); ins*=1.-.8*clamp(ppl,0.,1.)*step(.3,h21(id+4.)); }
            ins*=mix(1.,mul,1.-lod); }
          gEm+=lc*ins*br*frame*uNight*.72*(1.-uGlitch*step(.5,h21(id+floor(uTime*6.))));
          gEm+=lc*frame*(shop?.12:.0)*on*(1.-uNight);
          dc=mix(dc,gl,frame); gR=mix(.88,st==1?.08:.16,frame); gMt=mix(0.,st==1?.75:.5,frame);
          if(st==1){ float mull=step(.97,f.x)+step(.97,f.y); dc*=1.-.3*min(1.,mull)*(1.-lod);}
        } else if(st==0){ dc*=.84+.26*vn(vM*.5+sd); vec2 pf=fract(vM/vec2(3.2,2.4)); dc*=mix(.86,1.,max(step(.02,pf.x)*step(.02,pf.y),smoothstep(.02,.2,fwidth(vM.x)))); dc*=.8+.2*smoothstep(0.,3.,vWP.y); gR=.85; }
        else if(st==5||st==7){ float c=sin(vM.x*(st==7?20.:13.)); c=mix(c,0.,smoothstep(.02,.15,fwidth(vM.x))); dc*=.86+.16*c; dc*=.72+.4*fbm(vM*vec2(.8,.25)+sd); float rust=smoothstep(.55,.8,fbm(vM*.5+sd*3.)); dc=mix(dc,vec3(.23,.1,.05),rust*(st==7?.45:.35)); gR=.55; gMt=.45;
          if(st==5){ float wy=step(vB.w-1.8,vM.y)*step(vM.y,vB.w-.8)*step(.2,fract(vM.x/4.)); float on=step(.6,h21(floor(vec2(vM.x/4.,1.))+sd)); gEm+=vec3(1.,.8,.5)*wy*on*uNight*.9; dc=mix(dc,vec3(.06,.08,.1),wy);} }
        else if(st==6){ gEm=dc*vB.z*mix(.55,1.,uNight); dc*=.3; }
        else if(st==8){ dc*=.75+.35*vn(vWP.xz*1.7)+.1*vn(vWP.xz*9.); gR=mix(.95,.35,uWet*.7); }
        else if(st==9){ float n=fbm(vWP.xz*.25); dc=mix(vec3(.07,.13,.045),vec3(.13,.2,.06),n)*(.8+.4*vn(vWP.xz*6.)); gR=.95; }
        else if(st==11){ dc*=.85+.25*fbm(vWP.xz*.4)+.06*vn(vWP.xz*14.); float wl=smoothstep(.2,-1.4,vWP.y); dc*=1.-.45*wl; gR=mix(.95,.4,wl); }
        else if(st==12){ gEm=dc*vB.z*(.15+step(.6,fract(uTime*.7+sd))); dc*=.2; }
        else if(st==13){ dc=mix(vec3(.02,.2,.28),vec3(.1,.45,.5),vn(vWP.xz*1.4+uTime*.5)); gR=.06; gEm=dc*.5*uNight; }
        else if(st==14){ vec2 t=vWP.xz/2.; vec2 tf=fract(t); float j=step(.02,tf.x)*step(.02,tf.y); j=mix(j,1.,smoothstep(.1,.5,fwidth(t.x))); dc*=mix(.75,1.,j)*(.82+.16*h21(floor(t))+.14*fbm(vWP.xz*.6)); float pd=smoothstep(.5,.75,fbm(vWP.xz*.12+4.)); gR=mix(.92,mix(.55,.12,pd),uWet); dc*=1.-.35*uWet; }
        else if(st==16){ vec2 q=abs(fract(vWP.xz/2.)-.5); float l=smoothstep(.45,.5,max(q.x,q.y)); float pu=.6+.4*sin(uTime*2.+vWP.x*.3+vWP.z*.2); gEm=dc*(l*1.5*pu+.025); dc*=.06; gR=.25; }
        else if(st==17){ vec2 q=abs(fract(vM/vec2(2.,1.))-.5); float l=smoothstep(.45,.5,max(q.x,q.y)); float bit=step(.82,h21(floor(vM*vec2(2.,4.))+floor(uTime*2.))); gEm=dc*(l*4.+bit*2.2); dc*=.15; }
        else if(st==15){ vec2 q=vM; float s=sin(q.x*3.+uTime*2.)*.5+.5; gEm=dc*vB.z*(.4+.6*s); dc*=.1; }
        diffuseColor.rgb=dc; }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=gR;').replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nmetalnessFactor=gMt;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance+=gEm;');
  };
  return m;
}
function makeRoadMat() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95 });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP=(modelMatrix*vec4(position,1.)).xyz;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWP; uniform float uNight,uTime,uWet; float gR=.95; vec3 gEm=vec3(0.);${NOISE}
      float ln(float x,float c,float w){float f=fwidth(x);return 1.-smoothstep(w-f,w+f,abs(x-c));}`)
      .replace('#include <color_fragment>', `
      { vec2 wp=vWP.xz; vec2 p=mod(wp+${(HALF + 10).toFixed(1)},${PITCH.toFixed(1)}); bool rx=p.x<20., rz=p.y<20.; float n=fbm(wp*.35),n2=vn(wp*7.); vec3 c=vec3(.075,.077,.083)*(.75+.5*n)*(.86+.28*n2);
        float crack=smoothstep(.012,0.,abs(fbm(wp*.22+9.)-.5))*.5; c*=1.-crack; float patch_=step(.8,h21(floor(wp/vec2(7.,5.))))*.25; c*=1.-patch_*.6;
        float mk=0.,ye=0.;
        if(rx!=rz){ float a=rx?p.x:p.y, b=rx?p.y:p.x; float t=b-20.;
          ye=max(ln(a,9.75,.07),ln(a,10.25,.07)); float inl=step(6.,t)*step(t,84.); ye*=inl;
          float dash=step(.5,fract(b/6.)); mk=max(ln(a,5.4,.07),ln(a,14.6,.07))*dash*inl; mk=max(mk,ln(a,1.9,.05)*inl); mk=max(mk,ln(a,18.1,.05)*inl);
          float cw=step(.8,t)*step(t,3.8)+step(86.2,t)*step(t,89.2); mk=max(mk,cw*step(.5,fract(a/1.4)));
          mk=max(mk,step(5.,t)*step(t,5.5)*step(a,10.)*(rx?1.:0.)+step(84.5,t)*step(t,85.)*step(10.,a)*(rx?1.:0.)+step(5.,t)*step(t,5.5)*step(10.,a)*(rx?0.:1.)+step(84.5,t)*step(t,85.)*step(a,10.)*(rx?0.:1.)); }
        float man=length(mod(wp+vec2(21.,37.),vec2(43.,57.))-vec2(20.)); float mh=1.-smoothstep(.45,.5,man); c=mix(c,vec3(.035),mh*.8);
        float wear=.45+.55*smoothstep(.25,.6,fbm(wp*1.3+3.)); c=mix(c,vec3(.55),mk*wear*.75); c=mix(c,vec3(.62,.42,.06),ye*wear*.85);
        float pd=smoothstep(.46,.62,fbm(wp*.085+2.)); gR=mix(.9-.1*n2,mix(.42,.05,pd),uWet); c*=1.-uWet*mix(.3,.62,pd);
        diffuseColor.rgb=c; }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=gR;');
  };
  return m;
}
function signAtlas() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 2048; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 2048, 2048); x.textAlign = 'center'; x.textBaseline = 'middle';
  const fonts = ['900 80px Bahnschrift,Impact,sans-serif', 'italic 900 84px "Segoe UI",sans-serif', '900 82px Georgia,serif', '900 70px "Cascadia Mono",Consolas,monospace', '700 84px "Comic Sans MS",cursive'];
  for (let i = 0; i < 64; i++) {
    const cx = (i % 4) * 512, cy = Math.floor(i / 4) * 128; x.save(); x.translate(cx + 256, cy + 66); const t = SIGNS[i]; x.font = fonts[i % 5]; const w = x.measureText(t).width; const k = Math.min(1, 450 / w); x.scale(k, 1);
    x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(-250 / k, -60, 500 / k, 120); if (i % 3 === 0) { x.strokeStyle = '#fff'; x.lineWidth = 5; x.strokeRect(-244 / k, -54, 488 / k, 106); }
    x.shadowColor = '#fff'; x.shadowBlur = 18; if (i % 4 === 1) { x.strokeStyle = '#fff'; x.lineWidth = 4; x.strokeText(t, 0, 0); } else { x.fillStyle = '#fff'; x.fillText(t, 0, 0); } x.restore();
  }
  const tx = new THREE.CanvasTexture(c); tx.anisotropy = 4; tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
function vsignAtlas() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 2048, 1024); x.textAlign = 'center'; x.textBaseline = 'middle';
  VSIGNS.forEach((t, i) => { const cx = i * 128 + 64; x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(cx - 60, 4, 120, 1016); x.strokeStyle = '#fff'; x.lineWidth = 5; x.strokeRect(cx - 56, 8, 112, 1008); x.font = '900 110px Bahnschrift,Impact,sans-serif'; x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 16; const n = t.length, st = Math.min(150, 960 / n); for (let k = 0; k < n; k++) x.fillText(t[k], cx, 512 + (k - (n - 1) / 2) * st); x.shadowBlur = 0; });
  const tx = new THREE.CanvasTexture(c); tx.anisotropy = 4; tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
function adAtlas() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 1024; const x = c.getContext('2d'); x.textAlign = 'center'; x.textBaseline = 'middle';
  ADS.forEach((a, i) => {
    const px = (i % 4) * 512, py = Math.floor(i / 4) * 256; x.save(); x.beginPath(); x.rect(px, py, 512, 256); x.clip(); const g = x.createLinearGradient(px, py, px + 512, py + 256); g.addColorStop(0, a[3]); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(px, py, 512, 256);
    const r = rng(i + 9); x.globalAlpha = .28; for (let k = 0; k < 14; k++) { x.fillStyle = a[2]; const s = r.range(6, 90); if (r.chance(.5)) { x.beginPath(); x.arc(px + r.range(0, 512), py + r.range(0, 256), s / 2, 0, 7); x.fill(); } else x.fillRect(px + r.range(0, 512), py + r.range(0, 256), s * 2, 3); } x.globalAlpha = 1;
    x.fillStyle = a[2]; x.font = '900 74px Bahnschrift,Impact,sans-serif'; let k = Math.min(1, 460 / x.measureText(a[0]).width); x.save(); x.translate(px + 256, py + 100); x.scale(k, 1); x.fillText(a[0], 0, 0); x.restore(); x.fillStyle = '#fff'; x.font = '600 34px "Segoe UI",sans-serif'; k = Math.min(1, 470 / x.measureText(a[1]).width); x.save(); x.translate(px + 256, py + 176); x.scale(k, 1); x.fillText(a[1], 0, 0); x.restore(); x.restore();
  });
  const tx = new THREE.CanvasTexture(c); tx.anisotropy = 4; tx.colorSpace = THREE.SRGBColorSpace; return tx;
}
function textPlane(text, color, w, h) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 1024, 160); x.font = '900 112px Bahnschrift,Impact,sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = color; x.shadowBlur = 26; x.fillStyle = color; const k = Math.min(1, 980 / x.measureText(text).width); x.translate(512, 84); x.scale(k, 1); x.fillText(text, 0, 0); x.fillText(text, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide })); m.material.color.setScalar(1.15); return m;
}

const _sm = new THREE.Matrix4();
export class City {
  constructor(phys) {
    this.phys = phys; this.group = new THREE.Group(); this.buildings = []; this.atms = []; this.vending = []; this.boxes = []; this.cams = []; this.parking = []; this.smash = []; this.duckSpots = []; this.crates = []; this.rampSpots = []; this.treeSpots = []; this.lampSpots = [];
    this.inst = {}; this.noTraffic = new Set();
  }
  baseGround(x, z) {
    if (x > 3500) return 0; const d = Math.max(Math.abs(x), Math.abs(z)); if (d > 900) return outerHeight(x, z);
    if (d > EDGE) { return -Math.min(7, (d - EDGE) * .065); } if (inPark(x, z)) return .24;
    const a = (x + HALF + 10) % PITCH, b = (z + HALF + 10) % PITCH; return a > ROAD && b > ROAD && a < PITCH && b < PITCH && d < 725 ? .18 : 0;
  }
  onRoad(x, z) { if (Math.max(Math.abs(x), Math.abs(z)) > 725 || inPark(x, z)) return false; const a = (x + HALF + 10) % PITCH, b = (z + HALF + 10) % PITCH; return a < ROAD || b < ROAD; }
  queue(type, m, col) { (this.inst[type] = this.inst[type] || []).push([m, col]); return this.inst[type].length - 1; }
  build() {
    const ph = this.phys; ph.baseGround = (x, z, y) => this.baseGround(x, z);
    this.mat = makeBuildingMat(); this.signG = new GeoB(); this.vsignG = new GeoB(); this.adG = new GeoB();
    for (const k of PARK_EDGES) this.noTraffic.add(k); this.highways();
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) this.block(i, j);
    this.intersections(); this.outer(); this.bigPark(); this.instances(); this.signs(); this.skyTraffic(); G.world = world; setOuterDistrict(world.district); this.world = new Outer(this).build();
    const road = new THREE.Mesh(new THREE.PlaneGeometry(EDGE * 2, EDGE * 2).rotateX(-Math.PI / 2), makeRoadMat()); road.receiveShadow = true; this.group.add(road); this.road = road;
    return this;
  }
  mesh(gb, shadow = true) { if (gb.empty) return null; const m = new THREE.Mesh(gb.build(), this.mat); m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false; this.group.add(m); return m; }
  gb() { return new GeoB({ aB: 4 }); }
  // ---- one building tier with collider
  tier(g, x0, y0, z0, x1, y1, z1, style, seed, lit, fh, col) { g.color(col).set('aB', style, seed, lit, fh); g.box(x0, y0, z0, x1, y1, z1, { noTop: true }); g.color('#3a3d42').set('aB', 8, seed, 0, 0); g.box(x0, y0, z0, x1, y1, z1, { noSides: true }); this.phys.addBox(x0, y0, z0, x1, y1, z1); }
  parapet(g, x0, z0, x1, z1, y, col, R) { g.color(col).set('aB', 0, 1, 0, 0); const t = .35, h = .8; g.box(x0, y, z0, x1, y + h, z0 + t); g.box(x0, y, z1 - t, x1, y + h, z1); g.box(x0, y, z0, x0 + t, y + h, z1); g.box(x1 - t, y, z0, x1, y + h, z1); }
  roofStuff(g, x0, z0, x1, z1, y, R, d) {
    const w = x1 - x0, l = z1 - z0; if (w < 7 || l < 7) return; const n = R.int(1, 4);
    for (let k = 0; k < n; k++) { const x = R.range(x0 + 2, x1 - 3), z = R.range(z0 + 2, z1 - 3), t = R.int(0, 4); g.set('aB', 0, k, 0, 0);
      if (t < 2) { g.color('#8b9096').cbox(x, y + .7, z, 2, 1.4, 1.6); g.color('#2a2c30').cyl(x, y + 1.4, y + 1.55, z, .55, .55, 8); }
      else if (t === 2) { g.color('#5a4636').cyl(x, y + 1.2, y + 3.6, z, 1.2, 1.2, 10); g.color('#463628').cyl(x, y + 3.6, y + 4.5, z, 1.3, .05, 10); g.color('#333').cbox(x - .8, y + .6, z - .8, .15, 1.2, .15).cbox(x + .8, y + .6, z + .8, .15, 1.2, .15).cbox(x - .8, y + .6, z + .8, .15, 1.2, .15).cbox(x + .8, y + .6, z - .8, .15, 1.2, .15); }
      else if (t === 3) { const h = R.range(3, 9); g.color('#777').cbox(x, y + h / 2, z, .12, h, .12); g.cbox(x, y + h * .7, z, 1.6, .06, .06).cbox(x, y + h * .85, z, 1, .06, .06); if (y > 40) { g.color('#ff2020').set('aB', 12, R(), 4, 0).cbox(x, y + h, z, .3, .3, .3); } }
      else { g.color('#70757c').cbox(x, y + .5, z, R.range(2, 5), .9, .7); }
    }
  }
  sign(x, y, z, face, w, h, idx, col) { // face: 0 +z,1 -z,2 +x,3 -x
    const u0 = (idx % 4) / 4 + .004, u1 = (idx % 4 + 1) / 4 - .004, v1 = 1 - Math.floor(idx / 4) / 16 - .003, v0 = 1 - (Math.floor(idx / 4) + 1) / 16 + .003; this.faceQuad(this.signG, x, y, z, face, w, h, [u0, v0, u1, v0, u1, v1, u0, v1], col, 2.1);
  }
  faceQuad(g, x, y, z, f, w, h, uv, col, k) {
    const c = new THREE.Color(col); g.color(c.r * k, c.g * k, c.b * k); const a = w / 2, b = h / 2;
    if (f === 0) g.quad([x - a, y - b, z], [x + a, y - b, z], [x + a, y + b, z], [x - a, y + b, z], uv); else if (f === 1) g.quad([x + a, y - b, z], [x - a, y - b, z], [x - a, y + b, z], [x + a, y + b, z], uv);
    else if (f === 2) g.quad([x, y - b, z + a], [x, y - b, z - a], [x, y + b, z - a], [x, y + b, z + a], uv); else g.quad([x, y - b, z - a], [x, y - b, z + a], [x, y + b, z + a], [x, y + b, z - a], uv);
  }
  ad(x, y, z, f, w, h, idx) { const u = (idx % 4) / 4, v = 1 - (Math.floor(idx / 4) + 1) / 4; this.faceQuad(this.adG, x, y, z, f, w, h, [u, v, u + .25, v, u + .25, v + .25, u, v + .25], '#ffffff', 1.15); }
  vsign(x, y, z, axis, h, idx, col) { const w = h / 8, u0 = idx / 16 + .002, u1 = (idx + 1) / 16 - .002, uv = [u0, 0, u1, 0, u1, 1, u0, 1]; if (axis === 'x') { this.faceQuad(this.vsignG, x, y, z + .06, 0, w, h, uv, col, 2); this.faceQuad(this.vsignG, x, y, z - .06, 1, w, h, uv, col, 2); } else { this.faceQuad(this.vsignG, x + .06, y, z, 2, w, h, uv, col, 2); this.faceQuad(this.vsignG, x - .06, y, z, 3, w, h, uv, col, 2); } }
  highways() {
    const g = this.gb(), ph = this.phys; const deck = (x0, z0, x1, z1, y) => { g.color('#50545c').set('aB', 14, 1, 0, 0).box(x0, y - .9, z0, x1, y, z1, { bottom: true }); ph.addBox(x0, y - .9, z0, x1, y, z1); };
    const rail = (x0, z0, x1, z1, y) => { g.color('#80858c').set('aB', 0, 2, 0, 0).box(x0, y, z0, x1, y + .9, z1); ph.addBox(x0, y - .5, z0, x1, y + .9, z1, { noSight: true }); };
    this.decks = [];
    const line = (axis, c, y, a, b, rl) => {
      const hw = 6.5, X = (p, q, o) => axis === 'x' ? [p, c - o, q, c + o] : [c - o, p, c + o, q];
      for (let p = a; p < b; p += 20) { const q = Math.min(b, p + 20); const [x0, z0, x1, z1] = X(p, q, hw); deck(x0, z0, x1, z1, y); const lw = .3;
        if (axis === 'x') { rail(p, c - hw, q, c - hw + lw, y); rail(p, c + hw - lw, q, c + hw, y); g.color('#ffd24a').set('aB', 6, 0, 1.6, 0).box(p + 2, y + .9, c - hw, q - 2, y + 1, c - hw + .1).box(p + 2, y + .9, c + hw - .1, q - 2, y + 1, c + hw); } else { rail(c - hw, p, c - hw + lw, q, y); rail(c + hw - lw, p, c + hw, q, y); g.color('#40d0ff').set('aB', 6, 0, 1.6, 0).box(c - hw, y + .9, p + 2, c - hw + .1, y + 1, q - 2).box(c + hw - .1, y + .9, p + 2, c + hw, y + 1, q - 2); }
        const cr = ((p + 10 + HALF) % PITCH + PITCH) % PITCH; const near = Math.min(cr, PITCH - cr); g.color('#d8c040').set('aB', 0, 0, 0, 0); const mx = p + 7, my = p + 11; if (axis === 'x') g.box(mx, y, c - .1, my, y + .02, c + .1); else g.box(c - .1, y, mx, c + .1, y + .02, my);
        if (near > 14) { const px = axis === 'x' ? p + 10 : c, pz = axis === 'x' ? c : p + 10; g.color('#555960').set('aB', 0, 3, 0, 0).box(px - .7, 0, pz - .7, px + .7, y - .9, pz + .7); if (axis === 'x') g.box(px - .7, y - 2, c - 5, px + .7, y - .9, c + 5); else g.box(c - 5, y - 2, pz - .7, c + 5, y - .9, pz + .7); ph.addBox(px - .7, 0, pz - .7, px + .7, y - .9, pz + .7); } }
      for (const s of [0, 1]) { const p0 = s ? b : a - rl, p1 = s ? b + rl : a; const h0 = s ? y : 0, h1 = s ? 0 : y; const [x0, z0, x1, z1] = X(p0, p1, hw); ph.addRamp(x0, z0, x1, z1, axis, h0, h1); g.color('#50545c').set('aB', 14, 1, 0, 0);
        if (axis === 'x') { g.quad([x0, h0, z1], [x1, h1, z1], [x1, h1, z0], [x0, h0, z0]); g.color('#5a5e66').set('aB', 0, 1, 0, 0); g.quad([x0, 0, z1], [x1, 0, z1], [x1, h1, z1], [x0, h0, z1], [0, 0, rl, 0, rl, h1, 0, h0]); g.quad([x1, 0, z0], [x0, 0, z0], [x0, h0, z0], [x1, h1, z0], [0, 0, rl, 0, rl, h0, 0, h1]); }
        else { g.quad([x0, h1, z1], [x1, h1, z1], [x1, h0, z0], [x0, h0, z0]); g.color('#5a5e66').set('aB', 0, 1, 0, 0); g.quad([x1, 0, z1], [x1, 0, z0], [x1, h0, z0], [x1, h1, z1], [0, 0, rl, 0, rl, h0, 0, h1]); g.quad([x0, 0, z0], [x0, 0, z1], [x0, h1, z1], [x0, h0, z0], [0, 0, rl, 0, rl, h1, 0, h0]); }
        const n = Math.ceil(rl / 6); for (let k = 0; k < n; k++) { const q0 = p0 + k * rl / n, q1 = q0 + rl / n, hh = Math.min(h0 + (h1 - h0) * k / n, h0 + (h1 - h0) * (k + 1) / n) - .25; if (hh > .3) { const [a0, b0, a1, b1] = X(q0, q1, hw); ph.addBox(a0, 0, b0, a1, hh, b1); } const hm = Math.max(h0 + (h1 - h0) * k / n, h0 + (h1 - h0) * (k + 1) / n); if (hm > 1.2) { if (axis === 'x') { rail(q0, c - hw, q1, c - hw + .3, hm - .5); rail(q0, c + hw - .3, q1, c + hw, hm - .5); } else { rail(c - hw, q0, c - hw + .3, q1, hm - .5); rail(c + hw - .3, q0, c + hw, q1, hm - .5); } } } }
      this.decks.push({ axis, c, y, a, b });
    };
    line('x', roadC(4), 9, -600, 600, 100); line('z', roadC(9), 17, -540, 540, 160);
    for (const i of [0, 12]) { this.noTraffic.add(`h${i},4`); this.noTraffic.add(`v9,${i}`); } this.noTraffic.add('v9,1'); this.noTraffic.add('v9,11');
    this.mesh(g);
  }
  block(bi, bj) {
    if (MAP[bj][bi] === 'P') return; const d = MAP[bj][bi], cx = blockC(bi), cz = blockC(bj), R = rng(bi * 131 + bj * 977 + 5), g = this.gb(); const x0 = cx - 45, x1 = cx + 45, z0 = cz - 45, z1 = cz + 45;
    const pave = { D: '#83837f', N: '#5e5a66', C: '#5c676b', S: '#6d6962', H: '#8a8678', R: '#5a554e', P: '#77756a', B: '#9a8d74' }[d];
    g.color(pave).set('aB', 14, 0, 0, 0).box(x0, -.4, z0, x1, .18, z1);
    const poi = POIS.find(p => p.bx === bi && p.bz === bj); const lot = { x0: cx - 39, x1: cx + 39, z0: cz - 39, z1: cz + 39 };
    if (poi) this.poiBlock(poi, g, lot, R, d);
    else if (d === 'D') this.downtown(g, lot, R, cx, cz); else if (d === 'N') this.neon(g, lot, R, bi, bj); else if (d === 'C') this.circuit(g, lot, R); else if (d === 'S') this.sprawl(g, lot, R); else if (d === 'H') this.heights(g, lot, R, cx, cz); else if (d === 'R') this.rust(g, lot, R, bi, bj); else if (d === 'P') this.park(g, lot, R, cx, cz, bi, bj); else this.beach(g, lot, R);
    this.street(g, cx, cz, R, d, poi); const m = this.mesh(g); if (m) m.geometry.computeBoundingSphere();
  }
  // generic multi-tier building registered for the map
  bld(g, x0, z0, x1, z1, h, style, col, R, o = {}) {
    const seed = Math.floor(R() * 999), lit = o.lit ?? R.range(.25, .6), fh = o.fh ?? (style === 1 ? 3.6 : 3.3), y = .18; let ax = x0, bx = x1, az = z0, bz = z1, cy = y; const tiers = o.tiers || 1; const step = h / tiers;
    for (let t = 0; t < tiers; t++) { const top = t === tiers - 1 ? y + h : cy + step * R.range(.8, 1.1); this.tier(g, ax, cy, az, bx, top, bz, t && style === 4 ? 3 : style, seed, lit, fh, col); if (t === tiers - 1) { if (!o.noRoof) { this.parapet(g, ax, az, bx, bz, top, col, R); this.roofStuff(g, ax, az, bx, bz, top, R); } } cy = top; const s = R.range(2, 5); ax += s; bx -= s; az += s; bz -= s; if (bx - ax < 8 || bz - az < 8) { if (t < tiers - 1) { this.parapet(g, ax - s, az - s, bx + s, bz + s, cy, col, R); break; } } }
    this.buildings.push([x0, z0, x1, z1, h]); if (o.cornice) { g.color(col).set('aB', 0, 1, 0, 0).box(x0 - .4, y + h - 1.2, z0 - .4, x1 + .4, y + h - .5, z1 + .4, { bottom: true }); }
    if (o.base) { g.color(o.base).set('aB', 0, 2, 0, 0).box(x0 - .15, y, z0 - .15, x1 + .15, y + .9, z1 + .15); }
    return cy;
  }
  downtown(g, L, R, cx, cz) {
    const dist = Math.hypot(cx - 110, cz + 110), hm = clamp(1.15 - dist / 620, .3, 1); const cols = ['#5d7184', '#46586b', '#6f6a64', '#3e4a55', '#75706a', '#54606c', '#7c7264']; const n = R.int(0, 2); const mk = (a, b, c, e) => { const h = R.range(55, 175) * hm + 18, st = R.chance(.6) ? 1 : 2; this.bld(g, a, b, c, e, h, st, R.pick(cols), R, { tiers: R.int(1, 3), lit: R.range(.1, .34), base: '#2c2f34' }); if (R.chance(.5)) { const y = R.range(14, 30), f = R.int(0, 3); const px = f === 2 ? c + .2 : f === 3 ? a - .2 : (a + c) / 2, pz = f === 0 ? e + .2 : f === 1 ? b - .2 : (b + e) / 2; this.ad(px, y, pz, f, 16, 8, R.int(0, 15)); } if (R.chance(.4)) { g.color(R.pick(['#ffd24a', '#4ac8ff', '#ff4a9a', '#7affc0'])).set('aB', 6, 0, 2.2, 0); for (const [qx, qz] of [[a, b], [c, b], [a, e], [c, e]]) g.cbox(qx, h * .4, qz, .25, h * .7, .25); } };
    if (n === 0) mk(L.x0 + 6, L.z0 + 6, L.x1 - 6, L.z1 - 6); else if (n === 1) { if (R.chance(.5)) { mk(L.x0, L.z0, cx - 4, L.z1); mk(cx + 4, L.z0, L.x1, L.z1); } else { mk(L.x0, L.z0, L.x1, cz - 4); mk(L.x0, cz + 4, L.x1, L.z1); } } else for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) mk(a ? cx + 4 : L.x0, b ? cz + 4 : L.z0, a ? L.x1 : cx - 4, b ? L.z1 : cz - 4);
  }
  neon(g, L, R, bi, bj) {
    const cols = ['#4a3a4f', '#3d3848', '#5a3b40', '#344250', '#524636', '#403a5c'], nc = ['#ff2f9a', '#2ff0ff', '#ffd02f', '#8a4aff', '#4aff8a', '#ff5a2f']; const n = 3, w = 26;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { if (i === 1 && j === 1) continue; if (R.chance(.06)) { this.crates.push([L.x0 + i * w + 12, L.z0 + j * w + 12]); continue; } const a = L.x0 + i * w, b = L.z0 + j * w, pad = R.chance(.5) ? 1.2 : 0, x0 = a + pad * (i > 0), z0 = b + pad * (j > 0), x1 = a + w - pad * (i < 2), z1 = b + w - pad * (j < 2); const h = R.range(10, 46); this.bld(g, x0, z0, x1, z1, h, 4, R.pick(cols), R, { tiers: R.chance(.3) ? 2 : 1, lit: R.range(.35, .7) });
      const faces = []; if (j === 2) faces.push(0); if (j === 0) faces.push(1); if (i === 2) faces.push(2); if (i === 0) faces.push(3);
      for (const f of faces) { const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2; const px = f === 2 ? x1 + .25 : f === 3 ? x0 - .25 : mx, pz = f === 0 ? z1 + .25 : f === 1 ? z0 - .25 : mz; this.sign(px, 4.9, pz, f, R.range(8, 13), R.range(2, 3), R.int(0, 63), R.pick(nc)); if (R.chance(.65)) { const vh = Math.min(h - 3, R.range(7, 14)); if (vh > 5) { const o = f < 2 ? R.range(-9, 9) : 0, q = f > 1 ? R.range(-9, 9) : 0; const ox = f === 2 ? .8 : f === 3 ? -.8 : o, oz = f === 0 ? .8 : f === 1 ? -.8 : q; this.vsign(px + ox, 6.5 + vh / 2, pz + oz, f < 2 ? 'z' : 'x', vh, R.int(0, 15), R.pick(nc)); } } if (R.chance(.3) && h > 22) this.ad(px, h * .62, pz, f, 14, 7, R.int(0, 15)); g.color(R.pick(nc)).set('aB', 6, 0, 2.4, 0); const yy = .18 + 4.1; if (f === 0) g.box(x0, yy, z1, x1, yy + .12, z1 + .15); else if (f === 1) g.box(x0, yy, z0 - .15, x1, yy + .12, z0); else if (f === 2) g.box(x1, yy, z0, x1 + .15, yy + .12, z1); else g.box(x0 - .15, yy, z0, x0, yy + .12, z1); if (R.chance(.5)) { g.color(R.pick(['#5a2a3a', '#2a3a5a', '#3a5a3a'])).set('aB', 0, 0, 0, 0); if (f === 0) g.box(x0 + 3, 3.4, z1, x1 - 3, 3.55, z1 + 1.8, { bottom: true }); if (f === 1) g.box(x0 + 3, 3.4, z0 - 1.8, x1 - 3, 3.55, z0, { bottom: true }); } } }
  }
  circuit(g, L, R) {
    const cols = ['#3c5560', '#4a5a5a', '#56616a', '#2f4650', '#5a6658'], nc = ['#4affd0', '#4ac8ff', '#b0ff4a', '#ff8a4a']; const w = 78 / 2, l = 78 / 3;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) { const x0 = L.x0 + i * w + (i ? 2 : 0), z0 = L.z0 + j * l + (j ? 1 : 0), x1 = L.x0 + (i + 1) * w - (i ? 0 : 2), z1 = L.z0 + (j + 1) * l - (j < 2 ? 1 : 0), h = R.range(14, 62); this.bld(g, x0, z0, x1, z1, h, R.pick([1, 3, 4, 4]), R.pick(cols), R, { tiers: R.int(1, 2), lit: .5 }); const f = i ? 2 : 3, px = i ? x1 + .25 : x0 - .25; this.sign(px, 5, (z0 + z1) / 2, f, 11, 2.4, R.int(0, 63), R.pick(nc)); if (R.chance(.45)) this.vsign(px + (i ? .7 : -.7), 13, (z0 + z1) / 2 + R.range(-8, 8), 'x', 10, R.int(0, 15), R.pick(nc)); g.color(R.pick(nc)).set('aB', 15, 0, 2, 0); if (R.chance(.6)) { const xx = i ? x1 : x0 - .2; g.box(xx, 6, z0 + 2, xx + .2, Math.min(h, 24), z0 + 2.25); } }
  }
  sprawl(g, L, R) {
    const cols = ['#7a4a38', '#8a5f48', '#6a5a4a', '#7d6a50', '#5f4a40', '#6d6256', '#80705c']; const tall = R.chance(.3);
    if (tall) { for (const s of [0, 1]) for (const q of [0, 1]) { if (R.chance(.15)) { this.lotYard(g, L, s, q, R); continue; } const x0 = s ? 6 + (L.x0 + L.x1) / 2 : L.x0, z0 = q ? 6 + (L.z0 + L.z1) / 2 : L.z0, x1 = s ? L.x1 : -6 + (L.x0 + L.x1) / 2, z1 = q ? L.z1 : -6 + (L.z0 + L.z1) / 2; this.bld(g, x0, z0, x1, z1, R.range(16, 34), R.pick([10, 3]), R.pick(cols), R, { lit: R.range(.3, .55), cornice: true }); this.escapes(g, x0, x1, z1, R); } return; }
    for (let i = 0; i < 4; i++) for (const q of [0, 1]) { const w = 78 / 4, x0 = L.x0 + i * w + .8, x1 = x0 + w - 1.6, z0 = q ? L.z1 - 24 : L.z0 + 3, z1 = q ? L.z1 - 3 : L.z0 + 24, h = R.range(6.5, 11), c = R.pick(cols); if (R.chance(.1)) { this.duckSpots.push([(x0 + x1) / 2, .4, (z0 + z1) / 2]); continue; }
      this.bld(g, x0, z0, x1, z1, h, 10, c, R, { lit: .45, noRoof: true, fh: 3.2 }); const y = h + .18, mx = (x0 + x1) / 2, rh = R.range(2, 3.6); if (R.chance(.7)) { g.color(R.pick(['#4a2f28', '#3a3c42', '#54402e', '#2f3a3a'])).set('aB', 5, R() * 9, 0, 99); g.quad([x0 - .4, y, z1 + .4], [mx, y + rh, z1 + .4], [mx, y + rh, z0 - .4], [x0 - .4, y, z0 - .4]); g.quad([mx, y + rh, z1 + .4], [x1 + .4, y, z1 + .4], [x1 + .4, y, z0 - .4], [mx, y + rh, z0 - .4]); g.color(c).set('aB', 0, 1, 0, 0); g.quad([x0, y, z1], [x1, y, z1], [mx, y + rh, z1], [mx, y + rh, z1]); g.quad([x1, y, z0], [x0, y, z0], [mx, y + rh, z0], [mx, y + rh, z0]); } else { this.parapet(g, x0, z0, x1, z1, y, c, R); this.roofStuff(g, x0, z0, x1, z1, y, R); }
      const pz = q ? z1 : z0, s = q ? 1 : -1; g.color('#4a4038').set('aB', 0, 0, 0, 0).box(mx - 2, .18, Math.min(pz, pz + s * 2), mx + 2, .5, Math.max(pz, pz + s * 2)); g.color('#d8c8a8').box(mx - 1.9, 3, Math.min(pz, pz + s * 2), mx + 1.9, 3.2, Math.max(pz, pz + s * 2), { bottom: true }); g.color('#ffcf8a').set('aB', 6, 0, 2, 0).cbox(mx, 2.8, pz + s * .3, .3, .25, .3); }
    g.color('#555').set('aB', 9, 0, 0, 0).box(L.x0, .18, L.z0 + 25, L.x1, .22, L.z1 - 25); for (let k = 0; k < 5; k++) if (R.chance(.7)) this.tree(R.range(L.x0 + 4, L.x1 - 4), R.range(L.z0 + 29, L.z1 - 29), R, .9); this.crates.push([(L.x0 + L.x1) / 2, (L.z0 + L.z1) / 2]);
  }
  escapes(g, x0, x1, z, R) { const mx = (x0 + x1) / 2 + R.range(-8, 8); g.color('#2a2522').set('aB', 0, 0, 0, 0); for (let y = 4; y < 14; y += 3.2) { g.box(mx - 2, y, z, mx + 2, y + .08, z + 1.2, { bottom: true }); g.box(mx - 2, y, z + 1.14, mx + 2, y + .9, z + 1.18); } }
  lotYard(g, L, s, q, R) { const mx = (L.x0 + L.x1) / 2, mz = (L.z0 + L.z1) / 2, x = s ? mx + 22 : mx - 22, z = q ? mz + 22 : mz - 22; g.color('#fff').set('aB', 9, 0, 0, 0).box(x - 15, .18, z - 15, x + 15, .22, z + 15); for (let k = 0; k < 4; k++) this.tree(x + R.range(-12, 12), z + R.range(-12, 12), R); this.crates.push([x, z]); this.duckSpots.push([x + 3, .3, z - 6]); }
  heights(g, L, R, cx, cz) {
    g.color('#fff').set('aB', 9, 0, 0, 0).box(L.x0, .18, L.z0, L.x1, .24, L.z1); for (const s of [-1, 1]) for (const q of [-1, 1]) { const x = cx + s * 20, z = cz + q * 20; if (R.chance(.12)) { for (let k = 0; k < 6; k++) this.tree(x + R.range(-13, 13), z + R.range(-13, 13), R, 1.3); continue; } const w = R.range(8, 11), l = R.range(7, 9), c = R.pick(['#e6dfd0', '#d8d2c8', '#c8c0b4', '#efe9dd', '#b8b0a4']); this.bld(g, x - w, z - l, x + w, z + l, R.range(5, 8), R.pick([2, 3, 1]), c, R, { lit: .55, tiers: 1 }); const hh = R.range(8.5, 11); this.bld(g, x - w * .5, z - l * .6, x + w * .3, z + l * .5, hh, 2, c, R, { lit: .6, noRoof: true }); const px = x + s * 2, pz = z + q * 14; g.color('#fff').set('aB', 13, 0, 0, 0).box(px - 4, .2, pz - 2, px + 4, .3, pz + 2); for (let k = 0; k < 3; k++) this.tree(x + R.range(-16, 16), z + q * R.range(13, 17), R, 1.1); }
    const t = .4, h = 1.8; g.color('#b8ae9c').set('aB', 0, 0, 0, 0); for (const [a, b, c, e] of [[L.x0, L.z0, cx - 6, L.z0 + t], [cx + 6, L.z0, L.x1, L.z0 + t], [L.x0, L.z1 - t, cx - 6, L.z1], [cx + 6, L.z1 - t, L.x1, L.z1]]) { g.box(a, .18, b, c, h, e); this.phys.addBox(a, 0, b, c, h, e); }
  }
  rust(g, L, R, bi, bj) {
    const cols = ['#6a4a3a', '#5a5f62', '#70604a', '#4f5a56', '#7a5a40'], n = R.int(0, 3), mx = (L.x0 + L.x1) / 2, mz = (L.z0 + L.z1) / 2;
    if (n === 0) { this.bld(g, L.x0 + 4, L.z0 + 4, L.x1 - 4, mz + 10, R.range(9, 15), 5, R.pick(cols), R, { fh: 8 }); this.containers(g, L.x0 + 6, mz + 16, L.x1 - 6, L.z1 - 2, R, 2); } else if (n === 1) { this.bld(g, L.x0, L.z0, mx - 4, L.z1, R.range(8, 13), 5, R.pick(cols), R, { fh: 8 }); this.bld(g, mx + 4, L.z0, L.x1, mz + 4, R.range(8, 16), 5, R.pick(cols), R, { fh: 8 }); this.containers(g, mx + 8, mz + 10, L.x1 - 2, L.z1 - 4, R, 3); }
    else if (n === 2) { for (let k = 0; k < 5; k++) { const x = L.x0 + 14 + (k % 3) * 24, z = L.z0 + 16 + Math.floor(k / 3) * 28, r = R.range(7, 9), h = R.range(8, 13); g.color(R.pick(['#9a9488', '#8a8f92', '#7a6a58'])).set('aB', 5, k, 0, 99).cyl(x, .18, h, z, r, r, 20); g.color('#777').set('aB', 0, 0, 0, 0).cyl(x, h, h + 1.4, z, r, 1, 20); this.phys.addBox(x - r * .9, 0, z - r * .9, x + r * .9, h, z + r * .9); this.buildings.push([x - r, z - r, x + r, z + r, h]); } this.bld(g, L.x1 - 24, L.z1 - 22, L.x1, L.z1, 8, 5, '#555f58', R, { fh: 7 }); }
    else { this.containers(g, L.x0 + 4, L.z0 + 4, L.x1 - 4, L.z1 - 4, R, 3); }
    if (R.chance(.4)) { const x = L.x0 + 8, z = L.z0 + 8, h = R.range(24, 38); g.color('#6a5548').set('aB', 10, 1, 0, 3).cyl(x, .18, h, z, 2.2, 1.5, 14); g.color('#ff2020').set('aB', 12, R(), 4, 0).cbox(x, h + .3, z, .5, .5, .5); this.phys.addBox(x - 2, 0, z - 2, x + 2, h, z + 2); }
    this.duckSpots.push([mx + R.range(-5, 5), .3, L.z1 - 1]);
  }
  containers(g, x0, z0, x1, z1, R, maxStack) { const cols = ['#8a3028', '#2a5a7a', '#3a6a3a', '#8a6a20', '#5a5a60', '#7a4a6a']; for (let x = x0; x + 12.2 <= x1; x += 15.5) for (let z = z0; z + 2.5 <= z1; z += 5.2) { if (R.chance(.22)) continue; const s = R.int(1, maxStack); for (let k = 0; k < s; k++) { const y = .18 + k * 2.6; g.color(R.pick(cols)).set('aB', 7, R() * 99, 0, 0).box(x, y, z, x + 12.2, y + 2.58, z + 2.5); } this.phys.addBox(x, 0, z, x + 12.2, .18 + s * 2.6, z + 2.5); } }
  tree(x, z, R, s = 1) { const k = s * R.range(.8, 1.25); this.queue('tree', M4(x, .15, z, 0, R() * 6, 0, k, k * R.range(.9, 1.2), k), new THREE.Color().setHSL(.24 + R() * .1, .45, .28 + R() * .1)); this.phys.addBox(x - .25, 0, z - .25, x + .25, 4 * k, z + .25, { noSight: true }); }
  palm(x, z, R) { const k = R.range(.8, 1.2); this.queue('palm', M4(x, .1, z, 0, R() * 6, 0, k)); this.phys.addBox(x - .25, 0, z - .25, x + .25, 5, z + .25, { noSight: true }); }
  park(g, L, R, cx, cz, bi, bj) {
    g.color('#fff').set('aB', 9, 0, 0, 0).box(L.x0 - 2, .18, L.z0 - 2, L.x1 + 2, .24, L.z1 + 2); g.color('#8a8474').set('aB', 14, 0, 0, 0).box(cx - 2.5, .24, L.z0 - 2, cx + 2.5, .27, L.z1 + 2).box(L.x0 - 2, .24, cz - 2.5, L.x1 + 2, .28, cz + 2.5); for (let k = 0; k < 26; k++) { const x = R.range(L.x0, L.x1), z = R.range(L.z0, L.z1); if (Math.abs(x - cx) > 5 && Math.abs(z - cz) > 5 && Math.hypot(x - cx, z - cz) > 15) this.tree(x, z, R, 1.3); }
    if (bi === 4 && bj === 6) { g.color('#9a9484').set('aB', 0, 0, 0, 0).cyl(cx, .2, .9, cz, 10, 10, 28); g.color('#fff').set('aB', 13, 0, 0, 0).cyl(cx, .9, .95, cz, 9.4, 9.4, 28); g.color('#b0a894').set('aB', 0, 0, 0, 0).cyl(cx, .9, 3.4, cz, 1, .7, 12); this.phys.addBox(cx - 8, 0, cz - 8, cx + 8, .9, cz + 8); g.color('#ffd24a').set('aB', 6, 0, .5, 0); g.cbox(cx, 4.6, cz, .9, 2.2, .7); g.add(new THREE.SphereGeometry(.5, 12, 8), M4(cx, 6.2, cz)); this.duckSpots.push([cx, 6.8, cz]); }
    else if (bi === 5 && bj === 7) { g.color('#fff').set('aB', 13, 0, 0, 0).box(cx - 30, .25, cz - 30, cx - 8, .3, cz - 8); g.color('#6a4a38').set('aB', 0, 0, 0, 0).box(cx + 8, .24, cz + 8, cx + 28, 1.2, cz + 26); this.phys.addBox(cx + 8, 0, cz + 8, cx + 28, 1.2, cz + 26); g.color('#333').box(cx + 8, 1.2, cz + 24, cx + 28, 7, cz + 26); this.phys.addBox(cx + 8, 0, cz + 24, cx + 28, 7, cz + 26); this.ad(cx + 18, 4.4, cz + 23.9, 1, 14, 5, 14); }
    for (let k = 0; k < 6; k++) this.queue('bench', M4(cx + (k % 2 ? 4 : -4), .2, cz - 30 + k * 12, 0, k % 2 ? -Math.PI / 2 : Math.PI / 2, 0)); this.duckSpots.push([cx + 20, .3, cz - 24]);
  }
  beach(g, L, R) {
    const cols = ['#d8a878', '#7ab0b0', '#d8d0b0', '#c88080', '#88a8c8', '#e0c070'], mx = (L.x0 + L.x1) / 2;
    for (let i = 0; i < 3; i++) for (const q of [0, 1]) { if (R.chance(.2)) { for (let k = 0; k < 3; k++) this.palm(L.x0 + i * 26 + R.range(4, 22), (q ? L.z1 - 18 : L.z0 + 18) + R.range(-8, 8), R); continue; } const x0 = L.x0 + i * 26 + 1, x1 = x0 + 24, z0 = q ? L.z1 - 32 : L.z0, z1 = q ? L.z1 : L.z0 + 32, h = R.chance(.3) ? R.range(14, 30) : R.range(5, 10); this.bld(g, x0, z0, x1, z1, h, 4, R.pick(cols), R, { lit: .5 }); const pz = q ? z1 + .25 : z0 - .25; this.sign((x0 + x1) / 2, 4.9, pz, q ? 0 : 1, 10, 2.3, R.int(0, 63), R.pick(['#ff8a4a', '#4affd0', '#ff5aa0', '#ffe04a'])); }
    for (let k = 0; k < 4; k++) this.palm(L.x0 + R.range(0, 78), (L.z0 + L.z1) / 2 + R.range(-4, 4), R); this.crates.push([mx, (L.z0 + L.z1) / 2]);
  }
  street(g, cx, cz, R, d, poi) {
    const e = 43, put = (t, x, z, yaw, r, h, o) => { const i = this.queue(t, M4(x, .18, z, 0, yaw, 0)); const b = this.phys.addBox(x - r, 0, z - r, x + r, h, z + r, { noSight: true, smash: { type: t, i, x, z }, noShot: t === 'lamp' ? false : undefined }); if (o) Object.assign(b, o); return b; };
    for (const s of [-30, 0, 30]) { for (const [x, z, yaw] of [[cx + s, cz - e, 0], [cx + s, cz + e, Math.PI], [cx - e, cz + s, Math.PI / 2], [cx + e, cz + s, -Math.PI / 2]]) { if ((s === 0 && d !== 'D' && d !== 'N')) continue; put('lamp', x, z, yaw, .16, 6); this.lampSpots.push([x, z]); } }
    for (let k = 0; k < 4; k++) { const s = R.range(-36, 36), f = R.int(0, 3), x = f < 2 ? cx + s : f === 2 ? cx - 42.2 : cx + 42.2, z = f === 0 ? cz - 42.2 : f === 1 ? cz + 42.2 : cz + s; if (poi && f === 1 && Math.abs(s) < 9) continue; const t = R.pick(['trash', 'hydrant', 'mailbox', 'trash', 'cone', 'news']); put(t, x, z, R() * 6, .3, t === 'hydrant' ? .9 : 1.1); }
    if (R.chance(.34)) { const x = cx + R.range(-28, -14), z = cz + 40.6; this.atms.push({ x, z, yaw: 0, y: .18 }); this.queue('atm', M4(x, .18, z)); this.phys.addBox(x - .45, 0, z - .35, x + .45, 2, z + .35); }
    if (R.chance(.34)) { const x = cx + R.range(14, 28), z = cz - 40.6; this.vending.push({ x, z, yaw: Math.PI, y: .18 }); this.queue('vend', M4(x, .18, z, 0, Math.PI, 0)); this.phys.addBox(x - .6, 0, z - .45, x + .6, 2.1, z + .45); }
    if (R.chance(.3)) { const x = cx - 40.8, z = cz + R.range(-28, -12); this.boxes.push({ x, z, y: .18 }); this.queue('tbox', M4(x, .18, z)); this.phys.addBox(x - .6, 0, z - .5, x + .6, 1.6, z + .5); }
    if (R.chance(.4) || poi) { const x = cx + 40, z = cz + 40; this.cams.push({ x, z, y: 5, yaw: Math.PI / 4 }); this.queue('cam', M4(x, 5, z, 0, Math.PI / 4, 0)); this.queue('pole', M4(x, .18, z)); this.phys.addBox(x - .1, 0, z - .1, x + .1, 5, z + .1, { noSight: true }); }
    if (d !== 'P' && R.chance(.5)) { for (const s of [-22, 18]) { const x = cx + s, z = cz - 42; if (R.chance(.5) && d !== 'R') { this.queue('planter', M4(x, .18, z)); this.phys.addBox(x - 1, 0, z - .5, x + 1, .8, z + .5); } else this.queue('bench', M4(x, .18, z, 0, 0, 0)); } }
    if (R.chance(.25)) { const x = cx + 42.4, z = cz + 10; this.queue('busstop', M4(x, .18, z, 0, -Math.PI / 2, 0)); this.phys.addBox(x - .2, 0, z - 2, x + .9, 2.6, z + 2, { noSight: true, noShot: true }); }
    // curbside parking slots
    for (const s of [-28, -18, 18, 28]) { this.parking.push({ x: cx + s, z: cz - 45 - 1.2, yaw: Math.PI / 2, d }); this.parking.push({ x: cx + s, z: cz + 45 + 1.2, yaw: -Math.PI / 2, d }); this.parking.push({ x: cx - 45 - 1.2, z: cz + s, yaw: Math.PI, d }); this.parking.push({ x: cx + 45 + 1.2, z: cz + s, yaw: 0, d }); }
  }
  poiBlock(p, g, L, R, d) {
    const cx = p.x, cz = p.z; if (p.type && this[p.type + 'Build']) return this[p.type + 'Build'](p, g, L, R);
    if (p.lawn) g.color('#fff').set('aB', 9, 0, 0, 0).box(L.x0, .18, L.z0, L.x1, .24, L.z1);
    const x0 = cx - p.w / 2, x1 = cx + p.w / 2, z0 = cz - p.d / 2, z1 = cz + p.d / 2; this.bld(g, x0, z0, x1, z1, p.h, p.style, p.color, R, { lit: .6, base: '#26282c', cornice: p.style !== 5, fh: p.style === 5 ? p.h : undefined });
    // door + canopy
    g.color('#0c0d10').set('aB', 0, 0, 0, 0).box(cx - 1.7, .18, z1, cx + 1.7, 3.2, z1 + .12); g.color(p.sc || p.col).set('aB', 6, 0, 1.25, 0).box(cx - 1.9, .18, z1, cx - 1.7, 3.4, z1 + .2).box(cx + 1.7, .18, z1, cx + 1.9, 3.4, z1 + .2).box(cx - 1.9, 3.2, z1, cx + 1.9, 3.4, z1 + .2); g.color('#2a2c30').set('aB', 0, 0, 0, 0).box(cx - 3.2, 3.6, z1, cx + 3.2, 3.8, z1 + 2.4, { bottom: true });
    if (p.sign) { const s = textPlane(p.sign, p.sc, Math.min(p.w * .8, 24), Math.min(p.w * .8, 24) * .156); s.position.set(cx, Math.min(p.h - 1.6, 6.6), z1 + .35); this.group.add(s); const s2 = s.clone(); s2.position.set(cx, Math.min(p.h - 1.6, 6.6), z0 - .35); s2.rotation.y = Math.PI; this.group.add(s2); }
    if (p.wall) { const t = .5, h = 4; g.color('#7a7a78').set('aB', 0, 0, 0, 0); for (const [a, b, c, e] of [[L.x0, L.z0, L.x1, L.z0 + t], [L.x0, L.z0, L.x0 + t, L.z1], [L.x1 - t, L.z0, L.x1, L.z1], [L.x0, L.z1 - t, cx - 7, L.z1], [cx + 7, L.z1 - t, L.x1, L.z1]]) { g.box(a, .18, b, c, h, e); this.phys.addBox(a, 0, b, c, h, e); } if (p.id === 'prison') { g.color('#50545a'); for (const [a, b] of [[L.x0 + 3, L.z0 + 3], [L.x1 - 3, L.z0 + 3], [L.x0 + 3, L.z1 - 3], [L.x1 - 3, L.z1 - 3]]) { g.set('aB', 0, 0, 0, 0).box(a - 2, .18, b - 2, a + 2, 10, b + 2); g.color('#ffdf90').set('aB', 6, 0, 3, 0).box(a - 2, 10, b - 2, a + 2, 10.6, b + 2); g.color('#50545a'); this.phys.addBox(a - 2, 0, b - 2, a + 2, 10.6, b + 2); } } }
    // back-of-lot filler
    const f = (a, b, c, e) => { if (c - a > 8 && e - b > 8) this.bld(g, a, b, c, e, R.range(8, d === 'D' ? 50 : 20), d === 'R' ? 5 : d === 'D' ? 2 : 4, R.pick(['#5a5450', '#4a4a56', '#635848', '#44525a']), R, { fh: d === 'R' ? 8 : undefined }); };
    if (!p.wall && p.w < 60) { f(L.x0, L.z0, x0 - 6, cz - 6); f(x1 + 6, L.z0, L.x1, cz - 6); f(L.x0, cz + 4, x0 - 6, L.z1); f(x1 + 6, cz + 4, L.x1, L.z1); if (z0 - L.z0 > 18) f(x0 - 2, L.z0, x1 + 2, z0 - 7); }
    else { for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, r = 36; if (p.id !== 'prison' && Math.abs(Math.sin(a)) < .9) this.tree(cx + Math.cos(a) * r, cz + Math.sin(a) * r, R, 1); } }
    if (p.shop === 'garage' || p.shop === 'chop' || p.shop === 'spray') { g.color('#caa040').set('aB', 6, 0, .6, 0); g.box(cx - 5, .19, z1 + 2, cx - 4.8, .22, z1 + 10).box(cx + 4.8, .19, z1 + 2, cx + 5, .22, z1 + 10); }
  }
  towerBuild(p, g, L, R) {
    const cx = p.x, cz = p.z, gold = '#c9a24a', ph = this.phys; g.color('#8c8470').set('aB', 14, 0, 0, 0).box(L.x0, .18, L.z0, L.x1, .3, L.z1);
    const T = [[28, 0, 60], [23, 60, 130], [19, 130, BANK_ROOF]]; for (const [h, a, b] of T) { this.tier(g, cx - h, a + .18, cz - h, cx + h, b, cz + h, 1, 77, .5, 4, '#8a7a4a'); g.color(gold).set('aB', 6, 0, 1.4, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.cbox(cx + sx * h, (a + b) / 2, cz + sz * h, .8, b - a, .8); g.color('#ffd24a').set('aB', 6, 0, 2, 0).box(cx - h - .2, b - 1, cz - h - .2, cx + h + .2, b - .6, cz + h + .2); this.buildings.push([cx - h, cz - h, cx + h, cz + h, b]); }
    const y = BANK_ROOF; g.color('#b89a4a').set('aB', 0, 0, 0, 0); for (const [a, b, c, e] of [[-19, -19, 19, -18.4], [-19, 18.4, 19, 19], [-19, -19, -18.4, 19], [18.4, -19, 19, 19]]) { g.box(cx + a, y, cz + b, cx + c, y + 1.2, cz + e); ph.addBox(cx + a, y - 1, cz + b, cx + c, y + 1.2, cz + e); }
    for (const [a, b] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) { g.color('#3a3528').set('aB', 0, 0, 0, 0).box(cx + a - 1.6, y, cz + b - 1.6, cx + a + 1.6, y + 3, cz + b + 1.6); g.color('#ffd24a').set('aB', 6, 0, 2, 0).box(cx + a - 1.65, y + 2.4, cz + b - 1.65, cx + a + 1.65, y + 2.6, cz + b + 1.65); ph.addBox(cx + a - 1.6, y, cz + b - 1.6, cx + a + 1.6, y + 3, cz + b + 1.6); }
    g.color('#ffe28a').set('aB', 6, 0, 1.6, 0); g.box(cx - 6, y + .02, cz - 6, cx + 6, y + .05, cz - 5.6).box(cx - 6, y + .02, cz + 5.6, cx + 6, y + .05, cz + 6).box(cx - 6, y + .02, cz - 6, cx - 5.6, y + .05, cz + 6).box(cx + 5.6, y + .02, cz - 6, cx + 6, y + .05, cz + 6);
    // entrance
    g.color('#0a0a0c').set('aB', 0, 0, 0, 0).box(cx - 4, .18, cz + 28, cx + 4, 6, cz + 28.2); g.color('#ffd24a').set('aB', 6, 0, 2.4, 0).box(cx - 4.3, .18, cz + 28, cx - 4, 6.3, cz + 28.4).box(cx + 4, .18, cz + 28, cx + 4.3, 6.3, cz + 28.4).box(cx - 4.3, 6, cz + 28, cx + 4.3, 6.3, cz + 28.4); for (let k = -3; k <= 3; k++) { if (!k) continue; const x = cx + k * 8; g.color('#b8a878').set('aB', 0, 0, 0, 0).cyl(x, .18, 9, cz + 33, .8, .7, 12); ph.addBox(x - .7, 0, cz + 32.3, x + .7, 9, cz + 33.7); } g.color('#c9b078').box(cx - 28, 9, cz + 31, cx + 28, 11, cz + 35, { bottom: true });
    for (let k = 0; k < 4; k++) { const f = k, o = 23.3; this.ad(cx + (f === 2 ? o : f === 3 ? -o : 0), 100, cz + (f === 0 ? o : f === 1 ? -o : 0), f, 34, 17, [0, 5, 1, 13][k]); } for (const f of [0, 1]) { const s = textPlane('AURELIAN TRUST', '#ffd24a', 34, 5.3); s.position.set(cx, 222, cz + (f ? -19.4 : 19.4)); if (f) s.rotation.y = Math.PI; this.group.add(s); } const s = textPlane('AURELIAN TRUST', '#ffd24a', 24, 3.7); s.position.set(cx, 10, cz + 35.2); this.group.add(s);
    g.color('#ffffff').set('aB', 12, .3, 5, 0).cbox(cx, y + 14, cz, .6, .6, .6); g.color('#9a8a50').set('aB', 0, 0, 0, 0); for (const [a, b] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) g.box(cx + a - .1, y + 3, cz + b - .1, cx + a + .1, y + 14, cz + b + .1);
    for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; if (Math.sin(a) < .8) this.tree(cx + Math.cos(a) * 36, cz + Math.sin(a) * 35, R, .8); }
  }
  tvtowerBuild(p, g, L, R) {
    const cx = p.x, cz = p.z; g.color('#fff').set('aB', 9, 0, 0, 0).box(L.x0, .18, L.z0, L.x1, .24, L.z1); this.bld(g, cx - 14, cz - 10, cx + 14, cz + 10, 9, 2, '#b0b4b8', R, { lit: .6 }); g.color('#c84030').set('aB', 0, 0, 0, 0); const H = 130; for (let y = 9; y < H; y += 6) { const r = 6 * (1 - y / (H + 20)); g.color(Math.floor(y / 6) % 2 ? '#d8d8d8' : '#c84030'); for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.cbox(cx + a * r, y + 3, cz + b * r, .5, 6.2, .5); g.cbox(cx, y, cz + r, r * 2, .25, .25).cbox(cx, y, cz - r, r * 2, .25, .25).cbox(cx + r, y, cz, .25, .25, r * 2).cbox(cx - r, y, cz, .25, .25, r * 2); } g.color('#ff2020').set('aB', 12, 0, 6, 0).cbox(cx, H + 8, cz, 1, 1, 1).cbox(cx, 70, cz + 3, .8, .8, .8); g.color('#ddd').set('aB', 0, 0, 0, 0).cyl(cx, H, H + 8, cz, .6, .2, 8); g.color('#c8ccd0').cyl(cx, 84, 88, cz, 7, 8, 18); g.color('#ffcf8a').set('aB', 6, 0, 1.5, 0).cyl(cx, 85.5, 86.5, cz, 7.7, 7.8, 18); this.phys.addBox(cx - 5, 9, cz - 5, cx + 5, H, cz + 5);
    g.color('#0c0d10').set('aB', 0, 0, 0, 0).box(cx - 1.7, .18, cz + 10, cx + 1.7, 3.2, cz + 10.15); const s = textPlane('VSPR-TV', '#ff6a6a', 14, 2.2); s.position.set(cx, 6, cz + 10.4); this.group.add(s); for (let k = 0; k < 14; k++) { const a = k / 14 * TAU; this.tree(cx + Math.cos(a) * 33, cz + Math.sin(a) * 33, R, 1.3); }
  }
  plantBuild(p, g, L, R) {
    const cx = p.x, cz = p.z; this.bld(g, cx - 30, cz - 20, cx + 6, cz + 15, 16, 5, '#5a6468', R, { fh: 12 }); for (const [x, z] of [[cx + 22, cz - 18], [cx + 22, cz + 18]]) { for (let k = 0; k < 8; k++) { const r0 = 12 - 4.5 * Math.sin(k / 8 * 2.2), r1 = 12 - 4.5 * Math.sin((k + 1) / 8 * 2.2); g.color('#a8a49a').set('aB', 0, 0, 0, 0).cyl(x, k * 4.2, (k + 1) * 4.2, z, r0, r1, 22, false); } g.color('#ff4020').set('aB', 12, .4, 4, 0).cbox(x + 8, 34, z, .6, .6, .6); this.phys.addBox(x - 10, 0, z - 10, x + 10, 34, z + 10); this.buildings.push([x - 10, z - 10, x + 10, z + 10, 34]); } for (let k = 0; k < 5; k++) { const x = cx - 30 + k * 8, z = cz + 28; g.color('#6a7076').set('aB', 5, k, 0, 99).box(x - 2, .18, z - 2, x + 2, 3.4, z + 2); g.color('#4ac8ff').set('aB', 15, 0, 3, 0).cyl(x, 3.4, 5.4, z, .3, .2, 8); this.phys.addBox(x - 2, 0, z - 2, x + 2, 3.4, z + 2); } g.color('#0c0d10').set('aB', 0, 0, 0, 0).box(cx - 13.7, .18, cz + 15, cx - 10.3, 3.2, cz + 15.15); const s = textPlane('VESPER GRID', '#ffe04a', 18, 2.8); s.position.set(cx - 12, 9, cz + 15.4); this.group.add(s);
  }
  airfieldBuild(p, g, L, R) {
    const cx = p.x, cz = p.z; g.color('#4a4d52').set('aB', 14, 0, 0, 0).box(L.x0, .18, L.z0, L.x1, .22, L.z1); this.bld(g, L.x0, L.z0, L.x1 - 20, L.z0 + 24, 13, 5, '#6a7880', R, { fh: 11 }); this.bld(g, L.x1 - 14, L.z0, L.x1, L.z0 + 14, 22, 2, '#8a9298', R, { lit: .8 }); for (const [x, z] of [[cx - 18, cz + 16], [cx + 18, cz + 16]]) { g.color('#ffe04a').set('aB', 6, 0, .9, 0); for (let k = 0; k < 24; k++) { const a = k / 24 * TAU; g.cbox(x + Math.cos(a) * 8, .25, z + Math.sin(a) * 8, 1.4, .06, 1.4); } g.box(x - 2.5, .23, z - 3, x - 1.7, .27, z + 3).box(x + 1.7, .23, z - 3, x + 2.5, .27, z + 3).box(x - 2, .23, z - .4, x + 2, .27, z + .4); } const s = textPlane('FORTIS AIR', '#9ad0ff', 22, 3.4); s.position.set(cx - 10, 10, L.z0 + 24.4); this.group.add(s); this.helipads = [[cx - 18, cz + 16], [cx + 18, cz + 16]];
    for (const [a, b, c, e] of [[L.x0, L.z1 - .3, cx - 10, L.z1], [cx + 10, L.z1 - .3, L.x1, L.z1], [L.x0, L.z0, L.x0 + .3, L.z1], [L.x1 - .3, L.z0, L.x1, L.z1]]) { g.color('#70757a').set('aB', 0, 0, 0, 0).box(a, .18, b, c, 2.6, e); this.phys.addBox(a, 0, b, c, 2.6, e, { noSight: true }); } this.containers(g, L.x0 + 4, cz - 8, cx - 8, cz + 4, R, 1);
  }
  docksBuild(p, g, L, R) {
    const cx = p.x, cz = p.z; this.bld(g, cx - 10, cz - 39, cx + 39, cz - 11, 13, 5, '#54605a', R, { fh: 11 }); g.color('#0c0d10').set('aB', 0, 0, 0, 0).box(cx + 18.3, .18, cz - 11, cx + 21.7, 3.2, cz - 10.85); this.containers(g, L.x0 + 2, cz - 36, cx - 14, cz + 36, R, 3); this.containers(g, cx - 4, cz + 8, L.x1, cz + 38, R, 2); for (const s of [0, 1]) { const x = cx - 30 + s * 46, z = cz + 60; g.color('#c88a20').set('aB', 5, 1, 0, 99); for (const [a, b] of [[-5, -4], [5, -4], [-5, 4], [5, 4]]) g.box(x + a - .5, -3, z + b - .5, x + a + .5, 28, z + b + .5); g.box(x - 6, 28, z - 5, x + 6, 30, z + 5, { bottom: true }); g.box(x - 1.5, 30, z - 26, x + 1.5, 31.5, z + 30, { bottom: true }); g.color('#ff2020').set('aB', 12, s * .5, 5, 0).cbox(x, 32, z + 30, .6, .6, .6); this.phys.addBox(x - 5.5, -3, z - 4.5, x - 4.5, 28, z + 4.5); this.phys.addBox(x + 4.5, -3, z - 4.5, x + 5.5, 28, z + 4.5); } const s = textPlane('PIER 13', '#ffa04a', 16, 2.5); s.position.set(cx + 14, 9, cz - 10.6); this.group.add(s);
    // pier
    g.color('#6a5a48').set('aB', 14, 0, 0, 0).box(cx - 40, -2, cz + 45, cx + 40, .18, cz + 110); this.phys.addBox(cx - 40, -4, cz + 45, cx + 40, .18, cz + 110); this.containers(g, cx - 36, cz + 78, cx + 36, cz + 100, R, 2); // ship
    g.color('#3a2a2a').set('aB', 5, 1, 0, 99).box(cx - 70, -3, cz + 114, cx + 60, 6, cz + 134); g.color('#d8d0c0').set('aB', 3, 2, .6, 3).box(cx + 36, 6, cz + 116, cx + 56, 18, cz + 132); this.phys.addBox(cx - 70, -3, cz + 114, cx + 60, 6, cz + 134); this.phys.addBox(cx + 36, 6, cz + 116, cx + 56, 18, cz + 132); this.containersAt(g, cx - 62, 6, cz + 116, R);
  }
  containersAt(g, x0, y, z0, R) { const cols = ['#8a3028', '#2a5a7a', '#3a6a3a', '#8a6a20']; for (let x = 0; x < 6; x++) for (let z = 0; z < 5; z++) { const s = R.int(1, 3); for (let k = 0; k < s; k++) g.color(R.pick(cols)).set('aB', 7, R() * 9, 0, 0).box(x0 + x * 14, y + k * 2.6, z0 + z * 3.2, x0 + x * 14 + 12, y + k * 2.6 + 2.55, z0 + z * 3.2 + 2.5); this.phys.addBox(x0 + x * 14, y, z0 + z * 3.2, x0 + x * 14 + 12, y + s * 2.6, z0 + z * 3.2 + 2.5); } }
  intersections() {
    const lg = new GeoB({ aT: 3 }), g = this.gb(); this.lights = [];
    for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { if (PARK_NODES.has(i + ',' + j)) continue; const x = roadC(i), z = roadC(j); const off = ((i * 7 + j * 3) % 4) * 3.2; for (const [sx, sz, face, ax] of [[-1, -1, 1, 0], [1, 1, 0, 0], [1, -1, 2, 1], [-1, 1, 3, 1]]) { const px = x + sx * 10.9, pz = z + sz * 10.9; if (Math.abs(px) > 724 || Math.abs(pz) > 724) continue; g.color('#2c3034').set('aB', 0, 0, 0, 0).cbox(px, 3, pz, .18, 6, .18); let hx = px, hz = pz; if (ax === 0) hx -= sx * 5; else hz -= sz * 5; g.cbox((px + hx) / 2, 5.8, (pz + hz) / 2, Math.abs(px - hx) + .12, .12, Math.abs(pz - hz) + .12); g.color('#101214').cbox(hx, 5.3, hz, .5, 1.5, .5); this.phys.addBox(px - .12, 0, pz - .12, px + .12, 5.6, pz + .12, { noSight: true }); for (const f of [face, face ^ 1]) for (let k = 0; k < 3; k++) { lg.set('aT', ax, k, off); this.faceQuad(lg, hx + (f === 2 ? .27 : f === 3 ? -.27 : 0), 5.75 - k * .45, hz + (f === 0 ? .27 : f === 1 ? -.27 : 0), f, .34, .34, [0, 0, 1, 0, 1, 1, 0, 1], ['#ff2818', '#ffb020', '#28ff60'][k], 2.2); } }
      this.lights.push({ i, j, x, z, off }); }
    this.mesh(g, false); const m = new THREE.MeshBasicMaterial({ vertexColors: true }); m.onBeforeCompile = s => { s.uniforms.uTime = U.uTime; s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aT; varying float vOn; uniform float uTime;').replace('#include <begin_vertex>', `#include <begin_vertex>\n float t=mod(uTime+aT.z+aT.x*13.,26.); float ph=t<10.?2.:t<13.?1.:0.; vOn=abs(ph-aT.y)<.5?1.:.06;`); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vOn;').replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb*=vOn;'); };
    this.group.add(new THREE.Mesh(lg.build(), m));
  }
  // axis 0: traffic heading along z; 1: along x. returns 'g' | 'y' | 'r'
  lightState(i, j, axis) { const off = ((i * 7 + j * 3) % 4) * 3.2; const t = (G.time + off + axis * 13) % 26; return t < 10 ? 'g' : t < 13 ? 'y' : 'r'; }
  outer() {
    const g = this.gb(); g.color('#b8a070').set('aB', 11, 0, 0, 0); const a = 725, b = 735, c = 900; // ring of beach
    const ring = (r0, y0, r1, y1) => { const P = (r, s) => [[-r, -r], [r, -r], [r, r], [-r, r]][s]; for (let s = 0; s < 4; s++) { const A = P(r0, s), B = P(r0, (s + 1) % 4), C = P(r1, (s + 1) % 4), D = P(r1, s); const n = 20; for (let k = 0; k < n; k++) { const L = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; const p0 = L(A, B, k / n), p1 = L(A, B, (k + 1) / n), p2 = L(D, C, (k + 1) / n), p3 = L(D, C, k / n); g.quad([p1[0], y0, p1[1]], [p0[0], y0, p0[1]], [p3[0], y1, p3[1]], [p2[0], y1, p2[1]]); } } };
    g.color('#7a7468').set('aB', 14, 0, 0, 0); ring(a, .02, b, .02); g.color('#b8a070').set('aB', 11, 0, 0, 0); ring(b, 0, c, -7); this.mesh(g, false); const R = rng(808); for (let k = 0; k < 90; k++) { const s = R.int(0, 3), t = R.range(-720, 720), o = R.range(740, 752); const [x, z] = s === 0 ? [t, o] : s === 1 ? [t, -o] : s === 2 ? [o, t] : [-o, t]; if (s === 0 && Math.abs(x) < 60) continue; if ((s === 1 && Math.abs(x + 55) < 16) || (s === 3 && Math.abs(z - 495) < 16)) continue; this.palm(x, z, R); }
    // low sea wall keeps traffic on the island, with gaps
    for (let k = 0; k < 4; k++) for (let t = -720; t < 720; t += 40) { if ((t / 40) % 4 === 0) continue; const o = 731; if (k === 0 && Math.abs(t + 20) < 70) continue; if (k === 1 && Math.abs(t + 19 + 55) < 30) continue; const [x0, z0, x1, z1] = k === 0 ? [t, o, t + 38, o + .6] : k === 1 ? [t, -o - .6, t + 38, -o] : k === 2 ? [o, t, o + .6, t + 38] : [-o - .6, t, -o, t + 38]; g.color('#8a8478'); this.phys.addBox(x0, 0, z0, x1, .9, z1, { noSight: true }); this.wallG = this.wallG || this.gb(); this.wallG.color('#8a8478').set('aB', 0, 0, 0, 0).box(x0, 0, z0, x1, .9, z1); } this.mesh(this.wallG, false);
    // stunt ramps
    const rg = this.gb(); const RS = [[-690, -300, 'z', 1], [330, 680, 'x', 1], [-385, 250, 'z', -1], [600, 55, 'z', 1], [55, 692, 'x', -1], [-600, 692, 'x', 1], [692, -430, 'z', -1], [-55, -692, 'x', 1]]; for (const [x, z, ax, s] of RS) { const w = 3, l = 7, h = 3; const x0 = x - (ax === 'x' ? l : w), x1 = x + (ax === 'x' ? l : w), z0 = z - (ax === 'z' ? l : w), z1 = z + (ax === 'z' ? l : w); const h0 = s > 0 ? 0 : h, h1 = s > 0 ? h : 0; this.phys.addRamp(x0, z0, x1, z1, ax, h0, h1); rg.color('#ff8a2a').set('aB', 0, 0, 0, 0); if (ax === 'x') { rg.quad([x0, h0, z1], [x1, h1, z1], [x1, h1, z0], [x0, h0, z0]); rg.quad([x0, 0, z1], [x1, 0, z1], [x1, h1, z1], [x0, h0, z1]); rg.quad([x1, 0, z0], [x0, 0, z0], [x0, h0, z0], [x1, h1, z0]); if (s > 0) rg.quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1]); else rg.quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0]); } else { rg.quad([x0, h1, z1], [x1, h1, z1], [x1, h0, z0], [x0, h0, z0]); rg.quad([x1, 0, z1], [x1, 0, z0], [x1, h0, z0], [x1, h1, z1]); rg.quad([x0, 0, z0], [x0, 0, z1], [x0, h1, z1], [x0, h0, z0]); if (s > 0) rg.quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1]); else rg.quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0]); } rg.color('#fff').set('aB', 6, 0, 1.5, 0); this.rampSpots.push([x, z]); } this.mesh(rg);
  }
  instances() {
    const std = (o = {}) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: .7, metalness: .2 }, o)); const geos = {}; let g;
    g = new GeoB(); g.color('#2a2d31').cyl(0, 0, 6, 0, .11, .07, 7).cbox(0, 6, -.9, .1, .1, 1.9); g.color('#1c1e22').cbox(0, 5.98, -1.7, .35, .12, .9); geos.lamp = g.build(); g = new GeoB(); g.color(9, 6.6, 3.8).cbox(0, 5.9, -1.7, .28, .05, .8); this.lampHeadGeo = g.build();
    g = new GeoB(); g.color('#3c4a3c').cyl(0, 0, 1, 0, .28, .32, 10); g.color('#222').cyl(0, 1, 1.08, 0, .34, .3, 10); geos.trash = g.build(); g = new GeoB(); g.color('#c02a20').cyl(0, 0, .65, 0, .16, .15, 8).cyl(0, .65, .85, 0, .18, .05, 8).cbox(0, .5, 0, .5, .14, .14); geos.hydrant = g.build(); g = new GeoB(); g.color('#26408a').cbox(0, .65, 0, .55, 1.1, .5).cyl(0, 1.2, 1.35, 0, .28, .1, 8); geos.mailbox = g.build(); g = new GeoB(); g.color('#ff6a1a').cyl(0, .05, .7, 0, .2, .04, 10).cbox(0, .03, 0, .5, .06, .5); g.color('#fff').cyl(0, .3, .42, 0, .145, .115, 10); geos.cone = g.build(); g = new GeoB(); g.color('#a88a20').cbox(0, .55, 0, .5, 1.1, .45); g.color('#ddd').cbox(0, .75, .23, .36, .4, .02); geos.news = g.build();
    g = new GeoB(); g.color('#3a3f46').cbox(0, 1, 0, .9, 2, .66); g.color('#c9a53a').cbox(0, 1.8, .34, .86, .3, .04); g.color('#1a1c20').cbox(0, .9, .36, .6, .12, .1); geos.atm = g.build(); g = new GeoB(); g.color(.4, 2.4, 2).cbox(0, 1.35, .345, .55, .42, .02); g.color(3, 2.2, .5).cbox(0, 1.8, .365, .6, .12, .02); this.atmGlow = g.build();
    g = new GeoB(); g.color('#7a1f2a').cbox(0, 1.05, 0, 1.2, 2.1, .85); g.color('#222').cbox(-.1, .5, .43, .7, .2, .03); geos.vend = g.build(); g = new GeoB(); g.color(.8, 2.2, 3).cbox(-.15, 1.35, .44, .75, 1.1, .02); this.vendGlow = g.build(); g = new GeoB(); g.color('#4f6a5a').cbox(0, .8, 0, 1.2, 1.6, .9); g.color('#e0c020').cbox(0, 1, .46, .4, .4, .02); geos.tbox = g.build(); g = new GeoB(); g.color('#d8dce0').cbox(0, 0, .2, .22, .2, .5); g.color('#111').cbox(0, 0, .47, .16, .14, .04); geos.cam = g.build(); g = new GeoB(); g.color('#444').cyl(0, 0, 5, 0, .08, .06, 6); geos.pole = g.build(); g = new GeoB(); g.color('#6a4a30').cbox(0, .45, 0, 1.8, .08, .5).cbox(0, .8, -.24, 1.8, .4, .06); g.color('#333').cbox(-.7, .2, 0, .08, .4, .45).cbox(.7, .2, 0, .08, .4, .45); geos.bench = g.build(); g = new GeoB(); g.color('#7a7670').cbox(0, .35, 0, 2, .7, 1); g.color('#2f5a2a').add(new THREE.IcosahedronGeometry(.55, 0), M4(-.45, .9, 0)).add(new THREE.IcosahedronGeometry(.5, 0), M4(.45, .85, .1)); geos.planter = g.build(); g = new GeoB(); g.color('#333a40').cbox(0, 2.5, .3, 4, .12, 1.4).cbox(-1.9, 1.25, -.3, .1, 2.5, .1).cbox(1.9, 1.25, -.3, .1, 2.5, .1).cbox(0, 1.3, -.35, 3.8, 1.8, .05); g.color('#6a4a30').cbox(0, .5, 0, 2.4, .08, .5); geos.busstop = g.build();
    g = new GeoB(); g.color('#4a3524').cyl(0, 0, 2.6, 0, .22, .14, 6); g.color('#ffffff'); for (const [x, y, z, s] of [[0, 3.6, 0, 1.6], [.8, 3, .4, 1.1], [-.7, 3.1, -.5, 1.2], [.1, 4.6, -.1, 1.1], [-.3, 3, .8, 1]]) g.add(new THREE.IcosahedronGeometry(s, s > 1.5 ? 1 : 0), M4(x, y, z, x, y, z, 1, .85, 1)); geos.tree = g.build(); { const c = geos.tree.attributes.color; }
    g = new GeoB(); g.color('#7a6248'); for (let k = 0; k < 5; k++) g.cyl(k * k * .06, k * 1.2, (k + 1) * 1.2 + .05, 0, .2 - k * .015, .18 - k * .015, 6, false); g.color('#3f6a2c'); for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, ca = Math.cos(a), sa = Math.sin(a), ox = 1.35; const p = (r, y, w) => [[ox + ca * r - sa * w, y, sa * r + ca * w], [ox + ca * r + sa * w, y, sa * r - ca * w]]; const A = p(.1, 6.1, .12), B = p(1.5, 6.4, .42), C = p(2.8, 5.4, .05); g.quad(A[0], A[1], B[1], B[0]); g.quad(B[0], B[1], C[1], C[0]); g.quad(A[1], A[0], B[0], B[1]); g.quad(B[1], B[0], C[0], C[1]); } geos.palm = g.build();
    this.im = {}; const CH = new Set(['tree', 'palm', 'bench', 'planter', 'busstop', 'tbox', 'vend', 'atm', 'pole', 'cam']); for (const t in this.inst) { const all = this.inst[t], mat = std(t === 'tree' || t === 'palm' ? { roughness: .95, metalness: 0, flatShading: t === 'tree' } : {}); const groups = new Map(); if (CH.has(t)) for (const it of all) { const e = it[0].elements, k = Math.floor((e[12] + 900) / 260) * 20 + Math.floor((e[14] + 900) / 260); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(it); } else groups.set(0, all);
      for (const L of groups.values()) { const im = new THREE.InstancedMesh(geos[t], mat, L.length); L.forEach(([m, c], k) => { im.setMatrixAt(k, m); if (c) im.setColorAt(k, c); }); im.castShadow = !['cone', 'cam', 'news', 'lamp', 'pole'].includes(t); im.receiveShadow = true; if (groups.size > 1) { im.computeBoundingSphere(); im.frustumCulled = true; } else im.frustumCulled = false; this.group.add(im); this.im[t] = im; } }
    const glow = (geo, src) => { if (!src) return null; const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }), src.length); src.forEach(([m], k) => im.setMatrixAt(k, m)); im.frustumCulled = false; this.group.add(im); return im; }; this.lampHeads = glow(this.lampHeadGeo, this.inst.lamp); glow(this.atmGlow, this.inst.atm); glow(this.vendGlow, this.inst.vend);
    // fake light pools under lamps
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.4, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); this.glowTex = new THREE.CanvasTexture(c);
    const pool = new THREE.InstancedMesh(new THREE.PlaneGeometry(13, 13).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.glowTex, color: 0xffb060, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4, opacity: .3 }), this.inst.lamp.length); const mm = new THREE.Matrix4(), v = new THREE.Vector3(); this.inst.lamp.forEach(([m], k) => { v.set(0, 0, -1.7).applyMatrix4(m); mm.makeTranslation(v.x, .215, v.z); pool.setMatrixAt(k, mm); }); pool.frustumCulled = false; pool.renderOrder = 1; this.group.add(pool); this.pool = pool;
    const halo = new THREE.InstancedMesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshBasicMaterial({ map: this.glowTex, color: 0xffc080, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .5 }), this.inst.lamp.length); halo.material.onBeforeCompile = s => { s.vertexShader = s.vertexShader.replace('#include <project_vertex>', 'vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.,0.,0.,1.); mvPosition.xy += position.xy; gl_Position = projectionMatrix * mvPosition;'); }; this.inst.lamp.forEach(([m], k) => { v.set(0, 5.9, -1.7).applyMatrix4(m); mm.makeTranslation(v.x, v.y, v.z); halo.setMatrixAt(k, mm); }); halo.frustumCulled = false; this.group.add(halo); this.halo = halo;
    // water
    const wm = new THREE.MeshStandardMaterial({ color: 0x0b2a36, roughness: .12, metalness: .55, transparent: true, opacity: .93 }); wm.onBeforeCompile = s => { s.uniforms.uTime = U.uTime; s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP=(modelMatrix*vec4(position,1.)).xyz;'); s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>\nvarying vec3 vWP; uniform float uTime;${NOISE}`).replace('#include <normal_fragment_maps>', `vec2 q=vWP.xz*.12; float e=.6; float t=uTime*.35; float a=fbm(q+t),b1=fbm(q+vec2(e*.12,0.)+t)-a,b2=fbm(q+vec2(0.,e*.12)+t)-a; float a2=vn(vWP.xz*.9-t*3.); vec3 wn=normalize(vec3(-b1*3.,1.,-b2*3.)+vec3((a2-.5)*.12,0.,(vn(vWP.zx*.9+t*3.)-.5)*.12)); normal=normalize((viewMatrix*vec4(wn,0.)).xyz);`); };
    const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), wm); water.position.y = WATER_Y; this.group.add(water); this.water = water;
  }
  // ambient flying traffic between the towers (visual only)
  skyTraffic() {
    const g = new GeoB(); g.color('#1c1f26').cbox(0, 0, 0, 1.7, .8, 4.2); g.color('#0a1016').cbox(0, .5, .2, 1.3, .5, 1.8); g.color(6, 5, 3.6).cbox(0, 0, 2.12, 1.3, .2, .05); g.color(5, .3, .2).cbox(0, 0, -2.12, 1.4, .2, .05); g.color(.6, 2.6, 4).cbox(0, -.45, 0, 1.2, .06, 3); const n = this.skyN = 90; this.sky = new THREE.InstancedMesh(g.build(), new THREE.MeshBasicMaterial({ vertexColors: true }), n); this.sky.frustumCulled = false; this.skyL = []; const R = rng(77); for (let i = 0; i < n; i++) { const ax = R.chance(.5), line = R.int(1, 12), dir = R.chance(.5) ? 1 : -1; this.skyL.push({ ax, c: roadC(line) + dir * R.range(2, 6), y: R.pick([46, 62, 78, 98]) + R.range(-3, 3), d: dir, o: R.range(0, 1900), s: R.range(17, 27) }); } this.group.add(this.sky);
  }
  skyUpdate() { const m = _sm, e = m.elements; for (let i = 0; i < this.skyN; i++) { const l = this.skyL[i]; let t = ((l.o + G.time * l.s) % 1900) - 950; t *= l.d; const x = l.ax ? t : l.c, z = l.ax ? l.c : t, yaw = l.ax ? (l.d > 0 ? Math.PI / 2 : -Math.PI / 2) : (l.d > 0 ? 0 : Math.PI); const c = Math.round(Math.cos(yaw)), s = Math.round(Math.sin(yaw)); e[0] = c; e[1] = 0; e[2] = -s; e[3] = 0; e[4] = 0; e[5] = 1; e[6] = 0; e[7] = 0; e[8] = s; e[9] = 0; e[10] = c; e[11] = 0; e[12] = x; e[13] = l.y + Math.sin(G.time + i) * .6; e[14] = z; e[15] = 1; this.sky.setMatrixAt(i, m); } this.sky.instanceMatrix.needsUpdate = true; }
  signs() {
    const mk = (gb, tex, additive) => { if (gb.empty) return; const m = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, side: THREE.FrontSide }); if (additive) { m.blending = THREE.AdditiveBlending; m.transparent = true; m.depthWrite = false; } const me = new THREE.Mesh(gb.build(), m); me.matrixAutoUpdate = false; this.group.add(me); return me; };
    this.signMesh = mk(this.signG, signAtlas(), true); this.vsignMesh = mk(this.vsignG, vsignAtlas(), true); this.adMesh = mk(this.adG, adAtlas(), false);
    if (this.adMesh) this.adMesh.material.onBeforeCompile = s => { s.uniforms.uTime = U.uTime; s.uniforms.uGlitch = U.uGlitch; s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime,uGlitch;').replace('#include <map_fragment>', `vec2 q=vMapUv; float gl=step(.985-uGlitch*.4,fract(sin(floor(uTime*8.)+floor(q.y*60.)*7.1)*43.7)); q.x+=gl*.02; vec4 sampledDiffuseColor=texture2D(map,q); diffuseColor*=sampledDiffuseColor; diffuseColor.rgb*=.75+.25*sin(q.y*900.+uTime*6.); diffuseColor.rgb+=gl*vec3(.1,.25,.3);`); };
  }
  smashProp(b, vx, vz) {
    if (b.dead || !b.smash) return; this.phys.removeBox(b); const s = b.smash, im = this.im[s.type]; const m = new THREE.Matrix4().makeScale(0, 0, 0); im.setMatrixAt(s.i, m); im.instanceMatrix.needsUpdate = true; if (s.type === 'lamp') { for (const q of [this.lampHeads, this.pool, this.halo]) { q.setMatrixAt(s.i, m); q.instanceMatrix.needsUpdate = true; } }
    G.fx && G.fx.propDebris(s.x, .6, s.z, vx, vz, s.type); if (s.type === 'hydrant') G.fx && G.fx.geyser(s.x, s.z); G.audio.play(s.type === 'lamp' ? 'crash' : 'bump', { x: s.x, y: 1, z: s.z }, .7);
  }
  update(dt, night) { U.uTime.value = G.time; U.uNight.value = night; if (!G.interior) this.skyUpdate(); this.pool.material.opacity = .34 * night; this.halo.material.opacity = .5 * night; this.lampHeads.visible = this.pool.visible = this.halo.visible = night > .05; }
  // nearest sidewalk point of a block loop for pedestrians
  blockOf(x, z) { const i = clamp(Math.floor((x + HALF) / PITCH), 0, N - 1), j = clamp(Math.floor((z + HALF) / PITCH), 0, N - 1); return [i, j]; }
}
installCityPlus(City);
