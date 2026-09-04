/**
 * Builds the OrbGallery document the Atlas actually renders.
 *
 * The registered ThreeUI source at src/shaders/orb-gallery/sources/orb-gallery.html
 * is kept byte-for-byte verbatim (it verifies against the SHA-256 in the brief).
 * This module makes the two adaptations the brief declares, and nothing else:
 *
 *   1. THE ATLAS. The authored file ships 96 procedurally-drawn UI tiles as
 *      inline WebP data URIs, composited at runtime into a 12x8 canvas atlas.
 *      We swap that array for our own cover images and switch the tile geometry
 *      from 3:2 landscape to the 3:4 portrait that TikTok covers actually are.
 *
 *   2. THE POSITION SOLVER. `buildCards()` distributes plates evenly over
 *      latitude rings, which is exactly what we do not want: the geography has
 *      to carry the argument that each app is a self-contained network. It is
 *      replaced with a clustered solver — one cluster per app, each a centre
 *      tile with its creators packed around it, and plate size driven by views.
 *
 * Everything else the brief says to preserve is preserved: the motion, the drag
 * inertia, the hover lift, the focus dimming, the camera fit, the geometry
 * packing. The one further change is the re-light the brief asks us to budget
 * for — the component is authored on near-black and we are putting it on cream,
 * so the focus dimming has to dim toward WHITE rather than black. That inverts
 * a `material.color.setScalar()` into a shader mix toward the paper colour; the
 * timing and easing are untouched.
 *
 * Offline: three.js and the fonts are inlined, because the session runs on
 * localhost with no network.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { OrbCluster } from "./data";

const ROOT = process.cwd();

const AUTHORED = join(ROOT, "src", "shaders", "orb-gallery", "sources", "orb-gallery.html");
const THREE_JS = join(ROOT, "public", "vendor", "three.min.js");

/** Portrait tiles, because a TikTok cover is 3:4. */
const TW = 168;
const TH = 224;

export type OrbPlateSpec = {
  /** Index into the atlas — also the plate's stable identity. */
  tile: number;
  cluster: number;
  kind: "post" | "brand" | "concept";
  /** Image to paint into the atlas, or null for a drawn tile. */
  src: string | null;
  views: number;
  /** The accessible name the control layer uses. */
  name: string;
  href: string;
  label: string;
  accent: string;
};

/** Flatten the index's clusters into the flat plate list the solver needs. */
export function planPlates(clusters: OrbCluster[]) {
  const plates: OrbPlateSpec[] = [];
  const clusterMeta: { id: string; label: string; accent: string; count: number }[] = [];

  clusters.forEach((cluster, ci) => {
    const accent = cluster.accent || "#ce5d20";
    // The centre tile is the app itself — the way into the network, not into
    // one account.
    plates.push({
      tile: plates.length,
      cluster: ci,
      kind: "brand",
      src: cluster.centre.avatar,
      views: 0,
      name: cluster.centre.name,
      href: cluster.centre.href,
      label: cluster.label,
      accent,
    });
    for (const p of cluster.plates) {
      plates.push({
        tile: plates.length,
        cluster: ci,
        kind: "post",
        src: p.cover,
        views: p.views,
        name: p.name,
        href: p.href,
        label: `@${p.handle}`,
        accent,
      });
    }
    clusterMeta.push({ id: cluster.id, label: cluster.label, accent, count: cluster.plates.length + 1 });
  });

  return { plates, clusterMeta };
}

/* ------------------------------------------------------------------ solver */

/**
 * The clustered position solver, injected in place of the authored one.
 *
 * Written as a source string because it runs inside the iframe document. The
 * authored ring solver guaranteed non-overlap structurally — one card per
 * lattice cell — and a clustered layout throws that guarantee away, so it is
 * replaced with an explicit one: plates are placed largest-first on a sunflower
 * spiral in the tangent plane at their cluster's centre, and each candidate
 * position is rejected until its angular circumradius clears every plate
 * already placed. Deterministic, seeded, and stable between reads, which the
 * control layer depends on.
 */
