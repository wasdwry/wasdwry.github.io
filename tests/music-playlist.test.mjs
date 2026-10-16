import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildMusicPlaylist } from '../scripts/build-music-playlist.mjs';

async function library(t) {
    const root = await mkdtemp(join(tmpdir(), 'wasdwry-music-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const put = async (name, contents = 'audio fixture') => {
        const path = join(root, 'assets/music', name);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, contents);
        return path;
    };
    return { root, put };
}

test('discovers nested audio and mixed-case extensions without treating docs or artwork as music', async t => {
    const { root, put } = await library(t);
    for (const name of ['Day.MP3', '夜晚/海浪.ogg', 'room/piano.m4a', 'rain.wav', 'wind.aac', 'sea.flac', 'fire.opus', 'README.md', 'cover.jpg', 'playlist.json', '.hidden.mp3', '.hidden/secret.mp3']) await put(name);
    const tracks = await buildMusicPlaylist(root);
    assert.deepEqual(tracks.map(track => track.title).sort(), ['Day', '海浪', 'piano', 'rain', 'wind', 'sea', 'fire'].sort());
    assert.ok(tracks.every(track => !track.src.includes('\\')));
    assert.deepEqual(await buildMusicPlaylist(root), tracks, 'unchanged input produces an identical playlist');
});

test('Chinese names and URL-reserved characters resolve to the exact uploaded file', async t => {
    const { root, put } = await library(t);
    const name = '海 风 #100% & +/我的音乐 #1.MP3';
    await put(name);
    const [track] = await buildMusicPlaylist(root);
    const url = new URL(track.src, 'https://wasdwry.github.io/');
    assert.equal(track.title, '我的音乐 #1');
    assert.equal(decodeURIComponent(url.pathname), '/assets/music/' + name);
    assert.equal(url.hash, '');
    assert.match(url.searchParams.get('v'), /^[0-9a-f]{16}$/);
    assert.equal([...url.searchParams].length, 1);
});

test('replacing, renaming and deleting uploads refreshes the playlist without stale entries', async t => {
    const { root, put } = await library(t);
    const path = await put('before.mp3', 'first version');
    const [before] = await buildMusicPlaylist(root);
    await put('before.mp3', 'replacement audio');
    const [replacement] = await buildMusicPlaylist(root);
    assert.notEqual(replacement.src, before.src, 'same-path replacements get a fresh cache key');
    const renamed = join(dirname(path), 'after.mp3');
    await rename(path, renamed);
    const [after] = await buildMusicPlaylist(root);
    assert.equal(after.title, 'after');
    assert.ok(!after.src.includes('before'));
    await rm(renamed);
    assert.deepEqual(await buildMusicPlaylist(root), []);
});

test('a new or empty music folder produces an empty playlist', async t => {
    const { root, put } = await library(t);
    assert.deepEqual(await buildMusicPlaylist(root), []);
    await put('README.md');
    assert.deepEqual(await buildMusicPlaylist(root), []);
});
