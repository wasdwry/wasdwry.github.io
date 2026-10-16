export const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
export const lerp = (a, b, amount) => a + (b - a) * amount;
export function smooth(a, b, value) {
    const amount = clamp((value - a) / (b - a));
    return amount * amount * (3 - 2 * amount);
}

export function lightingAtHour(hour) {
    const h = ((Number.isFinite(hour) ? hour : 12) % 24 + 24) % 24;
    const daylight = smooth(5.2, 8.2, h) * (1 - smooth(16.6, 20.1, h));
    const dusk = clamp(Math.max(0, 1 - Math.abs(h - 18) / 2.3) * .82
        + Math.max(0, 1 - Math.abs(h - 6.4) / 1.8) * .34);
    return { daylight, dusk, night: 1 - daylight,
        period: h < 5.2 || h >= 20.1 ? 'night' : h < 8.2 ? 'dawn' : h < 16.6 ? 'day' : 'dusk' };
}

export function localHour(date = new Date()) {
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

// This geometry is shared by the painting and its clickable cabin, including phones.
export function coverGeometry(width, height, artworkWidth = 1716, artworkHeight = 916) {
    const scale = Math.max(width / artworkWidth, height / artworkHeight);
    const renderedWidth = artworkWidth * scale, renderedHeight = artworkHeight * scale;
    return { width: renderedWidth, height: renderedHeight,
        x: width < 700 ? 0 : (width - renderedWidth) / 2, y: 0 };
}
