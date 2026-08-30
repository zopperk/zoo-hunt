/**
 * Line icons matching the SF Symbols used in the Figma
 * (magnifyingglass, map, trophy, person.crop.circle, camera, star,
 * questionmark.circle.dashed, lock.fill, checkmark.circle.fill).
 */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const MagnifierIcon = (p: P) => (
	<svg {...base} {...p}>
		<circle cx="10.5" cy="10.5" r="6.5" />
		<path d="M15.5 15.5 21 21" />
	</svg>
);
export const MapIcon = (p: P) => (
	<svg {...base} {...p}>
		<path d="M3 6.5 9 4l6 2.5 6-2.5v13.5L15 20l-6-2.5L3 20z" />
		<path d="M9 4v13.5M15 6.5V20" />
	</svg>
);
export const TrophyIcon = (p: P) => (
	<svg {...base} {...p}>
		<path d="M7 4h10v5a5 5 0 0 1-10 0z" />
		<path d="M7 6H4.5a2.5 2.5 0 0 0 0 5H7M17 6h2.5a2.5 2.5 0 0 1 0 5H17" />
		<path d="M12 14v3M8.5 21h7M9.5 17h5v4h-5z" />
	</svg>
);
export const PersonCircleIcon = (p: P) => (
	<svg {...base} {...p}>
		<circle cx="12" cy="12" r="9.5" />
		<circle cx="12" cy="10" r="3.2" />
		<path d="M5.8 18.5c1.4-2.6 3.6-3.8 6.2-3.8s4.8 1.2 6.2 3.8" />
	</svg>
);
export const CameraIcon = (p: P) => (
	<svg {...base} {...p}>
		<path d="M4 8.5h3l1.5-2.5h7L17 8.5h3v10H4z" />
		<circle cx="12" cy="13.5" r="3.2" />
	</svg>
);
export const StarIcon = (p: P) => (
	<svg {...base} {...p}>
		<path d="m12 3.5 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.8l6.1-.7z" />
	</svg>
);
export const QuestionDashedIcon = (p: P) => (
	<svg {...base} {...p}>
		<circle cx="12" cy="12" r="9.5" strokeDasharray="4.2 3" />
		<path d="M9.4 9.2a2.7 2.7 0 1 1 3.9 2.4c-.9.5-1.3 1-1.3 2" />
		<path d="M12 17h.01" strokeWidth="3" />
	</svg>
);
export const LockIcon = (p: P) => (
	<svg {...base} {...p} fill="currentColor" stroke="none">
		<path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z" />
	</svg>
);
export const CheckCircleIcon = (p: P) => (
	<svg {...base} {...p}>
		<circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none" />
		<path d="m7.5 12.2 3 3 6-6.4" stroke="#fcdfa0" strokeWidth="2.6" />
	</svg>
);
export const ClockIcon = (p: P) => (
	<svg {...base} {...p}>
		<circle cx="12" cy="12" r="9.5" />
		<path d="M12 7v5l3.5 2" />
	</svg>
);
export const CheckIcon = (p: P) => (
	<svg {...base} {...p}>
		<path d="m5 12.5 4.5 4.5L19 7.5" strokeWidth="3" />
	</svg>
);
export const XIcon = (p: P) => (
	<svg {...base} {...p}>
		<path d="M6 6l12 12M18 6 6 18" strokeWidth="3" />
	</svg>
);
export const ChartIcon = (p: P) => (
	<svg {...base} {...p}>
		<path d="M4 20h16M7 16V9M12 16V5M17 16v-6" />
	</svg>
);
export const ListIcon = (p: P) => (
	<svg {...base} {...p}>
		<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
	</svg>
);
export const GearIcon = (p: P) => (
	<svg {...base} {...p}>
		<circle cx="12" cy="12" r="3" />
		<path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
	</svg>
);
