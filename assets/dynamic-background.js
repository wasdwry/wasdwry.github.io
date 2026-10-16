import { createOutdoorScene } from './pixel-landscape.mjs';
import { createRoomScene } from './pixel-rooms.mjs';
import { coverGeometry, lightingAtHour, localHour } from './scene-clock.mjs';

const media = matchMedia('(prefers-reduced-motion: reduce)');
const storageKey = 'wasdwry-background-paused';
const scenes = new Map(), loading = new Map();
const outside = document.createElement('canvas');
outside.className = 'dynamic-bg';
outside.setAttribute('aria-hidden', 'true');
document.body.prepend(outside);
const output = outside.getContext('2d', {alpha: false});
const toggle = document.createElement('button');
toggle.type = 'button'; toggle.id = 'motionToggle'; toggle.className = 'motion-toggle';
document.body.appendChild(toggle);
const initialRoom = location.hash.slice(1);
let view = ['hall', 'study'].includes(initialRoom) ? initialRoom : document.body.dataset.scene || 'outside';
let paused = media.matches;
try { const saved = localStorage.getItem(storageKey); if (saved !== null) paused = saved === 'true' || media.matches; } catch (_) { /* Storage is optional. */ }
let light = lightingAtHour(localHour()), elapsed = 0, frame = 0, last = 0, revision = 0;
let disposed = false;

function updateControls() {
    const label = paused ? '播放背景动画' : '暂停背景动画';
    toggle.textContent = paused ? '▶' : 'Ⅱ';
    toggle.setAttribute('aria-label', label); toggle.title = label;
    toggle.setAttribute('aria-pressed', String(paused));
    document.body.classList.toggle('motion-paused', paused);
}

function updateClock() {
    light = lightingAtHour(localHour());
    document.body.dataset.timeOfDay = light.period;
    document.body.dataset.daylight = light.daylight.toFixed(4);
}

function canAnimate() {
    return !disposed && !paused && !document.hidden && !document.getElementById('deskDialog')?.open;
}

function draw() {
    const scene = scenes.get(view);
    if (!scene || document.hidden || disposed) return;
    const artwork = scene.render(elapsed, light);
    const canvas = view === 'outside' ? outside : artwork;
    if (view === 'outside') {
        const rect = coverGeometry(innerWidth, innerHeight);
        const ratio = outside.width / innerWidth;
        output.imageSmoothingEnabled = false;
        output.drawImage(artwork, rect.x * ratio, 0, rect.width * ratio, rect.height * ratio);
    }
    canvas.dataset.frame = String(++revision);
    canvas.dataset.elapsed = elapsed.toFixed(3);
    canvas.dataset.daylight = light.daylight.toFixed(4);
    canvas.dataset.renderer = 'layered-pixel-canvas';
    canvas.dataset.ready = 'true';
}

function animate(now) {
    frame = 0;
    if (!canAnimate() || !scenes.has(view)) return;
    if (!last) last = now;
    const delta = now - last;
    if (delta >= 1000 / 30) {
        elapsed += Math.min(delta, 100) / 1000;
        last = now;
        draw();
    }
    frame = requestAnimationFrame(animate);
}

function restart() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    if (disposed || document.hidden) return;
    updateClock(); draw();
    if (canAnimate() && scenes.has(view)) frame = requestAnimationFrame(animate);
}

function ensureScene(name) {
    if (loading.has(name)) return loading.get(name);
    const promise = (name === 'outside' ? createOutdoorScene() : createRoomScene(name)).then(scene => {
        if (name !== 'outside') {
            scene.canvas.className = 'room-atmosphere';
            scene.canvas.setAttribute('aria-hidden', 'true');
            document.querySelector(`#${name} .room-stage`).prepend(scene.canvas);
        }
        scenes.set(name, scene);
        if (view === name) restart();
        return scene;
    }).catch(error => {
        loading.delete(name);
        console.warn('Keeping the original scene while animation is unavailable.', error);
        return null;
    });
    loading.set(name, promise);
    return promise;
}

function setView(name) {
    if (!['outside', 'hall', 'study'].includes(name)) return;
    view = name; outside.hidden = name !== 'outside';
    ensureScene(name); restart();
}

function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 1.5, 1920 / innerWidth, 1200 / innerHeight);
    outside.width = Math.max(1, Math.round(innerWidth * ratio));
    outside.height = Math.max(1, Math.round(innerHeight * ratio));
    restart();
}

function toggleMotion() {
    paused = !paused;
    try { localStorage.setItem(storageKey, String(paused)); } catch (_) { /* Storage is optional. */ }
    updateControls(); restart();
}

window.WasdwryLandscape = {
    get daylight() { return light.daylight; },
    get paused() { return paused; },
    get view() { return view; },
    toggle: toggleMotion, setView
};
toggle.addEventListener('click', toggleMotion);
media.addEventListener('change', () => { paused = media.matches; updateControls(); restart(); });
window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', restart);
window.addEventListener('pagehide', () => { disposed = true; cancelAnimationFrame(frame); });
window.addEventListener('pageshow', () => { disposed = false; restart(); });
const desk = document.getElementById('deskDialog');
if (desk) new MutationObserver(restart).observe(desk, {attributes: true, attributeFilter: ['open']});
setInterval(() => { if (!document.hidden && !disposed) { updateClock(); if (!canAnimate()) draw(); } }, 20000);
updateControls(); updateClock(); resize(); setView(view);
