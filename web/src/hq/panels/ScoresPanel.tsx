import { useState } from 'react';
import { formatPoints, signed, clock } from '../../shared/format';
import { adminApi } from '../api';
import { useHq, useHqData } from '../HqApp';
import { PanelHeader, TeamChip } from '../components';

const UP = [10, 25, 50, 100, 150];
const DOWN = [10, 25, 50, 100];

export function ScoresPanel() {
	const { gameId, overview, refresh, toast } = useHq();
	const { data: log, reload } = useHqData(() => adminApi.scoreLog(gameId));
	const teams = overview?.leaderboard ?? [];
	const [teamId, setTeamId] = useState('');
	const [custom, setCustom] = useState('');
	const [reason, setReason] = useState('');
	const selected = teams.find((t) => t.id === (teamId || teams[0]?.id));

	async function apply(delta: number) {
		if (!selected) return;
		if (!reason.trim()) return toast('A reason is required');
		try {
			await adminApi.adjust(gameId, { teamId: selected.id, delta, reason: reason.trim() });
			setReason('');
			setCustom('');
			toast(`${selected.name}: ${signed(delta)} pts`, 'good');
			await reload();
			await refresh();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Failed');
		}
	}

	return (
		<div className="hq-grid cols-2">
			<div className="hq-panel">
				<PanelHeader title="Score control" />
				<div className="field">
					<label>Select team</label>
					<select className="select" value={selected?.id ?? ''} onChange={(e) => setTeamId(e.target.value)}>
						{teams.map((t) => (
							<option key={t.id} value={t.id}>
								{t.name} — {formatPoints(t.points)} pts
							</option>
						))}
					</select>
				</div>
				{selected && (
					<div className="points-plank mb">
						<div className="eyebrow">Current score</div>
						<div className="v">{formatPoints(selected.points)}</div>
					</div>
				)}
				<div className="field">
					<label>Reason (required)</label>
					<input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Award for best group photo" />
				</div>
				<div className="label mb">Add</div>
				<div className="preset-grid mb">
					{UP.map((p) => (
						<button key={p} className="btn xs" onClick={() => apply(p)} disabled={!selected}>
							+{p}
						</button>
					))}
				</div>
				<div className="label mb">Remove</div>
				<div className="preset-grid mb">
					{DOWN.map((p) => (
						<button key={p} className="btn xs red" onClick={() => apply(-p)} disabled={!selected}>
							−{p}
						</button>
					))}
				</div>
				<div className="row gap">
					<input className="input" placeholder="Custom (e.g. 75 or -30)" value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="numeric" />
					<button className="btn sm" disabled={!selected || !Number(custom)} onClick={() => apply(Number(custom))}>
						Apply
					</button>
				</div>
			</div>
			<div className="hq-panel">
				<div className="eyebrow mb">Score change log</div>
				<ul className="activity" style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 520, overflow: 'auto' }}>
					{(log?.log ?? []).map((e) => (
						<li key={e.id} style={{ alignItems: 'center' }}>
							<span className={`bold ${e.delta >= 0 ? 'c-green' : 'c-red'}`} style={{ width: 52 }}>
								{signed(e.delta)}
							</span>
							<div className="grow">
								<div className="small">
									{e.team_name && <span className="bold">{e.team_name}: </span>}
									{e.reason}
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
				{selected && (
					<div className="mt small">
						Editing <TeamChip name={selected.name} color={selected.color} />
					</div>
				)}
			</div>
		</div>
	);
}
