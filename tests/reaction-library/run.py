#!/usr/bin/env python3
"""The offline test of the reaction library. Free: a fixture workspace in a temporary folder,
a test video made by ffmpeg, no network. Not shipped (the installer copies template/ only).

    python3 tests/reaction-library/run.py

  - reactions.py: scan finds a post whose notes describe a reaction; add refuses a range past the
    end of the video and an unknown tag; describe never changes a field the user set; fill writes
    the sha256, the preview and the fit; check finds a changed video and a "kept" not set by the user;
  - the fit: face replace refuses two people, speech, a cut and a hidden face;
  - video_plan.py: reactions lists the library before the research; check_library_ref refuses an
    unknown or retired entry and another range without library_differs.

Exit 1 when any expectation fails.
"""
import contextlib, io, json, os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "template")
SCRIPT = os.path.join(KIT, "scripts", "planning", "reactions.py")
RESULTS = []


def expect(label, good, detail=""):
    RESULTS.append(bool(good))
    print(f"{'PASS' if good else 'FAIL'}  {label}")
    if not good and detail:
        print(f"      {detail[:400]}")


def run(ws, *args):
    r = subprocess.run([sys.executable, SCRIPT, *args], capture_output=True, text=True,
                       env={**os.environ, "UGCKIT_ROOT": ws})
    return r.returncode, r.stdout + r.stderr


