#!/usr/bin/env python3
"""Local review UI. Outer layer = projects, inner layer = that project's assets + script.

    scripts/ui.py [--port 7878]

Read-only for anything the pipeline generated; editable for the prompt, which is the one
file a human actually needs to change. Feedback is appended to feedback.jsonl, which the
orchestrator reads at every stage -- so notes survive whether or not an agent is running.

Binds to 127.0.0.1 only. There is no auth; do not expose it.
"""
import json, mimetypes, os, subprocess, sys

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(ROOT, "pipeline", "state", "pipeline.json")
PIPE = os.path.join(ROOT, "pipeline")

app = FastAPI(title="ugckit")

STAGE_DIRS = {
    "source":    "00-source",
    "objective": "01-objective",
    "watching":  "02-watching",
    "verbatim":  "03-verbatim",
    "breakdown": "04-breakdown",
    "prompt":    "05-prompt",
    "generated": "06-generated",
    "composite": "07-composite",
}
VIDEO = {".mp4", ".mov", ".webm"}
IMAGE = {".png", ".jpg", ".jpeg", ".webp"}
TEXT = {".txt", ".md", ".json", ".tsv", ".csv"}


def safe(rel: str) -> str:
    """Resolve a client-supplied path inside pipeline/ and refuse anything that escapes."""
    p = os.path.realpath(os.path.join(PIPE, rel))
    if not p.startswith(os.path.realpath(PIPE) + os.sep):
        raise HTTPException(400, "path outside pipeline/")
    return p


def load_state():
    if not os.path.exists(STATE):
        return {"projects": {}, "setup": {"status": "pending"}}
    with open(STATE) as f:
        return json.load(f)


def feedback_rows():
    p = os.path.join(PIPE, "state", "feedback.jsonl")
    if not os.path.exists(p):
        return []
    out = []
    for line in open(p):
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except json.JSONDecodeError:
                pass
    return out


@app.get("/api/projects")
def projects():
    st = load_state()
    names = set(st.get("projects", {}))
    # A project can exist on disk before it is registered -- show it either way.
    for d in STAGE_DIRS.values():
        p = os.path.join(PIPE, d)
        if os.path.isdir(p):
            names |= {n for n in os.listdir(p) if os.path.isdir(os.path.join(p, n))}
    fb = feedback_rows()
    out = []
    for n in sorted(names):
        pj = st.get("projects", {}).get(n, {})
        stages = pj.get("stages", {})
        out.append({
            "name": n,
            "flow": pj.get("flow", "?"),
            "registered": n in st.get("projects", {}),
            "done": sum(1 for k, v in stages.items() if k != "setup" and v.get("status") == "done"),
            "total": max(len(stages) - 1, 0),
            "open_feedback": sum(1 for f in fb if f.get("project") == n and f.get("status") == "open"),
        })
    return {"setup": st.get("setup", {}).get("status", "pending"), "projects": out}


@app.get("/api/project/{name}")
def project(name: str):
    st = load_state()
    pj = st.get("projects", {}).get(name, {})
    assets = []
    for label, d in STAGE_DIRS.items():
        base = os.path.join(PIPE, d, name)
        if not os.path.isdir(base):
            continue
        for dirpath, _, files in os.walk(base):
            for f in sorted(files):
                # Hide our own save backups and editor noise from the asset list.
                if f.startswith(".") or f.endswith((".bak", ".tmp", "~")):
                    continue
                full = os.path.join(dirpath, f)
                ext = os.path.splitext(f)[1].lower()
                kind = ("video" if ext in VIDEO else "image" if ext in IMAGE
                        else "text" if ext in TEXT else "other")
                assets.append({
                    "stage": label,
                    "rel": os.path.relpath(full, PIPE),
                    "name": os.path.relpath(full, base),
                    "kind": kind,
                    "size": os.path.getsize(full),
                    "mtime": os.path.getmtime(full),
                })
    assets.sort(key=lambda a: (-a["mtime"],))
    return {
        "name": name,
        "flow": pj.get("flow", "?"),
        "stages": pj.get("stages", {}),
        "notes": pj.get("notes", []),
        "costs": pj.get("costs", []),
        "assets": assets,
        "feedback": [f for f in feedback_rows() if f.get("project") == name],
        "prompt_rel": f"05-prompt/{name}/prompt.txt",
        "has_prompt": os.path.exists(os.path.join(PIPE, "05-prompt", name, "prompt.txt")),
    }


@app.get("/api/file")
def get_file(rel: str):
    p = safe(rel)
    if not os.path.exists(p):
        raise HTTPException(404, "not found")
    ext = os.path.splitext(p)[1].lower()
    if ext in TEXT:
        return JSONResponse({"text": open(p, errors="replace").read()})
    return FileResponse(p, media_type=mimetypes.guess_type(p)[0] or "application/octet-stream")


@app.get("/api/media")
def media(rel: str):
    """Separate from /api/file so <video> and <img> get a real byte-range response."""
    p = safe(rel)
    if not os.path.exists(p):
        raise HTTPException(404, "not found")
    return FileResponse(p, media_type=mimetypes.guess_type(p)[0] or "application/octet-stream")


class Save(BaseModel):
    rel: str
    text: str


@app.post("/api/save")
def save(body: Save):
    ext = os.path.splitext(body.rel)[1].lower()
    if ext not in TEXT:
        raise HTTPException(400, "only text files are editable here")
    p = safe(body.rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    # Keep one backup. The prompt is the product; an accidental overwrite is expensive.
    if os.path.exists(p):
        with open(p + ".bak", "w") as b:
            b.write(open(p, errors="replace").read())
    with open(p, "w") as f:
        f.write(body.text)
    chars = len(body.text)
    warn = None
    if body.rel.endswith("prompt.txt") and chars > 5000:
        warn = f"{chars} characters — over the 5000 limit, generation will reject this."
    return {"ok": True, "chars": chars, "warning": warn}


class Feedback(BaseModel):
    project: str
    stage: str = "-"
    note: str


@app.post("/api/feedback")
def feedback(body: Feedback):
    if not body.note.strip():
        raise HTTPException(400, "empty note")
    subprocess.run([sys.executable, os.path.join(HERE, "state.py"), "feedback",
                    body.project, body.stage, body.note], check=True)
    return {"ok": True}


class Resolve(BaseModel):
    id: str


@app.post("/api/feedback/resolve")
def resolve(body: Resolve):
    subprocess.run([sys.executable, os.path.join(HERE, "state.py"),
                    "feedback-done", body.id], check=True)
    return {"ok": True}


@app.get("/", response_class=HTMLResponse)
def index():
    return open(os.path.join(HERE, "ui", "index.html")).read()


app.mount("/static", StaticFiles(directory=os.path.join(HERE, "ui")), name="static")

if __name__ == "__main__":
    import uvicorn
    port = 7878
    if "--port" in sys.argv:
        port = int(sys.argv[sys.argv.index("--port") + 1])
    print(f"\n  ugckit UI  ->  http://127.0.0.1:{port}\n  ctrl-c to stop\n")
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
