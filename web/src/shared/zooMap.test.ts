import { describe, it, expect } from 'vitest';
import { CONTROL_POINTS, fitAffine, gpsToImage, onMap } from './zooMap';

describe('zoo map georeferencing', () => {
	it('reproduces every control point within ~3% of the image', () => {
		const f = gpsToImage!;
		for (const p of CONTROL_POINTS) {
			const r = f(p.lat, p.lng);
			expect(Math.abs(r.x - p.x)).toBeLessThan(0.03);
			expect(Math.abs(r.y - p.y)).toBeLessThan(0.03);
		}
	});

	it('maps the zoo centre to roughly the middle of the illustration', () => {
		const r = gpsToImage!(40.8493, -73.8771);
		expect(r.x).toBeGreaterThan(0.3);
		expect(r.x).toBeLessThan(0.8);
		expect(r.y).toBeGreaterThan(0.2);
		expect(r.y).toBeLessThan(0.8);
	});

	it('needs at least three control points', () => {
		expect(fitAffine(CONTROL_POINTS.slice(0, 2))).toBeNull();
	});

	it('onMap flags points off the illustration', () => {
		expect(onMap({ x: 0.5, y: 0.5 })).toBe(true);
		expect(onMap({ x: -0.02, y: 0.5 })).toBe(true); // slack for GPS drift
		expect(onMap({ x: 1.5, y: 0.5 })).toBe(false);
		expect(onMap(gpsToImage!(40.7484, -73.9857))).toBe(false); // Empire State Building
	});
});
