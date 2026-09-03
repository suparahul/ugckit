const $ = s => document.querySelector(s);
let current = null, currentAsset = null;

const fmtSize = b => b > 1e6 ? (b/1048576).toFixed(1)+' MB'
                  : b > 1e3 ? (b/1024).toFixed(0)+' KB' : b+' B';
const esc = s => String(s).replace(/[&<>"]/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

async function loadProjects() {
  const d = await (await fetch('/api/projects')).json();
  const pill = $('#setup-pill');
  const ready = d.setup === 'done';
  pill.textContent = ready ? 'setup complete' : 'setup incomplete — run the setup skill';
  pill.className = 'pill ' + (ready ? 'ok' : 'bad');

  $('#project-list').innerHTML = d.projects.map(p => `
    <li data-name="${esc(p.name)}" class="${p.name===current?'active':''}">
      <div>${esc(p.name)}</div>
      <div class="meta">
        <span>${esc(p.flow)}</span>
        <span>${p.total ? p.done+'/'+p.total : 'unregistered'}</span>
        ${p.open_feedback ? `<span class="badge">${p.open_feedback}</span>` : ''}
      </div>
    </li>`).join('') || '<li style="color:var(--dim);cursor:default">no projects yet</li>';

  document.querySelectorAll('#project-list li[data-name]').forEach(li =>
    li.onclick = () => selectProject(li.dataset.name));

  // Land on something useful rather than an empty pane.
  if (!current && d.projects.length) selectProject(d.projects[0].name);
}

async function selectProject(name) {
  current = name; currentAsset = null;
  document.querySelectorAll('#project-list li').forEach(li =>
    li.classList.toggle('active', li.dataset.name === name));
  const p = await (await fetch('/api/project/' + encodeURIComponent(name))).json();
  render(p);
}

function render(p) {
  const stages = Object.entries(p.stages).filter(([k]) => k !== 'setup');
  const spend = (p.costs||[]).reduce((a,c)=>a+c.usd, 0);
  const newest = p.assets.find(a => a.kind === 'video');

  $('#detail').className = '';
  $('#detail').innerHTML = `
    <h1>${esc(p.name)}</h1>
    <div class="sub">flow: ${esc(p.flow)}${spend ? ` · computed spend $${spend.toFixed(2)}` : ''}</div>
    <div class="stages">${stages.map(([k,v]) =>
      `<span class="stage ${v.status}">${k}</span>`).join('')}</div>

    <div class="grid">
      <div>
        <div class="card">
          <h2>Preview</h2>
          <div id="viewer">${newest
            ? `<video src="/api/media?rel=${encodeURIComponent(newest.rel)}" controls></video>`
            : '<div class="placeholder">nothing generated yet</div>'}</div>
          <div class="count" id="viewer-label">${newest ? esc(newest.name) : ''}</div>
        </div>
        <div class="card">
          <h2>Assets</h2>
          <div class="assets" id="assets">${p.assets.map((a,i) => `
            <div class="asset" data-i="${i}">
              <span class="k">${a.kind}</span>
              <span class="n" title="${esc(a.rel)}">${esc(a.name)}</span>
              <span class="s">${fmtSize(a.size)}</span>
            </div>`).join('') || '<div class="placeholder">none</div>'}</div>
        </div>
      </div>

      <div>
        <div class="card">
          <h2>Prompt — the product. Edit here, regenerate in the agent.</h2>
          ${p.has_prompt
            ? `<textarea id="prompt"></textarea>
               <div class="row">
                 <button id="save">Save</button>
                 <span class="count" id="chars"></span>
                 <span class="msg" id="saved"></span>
               </div>`
            : '<div class="placeholder">no prompt.txt yet — run the script skill</div>'}
        </div>

        <div class="card">
          <h2>Feedback to the agent</h2>
          <textarea id="note" style="min-height:70px"
            placeholder="e.g. the cat disappears in the last 5 seconds"></textarea>
          <div class="row">
            <button id="send">Send</button>
            <span class="count">queued to feedback.jsonl — the orchestrator reads it each stage</span>
          </div>
          <div style="margin-top:12px">${(p.feedback||[]).slice().reverse().map(f => `
            <div class="fb ${f.status==='done'?'done':''}">
              ${f.status==='open' ? `<a class="act" data-fb="${f.id}">resolve</a>` : ''}
              <div>${esc(f.note)}</div>
              <div class="when">${esc(f.ts)} · ${esc(f.stage)}</div>
            </div>`).join('') || '<div class="placeholder">no feedback yet</div>'}</div>
        </div>
      </div>
    </div>`;

  p.assets.forEach((a,i) => {
    const el = document.querySelector(`.asset[data-i="${i}"]`);
    if (el) el.onclick = () => showAsset(a, i);
  });
  document.querySelectorAll('[data-fb]').forEach(el => el.onclick = async () => {
    await fetch('/api/feedback/resolve', {method:'POST',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify({id: el.dataset.fb})});
    selectProject(current); loadProjects();
  });

  if (p.has_prompt) loadPrompt(p.prompt_rel);
  $('#send').onclick = sendFeedback;
}

async function showAsset(a, i) {
  document.querySelectorAll('.asset').forEach(e => e.classList.toggle('active', e.dataset.i == i));
  $('#viewer-label').textContent = a.rel;
  const v = $('#viewer'), url = '/api/media?rel=' + encodeURIComponent(a.rel);
  if (a.kind === 'video')      v.innerHTML = `<video src="${url}" controls autoplay muted></video>`;
  else if (a.kind === 'image') v.innerHTML = `<img class="preview" src="${url}">`;
  else if (a.kind === 'text') {
    const d = await (await fetch('/api/file?rel=' + encodeURIComponent(a.rel))).json();
    v.innerHTML = `<pre class="text">${esc(d.text)}</pre>`;
  } else v.innerHTML = '<div class="placeholder">no preview for this file type</div>';
}

async function loadPrompt(rel) {
  const d = await (await fetch('/api/file?rel=' + encodeURIComponent(rel))).json();
  const ta = $('#prompt'); ta.value = d.text;
  const count = () => {
    // Characters, not bytes — an em dash is 3 bytes but 1 character, and the model
    // counts characters. Getting this wrong rejects valid prompts.
    const n = [...ta.value].length;
    $('#chars').textContent = `${n} / 5000 characters`;
    $('#chars').className = 'count' + (n > 5000 ? ' over' : '');
  };
  ta.oninput = count; count();
  $('#save').onclick = async () => {
    const r = await (await fetch('/api/save', {method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({rel, text: ta.value})})).json();
    const m = $('#saved');
    m.textContent = r.warning || 'saved';
    m.className = 'msg' + (r.warning ? ' err' : '');
    setTimeout(() => m.textContent = '', 4000);
  };
}

async function sendFeedback() {
  const ta = $('#note');
  if (!ta.value.trim()) return;
  await fetch('/api/feedback', {method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({project: current, stage: '-', note: ta.value})});
  ta.value = '';
  selectProject(current); loadProjects();
}

loadProjects();
setInterval(loadProjects, 5000);   // pick up stages finishing while the tab is open
