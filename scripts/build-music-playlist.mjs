import { createReadStream } from 'node:fs';
import { readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const audioExtensions = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac', '.opus']);

async function audioFiles(directory) {
    let entries;
    try {
        entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
    const files = [];
    for (const entry of entries) {
        // Ignore hidden files and symlinks; never traverse outside the music folder.
        if (entry.name.startsWith('.')) continue;
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) files.push(...await audioFiles(path));
        else if (entry.isFile() && audioExtensions.has(extname(entry.name).toLowerCase())) files.push(path);
    }
    return files;
}

export async function buildMusicPlaylist(root) {
    const files = (await audioFiles(resolve(root, 'assets/music'))).sort();
    const tracks = [];
    for (const file of files) {
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(file)) hash.update(chunk);
        // Encode each segment so spaces, Chinese, # and % remain valid file URLs.
        const path = relative(root, file).split(sep).map(encodeURIComponent).join('/');
        tracks.push({
            title: basename(file, extname(file)),
            artist: '',
            // Replacing an audio file at the same path must also invalidate browser caches.
            src: `${path}?v=${hash.digest('hex').slice(0, 16)}`
        });
    }
    return tracks;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const tracks = await buildMusicPlaylist(root);
    await writeFile(resolve(root, 'assets/music/playlist.json'), JSON.stringify(tracks, null, 2) + '\n');
    console.log(`Updated public music playlist: ${tracks.length} tracks.`);
}
