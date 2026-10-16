export const MAX_MUSIC_BYTES = 10 * 1024 * 1024;
export const MUSIC_EXTENSIONS = ['mp3', 'ogg', 'wav', 'm4a', 'aac', 'flac', 'opus'];

export function validateMusicFile(name, size) {
    if (typeof name !== 'string' || !name.trim() || /[\\/\x00-\x1f\x7f]/.test(name)) throw new Error('音频文件名无效，请重命名后再试。');
    const normalized = name.normalize('NFC').trim();
    const extension = normalized.split('.').pop().toLowerCase();
    if (!MUSIC_EXTENSIONS.includes(extension)) throw new Error('请选择 MP3、M4A、OGG、WAV、AAC、FLAC 或 OPUS 音频。');
    const title = normalized.slice(0, -(extension.length + 1)).replace(/^[._\s]+/, '').trim();
    if (!title || new TextEncoder().encode(normalized).length > 180) throw new Error('文件名太长或没有曲名，请重命名后再试。');
    if (!Number.isSafeInteger(size) || size <= 0) throw new Error('音频文件为空，请重新选择。');
    if (size > MAX_MUSIC_BYTES) throw new Error('每首音频最多 10 MiB；请压缩音频，或改从 GitHub 上传较大的文件。');
    return { name: `${title}.${extension}`, title, extension };
}

export function validateMusicBytes(extension, bytes) {
    const starts = (text, offset = 0) => [...text].every((char, i) => bytes[offset + i] === char.charCodeAt(0));
    const sync = bytes.length > 4 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
    const valid = {
        mp3: starts('ID3') || (sync && (bytes[1] & 6) !== 0 && (bytes[1] & 24) !== 8),
        aac: sync && (bytes[1] & 6) === 0,
        wav: starts('RIFF') && starts('WAVE', 8),
        m4a: starts('ftyp', 4),
        flac: starts('fLaC'),
        ogg: starts('OggS'),
        opus: starts('OggS')
    }[extension];
    if (bytes.length < 12 || !valid) throw new Error('文件内容与音频格式不符，请选择真实的音频文件。');
}

export function musicFileUrl(path) {
    return 'https://github.com/wasdwry/wasdwry.github.io/blob/main/' + path.split('/').map(encodeURIComponent).join('/');
}

export function isMusicUploadResult(result) {
    const match = typeof result?.path === 'string' && result.path.match(/^assets\/music\/uploads\/([a-f0-9]{40})\/([^/]+)$/);
    if (!match) return false;
    try {
        const file = validateMusicFile(match[2], 1);
        return file.name === match[2] && result.fileUrl === musicFileUrl(result.path);
    } catch { return false; }
}