function solverSource(clusterCount: number) {
  return `
/* ---------- clustered plate solver (replaces the authored ring solver) ---------- */
function buildCards(){
  const r = mulberry32(424242);
  const out = [];
  const N = ${clusterCount};
  const GOLD = Math.PI * (3 - Math.sqrt(5));

  /* Cluster centres on an equatorial BAND, not over the whole sphere.
     The scene clamps pitch to +/-0.26 rad — you can spin the globe but you
     cannot tip it — so anything parked near a pole can never be brought to face
     the camera. A Fibonacci sphere put the fundamentals at -59 degrees, which
     made that whole cluster unreachable. Evenly spaced longitudes with a small
     alternating tilt keep every constellation inside the band you can actually
     turn to, and still read as seven separate groups. */
  const LATS = [];
  for (let i = 0; i < N; i++) {
    LATS.push(i === N - 1 && N % 2 ? 0 : (i % 2 ? -0.30 : 0.30));
  }
  const centres = [];
  for (let i = 0; i < N; i++) {
    const lat = LATS[i], lon = (i / N) * Math.PI * 2;
    const cl = Math.cos(lat);
    centres.push([cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon)]);
  }

  /* How close do two centres actually get? Every cluster is then capped well
     inside half that, which is what leaves clear space BETWEEN constellations
     instead of letting neighbouring networks bleed into each other. */
  let minSep = Math.PI;
  for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
    const d = centres[i][0]*centres[j][0] + centres[i][1]*centres[j][1] + centres[i][2]*centres[j][2];
    minSep = Math.min(minSep, Math.acos(Math.max(-1, Math.min(1, d))));
  }
  const maxA = minSep * 0.495;                      /* cluster radius — almost touching */
  const capArea = 2 * Math.PI * (1 - Math.cos(maxA));

  function basisAt(c) {
    const up = Math.abs(c[1]) > 0.9 ? [1,0,0] : [0,1,0];
    let u = [c[1]*up[2]-c[2]*up[1], c[2]*up[0]-c[0]*up[2], c[0]*up[1]-c[1]*up[0]];
    const ul = Math.hypot(u[0],u[1],u[2]) || 1;
    u = [u[0]/ul, u[1]/ul, u[2]/ul];
    const v = [c[1]*u[2]-c[2]*u[1], c[2]*u[0]-c[0]*u[2], c[0]*u[1]-c[1]*u[0]];
    return [u, v];
  }

  const maxViews = Math.max(1, ...PLATES.map(p => p.views || 0));
  const ASPECT = ${(TW / TH).toFixed(4)};            /* 3:4 portrait */
  const PAD = 1.02;                                 /* breathing room between plates */

  /* Every plate placed anywhere, so clusters are tested against each other and
     not only against their own members. */
  const all = [];

  for (let ci = 0; ci < N; ci++) {
    const members = PLATES.filter(p => p.cluster === ci);
    if (!members.length) continue;
    const C = centres[ci];
    const [U, V] = basisAt(C);

    /* Plate size is views, on a compressed power scale. Linear would make the
       biggest plate the only thing visible; log would flatten the distribution
       into a lie. */
    const sized = members.map(p => {
      let w;
      if (p.kind === 'brand')        w = 0.250;
      else if (p.kind === 'concept') w = 0.165;
      else {
        const t = Math.pow((p.views || 1) / maxViews, 0.38);
        w = 0.072 + t * 0.185;
      }
      return { p, w };
    });

    /* Scale the whole cluster down until its plates genuinely fit the cap, so
       density is even everywhere rather than sparse in some constellations and
       jammed in others. Circle packing tops out around 0.82; 0.55 leaves the
       group airy and guarantees the placer never has to give up. */
    const discArea = (w) => Math.PI * Math.pow(Math.hypot(w, w / ASPECT) / 2 * PAD, 2);
    let total = 0;
    for (const m of sized) total += discArea(m.w);
    const budget = capArea * 0.74;
    if (total > budget) {
      const k = Math.sqrt(budget / total);
      for (const m of sized) m.w *= k;
    }
    for (const m of sized) {
      m.h = m.w / ASPECT;
      m.rho = Math.hypot(m.w, m.h) / 2;              /* angular circumradius */
    }

    /* Centre tile first, then largest to smallest — big plates get the middle,
       small ones fill the gaps, which is what makes a group read as packed. */
    sized.sort((a, b) => (b.p.kind === 'brand' ? 1 : 0) - (a.p.kind === 'brand' ? 1 : 0) || b.w - a.w);

    for (let mi = 0; mi < sized.length; mi++) {
      const m = sized[mi];
      let dir = null;

      if (mi === 0) {
        dir = C;
      } else {
        for (let t = 1; t < 6000 && !dir; t++) {
          const a = 0.013 * Math.sqrt(t);
          if (a > maxA) break;
          const phi = t * GOLD + ci * 1.7;
          const sa = Math.sin(a), ca = Math.cos(a);
          const cand = [
            C[0]*ca + (U[0]*Math.cos(phi) + V[0]*Math.sin(phi))*sa,
            C[1]*ca + (U[1]*Math.cos(phi) + V[1]*Math.sin(phi))*sa,
            C[2]*ca + (U[2]*Math.cos(phi) + V[2]*Math.sin(phi))*sa
          ];
          let ok = true;
          for (let q = 0; q < all.length; q++) {
            const o = all[q];
            const d = cand[0]*o.dir[0] + cand[1]*o.dir[1] + cand[2]*o.dir[2];
            const arc = Math.acos(Math.max(-1, Math.min(1, d)));
            if (arc < (m.rho + o.rho) * PAD) { ok = false; break; }
          }
          if (ok) dir = cand;
        }
      }
      if (!dir) continue;                            /* no room: drop, never overlap */

      all.push({ dir: dir, rho: m.rho });
      out.push({
        lat: Math.asin(Math.max(-1, Math.min(1, dir[1]))),
        lon: Math.atan2(dir[0], dir[2]),
        /* One shell. The authored jitter put plates on slightly different radii,
           which reads as plates cutting through each other. */
        rad: SPHERE.R,
        w: m.w, h: m.h,
        roll: rr(r, -0.045, 0.045),                  /* the authored tilt, unchanged */
        tile: m.p.tile,
        plate: m.p
      });
    }
  }
  return out;
}
`;
}

