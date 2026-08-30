import { useState, type CSSProperties, type ReactNode } from 'react';
import { formatPoints } from '../shared/format';

/** Denser sizing for admin inputs/selects — the base .input is phone-sized. */
export const dense: CSSProperties = { padding: '10px 14px', fontSize: 16, textAlign: 'left', borderRadius: 'var(--r-sm)' };

export function PanelHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
	return (
		<div className="hq-head">
			<div>
				<h1>{title}</h1>
				{sub && <div className="sub">{sub}</div>}
			</div>
			{children && <div className="row wrap">{children}</div>}
		</div>
	);
}

export function Field({ label, children, style }: { label: ReactNode; children: ReactNode; style?: CSSProperties }) {
	return (
		<div className="field" style={style}>
			<label className="label">{label}</label>
			{children}
		</div>
	);
}

export function TeamChip({ name, color }: { name: string; color: string }) {
	return (
		<span className={`chip team-${color}`}>
			<img src="/art/monkey-head.png" alt="" />
			{name}
		</span>
	);
}

export function Points({ n }: { n: number }) {
	return (
		<span className="display" style={{ fontSize: 18, color: 'var(--green)' }}>
			{formatPoints(n)}
		</span>
	);
}

export function Lightbox({ src, alt }: { src: string; alt: string }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<img src={src} alt={alt} onClick={() => setOpen(true)} />
			{open && (
				<div className="lightbox" onClick={() => setOpen(false)} role="dialog" aria-label={alt}>
					<img src={src} alt={alt} />
				</div>
			)}
		</>
	);
}

export function Empty({ children }: { children: ReactNode }) {
	return <div className="empty">{children}</div>;
}
