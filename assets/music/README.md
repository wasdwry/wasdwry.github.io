# Music Assets

Put only music you have the right to publish here.

## How to add music

1. Put your authorized audio file in this folder, for example `lofi-study.mp3`.
2. Open `assets/music/playlist.json`.
3. Add one item for the file:

```json
{
  "title": "Lofi Study",
  "artist": "wasdwry",
  "src": "assets/music/lofi-study.mp3"
}
```

4. Keep `playlist.json` as a JSON array. If there are multiple songs, separate items with commas.
5. Commit and push both the audio file and `playlist.json`.

Supported playlist format:

```json
[
  {
    "title": "Example",
    "artist": "wasdwry",
    "src": "assets/music/example.mp3"
  }
]
```

Do not add third-party commercial songs unless you have explicit permission.
