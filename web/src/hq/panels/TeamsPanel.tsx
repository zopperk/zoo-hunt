import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatPoints, signed, timeAgo, clock } from '../../shared/format';
import { adminApi } from '../api';
import { useHq, useHqData } from '../HqApp';
import { Empty, Lightbox, PanelHeader, TeamChip } from '../components';

const COLORS = ['yellow', 'green', 'blue', 'red', 'purple', 'orange'];

export function TeamsPanel() {
	const { gameId, refresh, toast } = useHq();
	const { data, reload } = useHqData(() => adminApi.teams(gameId));
	const [name, setName] = useState('');
	const [color, setColor] = useState('yellow');
	const [error, setError] = useState<string | null>(null);

	async function add(e: FormEvent) {
		e.preventDefault();
		try {
			await adminApi.addTeam(gameId, { name, color });
			setName('');
			setError(null);
			await reload();
			await refresh();
			toast('Team added', 'good');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed');
		}
	}

	async function remove(id: string, teamName: string) {
		if (!window.confirm(`Remove team "${teamName}" and all their photos/points?`)) return;
		await adminApi.deleteTeam(id);
		await reload();
		await refresh();
	}

	return (
		<div className="hq-panel">
			<PanelHeader title="Teams" sub={`${data?.teams.length ?? 0} teams`} />
			<form onSubmit={add} className="row gap wrap mb">
				<input className="input" style={{ width: 240 }} placeholder="New team name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
				<select className="select" style={{ width: 130 }} value={color} onChange={(e) => setColor(e.target.value)}>
					{COLORS.map((c) => (
						<option key={c} value={c}>
							{c}
						</option>
					))}
				</select>
				<button className="btn sm" disabled={!name.trim()}>
					+ Add team
				</button>
				{error && <span className="c-red bold small">{error}</span>}
			</form>
			{!data ? (
				<div className="spinner" />
			) : data.teams.length === 0 ? (
				<Empty>No teams yet. Players create teams when they join, or add one here.</Empty>
			) : (
				<table className="table">
					<thead>
						<tr>
							<th>Team</th>
							<th>Players</th>
							<th>Points</th>
							<th>Clues found</th>
							<th>Photos</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{data.teams.map((t) => (
							<tr key={t.id}>
								<td>
									<Link to={`/hq/teams/${t.id}`} style={{ textDecoration: 'none' }}>
										<TeamChip name={t.name} color={t.color} />
									</Link>
								</td>
								<td>{t.players}</td>
								<td className="bold">{formatPoints(t.points)}</td>
								<td>{t.clues_found}</td>
								<td>{t.photos_submitted}</td>
								<td className="row gap" style={{ justifyContent: 'flex-end' }}>
									<Link to={`/hq/teams/${t.id}`} className="btn xs ghost">
										View
									</Link>
									<button className="btn xs ghost red" onClick={() => remove(t.id, t.name)}>
										Remove
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}

const PRESETS = [10, 25, 50, 100, 150];

export function TeamDetailPanel() {
	const { teamId } = useParams();
	const { gameId, refresh, toast } = useHq();
	const nav = useNavigate();
	const { data, reload, error } = useHqData(() => adminApi.team(teamId!), [teamId]);
	const [delta, setDelta] = useState<number>(50);
	const [custom, setCustom] = useState('');
	const [reason, setReason] = useState('');
	const [editName, setEditName] = useState<string | null>(null);

	if (error) return <div className="hq-panel error">{error}</div>;
	if (!data) return <div className="spinner" />;
	const { team, points, players, submissions, score_log, clues } = data;

	async function apply(sign: 1 | -1) {
		const amount = custom ? Number(custom) : delta;
		if (!Number.isInteger(amount) || amount <= 0) return toast('Enter a whole number of points');
		if (!reason.trim()) return toast('A reason is required');
		try {
			await adminApi.adjust(gameId, { teamId: team.id, delta: sign * amount, reason: reason.trim() });
			setReason('');
			setCustom('');
			await reload();
			await refresh();
			toast(`${signed(sign * amount)} pts applied`, 'good');
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Failed');
		}
	}

	async function saveName() {
		if (editName === null) return;
		try {
			await adminApi.patchTeam(team.id, { name: editName });
			setEditName(null);
			await reload();
			await refresh();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Failed');
		}
	}

	return (
		<>
			<button className="link" onClick={() => nav('/hq/teams')}>
				‹ Back to teams
			</button>
			<div className="hq-panel">
				<div className="row between wrap">
					<div className="row gap">
						<span className={`avatar lg team-${team.color}`}>🐵</span>
						<div>
							{editName === null ? (
								<h1 className="title-l c-green">
									{team.name}{' '}
									<button className="btn xs ghost" onClick={() => setEditName(team.name)}>
										Rename
									</button>
								</h1>
							) : (
								<div className="row gap">
									<input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={40} />
									<button className="btn xs" onClick={saveName}>
										Save
									</button>
									<button className="btn xs ghost" onClick={() => setEditName(null)}>
										Cancel
									</button>
								</div>
							)}
							<div className="small muted">
								{players.length} players · {clues.filter((c) => c.status === 'complete').length}/{clues.length} clues
							</div>
						</div>
					</div>
					<div className="display" style={{ fontSize: 44, color: 'var(--red)' }}>
						{formatPoints(points)} <span style={{ fontSize: 18 }}>points</span>
					</div>
				</div>
			</div>

			<div className="hq-grid cols-3 mt">
				<div className="hq-panel">
					<div className="eyebrow mb">Team members</div>
					<ul style={{ paddingLeft: 18, margin: 0 }}>
						{players.map((p) => (
							<li key={p.id} className="small">
								{p.name} {p.is_leader ? <span className="pill approved">leader</span> : null}
								<span className="tiny muted"> · seen {timeAgo(p.last_seen_at)}</span>
							</li>
						))}
					</ul>
					<div className="eyebrow mt-l mb">Clue progress</div>
					<div className="row wrap gap">
						{clues.map((c) => (
							<span key={c.id} className={`pill ${c.status}`} title={c.title}>
								#{c.sort_order}
							</span>
						))}
					</div>
				</div>

				<div className="hq-panel">
					<div className="eyebrow mb">Recent submissions</div>
					{submissions.length === 0 && <div className="muted small">No photos yet.</div>}
					<div className="list">
						{submissions.slice(0, 8).map((s) => (
							<div key={s.id} className="row gap">
								<div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', flex: 'none' }}>
									<Lightbox src={s.photo_url} alt={s.clue_title} />
								</div>
								<div className="grow small">
									<div className="bold">
										#{s.clue_order} {s.clue_title}
									</div>
									<div className="tiny muted">
										{s.player_name ?? '—'} · {clock(s.created_at)}
									</div>
								</div>
								<span className={`pill ${s.status}`}>{s.status === 'approved' ? `+${s.points_awarded}` : s.status}</span>
							</div>
						))}
					</div>
				</div>

				<div className="hq-panel">
					<div className="eyebrow mb">Adjust score</div>
					<div className="preset-grid">
						{PRESETS.map((p) => (
							<button key={p} className={`btn xs ${delta === p && !custom ? '' : 'ghost'}`} onClick={() => (setDelta(p), setCustom(''))}>
								{p}
							</button>
						))}
						<input className="input" style={{ padding: '4px 8px', fontSize: 14 }} placeholder="Custom" value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="numeric" />
					</div>
					<div className="field mt">
						<label>Reason (required)</label>
						<input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Great photo!" />
					</div>
					<div className="row gap">
						<button className="btn sm grow" onClick={() => apply(1)}>
							＋ Add
						</button>
						<button className="btn sm grow red" onClick={() => apply(-1)}>
							－ Remove
						</button>
					</div>
					<div className="tiny muted mt">All score changes are logged.</div>
					<div className="eyebrow mt-l mb">Score log</div>
					<ul className="activity" style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 220, overflow: 'auto' }}>
						{score_log.map((e) => (
							<li key={e.id}>
								<span className={e.delta >= 0 ? 'c-green bold' : 'c-red bold'}>{signed(e.delta)}</span>
								<span className="small">{e.reason}</span>
								<time>{clock(e.created_at)}</time>
							</li>
						))}
						{score_log.length === 0 && <li className="muted small">No score events yet.</li>}
					</ul>
				</div>
			</div>
		</>
	);
}
