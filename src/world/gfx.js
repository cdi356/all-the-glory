import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { G } from '../core/g.js';
import { clamp, lerp, smooth, damp, rand, pick } from '../core/util.js';
import { U } from './city.js';

export class Gfx {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); r.toneMapping = THREE.NoToneMapping; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; r.info.autoReset = false;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(65, 1, .08, 3200); G.scene = this.scene; G.camera = this.camera; G.renderer = r;
    this.quality = 'high'; this.fx = { damage: 0, scan: 0, slow: 0, glitch: 0, fade: 0, flash: 0, cyber: 0, drunk: 0, gray: 0, letter: 0 }; this.mainFx = this.fx; this.sm = {}; this.sunL = new THREE.Vector3(.3, .8, .2);
    this.post(); this.lights(); this.sky(); this.resize(); addEventListener('resize', () => this.resize());
  }
  post() {
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }); this.comp = new EffectComposer(this.renderer, rt); this.rp = new RenderPass(this.scene, this.camera); this.comp.addPass(this.rp);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), .55, .55, .92); this.comp.addPass(this.bloom);
    this.final = new ShaderPass({
      uniforms: { tDiffuse: { value: null }, time: { value: 0 }, dmg: { value: 0 }, scan: { value: 0 }, slow: { value: 0 }, glitch: { value: 0 }, fade: { value: 0 }, flash: { value: 0 }, cyber: { value: 0 }, drunk: { value: 0 }, gray: { value: 0 }, letter: { value: 0 }, expo: { value: 1 }, night: { value: 0 }, tint: { value: new THREE.Color(1, 1, 1) }, res: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform float time,dmg,scan,slow,glitch,fade,flash,cyber,drunk,gray,letter,expo,night; uniform vec3 tint; uniform vec2 res;
      float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      vec3 aces(vec3 x){ const mat3 a=mat3(.59719,.076,.0284,.35458,.90834,.13383,.04823,.01566,.83777); const mat3 b=mat3(1.60475,-.10208,-.00327,-.53108,1.10813,-.07276,-.07367,-.00605,1.07602); x=a*x; x=(x*(x+.0245786)-.000090537)/(x*(.983729*x+.4329510)+.238081); return clamp(b*x,0.,1.); }
      void main(){ vec2 u=vUv; vec2 c=u-.5; float r2=dot(c,c);
        if(drunk>0.){u+=vec2(sin(u.y*9.+time*2.),cos(u.x*8.+time*1.7))*.012*drunk;}
        if(glitch>0.){ float ln=floor(u.y*38.); float g=step(1.-.35*glitch,h(vec2(ln,floor(time*22.)))); u.x+=g*(h(vec2(ln,time))-.5)*.14*glitch; }
        float ca=.0012+.004*slow+.01*glitch+.004*dmg+.003*drunk; vec2 off=c*ca*(1.+r2*4.);
        vec3 col=vec3(texture2D(tDiffuse,u+off).r,texture2D(tDiffuse,u).g,texture2D(tDiffuse,u-off).b);
        vec2 px=1./res; vec3 nb=(texture2D(tDiffuse,u+vec2(px.x,0.)).rgb+texture2D(tDiffuse,u-vec2(px.x,0.)).rgb+texture2D(tDiffuse,u+vec2(0.,px.y)).rgb+texture2D(tDiffuse,u-vec2(0.,px.y)).rgb)*.25; col+=(col-nb)*.35;
        col*=expo*tint; col=aces(col*.92);
        float l=dot(col,vec3(.2126,.7152,.0722)); col=mix(vec3(l),col,1.12+.1*night); col=mix(col,col*vec3(.94,.98,1.07),night*.5*(1.-l));
        col=pow(max(col,0.),vec3(1./2.2)); float lm=dot(col,vec3(.2126,.7152,.0722)); col=mix(col,col*vec3(1.04,1.,.93)+vec3(.0,.006,.018)*(1.-lm),.6); col=mix(col,smoothstep(0.,1.,col),.18);
        if(scan>0.){ float ln=.94+.06*sin(u.y*res.y*1.2); vec3 sc=vec3(.12,.95,.82)*pow(dot(col,vec3(.3,.6,.1)),.85)*1.1; float ring=smoothstep(.05,0.,abs(length(c*vec2(res.x/res.y,1.))-fract(time*.45)*1.2)); col=mix(col,(sc+col*.25)*ln+ring*vec3(.02,.12,.1),scan*.72); }
        if(cyber>0.){ col=mix(col,vec3(l)*vec3(.3,1.1,1.)+col*.3,cyber*.35); col*=.96+.04*sin(u.y*res.y*1.5+time*8.); }
        if(slow>0.){ col=mix(col,vec3(dot(col,vec3(.33)))*vec3(1.1,1.,.85),slow*.45); }
        if(gray>0.){ col=mix(col,vec3(dot(col,vec3(.3,.6,.1)))*.8,gray); }
        col=mix(col,vec3(.7,.02,.03),dmg*smoothstep(.1,.5,r2)*.9); col*=1.-r2*(.55+.5*slow); col+=(h(u+fract(time))-.5)*.022; col+=flash;
        if(letter>0.){ float b=.11*letter; if(vUv.y<b||vUv.y>1.-b) col=vec3(0.); }
        col=mix(col,vec3(0.),fade); gl_FragColor=vec4(col,1.); }`,
    });
    this.final.renderToScreen = true; this.comp.addPass(this.final);
  }
  lights() {
    const s = this.sun = new THREE.DirectionalLight(0xffffff, 3); s.castShadow = true; s.shadow.mapSize.set(2048, 2048); const d = 75; Object.assign(s.shadow.camera, { left: -d, right: d, top: d, bottom: -d, near: 1, far: 420 }); s.shadow.bias = -.0004; s.shadow.normalBias = .06; this.scene.add(s, s.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); this.scene.add(this.hemi);
    this.points = []; for (let i = 0; i < 6; i++) { const p = new THREE.PointLight(0xffb070, 0, 22, 1.6); p.position.set(0, -500, 0); this.scene.add(p); this.points.push(p); }
    this.flashes = []; for (let i = 0; i < 1; i++) { const p = new THREE.PointLight(0xffc060, 0, 18, 1.8); this.scene.add(p); this.flashes.push({ l: p, t: 0, d: 1, i: 0 }); }
    this.spot = new THREE.SpotLight(0xfff0d8, 0, 48, .62, .6, 1.2); this.scene.add(this.spot, this.spot.target);
    this.scene.fog = new THREE.FogExp2(0x101420, .0022);
  }
  flashAt(p, color = 0xffc060, inten = 30, dur = .08, dist = 18) { let f = this.flashes[0]; for (const q of this.flashes) if (q.t < f.t) f = q; f.l.position.copy(p); f.l.color.set(color); f.i = inten; f.t = f.d = dur; f.l.distance = dist; }
  sky() {
    this.skyU = { top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunD: { value: new THREE.Vector3(0, 1, 0) }, sunC: { value: new THREE.Color() }, night: { value: 0 }, time: U.uTime, cloud: { value: .4 }, flash: { value: 0 } };
    const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU, vertexShader: 'varying vec3 vD; void main(){vD=position; vec4 p=projectionMatrix*mat4(mat3(modelViewMatrix))*vec4(position,1.); gl_Position=p.xyww;}',
      fragmentShader: `varying vec3 vD; uniform vec3 top,hor,sunD,sunC; uniform float night,time,cloud,flash;
      float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);} float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);} float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+3.1;a*=.5;}return s;}
      void main(){ vec3 d=normalize(vD); float y=max(d.y,0.); vec3 c=mix(hor,top,pow(smoothstep(-.02,.75,d.y),.55)); float sd=max(dot(d,sunD),0.);
        c+=sunC*(pow(sd,900.)*14.+pow(sd,24.)*.35+pow(sd,4.)*.12)*(1.-night);
        float md=max(dot(d,-sunD),0.); c+=vec3(.8,.86,1.)*night*(smoothstep(.9993,.9996,md)*1.6*(.7+.3*vn(d.xy*90.))+pow(md,180.)*.18);
        vec2 sp=d.xz/(abs(d.y)+.25)*260.; float st=step(.9975,h(floor(sp)))*smoothstep(.05,.4,d.y)*(.5+.5*sin(time*2.+h(floor(sp)+3.)*40.)); c+=st*night*.8*(1.-cloud*.7);
        if(d.y>0.015){ vec2 cp=d.xz/(d.y+.12)*1.15+time*.006; float f=fbm(cp); float cl=smoothstep(1.-cloud*.95,1.25-cloud*.5,f+.28); float sh=fbm(cp+sunD.xz*.12); vec3 cc=mix(hor*1.15+sunC*.25*(1.-night),top*.8+.02,clamp(sh*1.3-.2,0.,1.)); cc=mix(cc,vec3(.16,.1,.14)*1.2*(.5+.6*f)+hor*.35,night*.85); cc+=flash*vec3(.8,.85,1.)*f; c=mix(c,cc,cl*smoothstep(.015,.16,d.y)*.92); }
        c=mix(c,hor,smoothstep(.06,-.06,d.y)); gl_FragColor=vec4(c,1.); }` });
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(10, 40, 24), m); this.skyMesh.frustumCulled = false; this.skyMesh.renderOrder = -10; this.scene.add(this.skyMesh);
    this.pmrem = new THREE.PMREMGenerator(this.renderer); this.envScene = new THREE.Scene(); const em = this.skyMesh.clone(); em.material = m.clone(); em.material.uniforms = this.skyU; em.material.vertexShader = 'varying vec3 vD; void main(){vD=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}'; em.scale.setScalar(5); this.envScene.add(em); this.envT = -99; this.envHour = -99;
    // rain
    const n = 1400, pos = new Float32Array(n * 6), al = new Float32Array(n * 2); for (let i = 0; i < n; i++) { const x = rand(-28, 28), y = rand(0, 26), z = rand(-28, 28); pos.set([x, y, z, x, y + .75, z], i * 6); al[i * 2] = 0; al[i * 2 + 1] = 1; } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('al', new THREE.BufferAttribute(al, 1));
    this.rainU = { time: U.uTime, cam: { value: new THREE.Vector3() }, a: { value: 0 } }; this.rain = new THREE.LineSegments(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: this.rainU, vertexShader: `attribute float al; varying float vA; uniform float time; uniform vec3 cam; void main(){ vec3 p=position; p.y-=al*0.; float sp=24.; vec3 q; q.x=mod(p.x-cam.x,56.)-28.; q.z=mod(p.z-cam.z,56.)-28.; float by=p.y-al*.75; q.y=mod(by-cam.y-time*sp,26.)-11.+al*.75; vA=al*.4+.06; gl_Position=projectionMatrix*viewMatrix*vec4(q+cam,1.); }`, fragmentShader: 'varying float vA; uniform float a; void main(){gl_FragColor=vec4(.65,.75,.9,vA*a*.55);}' })); this.rain.frustumCulled = false; this.rain.visible = false; this.scene.add(this.rain);
    this.weather = { rain: 0, want: 0, t: 120, flash: 0, cloud: .4 };
  }
  setQuality(q) { this.quality = q; this.resize(); this.sun.shadow.mapSize.setScalar(q === 'low' ? 1024 : q === 'ultra' ? 4096 : 2048); const sd = q === 'ultra' ? 120 : 75; Object.assign(this.sun.shadow.camera, { left: -sd, right: sd, top: sd, bottom: -sd }); this.sun.shadow.camera.updateProjectionMatrix(); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } this.bloom.enabled = true; const s = q === 'high' || q === 'ultra' ? 4 : 0; this.comp.renderTarget1.samples = s; this.comp.renderTarget2.samples = s; this.comp.renderTarget1.dispose(); this.comp.renderTarget2.dispose(); }
  resize() { const w = innerWidth || 1280, h = innerHeight || 720; const dpr = Math.min(devicePixelRatio || 1, this.quality === 'ultra' ? 2 : this.quality === 'high' ? 1.25 : 1) * (this.quality === 'low' ? .7 : 1) * (this.adapt || 1); this.renderer.setPixelRatio(dpr); this.renderer.setSize(w, h, false); this.dpr = dpr; this.compW = 0; const R = G.coop && G.coop.on && G.coop.locals().length > 1 ? G.coop.rects()[0] : null; this.setComp(R ? R[2] : w, R ? R[3] : h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setComp(w, h) { if (this.compW === w && this.compH === h && this.compD === this.dpr) return; this.compW = w; this.compH = h; this.compD = this.dpr; this.comp.setPixelRatio(this.dpr); this.comp.setSize(w, h); this.bloom.setSize(w * this.dpr / 2, h * this.dpr / 2); this.final.uniforms.res.value.set(w, h); }
  setInterior(env) { this.interior = env; if (env) this.envT = -99; }
  update(dt, rdt) {
    const S = G.S, hour = S ? S.hour : 21, W = this.weather; const a = (hour - 6) / 24 * Math.PI * 2; const sy = Math.sin(a); const day = smooth(-.06, .22, sy); const dusk = smooth(-.22, .02, sy) * (1 - smooth(.05, .38, sy)); const night = 1 - day; this.night = night; U.uNight.value = this.interior ? 1 : smooth(.35, .75, night);
    W.t -= dt; if (W.t < 0) { W.t = rand(150, 320); W.want = Math.random() < .4 ? 1 : 0; } W.rain = damp(W.rain, W.force ?? W.want, .25, dt); U.uWet.value = damp(U.uWet.value, W.rain > .3 ? 1 : 0, W.rain > .3 ? .12 : .025, dt); W.cloud = damp(W.cloud, .35 + W.rain * .55, .3, dt); W.flash = Math.max(0, W.flash - rdt * 4); if (W.rain > .7 && Math.random() < dt * .03) { W.flash = 1; setTimeout(() => G.audio.play('thunder', null, .6), 400 + Math.random() * 1800); }
    const K = this.skyU, over = W.rain * .6; const c = (h, ...k) => h; const mixc = (o, x, y, t) => o.copy(x).lerp(y, t);
    const top = _c1.setRGB(.014, .02, .05).lerp(_c2.setRGB(.1, .26, .62), day).lerp(_c3.setRGB(.2, .16, .34), dusk * .6); const hor = _c4.setRGB(.06, .042, .085).lerp(_c2.setRGB(.52, .66, .8), day).lerp(_c3.setRGB(1.0, .42, .2), dusk * .75); top.lerp(_c5.setRGB(.1, .11, .13).multiplyScalar(.3 + day * .9), over); hor.lerp(_c5.setRGB(.34, .37, .4).multiplyScalar(.22 + day * .9), over * .9);
    if (this.redSky) { top.lerp(_c5.setRGB(.2, .01, .02), this.redSky * .7); hor.lerp(_c5.setRGB(.8, .08, .04), this.redSky * .6); }
    K.top.value.copy(top); K.hor.value.copy(hor); K.night.value = night; K.cloud.value = W.cloud; K.flash.value = W.flash; const sd = K.sunD.value.set(Math.cos(a) * .85, sy, .42).normalize(); K.sunC.value.setRGB(1, lerp(.45, .92, smooth(.02, .4, sy)), lerp(.2, .8, smooth(.02, .45, sy)));
    const I = this.interior, cam = this.camera.position; this.skyMesh.visible = !I || I.sky;
    if (I && !I.sky) { this.sun.intensity = I.sun ?? .5; this.sun.color.set(I.sunC || 0xffffff); this.hemi.intensity = (I.hemi ?? 1.1) * 1.75; this.hemi.color.set(I.amb || 0xc8d0e0); this.hemi.groundColor.set(I.gnd || 0x403830); this.scene.fog.color.set(I.fog || 0x050608); this.scene.fog.density = I.fogD ?? .012; this.scene.background = _bg.set(I.fog || 0x050608); this.scene.environmentIntensity = .4; this.rain.visible = false; if (this.final.uniforms.tint) this.final.uniforms.tint.value.set(I.tint || 0xffffff); }
    else {
      this.final.uniforms.tint.value.setRGB(1, 1, 1); this.scene.background = null; const moon = night > .6; const L = moon ? _v.copy(sd).negate() : _v.copy(sd); if (L.y < .14) L.y = .14; L.normalize(); this.sun.color.copy(moon ? _c1.setRGB(.5, .62, 1) : K.sunC.value); this.sun.intensity = (moon ? 1.1 * smooth(.6, .95, night) : 3.9 * smooth(.0, .3, sy)) * (1 - over * .75); this.sunL.copy(L);
      this.hemi.intensity = lerp(1.3, 2.6, day) + W.flash * 2; this.hemi.color.setRGB(.42, .46, .72).lerp(_c2.setRGB(.75, .85, 1), day); this.hemi.groundColor.setRGB(.28, .2, .26).lerp(_c2.setRGB(.36, .33, .3), day); const fc = this.scene.fog.color.copy(hor).multiplyScalar(lerp(.95, .82, day)); this.scene.fog.density = lerp(.00125, .00095, day) + W.rain * .0011; this.scene.environmentIntensity = lerp(.45, .75, day);
      this.rain.visible = W.rain > .05; this.rainU.a.value = W.rain;
      if (Math.abs(hour - this.envHour) > .35 || Math.abs((this.envRain || 0) - W.rain) > .3 || this.envT < 0) { this.envHour = hour; this.envRain = W.rain; this.envT = 1; const old = this.env; this.env = this.pmrem.fromScene(this.envScene, 0, .1, 100); this.scene.environment = this.env.texture; if (old) old.dispose(); }
    }
    for (const f of this.flashes) { f.t = Math.max(0, f.t - rdt); f.l.intensity = f.t > 0 ? f.i * (f.t / f.d) : 0; }
    const u = this.final.uniforms; u.time.value += rdt; u.night.value = night; u.expo.value = I ? (I.expo || 1.35) : lerp(1.75, 1.5, day);
    this.bloom.strength = I ? .5 : lerp(.6, .22, day); this.bloom.threshold = lerp(.85, 1.15, day);
  }
  // everything that depends on whose eyes we are looking through
  view(ctx, rdt) {
    const sm = ctx ? ctx.sm : this.sm, I = this.interior, cam = G.camera.position; const u = this.final.uniforms, M = this.mainFx, X = ctx ? ctx.fx : M, v = k => Math.max(M[k], X[k]); u.dmg.value = v('damage'); u.scan.value = sm.scan = damp(sm.scan || 0, v('scan'), 10, rdt); u.slow.value = sm.slow = damp(sm.slow || 0, v('slow'), 8, rdt); u.glitch.value = v('glitch'); u.fade.value = v('fade'); u.flash.value = v('flash'); u.cyber.value = v('cyber'); u.drunk.value = v('drunk'); u.gray.value = v('gray'); u.letter.value = sm.letter = damp(sm.letter || 0, v('letter'), 6, rdt);
    for (const q of X === M ? [M] : [X]) { q.damage = Math.max(0, q.damage - rdt * 1.2); q.glitch = Math.max(0, q.glitch - rdt * 1.6); q.flash = Math.max(0, q.flash - rdt * 3); }
    if (I && !I.sky) { const f = G.player ? G.player.pos : cam; this.sun.position.set(f.x + 14, f.y + 40, f.z + 9); this.sun.target.position.copy(f); } else { const L = this.sunL, f = G.focus || cam, q = 4, fx = Math.round(f.x / q) * q, fz = Math.round(f.z / q) * q; this.sun.target.position.set(fx, f.y || 0, fz); this.sun.position.set(fx + L.x * 200, (f.y || 0) + L.y * 200, fz + L.z * 200); this.rainU.cam.value.copy(cam); }
    if (!I && G.city) this.lampLights(this.night, sm); else if (!I) for (const p of this.points) p.intensity = 0;
  }
  fadeMain(rdt) { const M = this.mainFx; M.damage = Math.max(0, M.damage - rdt * 1.2); M.glitch = Math.max(0, M.glitch - rdt * 1.6); M.flash = Math.max(0, M.flash - rdt * 3); }
  lampLights(night, sm) {
    const c = G.focus || G.camera.position; sm.lampT = (sm.lampT || 0) - 1; if (sm.lampT <= 0) { sm.lampT = 12; const L = []; for (const l of G.city.lampSpots) { const d = (l[0] - c.x) ** 2 + (l[1] - c.z) ** 2; if (d < 3600) L.push([d, l]); } L.sort((a, b) => a[0] - b[0]); sm.lampNear = L.slice(0, 6); }
    for (let i = 0; i < this.points.length; i++) { const p = this.points[i], n = sm.lampNear && sm.lampNear[i]; if (n && night > .3) { p.position.set(n[1][0], 5.2, n[1][1]); p.color.setHex(0xffb060); p.intensity = 34 * smooth(.3, .7, night); p.distance = 24; } else p.intensity = 0; }
  }
  // keep the frame rate up on slower GPUs by shrinking the internal resolution
  adaptive(dt) { if (document.hidden || dt > .2) return; this.aT = (this.aT || 0) + dt; this.aN = (this.aN || 0) + 1; if (this.aT < 2.5) return; const f = this.aN / this.aT; this.aT = this.aN = 0; const a = this.adapt || 1; let n = a; if (f < 42) n = Math.max(.55, a * .88); else if (f > 57 && a < 1) n = Math.min(1, a * 1.06); if (Math.abs(n - a) > .01) { this.adapt = n; this.resize(); } }
  render() { const w = innerWidth || 1280, h = innerHeight || 720, r = this.renderer; this.setComp(w, h); r.setScissorTest(false); r.setViewport(0, 0, w, h); const c = this.rp.camera = G.camera; if (Math.abs(c.aspect - w / h) > .001) { c.aspect = w / h; c.updateProjectionMatrix(); } this.skyMesh.position.copy(c.position); r.info.reset(); this.comp.render(); }
  renderRect(R) { const [x, y, w, h] = R, H = innerHeight || 720, r = this.renderer; this.setComp(w, h); const c = this.rp.camera = G.camera; if (Math.abs(c.aspect - w / h) > .001) { c.aspect = w / h; c.updateProjectionMatrix(); } c.updateMatrixWorld(); r.setScissorTest(true); r.setScissor(x, H - y - h, w, h); r.setViewport(x, H - y - h, w, h); this.skyMesh.position.copy(c.position); this.comp.render(); }
}
const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color(), _c4 = new THREE.Color(), _c5 = new THREE.Color(), _bg = new THREE.Color(), _v = new THREE.Vector3();
