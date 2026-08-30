import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useGameState } from '../GameContext';
import { Plank, Screen } from '../components';
import { ZOO_MAP, ZOO_MAP_KEY, gpsToImage, onMap } from '../../shared/zooMap';
import type { TeamClue } from '../../shared/api';

/** image fraction → Leaflet CRS.Simple latlng (y grows downward in the image, upward in Leaflet). */
const toLatLng = (x: number, y: number): L.LatLngExpression => [ZOO_MAP.height * (1 - y), ZOO_MAP.width * x];

function pinIcon(c: TeamClue) {
	return L.divIcon({
		className: '',
		html: `<span class="pin ${c.status}" aria-label="Clue ${c.sort_order}">${c.status === 'locked' ? '?' : c.sort_order}</span>`,
		iconSize: [34, 34],
		iconAnchor: [17, 17],
		popupAnchor: [0, -18],
	});
}

const meIcon = L.divIcon({
	className: '',
	html: '<span class="me-pin"><img src="/art/monkey-head.png" alt="" /><b>You are here</b></span>',
	iconSize: [44, 44],
	iconAnchor: [22, 22],
});

/** Frame 05-map: the official Bronx Zoo illustration, zoomable, with clue pins and your GPS position. */
export function ZooMap() {
	const s = useGameState();
	const nav = useNavigate();
	const el = useRef<HTMLDivElement>(null);
	const map = useRef<L.Map | null>(null);
	const pins = useRef<L.LayerGroup | null>(null);
	const me = useRef<L.Marker | null>(null);
	const [geo, setGeo] = useState<'idle' | 'on' | 'off-map' | 'denied' | 'unsupported'>('idle');
	const [showKey, setShowKey] = useState(false);

	// Build the map once.
	useEffect(() => {
		if (!el.current || map.current) return;
		const bounds = L.latLngBounds([0, 0], [ZOO_MAP.height, ZOO_MAP.width]);
		const m = L.map(el.current, {
			crs: L.CRS.Simple,
			minZoom: -3,
			maxZoom: 2,
			zoomSnap: 0.25,
			zoomControl: false,
			attributionControl: false,
			maxBounds: bounds.pad(0.15),
			maxBoundsViscosity: 0.8,
			tap: true,
		} as L.MapOptions);
		L.imageOverlay(ZOO_MAP.src, bounds).addTo(m);
		L.control.zoom({ position: 'bottomright' }).addTo(m);
		// Zoomed all the way out shows the whole illustration; start filling the height instead so it's readable on a phone.
		m.fitBounds(bounds);
		m.setMinZoom(m.getZoom());
		const heightFit = Math.log2(el.current.clientHeight / ZOO_MAP.height);
		m.setView(bounds.getCenter(), Math.min(m.getMaxZoom(), Math.max(m.getMinZoom(), heightFit)), { animate: false });
		pins.current = L.layerGroup().addTo(m);
		map.current = m;
		const ro = new ResizeObserver(() => m.invalidateSize());
		ro.observe(el.current);
		return () => {
			ro.disconnect();
			m.remove();
			map.current = null;
		};
	}, []);

	// Re-draw clue pins whenever clues change.
	useEffect(() => {
		const group = pins.current;
		if (!group) return;
		group.clearLayers();
		for (const c of s.clues) {
			if (c.map_x === null || c.map_y === null) continue;
			const marker = L.marker(toLatLng(c.map_x, c.map_y), { icon: pinIcon(c), keyboard: false });
			if (c.status === 'locked') {
				marker.bindPopup(`<b>Clue #${c.sort_order}</b><br/>Locked — coming soon!`);
			} else {
				marker.bindPopup(`<b>Clue #${c.sort_order}</b><br/>${c.title}<br/><a href="/clues/${c.id}" data-clue="${c.id}">Open clue ›</a>`);
			}
			marker.addTo(group);
		}
	}, [s.clues]);

	// Make popup links use the SPA router.
	useEffect(() => {
		const m = map.current;
		if (!m) return;
		const onClick = (e: Event) => {
			const a = (e.target as HTMLElement).closest('a[data-clue]');
			if (!a) return;
			e.preventDefault();
			nav(`/clues/${a.getAttribute('data-clue')}`);
		};
		m.getContainer().addEventListener('click', onClick);
		return () => m.getContainer().removeEventListener('click', onClick);
	}, [nav]);

	// Live GPS → "you are here".
	useEffect(() => {
		if (!('geolocation' in navigator)) {
			setGeo('unsupported');
			return;
		}
		if (!gpsToImage) return;
		const id = navigator.geolocation.watchPosition(
			(pos) => {
				const p = gpsToImage!(pos.coords.latitude, pos.coords.longitude);
				const m = map.current;
				if (!m) return;
				if (!onMap(p)) {
					setGeo('off-map');
					me.current?.remove();
					me.current = null;
					return;
				}
				setGeo('on');
				const ll = toLatLng(Math.min(1, Math.max(0, p.x)), Math.min(1, Math.max(0, p.y)));
				if (!me.current) me.current = L.marker(ll, { icon: meIcon, zIndexOffset: 1000, keyboard: false }).addTo(m);
				else me.current.setLatLng(ll);
			},
			(err) => setGeo(err.code === err.PERMISSION_DENIED ? 'denied' : 'off-map'),
			{ enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
		);
		return () => navigator.geolocation.clearWatch(id);
	}, []);

	function locateMe() {
		const m = map.current;
		if (m && me.current) m.flyTo(me.current.getLatLng(), Math.min(m.getMaxZoom(), m.getZoom() + 1.5));
	}

	return (
		<Screen>
			<div className="sheet map-sheet">
				<Plank side={geo === 'on' ? '● GPS' : undefined}>Zoo map</Plank>
				<div className="map-wrap leaflet-wrap">
					<div ref={el} className="leaflet-host" role="application" aria-label="Bronx Zoo map with clue locations" />
					<div className="map-tools">
						<button type="button" className="btn xs" onClick={locateMe} disabled={geo !== 'on'}>
							{geo === 'on' ? 'Find me' : geo === 'denied' ? 'Location off' : geo === 'off-map' ? 'Not at the zoo yet' : 'Locating…'}
						</button>
						<button type="button" className="btn xs ghost" onClick={() => setShowKey((v) => !v)}>
							Key
						</button>
					</div>
					{showKey && <img className="map-key" src={ZOO_MAP_KEY} alt="Map legend" onClick={() => setShowKey(false)} />}
				</div>
				<div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
					<span className="pill complete">Found</span>
					<span className="pill pending">In review</span>
					<span className="pill rejected">Open</span>
					<span className="pill locked">Locked</span>
				</div>
				<div className="tiny muted tc">Pinch to zoom · tap a pin for the clue · map © Bronx Zoo / WCS</div>
			</div>
		</Screen>
	);
}