def main():
    ws = tempfile.mkdtemp(prefix="rx-test-")
    try:
        post = os.path.join(ws, "research", "demo", "brand", "some.handle", "7600000000000000001")
        os.makedirs(post)
        os.makedirs(os.path.join(ws, "scripts"))
        os.symlink(os.path.join(KIT, "scripts", "character"), os.path.join(ws, "scripts", "character"))
        subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "testsrc=duration=4:size=180x320:rate=25",
                        "-pix_fmt", "yuv420p", os.path.join(post, "video.mp4")], check=True)
        with open(os.path.join(post, "notes.md"), "w") as f:
            f.write("## Post\n- URL: https://www.tiktok.com/@some.handle/video/7600000000000000001\n"
                    "- Views: 1,234\n\n**Hook (0-2s):** she looks shocked at the phone\n")
        rel = "research/demo/brand/some.handle/7600000000000000001"
        eid = "rx-tiktok-7600000000000000001-0"

        code, out = run(ws, "scan", "demo")
        expect("scan finds the post whose notes describe a reaction", code == 0 and rel in out and "hook 0–2 s" in out, out)
        code, out = run(ws, "add", rel, "0", "9")
        expect("add refuses a range past the end of the video", code != 0 and "4.00 s long" in out, out)
        code, out = run(ws, "add", rel, "0", "2", "--tags", "nope")
        expect("add refuses an unknown tag", code != 0 and "unknown tag" in out, out)
        code, out = run(ws, "add", rel, "0", "2", "--tags", "surprise")
        expect("add writes a proposed entry", code == 0 and "(proposed)" in out, out)
        code, out = run(ws, "scan", "demo")
        expect("scan leaves out a post in the library", rel not in out, out)

        lib_path = os.path.join(ws, "library", "reactions", "reactions.json")
        lib = json.load(open(lib_path))
        lib["entries"][eid]["tags"] = ["regret"]
        lib["entries"][eid]["set_by_you"] = ["tags"]
        json.dump(lib, open(lib_path, "w"))
        beats = [{"start_s": 0, "end_s": 1, "face": "brows up", "eyes": "at the phone", "head": "back"},
                 {"start_s": 1, "end_s": 2, "face": "a slow smile", "eyes": "to the lens", "head": "tilts"}]
        code, out = run(ws, "describe", eid, "--json", json.dumps({
            "expression_beats": beats, "tags": ["shock"], "speech": "none",
            "framing": {"people": 1, "cuts": 0, "face_hidden_s": 0, "framing": "chest-up"}}))
        e = json.load(open(lib_path))["entries"][eid]
        expect("describe keeps the user's tags", code == 0 and e["tags"] == ["regret"] and "kept the user's tags" in out, out)
        expect("the fit: one face, silent, no cut fits face replace", e["fit"]["face_replace"]["ok"] is True, json.dumps(e["fit"]))

        code, out = run(ws, "describe", eid, "--json", json.dumps({"expression_beats": [{"start_s": 0, "end_s": 5, "face": "x", "eyes": "y", "head": "z"}]}))
        expect("describe refuses a beat outside the range", code != 0, out)

        code, out = run(ws, "fill", eid, "--no-ocr")
        e = json.load(open(lib_path))["entries"][eid]
        expect("fill writes the sha256 and the preview", code == 0 and len(e["source"]["video_sha256"] or "") == 64
               and os.path.exists(os.path.join(ws, e["preview"] or "-")), out)
        code, out = run(ws, "check")
        expect("check passes a filled entry", code == 0, out)

        sys.path.insert(0, os.path.dirname(SCRIPT))
        os.environ["UGCKIT_ROOT"] = ws
        import reactions as rx  # noqa: E402
        base = {"length_s": 2.0, "expression_beats": beats, "speech": "none",
                "framing": {"people": 1, "cuts": 0, "face_hidden_s": 0}}
        for label, change in [("two people", {"framing": {"people": 2, "cuts": 0, "face_hidden_s": 0}}),
                              ("speech", {"speech": "speaks"}),
                              ("a cut", {"framing": {"people": 1, "cuts": 1, "face_hidden_s": 0}}),
                              ("a hidden face", {"framing": {"people": 1, "cuts": 0, "face_hidden_s": 0.8}})]:
            expect(f"the fit: face replace refuses {label}", rx.compute_fit({**base, **change})["face_replace"]["ok"] is False)
        expect("the fit: a clip that speaks fits no route", rx.compute_fit({**base, "speech": "speaks"})["written"]["ok"] is False)
        expect("the fit: unknown until described", rx.compute_fit({"length_s": 2})["face_replace"]["ok"] is None)

        lib = json.load(open(lib_path))
        lib["entries"][eid]["status"] = "kept"
        json.dump(lib, open(lib_path, "w"))
        code, out = run(ws, "check")
        expect("check refuses kept by an agent", code != 0 and "only the user keeps" in out, out)
        lib["entries"][eid]["status"] = "proposed"
        json.dump(lib, open(lib_path, "w"))

        import video_plan as vp  # noqa: E402
        vp.ROOT = ws
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            vp.reactions("demo", job="discovery_regret")
        expect("video_plan reactions lists the library entry first", buf.getvalue().index(eid) < buf.getvalue().index("downloaded post"), buf.getvalue())

        def refusals(r, video):
            o = vp.Out(quiet=True)
            vp.check_library_ref("ref", r, video, o)
            return o.bad
        e = json.load(open(lib_path))["entries"][eid]
        video = e["source"]["video"]
        good = {"library_id": eid, "post_id": "7600000000000000001", "start_s": 0.0, "end_s": 2.0,
                "video_sha256": e["source"]["video_sha256"]}
        expect("check_library_ref passes the entry's post and range", not refusals(good, video), str(refusals(good, video)))
        for label, r in [("an unknown entry", {**good, "library_id": "rx-none"}),
                         ("another range", {**good, "end_s": 1.5}),
                         ("another video", {**good, "video_sha256": "0" * 64})]:
            expect(f"check_library_ref refuses {label}", refusals(r, video))
        expect("check_library_ref takes another range with library_differs",
               not refusals({**good, "end_s": 1.5, "library_differs": "the last half second is a cut"}, video))
        lib = json.load(open(lib_path))
        lib["entries"][eid]["status"] = "retired"
        json.dump(lib, open(lib_path, "w"))
        expect("check_library_ref refuses a retired entry", any("retired" in m for m in refusals(good, video)))
    finally:
        shutil.rmtree(ws, ignore_errors=True)
    print(f"\n{sum(RESULTS)} of {len(RESULTS)} expectations met")
    sys.exit(0 if all(RESULTS) else 1)


if __name__ == "__main__":
    main()
