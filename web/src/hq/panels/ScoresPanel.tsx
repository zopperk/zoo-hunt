import { useState } from 'react';
import { formatPoints, signed, clock } from '../../shared/format';
import { adminApi } from '../api';
import { useHq, useHqData } from '../HqApp';
import { Field, PanelHeader, TeamChip, dense } from '../components';

const PRESETS = [-50, -10, 10, 50, 100];
const POP = 'pop 0.45s cubic-bezier(0.2, 1.4, 0.4, 1) both';

export function ScoresPanel() {
	const { gameId, overview, refresh, toast } = useHq();
	const { data: log, reload } = useHqData(() => adminApi.scoreLog(gameId));
	const teams = overview?.leaderboard ?? [];
	const [teamId, setTeamId] = useState('');
	const [preset, setPreset] = useState<number>(10);
	const [custom, setCustom] = useState('');
	const [reason, setReason] = useState('');
	const [busy, setBusy] = useState(false);
	const selected = teams.find((t) => t.id === (teamId || teams[0]?.id));
	const amount = custom.trim() !== '' ? Number(custom) : preset;
	const valid = Number.isInteger(amount) && amount !== 0;

	async function award() {
		if (!selected) return;
		if (!valid) return toast('Enter a whole number of points');
		if (!reason.trim()) return toast('A reason is required');
		setBusy(true);
		try {
			await adminApi.adjust(gameId, { teamId: selected.id, delta: amount, reason: reason.trim() });
			setReason('');
			setCustom('');
			toast(`${selected.name}: ${signed(amount)} pts`, 'good');
			await reload();
			await refresh();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Failed');
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="hq-grid cols-2">
			<div className="hq-panel stack">
				<PanelHeader title="Team score" sub="Quick, chunky adjustments. Every change is logged." />
				<Field label="Team">
					<select className="select" style={dense} value={selected?.id ?? ''} onChange={(e) => setTeamId(e.target.value)}>
						{teams.map((t) => (
							<option key={t.id} value={t.id}>
								{t.name} — {formatPoints(t.points)} pts
							</option>
						))}
					</select>
				</Field>
				{selected ? (
					<div className="hq-tile tc">
						<div className="display" style={{ fontSize: 30, color: 'var(--brown)' }}>
							{selected.name}
						</div>
						<div key={`${selected.id}:${selected.points}`} className="big-score" style={{ animation: POP }}>
							{formatPoints(selected.points)}
						</div>
						<div className="tiny muted">Current score</div>
					</div>
				) : (
					<div className="empty">No teams yet.</div>
				)}
				<div className="preset-row">
					{PRESETS.map((p) => {
						const active = custom.trim() === '' && preset === p;
						return (
							<button
								key={p}
								type="button"
								className={`btn md ${p < 0 ? 'orange' : ''}`}
								style={{ padding: '12px 6px', outline: active ? '3px solid var(--green-ink)' : undefined, outlineOffset: 2 }}
								aria-pressed={active}
								disabled={!selected}
								onClick={() => (setPreset(p), setCustom(''))}
							>
								{signed(p)}
							</button>
						);
					})}
				</div>
				<Field label="Custom amount">
					<input className="input" style={dense} placeholder="e.g. 75 or -30" value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="numeric" />
				</Field>
				<Field label="Reason (required)">
					<input className="input" style={dense} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Best group photo" required />
				</Field>
				<button type="button" className={`btn md block ${amount < 0 ? 'orange' : ''}`} disabled={!selected || !valid || busy} onClick={award}>
					{valid ? `Award ${signed(amount)} points` : 'Award points'}
				</button>
			</div>
			<div className="hq-panel">
				<PanelHeader title="Score log" sub={selected ? <TeamChip name={selected.name} color={selected.color} /> : undefined} />
				<ul className="activity" style={{ maxHeight: 560, overflow: 'auto' }}>
					{(log?.log ?? []).map((e) => (
						<li key={e.id} style={{ alignItems: 'center' }}>
							<span className="display" style={{ width: 64, fontSize: 22, color: e.delta >= 0 ? 'var(--green)' : 'var(--orange)' }}>
								{signed(e.delta)}
							</span>
							<div className="grow">
								<div className="small">
									{e.team_name && <span>{e.team_name}: </span>}
									<span style={{ fontWeight: 500 }}>{e.reason}</span>
								</div>
								<div className="tiny muted">
									{e.source} · by {e.created_by}
								</div>
							</div>
							<time>{clock(e.created_at)}</time>
						</li>
					))}
					{log && log.log.length === 0 && <li className="muted small">No score changes yet.</li>}
				</ul>
			</div>
		</div>
	);
}
