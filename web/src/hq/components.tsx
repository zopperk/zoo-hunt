import { useState, type ReactNode } from 'react';
import { formatPoints } from '../shared/format';

export function PanelHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
	return (
		<div className="row between mb" style={{ alignItems: 'flex-end' }}>
			<div>
				<h1 className="title-l c-green">{title}</h1>
				{sub && <div className="small muted">{sub}</div>}
			</div>
			{children && <div className="row gap wrap">{children}</div>}
		</div>
	);
}

export function TeamChip({ name, color }: { name: string; color: string }) {
	return (
		<span className={`chip team-${color}`}>
			<span className="avatar sm">🐵</span>
			{name}
		</span>
	);
}

export function Points({ n }: { n: number }) {
	return <span className="display" style={{ fontSize: 18, color: 'var(--green)' }}>{formatPoints(n)}</span>;
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
	return (
		<div className="hq-tile tc muted" style={{ padding: 30 }}>
			{children}
		</div>
	);
}
