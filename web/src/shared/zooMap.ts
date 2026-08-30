/**
 * The Bronx Zoo illustrated map (bronxzoo.com/map, 2400×1471) is used as a Leaflet image layer.
 * Clues store positions as fractions of the image (map_x, map_y ∈ 0–1, origin top-left).
 * GPS → image is an affine fit through the four gate pins drawn on the map.
 */
export const ZOO_MAP = { src: '/art/bronx-zoo-map.png', width: 2400, height: 1471 } as const;
export const ZOO_MAP_KEY = '/art/bronx-zoo-map-key.png';

export interface ControlPoint {
	name: string;
	/** image fraction (0–1, from the top-left) */
	x: number;
	y: number;
	lat: number;
	lng: number;
}

/** Gate pins on the illustration ↔ their real-world position (OpenStreetMap). */
export const CONTROL_POINTS: ControlPoint[] = [
	{ name: 'Asia Gate', x: 0.055, y: 0.628, lat: 40.84443, lng: -73.87722 },
	{ name: 'Southern Boulevard Gate', x: 0.547, y: 0.087, lat: 40.85159, lng: -73.88185 },
	{ name: 'Fordham Road Gate', x: 0.869, y: 0.342, lat: 40.85499, lng: -73.87745 },
	{ name: 'Bronx River Gate', x: 0.766, y: 0.668, lat: 40.85298, lng: -73.87439 },
];

/** Least-squares affine map (lng, lat) → (x, y) image fractions. */
export function fitAffine(points: ControlPoint[]): ((lat: number, lng: number) => { x: number; y: number }) | null {
	if (points.length < 3) return null;
	// Solve for a..f in x = a*lng + b*lat + c, y = d*lng + e*lat + f via normal equations.
	const rows = points.map((p) => [p.lng, p.lat, 1]);
	const solve = (target: number[]) => {
		const AtA = [
			[0, 0, 0],
			[0, 0, 0],
			[0, 0, 0],
		];
		const Atb = [0, 0, 0];
		rows.forEach((r, i) => {
			for (let a = 0; a < 3; a++) {
				Atb[a] += r[a] * target[i];
				for (let b = 0; b < 3; b++) AtA[a][b] += r[a] * r[b];
			}
		});
		return gauss(AtA, Atb);
	};
	const cx = solve(points.map((p) => p.x));
	const cy = solve(points.map((p) => p.y));
	if (!cx || !cy) return null;
	return (lat, lng) => ({ x: cx[0] * lng + cx[1] * lat + cx[2], y: cy[0] * lng + cy[1] * lat + cy[2] });
}

function gauss(A: number[][], b: number[]): number[] | null {
	const n = b.length;
	const M = A.map((row, i) => [...row, b[i]]);
	for (let col = 0; col < n; col++) {
		let pivot = col;
		for (let r = col + 1; r < n; r++) if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
		if (Math.abs(M[pivot][col]) < 1e-12) return null;
		[M[col], M[pivot]] = [M[pivot], M[col]];
		for (let r = 0; r < n; r++) {
			if (r === col) continue;
			const f = M[r][col] / M[col][col];
			for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
		}
	}
	return M.map((row, i) => row[n] / row[i]);
}

export const gpsToImage = fitAffine(CONTROL_POINTS);

/** True when a point lands on the illustration (with a little slack for GPS drift). */
export function onMap(p: { x: number; y: number }, slack = 0.08): boolean {
	return p.x > -slack && p.x < 1 + slack && p.y > -slack && p.y < 1 + slack;
}
