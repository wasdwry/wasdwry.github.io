/* Animate the room's own paintings, keeping the window frames and furniture fixed. */
import { newCanvas, loadArtwork, seededRandom } from './pixel-landscape.mjs';
import { clamp, lerp, smooth } from './scene-clock.mjs';

const WIDTH = 1660, HEIGHT = 948;
const roomDetails = {
    hall: {
        skies: [
            { rect: [0, 96, 78, 242], sample: 67 },
            { rect: [289, 347, 35, 65], sample: 312 },
            { rect: [1178, 335, 69, 71], sample: 1235 },
            { rect: [1610, 186, 50, 111], sample: 1649 }
        ],
        waters: [[0, 457, 78, 37], [289, 432, 35, 18], [1178, 425, 69, 20]],
        lamps: [[970, 75, 65], [500, 475, 115], [448, 362, 32]],
        steam: [[501, 508, 27], [1352, 454, 28]],
        dust: [260, 360, 410, 350],
        fire: [475, 438, 72, 68]
    },
    study: {
        skies: [
            { rect: [584, 175, 493, 169], sample: 875, moon: [941, 247, 28, 29] },
            { rect: [0, 161, 20, 117], sample: 12 },
            { rect: [0, 298, 23, 55], sample: 12 }
        ],
        waters: [[682, 414, 326, 53], [0, 451, 23, 30]],
        lamps: [[1138, 466, 112], [403, 231, 65]],
        steam: [[1085, 509, 33]],
        dust: [590, 485, 510, 220]
    }
};

function sourceCanvas(image) {
    const canvas = newCanvas(WIDTH, HEIGHT);
    canvas.getContext('2d').drawImage(image, 0, 0, WIDTH, HEIGHT);
    return canvas;
}

function cropPixels(pixels, x, y) {
    const index = (clamp(Math.round(y), 0, HEIGHT - 1) * WIDTH + clamp(Math.round(x), 0, WIDTH - 1)) * 4;
    return [pixels[index], pixels[index + 1], pixels[index + 2]];
}

function makeWindow(spec, dayPixels, nightPixels, random) {
    const [x, y, width, height] = spec.rect;
    const mask = newCanvas(width, height), mg = mask.getContext('2d');
    const maskPixels = mg.createImageData(width, height);
    const clouds = newCanvas(width, height), cg = clouds.getContext('2d');
    const cloudPixels = cg.createImageData(width, height);
    const nativeDay = cg.createImageData(width, height), nativeNight = cg.createImageData(width, height);
    const nightClouds = newCanvas(width, height), ncg = nightClouds.getContext('2d');
    const nightCloudPixels = ncg.createImageData(width, height);
    const daySky = newCanvas(width, height), dg = daySky.getContext('2d');
    const nightSky = newCanvas(width, height), ng = nightSky.getContext('2d');
    for (let row = 0; row < height; row++) {
        // Pick the least cloudy of several neighbouring sky samples, avoiding stars at night.
        const samples = [-3, 0, 3].map(offset => ({
            day: cropPixels(dayPixels, spec.sample + offset, y + row),
            night: cropPixels(nightPixels, spec.sample + offset, y + row)
        })).sort((a, b) => a.day[0] - b.day[0]);
        let dayColor = samples[0].day, nightColor = samples[0].night;
        // Narrow panes may be crossed by a wooden mullion. Fill only sky pixels below.
        if (dayColor[2] < dayColor[0] || dayColor[2] < 180) {
            dayColor = [65 + row * .18, 159 + row * .16, 246];
            nightColor = [8, 26 + row * .07, 83 + row * .12];
        }
        dg.fillStyle = `rgb(${dayColor.join(',')})`; dg.fillRect(0, row, width, 1);
        ng.fillStyle = `rgb(${nightColor.join(',')})`; ng.fillRect(0, row, width, 1);
        for (let column = 0; column < width; column++) {
            const [r, g, b] = cropPixels(dayPixels, x + column, y + row);
            const index = (row * width + column) * 4;
            const sky = (b > g * 1.025 && b > r * 1.1 && b > 180)
                || (r > 145 && g > 175 && b > 190 && b >= r * .98);
            if (!sky) continue;
            nativeDay.data.set([r, g, b, 255], index);
            nativeNight.data.set([...cropPixels(nightPixels, x + column, y + row), 255], index);
            // Feather only the top and bottom of a sky patch to meet the original horizon.
            const edge = smooth(0, 3, row) * smooth(0, 6, height - 1 - row);
            maskPixels.data[index + 3] = 255 * edge;
            const opacity = smooth(5, 32, r - dayColor[0]);
            cloudPixels.data.set([r, g, b, 255 * opacity], index);
            nightCloudPixels.data.set([r * .19, g * .31, b * .54, 255 * opacity], index);
        }
    }
    mg.putImageData(maskPixels, 0, 0);
    cg.putImageData(cloudPixels, 0, 0);
    ncg.putImageData(nightCloudPixels, 0, 0);
    const stars = Array.from({length: width > 100 ? 33 : 4}, () => ({
        x: random() * width, y: random() * height, phase: random() * 6.28
    }));
    let moon;
    if (spec.moon) {
        const [mx, my, mw, mh] = spec.moon;
        moon = newCanvas(mw, mh);
        const mctx = moon.getContext('2d'), data = mctx.createImageData(mw, mh);
        for (let yy = 0; yy < mh; yy++) for (let xx = 0; xx < mw; xx++) {
            const rgb = cropPixels(nightPixels, mx + xx, my + yy);
            data.data.set([...rgb, 255 * smooth(75, 130, rgb[0])], (yy * mw + xx) * 4);
        }
        mctx.putImageData(data, 0, 0);
    }
    return { ...spec, mask, maskPixels, nativeDay, nativeNight, nativeFrame: cg.createImageData(width, height),
        clouds, nightClouds, daySky, nightSky, stars, moon, moonOrigin: spec.moon?.slice(0, 2),
        canvas: newCanvas(width, height) };
}

