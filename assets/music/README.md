# Music Assets

Put only music you have the right to publish here.

## How to add music

### Repository playlist

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

### Browser playlist

The site player can also add music from the browser:

- Use `添加本地音乐` to choose local audio files. The player stores the file in IndexedDB for this browser.
- Use `添加 URL` for direct audio links, YouTube, Vimeo, Spotify, or NetEase Cloud Music links.
- Direct audio files play with the browser audio element.
- YouTube, Vimeo, Spotify, and NetEase Cloud Music use embedded players. They may be limited by the platform, region, account, or copyright rules.
- The browser playlist is saved only in the current browser and is not committed to this repository.

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