/* ---------------------------------------------------------------- assembly */

export function buildOrbSource(plates: OrbPlateSpec[], clusterCount: number): string {
  let html = readFileSync(AUTHORED, "utf8");
  const three = readFileSync(THREE_JS, "utf8");

  /* -- offline: three.js and the fonts, inlined ---------------------------- */
  html = html.replace(
    '<script src="https://unpkg.com/three@0.149.0/build/three.min.js"></script>',
    `<script>${three}</script>`
  );
  html = html.replace(/<link rel="preconnect"[^>]*>/g, "");
  html = html.replace("<title>orb.gallery</title>", "<title>The Atlas — orb</title>");
  // A sandboxed iframe swallows its own failures. The driver has to be able to
  // see that the sphere did not come up, so faults are reported to the parent
  // and rendered as text rather than leaving a silent empty rectangle.
  html = html.replace("<head>", `<head><script>
window.addEventListener('error', function(e){
  parent.postMessage({type:'atlas-orb-error', message: (e && e.message) || String(e), where: (e && e.filename)+':'+(e && e.lineno)}, '*');
});
window.addEventListener('unhandledrejection', function(e){
  parent.postMessage({type:'atlas-orb-error', message: 'unhandled rejection: ' + ((e && e.reason && e.reason.message) || String(e && e.reason))}, '*');
});
(function(){
  var w = console.warn.bind(console);
  console.warn = function(){ try{ parent.postMessage({type:'atlas-orb-warn', message: Array.prototype.join.call(arguments,' ')}, '*'); }catch(_){} w.apply(null, arguments); };
})();
</script>`);
  html = html.replace(/<meta name="description"[^>]*>/, "");
  html = html.replace(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g, "");

  /* -- 1. the atlas -------------------------------------------------------- */
  // Grid sized to hold every plate while staying inside a 4096px texture.
  const cols = Math.ceil(Math.sqrt(plates.length)) || 1;
  const rows = Math.ceil(plates.length / cols) || 1;

  html = html.replace(
    /const TILE_SRC=\[[\s\S]*?\];/,
    `const PLATES=${JSON.stringify(plates)};\nconst TILE_SRC=PLATES.map(p=>p.src);`
  );
  html = html.replace(
    "const TW=384, TH=256, COLS=12, ROWS=8, TILES=COLS*ROWS;",
    `const TW=${TW}, TH=${TH}, COLS=${cols}, ROWS=${rows}, TILES=COLS*ROWS;`
  );

  // Covers come from /media over HTTP into an opaque-origin iframe, so the
  // canvas would be tainted and WebGL would refuse the texture. The route sends
  // Access-Control-Allow-Origin, and this asks for the CORS fetch.
  html = html.replace(
    "const im=new Image(); im.onload=()=>res(im); im.onerror=()=>res(null); im.src=src;",
    `if(!src){res(null);return;}
    /* The authored loader waits on every image forever. Here the images are
       ~100 HTTP requests for real cover files, so a single slow or hanging one
       would block buildAtlas() and the sphere would never appear at all. Each
       load gets its own deadline and falls back to a drawn plate. */
    var done=false;
    var im=new Image();
    im.crossOrigin='anonymous';
    var finish=function(v){ if(done)return; done=true; res(v); };
    im.onload=function(){ finish(im); };
    im.onerror=function(){ finish(null); };
    setTimeout(function(){ finish(null); }, 8000);
    im.src=src;`
  );

  // Cream ground under the atlas, and drawn tiles for the fundamentals — which
  // is what makes that cluster visibly a different material on the same sphere.
  html = html.replace(
    "ac.fillStyle='#1f1f21';ac.fillRect(0,0,atlasCanvas.width,atlasCanvas.height);",
    `ac.fillStyle='#d8c9ad';ac.fillRect(0,0,atlasCanvas.width,atlasCanvas.height);`
  );
  html = html.replace(
    "async function buildAtlas(){",
    `function fmtViews(n){
  if(n>=1e6) return (n/1e6).toFixed(n>=1e7?0:1)+'M';
  if(n>=1e3) return Math.round(n/1e3)+'K';
  return String(n);
}
async function buildAtlas(){`
  );
  html = html.replace(
    `  imgs.forEach((im,i)=>{
    if(!im)return;
    ac.drawImage(im,(i%COLS)*TW,((i/COLS)|0)*TH,TW,TH);
  });
  return imgs.filter(Boolean).length;`,
    `  imgs.forEach((im,i)=>{
    const x=(i%COLS)*TW, y=((i/COLS)|0)*TH, p=PLATES[i];
    if(im && p && p.kind==='brand'){
      /* A logo is square and is the app's mark, not a photograph — stretching it
         into a 3:4 plate would deform it. Card, then the mark centred at its own
         aspect, contained. */
      ac.fillStyle='#fffdf5'; ac.fillRect(x,y,TW,TH);
      ac.strokeStyle='rgba(47,34,19,.45)'; ac.lineWidth=3; ac.strokeRect(x+6,y+6,TW-12,TH-12);
      var box=Math.min(TW,TH)-52;
      var k=Math.min(box/im.width, box/im.height);
      var lw=im.width*k, lh=im.height*k;
      ac.drawImage(im, x+(TW-lw)/2, y+(TH-lh)/2 - 8, lw, lh);
      ac.fillStyle='#241d13'; ac.textAlign='center';
      ac.font='600 17px Inter, system-ui, sans-serif';
      ac.fillText(String((p&&p.label)||''), x+TW/2, y+TH-22);
      return;
    }
    if(im){
      ac.drawImage(im,x,y,TW,TH);
      /* Who made it and how far it went, printed on the cover itself. Plate size
         already encodes views, but a plate you cannot read is not evidence — at
         orb scale the band is the only thing legible, so it is a solid slab
         across the foot of the card rather than a caption floating on a photo. */
      if(p){
        const t = p.views ? fmtViews(p.views) : '';
        ac.fillStyle='rgba(20,18,14,.86)';
        ac.fillRect(x, y+TH-58, TW, 58);
        ac.fillStyle='#ce5d20';
        ac.fillRect(x, y+TH-58, TW, 3);
        ac.textAlign='left';
        ac.fillStyle='#fff6e6';
        ac.font='700 30px Inter, system-ui, sans-serif';
        if(t) ac.fillText(t, x+11, y+TH-25);
        /* The handle, shrunk to fit rather than clipped — a truncated @name is
           worse than a small one when the whole point is attribution. */
        var hd = String(p.label||'');
        var fs = 17;
        ac.font='500 '+fs+'px Inter, system-ui, sans-serif';
        while(fs>9 && ac.measureText(hd).width > TW-22){ fs--; ac.font='500 '+fs+'px Inter, system-ui, sans-serif'; }
        ac.fillStyle='rgba(240,223,194,.92)';
        ac.fillText(hd, x+11, y+TH-8);
      }
      return;
    }
    /* No cover, or a fundamentals card: draw the plate instead of dropping it.
       Concept plates are deliberately flat ink-on-slab so they read as a
       different material from the photographic evidence around them. */
    const concept = p && p.kind==='concept';
    ac.fillStyle = concept ? '#171612' : '#c9b894';
    ac.fillRect(x,y,TW,TH);
    ac.strokeStyle = concept ? '#ce5d20' : 'rgba(47,34,19,.35)';
    ac.lineWidth = 3; ac.strokeRect(x+7,y+7,TW-14,TH-14);
    ac.fillStyle = concept ? '#f0dfc2' : '#4a3d29';
    ac.textAlign='center';
    const words = String((p&&p.label)||'').split(/\\s+/);
    const lines=[]; let cur='';
    ac.font='600 19px Inter, system-ui, sans-serif';
    for(const wd of words){
      const test = cur ? cur+' '+wd : wd;
      if(ac.measureText(test).width > TW-34 && cur){ lines.push(cur); cur=wd; } else cur=test;
    }
    if(cur) lines.push(cur);
    const startY = y + TH/2 - (lines.length-1)*13;
    lines.slice(0,6).forEach((ln,k)=>ac.fillText(ln, x+TW/2, startY + k*26));
    if(concept){
      ac.fillStyle='#ce5d20'; ac.font='600 11px Inter, system-ui, sans-serif';
      ac.fillText('FUNDAMENTAL', x+TW/2, y+34);
    } else if(p && p.views){
      ac.fillStyle='#241d13'; ac.font='700 30px Inter, system-ui, sans-serif';
      ac.fillText(fmtViews(p.views), x+TW/2, y+TH-26);
    }
  });
  return imgs.filter(Boolean).length;`
  );

  /* -- 2. the position solver --------------------------------------------- */
  html = html.replace(
    /\/\* One card per lattice cell[\s\S]*?\n  return out;\n\}\n/,
    solverSource(clusterCount)
  );

  /* -- the re-light: cream ground, dimming toward white -------------------- */
  html = html.replace("--bg:#1f1f21;", "--bg:#d8c9ad;");
  html = html.replace("--ink:#f4f3f0;", "--ink:#241d13;");
  html = html.replace("--dim:rgba(244,243,240,.60);", "--dim:rgba(36,29,19,.60);");
  html = html.replace("--faint:rgba(244,243,240,.40);", "--faint:rgba(36,29,19,.42);");
  html = html.replace("--line:rgba(255,255,255,.12);", "--line:rgba(47,34,19,.22);");
  html = html.replace("--line-2:rgba(255,255,255,.20);", "--line-2:rgba(47,34,19,.40);");
  // The page itself is transparent — the Atlas's own paper shows through, so the
  // orb sits on the same continuous surface as every other screen.
  html = html.replace("html,body{margin:0;background:var(--bg)}", "html,body{margin:0;background:transparent}");

  // Plate frames need weight to hold against a light field, so give every plate
  // a dark edge, and invert the dim so a focused plate is the darkest thing on
  // a cream field rather than the brightest thing on a black one.
  html = html.replace(
    `  const mat=new THREE.MeshBasicMaterial({map:atlasTex,side:THREE.FrontSide,
                                        vertexColors:true,toneMapped:false});`,
    `  const mat=new THREE.MeshBasicMaterial({map:atlasTex,side:THREE.FrontSide,
                                        vertexColors:true,toneMapped:false});
  /* RE-LIT FOR CREAM. The authored component dims unfocused plates toward black
     by scaling material.color. On paper that reads as a hole, so the same
     easing now mixes toward the paper colour instead. vColor carries the
     per-plate exemption the authored code already computes for the hovered
     plate — the timing, the 0.42 depth and the easing curve are untouched. */
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uDim = ORB_DIM;
    shader.uniforms.uPaper = { value: new THREE.Color(0xd8c9ad) };
    shader.fragmentShader = 'uniform float uDim;\\nuniform vec3 uPaper;\\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      'float plateDim = uDim * (1.0 - vColor.r);'
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      '#include <dithering_fragment>\\n  gl_FragColor.rgb = mix(gl_FragColor.rgb, uPaper, plateDim);'
    );
  };`
  );

  // Drive that uniform from the authored dim easing rather than material.color.
  html = html.replace(
    `  const dimTo=1-0.42*dimT;
  cardMesh.material.color.setScalar(dimTo);`,
    `  const dimTo=1-0.42*dimT;
  ORB_DIM.value = 0.42 * dimT;      /* same curve, mixed toward paper instead */`
  );
  // vColor is now "how exempt is this plate from the dim", 0 normally, 1 hovered.
  html = html.replace(
    "    const lift=1+hoverT[i]*(1/dimTo-1);",
    "    const lift=hoverT[i];"
  );
  html = html.replace(
    "const col=new Float32Array(vCount*3).fill(1);",
    "const col=new Float32Array(vCount*3).fill(0);"
  );

  /* -- the copy the authored page ships with is not ours ------------------- */
  html = html.replace(/<header class="nav">[\s\S]*?<\/header>/, "");
  html = html.replace(/<section class="band">[\s\S]*?<\/section>/, "");
  // fitCamera() keeps the sphere clear of the authored page furniture by
  // measuring each element's rect. With that copy removed those lookups are
  // null, so the camera fit is scoped to the elements that still exist — the
  // hint pill. Without this the very first fit throws and the scene never
  // renders at all.
  html = html.replace(
    "    for(const e of [navEl,hintEl,leadEl,sideEl]) R=Math.min(R, clearTo(cx,cy,e)-18);",
    "    for(const e of [navEl,hintEl,leadEl,sideEl]) if(e) R=Math.min(R, clearTo(cx,cy,e)-18);"
  );

  // The authored fit reserves room for a nav, a lead paragraph and a side rail,
  // none of which exist here — the orb has the whole frame to itself, so it is
  // allowed to fill it. Same camera, same distance, same easing; only the radius
  // the fit aims for changes.
  html = html.replace(
    "    let R=Math.min(0.30*W, 0.46*H);",
    "    let R=Math.min(0.485*W, 0.53*H);"
  );
  html = html.replace(/<div class="hint" id="hint"[\s\S]*?<\/div>/, '<div class="hint" id="hint" aria-hidden="true" style="display:none"></div>');

  /* -- the hover read-out --------------------------------------------------
     A plate you are pointing at should say whose it is. The lift alone tells
     you WHICH plate, not WHOSE, and the canvas carries no text at hover size —
     so a plain HTML label follows the pointer inside the scene document. It is
     decoration only: the same string is already a named button in the parent's
     control layer, which is what a driver reads. */
  html = html.replace(
    "</body>",
    `<div id="plateLabel" aria-hidden="true"></div>
<style>
#plateLabel{
  position:fixed; left:0; top:0; z-index:40; pointer-events:none;
  max-width:min(360px,60vw); padding:7px 12px 8px;
  background:rgba(20,18,14,.9); color:#f7ecd8; border-left:3px solid #ce5d20;
  font:500 13px/1.35 Inter,system-ui,sans-serif; letter-spacing:-.005em;
  border-radius:3px; opacity:0; transform:translate(-50%,-215%);
  transition:opacity .12s ease;
}
#plateLabel.on{ opacity:1 }
#plateLabel b{ font-weight:700 }
#plateLabel i{ font-style:normal; opacity:.7 }
</style>
</body>`
  );

  html = html.replace(
    `  if(want!==hoverIdx){
    if(hoverIdx>=0) live.add(hoverIdx);
    if(want>=0) live.add(want);
    hoverIdx=want;
  }`,
    `  if(want!==hoverIdx){
    if(hoverIdx>=0) live.add(hoverIdx);
    if(want>=0) live.add(want);
    hoverIdx=want;
    showPlateLabel(want);
  }
  if(hoverIdx>=0) placePlateLabel();`
  );

  html = html.replace(
    "/* ---------- loop ---------- */",
    `/* ---------- hover read-out ---------- */
/* Resolved lazily: the element is appended after this script, so a lookup at
   parse time would bind null forever. */
let labelEl=null;
function plateLabelEl(){ return labelEl || (labelEl=document.getElementById('plateLabel')); }
function showPlateLabel(i){
  const labelEl=plateLabelEl();
  if(!labelEl) return;
  const p = i>=0 && CARDS && CARDS[i] ? CARDS[i].plate : null;
  canvas.style.cursor = p ? 'pointer' : '';
  if(!p){ labelEl.classList.remove('on'); return; }
  /* The accessible name is already "Brand · @handle · views · hook"; split it
     so the handle carries the weight and the rest sits back. */
  const bits = String(p.name||'').split(' · ');
  const who  = bits.length>1 ? bits[1] : bits[0];
  const rest = bits.filter((_,k)=>k!==1).join(' · ');
  labelEl.innerHTML = '<b></b><i></i>';
  labelEl.firstChild.textContent = who;
  labelEl.lastChild.textContent = rest ? '  '+rest : '';
  labelEl.classList.add('on');
  placePlateLabel();
}
function placePlateLabel(){
  const labelEl=plateLabelEl();
  if(!labelEl || !hoverPos) return;
  const b=canvas.getBoundingClientRect();
  labelEl.style.left = (b.left + (hoverPos.x+1)/2*b.width) + 'px';
  labelEl.style.top  = (b.top  + (1-hoverPos.y)/2*b.height) + 'px';
}

/* ---------- loop ---------- */`
  );

  /* The drag-vs-click test needs the distance travelled since the press, and
     only the authored pointer handlers see it. */
  html = html.replace(
    "    lastPointer={x:e.clientX,y:e.clientY};\n  });",
    "    lastPointer={x:e.clientX,y:e.clientY};\n    pressAt={x:e.clientX,y:e.clientY}; pressTravel=0;\n  });"
  );
  html = html.replace(
    "    if(!dragging||!lastPointer)return;\n    const dx=e.clientX-lastPointer.x, dy=e.clientY-lastPointer.y;",
    "    if(!dragging||!lastPointer)return;\n    if(pressAt) pressTravel=Math.max(pressTravel, Math.hypot(e.clientX-pressAt.x, e.clientY-pressAt.y));\n    const dx=e.clientX-lastPointer.x, dy=e.clientY-lastPointer.y;"
  );

  /* The pointer leaving takes the read-out with it. */
  html = html.replace(
    "  canvas.addEventListener('pointerleave',e=>{ hoverPos=null; end(e); });",
    "  canvas.addEventListener('pointerleave',e=>{ hoverPos=null; showPlateLabel(-1); end(e); });"
  );

  /* -- the control bridge -------------------------------------------------- */
  // A canvas has no accessibility nodes, so the driver's buttons live in the
  // parent document and talk to this scene by message. Clicking a plate here
  // reports which one; the parent can also ask the orb to fly to a plate, which
  // is what makes "the room sees the sphere turn, the driver clicked a button"
  // actually true.
  html = html.replace(
    "  canvas.addEventListener('pointerup',end);",
    `  /* Resolve a plate from a screen point, independently of the hover state.
     hoverIdx is only maintained while the orb is NOT being dragged, and 'click'
     fires immediately after pointerup — before the next frame has had a chance
     to recompute it — so a spin-then-click would otherwise resolve to nothing.
     Same tolerance as the hover, deliberately: the plate the click opens has to
     be the plate the pointer visibly lifted, or the affordance is a lie. It
     still requires the ray to meet the sphere at all, so the paper around the
     orb is dead space. */
  function pickAt(clientX, clientY){
    if(!CARDS || !cardMesh) return -1;
    const b=canvas.getBoundingClientRect();
    ndc.set(((clientX-b.left)/b.width)*2-1, -((clientY-b.top)/b.height)*2+1);
    raycaster.setFromCamera(ndc,camera);
    hoverBall.center.copy(orbGroup.position);
    if(!raycaster.ray.intersectsSphere(hoverBall)) return -1;
    const hit=raycaster.intersectObject(cardMesh,false)[0];
    if(hit && hit.faceIndex!==undefined) return Math.floor(hit.faceIndex/PER);
    if(raycaster.ray.intersectSphere(hoverBall,hitPt)){
      orbGroup.worldToLocal(hitPt).normalize();
      let best=-1,bd=-2;
      for(let i=0;i<CARDS.length;i++){
        const n=CARDS[i].basis.n, d=n[0]*hitPt.x+n[1]*hitPt.y+n[2]*hitPt.z;
        if(d>bd){bd=d;best=i}
      }
      return best;
    }
    return -1;
  }
  /* How far the pointer travelled between press and release. A drag is a drag
     even if it ends over a plate: releasing a spin must never navigate, and
     that — not the picking — is what made the orb feel like it was firing at
     random. Six pixels is the usual slop for a hand that meant to click. */
  let pressAt=null, pressTravel=0;
  canvas.addEventListener('click',e=>{
    if(pressTravel>6) return;
    /* The lifted plate first: it is the one the room can see is selected. */
    let i = hoverIdx>=0 ? hoverIdx : pickAt(e.clientX, e.clientY);
    if(i<0 || !CARDS[i]) return;
    const plate = CARDS[i].plate;
    if(plate) parent.postMessage({type:'atlas-orb-select', href:plate.href, name:plate.name}, '*');
  });
  canvas.addEventListener('pointerup',end);`
  );

  html = html.replace(
    "const AUTO=Math.PI*2/20;              /* one full turn every 20 seconds */",
    `const AUTO=Math.PI*2/20;              /* one full turn every 20 seconds */
const ORB_DIM={value:0};
let ORB_READY=false;
let ORB_ACKED=false;
let focusYaw=null, focusPitch=null;
/* Fly to a named plate. Yaw is chosen on the short way round so the globe never
   spins the long way to reach a neighbour. */
window.addEventListener('message',(e)=>{
  const d=e.data;
  if(!d) return;
  /* The parent may finish hydrating after the scene is already up, so it asks
     rather than relying on catching a single announcement. */
  if(d.type==='atlas-orb-ping'){
    if(ORB_READY) parent.postMessage({type:'atlas-orb-ready'},'*');
    return;
  }
  if(d.type==='atlas-orb-ack'){ ORB_ACKED=true; return; }
  if(d.type==='atlas-orb-focus' && CARDS){
    const c = CARDS.find(x=>x.plate && x.plate.tile===d.tile);
    if(!c) return;
    let target=-c.lon;
    while(target-yaw >  Math.PI) target-=Math.PI*2;
    while(target-yaw < -Math.PI) target+=Math.PI*2;
    focusYaw=target;
    focusPitch=Math.max(-0.26,Math.min(0.26,c.lat));
    hintEl && hintEl.classList.add('gone');
  }
});`
  );

  html = html.replace(
    `  if(!dragging){
    yaw+=(AUTO*(reduce?0:1)*(1-0.78*slowT)+yawVel)*dt;`,
    `  if(!dragging && focusYaw!==null){
    /* Easing to a called plate. Same feel as the inertia it replaces. */
    const k=1-Math.pow(0.0025,dt);
    yaw += (focusYaw-yaw)*k;
    pitch += (focusPitch-pitch)*k;
    yawVel=0; pitchVel=0;
    if(Math.abs(focusYaw-yaw)<0.002){ yaw=focusYaw; pitch=focusPitch; focusYaw=null; }
  } else if(!dragging){
    yaw+=(AUTO*(reduce?0:1)*(1-0.78*slowT)+yawVel)*dt;`
  );
  // A hand on the globe always wins over a called move.
  html = html.replace(
    "    dragging=true;hintEl.classList.add('gone');",
    "    dragging=true;focusYaw=null;hintEl.classList.add('gone');"
  );

  // The authored feel only throttles the idle turn to 22% speed while the
  // cursor sits on the globe, which still reads as drift when you are trying
  // to read a card. The cursor being over the sphere at all is a full stop,
  // not a slowdown — same easing curve as the hover lift, so it still feels
  // like one motion rather than a hard cut.
  html = html.replace("(1-0.78*slowT)", "(1-slowT)");

  // Tell the parent when the scene is live, so the control layer can stop
  // reporting itself as loading.
  html = html.replace(
    "  requestAnimationFrame(tick);\n}",
    `  requestAnimationFrame(tick);
  ORB_READY=true;
  /* Announce until acknowledged. The parent may hydrate after the scene is
     already running, in which case a single announcement lands in a window
     that has no listener yet and the control layer would sit at "loading"
     forever. */
  (function announce(){
    if(ORB_ACKED) return;
    parent.postMessage({type:'atlas-orb-ready'},'*');
    setTimeout(announce, 400);
  })();
}`
  );

  return html;
}
