import test from 'node:test';
import assert from 'node:assert/strict';
import { lightingAtHour, coverGeometry, localHour } from '../assets/scene-clock.mjs';

test('local clock gives day, dusk and night without a timezone dependency', () => {
    assert.equal(lightingAtHour(12).daylight, 1);
    assert.equal(lightingAtHour(23).night, 1);
    assert.equal(lightingAtHour(18).period, 'dusk');
    assert.ok(lightingAtHour(18).dusk > .8);
    assert.equal(localHour({getHours: () => 18, getMinutes: () => 30, getSeconds: () => 0}), 18.5);
});

test('lighting remains continuous across midnight and the dawn/dusk boundaries', () => {
    assert.deepEqual(lightingAtHour(24), lightingAtHour(0));
    assert.deepEqual(lightingAtHour(-1), lightingAtHour(23));
    for (const hour of [5.2, 8.2, 16.6, 18, 20.1]) {
        const before = lightingAtHour(hour - .001), after = lightingAtHour(hour + .001);
        assert.ok(Math.abs(before.daylight - after.daylight) < .003);
        for (const value of [before.daylight, before.night, before.dusk]) assert.ok(value >= 0 && value <= 1);
    }
});

test('the mobile cabin stays on the visible left side and desktop crop is centred', () => {
    for (const [width, height] of [[360, 800], [699, 916], [1440, 900], [1920, 1080]]) {
        const frame = coverGeometry(width, height);
        assert.ok(frame.width >= width && frame.height >= height);
        assert.equal(frame.x, width < 700 ? 0 : (width - frame.width) / 2);
        const cabinLeft = frame.x + .017 * frame.width;
        const cabinRight = frame.x + .264 * frame.width;
        assert.ok(cabinRight > 0 && cabinLeft < width);
    }
});
