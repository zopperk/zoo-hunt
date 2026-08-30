import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZOO_MAP } from '../shared/zooMap';

const toLatLng = (x: number, y: number): L.LatLngExpression => [ZOO_MAP.height * (1 - y), ZOO_MAP.width * x];

export interface PickerPin {
	id: string;
	x: number;
	y: number;
	label: string;
	dim?: boolean;
}

/**
 * Click-to-place picker on the zoo illustration. `value` is the pin being edited
 * (image fractions); `others` are the other clues' pins shown for context.
 */
export function MapPicker({ value, onChange, others = [], height = 380 }: { value: { x: number; y: number } | null; onChange: (p: { x: number; y: number }) => void; others?: PickerPin[]; height?: number }) {
	const el = useRef<HTMLDivElement>(null);
	const map = useRef<L.Map | null>(null);
	const marker = useRef<L.Marker | null>(null);
	const ctx = useRef<L.LayerGroup | null>(null);
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	useEffect(() => {
		if (!el.current || map.current) return;
		const bounds = L.latLngBounds([0, 0], [ZOO_MAP.height, ZOO_MAP.width]);
		const m = L.map(el.current, { crs: L.CRS.Simple, minZoom: -3, maxZoom: 2, zoomSnap: 0.25, attributionControl: false, maxBounds: bounds.pad(0.1) });
		L.imageOverlay(ZOO_MAP.src, bounds).addTo(m);
		m.fitBounds(bounds);
		m.setMinZoom(m.getZoom());
		ctx.current = L.layerGroup().addTo(m);
		m.on('click', (e: L.LeafletMouseEvent) => {
			const x = e.latlng.lng / ZOO_MAP.width;
			const y = 1 - e.latlng.lat / ZOO_MAP.height;
			if (x < 0 || x > 1 || y < 0 || y > 1) return;
			onChangeRef.current({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
		});
		map.current = m;
		return () => {
			m.remove();
			map.current = null;
		};
	}, []);

	useEffect(() => {
		const m = map.current;
		if (!m) return;
		if (!value) {
			marker.current?.remove();
			marker.current = null;
			return;
		}
		const ll = toLatLng(value.x, value.y);
		const icon = L.divIcon({ className: '', html: '<span class="pin available picker">★</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
		if (!marker.current) {
			marker.current = L.marker(ll, { icon, draggable: true, zIndexOffset: 1000 }).addTo(m);
			marker.current.on('dragend', () => {
				const p = marker.current!.getLatLng();
				onChangeRef.current({ x: Math.round((p.lng / ZOO_MAP.width) * 1000) / 1000, y: Math.round((1 - p.lat / ZOO_MAP.height) * 1000) / 1000 });
			});
		} else marker.current.setLatLng(ll);
	}, [value?.x, value?.y]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		const g = ctx.current;
		if (!g) return;
		g.clearLayers();
		for (const p of others) {
			L.marker(toLatLng(p.x, p.y), {
				icon: L.divIcon({ className: '', html: `<span class="pin locked" style="opacity:${p.dim ? 0.55 : 0.85}">${p.label}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] }),
				interactive: false,
			}).addTo(g);
		}
	}, [others]);

	return <div ref={el} className="leaflet-host picker" style={{ height }} aria-label="Click the map to place this clue" />;
}