function makeWater(rect, daySource, nightSource) {
    const [x, y, width, height] = rect;
    const day = newCanvas(width, height), night = newCanvas(width, height);
    const dg = day.getContext('2d'), ng = night.getContext('2d');
    dg.drawImage(daySource, x, y, width, height, 0, 0, width, height);
    ng.drawImage(nightSource, x, y, width, height, 0, 0, width, height);
    const d = dg.getImageData(0, 0, width, height), n = ng.getImageData(0, 0, width, height);
    for (let i = 0; i < d.data.length; i += 4) {
        const [r, g, b] = d.data.slice(i, i + 3);
        if (!(b > g * .98 && g > r * 1.06 && b > 120)) d.data[i + 3] = n.data[i + 3] = 0;
    }
    dg.putImageData(d, 0, 0); ng.putImageData(n, 0, 0);
    return { rect, day, night };
}

export async function createRoomScene(name) {
    const spec = roomDetails[name];
    if (!spec) throw new Error('Unknown room');
    const [dayImage, nightImage] = await Promise.all([
        loadArtwork(`pixel-cabin-${name}.webp`), loadArtwork(`pixel-cabin-${name}-night.webp`)
    ]);
    const day = sourceCanvas(dayImage), night = sourceCanvas(nightImage);
    const dayPixels = day.getContext('2d').getImageData(0, 0, WIDTH, HEIGHT).data;
    const nightPixels = night.getContext('2d').getImageData(0, 0, WIDTH, HEIGHT).data;
    const random = seededRandom(name === 'hall' ? 211 : 701);
    const windows = spec.skies.map(item => makeWindow(item, dayPixels, nightPixels, random));
    const waters = spec.waters.map(rect => makeWater(rect, day, night));
    const canvas = newCanvas(WIDTH, HEIGHT), ctx = canvas.getContext('2d', {alpha:false});
    const base = newCanvas(WIDTH, HEIGHT), bg = base.getContext('2d', {alpha:false});
    const [dx, dy, dw, dh] = spec.dust;
    const dust = Array.from({length: 18}, () => ({x: dx + random() * dw, y: dy + random() * dh, phase: random() * 6.28}));
    let lastLight = -1;

    function drawWindows(time, light) {
        for (const item of windows) {
            const [x, y, width, height] = item.rect, g = item.canvas.getContext('2d');
            if (width < 100) {
                // Preserve the exact lighting and perspective in narrow panes. Sample only
                // neighbouring sky pixels so wood, tree branches and glass bars never move.
                const d = item.nativeDay.data, n = item.nativeNight.data, out = item.nativeFrame.data;
                for (let row = 0; row < height; row++) {
                    const shift = Math.round(Math.sin(time * .27 + row * .025) * 1.4);
                    for (let column = 0; column < width; column++) {
                        const index = (row * width + column) * 4;
                        if (!item.maskPixels.data[index + 3]) continue;
                        let source = (row * width + clamp(column + shift, 0, width - 1)) * 4;
                        if (!item.maskPixels.data[source + 3]) source = index;
                        for (let channel = 0; channel < 3; channel++) out[index + channel] = lerp(d[source + channel], n[source + channel], light.night);
                        out[index + 3] = item.maskPixels.data[index + 3];
                    }
                }
                g.putImageData(item.nativeFrame, 0, 0); ctx.drawImage(item.canvas, x, y);
                continue;
            }
            g.clearRect(0, 0, width, height);
            g.globalCompositeOperation = 'source-over';
            g.globalAlpha = 1; g.drawImage(item.daySky, 0, 0);
            g.globalAlpha = light.night; g.drawImage(item.nightSky, 0, 0);
            g.globalAlpha = 1;
            if (light.dusk > 0) {
                g.fillStyle = `rgba(247,154,128,${light.dusk * .22})`;
                g.fillRect(0, 0, width, height);
            }
            for (const star of item.stars) {
                g.globalAlpha = light.night * (.25 + .16 * Math.sin(time * .7 + star.phase));
                g.fillStyle = '#c5dfff'; g.fillRect(Math.round(star.x), Math.round(star.y), 1, 1);
            }
            if (item.moon) {
                g.globalAlpha = light.night;
                g.drawImage(item.moon, item.moonOrigin[0] - x, item.moonOrigin[1] - y);
            }
            // Overscan keeps the cut edges outside the actual pane while the cloud layer moves.
            const shift = Math.sin(time * .07) * Math.min(7, width * .07);
            const padding = Math.min(10, width * .12);
            g.globalAlpha = light.daylight; g.drawImage(item.clouds, -padding + shift, 0, width + padding * 2, height);
            g.globalAlpha = light.night; g.drawImage(item.nightClouds, -padding + shift, 0, width + padding * 2, height);
            g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in'; g.drawImage(item.mask, 0, 0);
            g.globalCompositeOperation = 'source-over';
            ctx.drawImage(item.canvas, x, y);
        }
    }

    function drawWater(time, light) {
        for (const item of waters) {
            const [x, y, width, height] = item.rect;
            ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
            for (let row = 0; row < height; row += 2) {
                const shift = Math.round(Math.sin(row * .45 - time * 1.2) * 1.5);
                const strip = Math.min(2, height - row);
                ctx.globalAlpha = 1; ctx.drawImage(item.day, 0, row, width, strip, x + shift, y + row, width, strip);
                ctx.globalAlpha = light.night; ctx.drawImage(item.night, 0, row, width, strip, x + shift, y + row, width, strip);
            }
            ctx.restore();
        }
    }

    function drawFire(time, light) {
        if (!spec.fire) return;
        const [x, y, width, height] = spec.fire;
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
        for (let row = 0; row < height - 7; row += 2) {
            const shift = Math.round(Math.sin(row * .35 - time * 4.3) * (1.2 + row / height));
            ctx.globalAlpha = 1; ctx.drawImage(day, x, y + row, width, 2, x + shift, y + row, width, 2);
            ctx.globalAlpha = light.night; ctx.drawImage(night, x, y + row, width, 2, x + shift, y + row, width, 2);
        }
        for (let i = 0; i < 11; i++) {
            const phase = (time * (.35 + (i % 3) * .06) + i * .173) % 1;
            const px = x + 14 + (i * 13 % 44) + Math.sin(time + i) * 2;
            const py = y + height - 10 - phase * (height - 6);
            ctx.globalAlpha = Math.sin(phase * Math.PI) * .72;
            ctx.fillStyle = i % 3 ? '#ffd76b' : '#ff9c31';
            ctx.fillRect(Math.round(px), Math.round(py), 2, 3);
        }
        ctx.restore();
    }

    function drawAtmosphere(time, light) {
        for (const [x, y, radius] of spec.lamps) {
            const alpha = (.035 + .012 * Math.sin(time * 1.4 + x)) * (.4 + light.night * .6);
            const glow = ctx.createRadialGradient(x, y, 1, x, y, radius);
            glow.addColorStop(0, `rgba(255,181,78,${alpha})`); glow.addColorStop(1, 'rgba(255,181,78,0)');
            ctx.fillStyle = glow; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        for (const [x, y, height] of spec.steam) for (let i = 0; i < 9; i++) {
            const phase = (time * .18 + i / 9) % 1;
            const px = x + Math.sin(phase * 7 + time * .5) * (2 + phase * 4), py = y - phase * height;
            ctx.globalAlpha = Math.sin(phase * Math.PI) * .12;
            ctx.fillStyle = '#f3e5c9'; ctx.fillRect(Math.round(px), Math.round(py), 2 + Math.round(phase * 3), 3);
        }
        for (const mote of dust) {
            const py = dy + ((mote.y - dy - time * 2) % dh + dh) % dh;
            ctx.globalAlpha = Math.pow(Math.max(0, Math.sin(time * .2 + mote.phase)), 2) * .22;
            ctx.fillStyle = '#ffeec8'; ctx.fillRect(Math.round(mote.x + Math.sin(time * .18 + mote.phase) * 9), Math.round(py), 1, 2);
        }
        ctx.globalAlpha = 1;
    }

    return {
        canvas,
        render(time, light) {
            if (lastLight !== light.daylight) {
                bg.globalAlpha = 1; bg.drawImage(day, 0, 0);
                bg.globalAlpha = light.night; bg.drawImage(night, 0, 0); bg.globalAlpha = 1;
                lastLight = light.daylight;
            }
            ctx.imageSmoothingEnabled = false; ctx.globalAlpha = 1;
            ctx.drawImage(base, 0, 0);
            drawWindows(time, light); drawWater(time, light); drawFire(time, light); drawAtmosphere(time, light);
            return canvas;
        }
    };
}
