# The music library

The tracks a reel can carry: the post page's **Music** dropdown lists every file here, and `scripts/add-audio.mjs`
lays the chosen one under `video/reel-final.mp4`. A TikTok photo carousel cannot carry sound; only the reel does.

Each folder is a group. The dropdown shows the groups in turn, the handle's own group first, and a handle picks its
group with a `Music:` line in its `HANDLE.md` (`Music: calm`). With that line, a reel made for the handle gets a track
of its group by itself (picked by a hash of the post key, so the same post keeps the same track); without it, the reel
stays silent until a track is chosen on the post page.

- `calm/`: lullabies, soft piano, music box, acoustic, gentle guitar, lofi, dreamy. 55 tracks.
- `upbeat/`: ukulele, whistle, playful, upbeat acoustic, cheerful, happy pop. 54 tracks.

Add your own: drop mp3, m4a, wav, aac or ogg files into a folder here (a new folder is a new group). `ugckit update`
only replaces the files it shipped; yours stay.

## Where the tracks come from

- `NN-*.mp3` (01–06 in each group): generated with ElevenLabs Music v2.5, instrumental, 30 s.
- `px-*.mp3`: Pixabay Music (pixabay.com/music/). Most file names end in the Pixabay page id
  (`pixabay.com/music/<name>-<id>/`). Lengths 25–220 s. Some Pixabay tracks are registered with Content ID, which can
  trigger claims on YouTube.
- `px-vox-*.mp3`: Pixabay tracks with sung English vocals (checked with a Whisper pass). The lyrics were only skimmed:
  listen before pairing one with a post.

Check each source's licence for your own use before you publish with a track.
