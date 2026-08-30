import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatPoints, signed, timeAgo, clock } from '../../shared/format';
import { adminApi } from '../api';
import { useHq, useHqData } from '../HqApp';
import { Empty, Field, Lightbox, PanelHeader, TeamChip, dense } from '../components';

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
			<PanelHeader title="Teams" sub={`${data?.teams.length ?? 0} teams`}>
				<form onSubmit={add} className="row wrap">
					<input className="input" style={{ ...dense, width: 220 }} placeholder="New team name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
					<select className="select" style={{ ...dense, width: 130 }} value={color} onChange={(e) => setColor(e.target.value)}>
						{COLORS.map((c) => (
							<option key={c} value={c}>
								{c}
							</option>
						))}
					</select>
					<button className="btn sm" disabled={!name.trim()}>
						+ Add team
					</button>
				</form>
			</PanelHeader>
			{error && <div className="error mb">{error}</div>}
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
									<Link to={`/admin/teams/${t.id}`} style={{ textDecoration: 'none' }}>
										<TeamChip name={t.name} color={t.color} />
									</Link>
								</td>
								<td>{t.players}</td>
								<td className="display" style={{ fontSize: 22, color: 'var(--green)' }}>
									{formatPoints(t.points)}
								</td>
								<td>{t.clues_found}</td>
								<td>{t.photos_submitted}</td>
								<td>
									<div className="row" style={{ justifyContent: 'flex-end' }}>
										<Link to={`/admin/teams/${t.id}`} className="btn xs ghost">
											View
										</Link>
										<button className="btn xs ghost orange" onClick={() => remove(t.id, t.name)}>
											Remove
										</button>
									</div>
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
	const [editPlayer, setEditPlayer] = useState<{ id: string; name: string } | null>(null);

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

	async function savePlayer() {
		if (!editPlayer || !editPlayer.name.trim()) return;
		try {
			await adminApi.patchPlayer(editPlayer.id, { name: editPlayer.name.trim() });
			setEditPlayer(null);
			await reload();
			toast('Player renamed', 'good');
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Failed');
		}
	}

	async function removePlayer(id: string, name: string) {
		if (!window.confirm(`Remove ${name} from the team?`)) return;
		await adminApi.deletePlayer(id);
		await reload();
		await refresh();
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
			<button className="link" style={{ paddingLeft: 0 }} onClick={() => nav('/admin/teams')}>
				‹ Back to teams
			</button>
			<div className="hq-panel">
				<div className="hq-head" style={{ marginBottom: 0 }}>
					<div className="row" style={{ gap: 14 }}>
						<span className={`tile sm team-${team.color}`} style={{ cursor: 'default' }}>
							<img src="/art/monkey-head.png" alt="" />
						</span>
						<div>
							{editName === null ? (
								<h1 className="row">
									{team.name}
									<button className="btn xs ghost" style={{ fontFamily: 'var(--f-body)', letterSpacing: 0 }} onClick={() => setEditName(team.name)}>
										Rename
									</button>
								</h1>
							) : (
								<div className="row">
									<input className="input" style={dense} value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={40} />
									<button className="btn xs" onClick={saveName}>
										Save
									</button>
									<button className="btn xs ghost" onClick={() => setEditName(null)}>
										Cancel
									</button>
								</div>
							)}
							<div className="sub">
								{players.length} players · {clues.filter((c) => c.status === 'complete').length}/{clues.length} clues
							</div>
						</div>
					</div>
					<div className="score-box" style={{ minWidth: 160 }}>
						<div className="k">Points</div>
						<div className="v" key={points}>
							{formatPoints(points)}
						</div>
					</div>
				</div>
			</div>

			<div className="hq-grid cols-3 mt">
				<div className="hq-panel">
					<div className="eyebrow mb">Team members</div>
					<div className="tiny muted mb">Players get a random name when they join — rename them here.</div>
					<ul className="activity">
						{players.map((p) => (
							<li key={p.id} style={{ alignItems: 'center' }}>
								{editPlayer?.id === p.id ? (
									<span className="row grow">
										<input className="input" style={{ ...dense, padding: '6px 10px' }} value={editPlayer.name} onChange={(e) => setEditPlayer({ id: p.id, name: e.target.value })} maxLength={40} autoFocus aria-label="Player name" />
										<button className="btn xs" onClick={savePlayer}>
											Save
										</button>
										<button className="btn xs ghost" onClick={() => setEditPlayer(null)}>
											Cancel
										</button>
									</span>
								) : (
									<>
										<span className="grow">
											{p.name} {p.is_leader ? <span className="pill approved">leader</span> : null}
										</span>
										<button className="btn xs ghost" onClick={() => setEditPlayer({ id: p.id, name: p.name })}>
											Rename
										</button>
										<button className="btn xs ghost orange" aria-label={`Remove ${p.name}`} onClick={() => removePlayer(p.id, p.name)}>
											✕
										</button>
										<time>seen {timeAgo(p.last_seen_at)}</time>
									</>
								)}
							</li>
						))}
					</ul>
					<div className="eyebrow mt-l mb">Clue progress</div>
					<div className="row wrap">
						{clues.map((c) => (
							<span key={c.id} className={`pill ${c.status}`} title={c.title}>
								#{c.sort_order}
							</span>
						))}
					</div>
				</div>

				<div className="hq-panel">
					<div className="eyebrow mb">Recent submissions</div>
					{submissions.length === 0 && <div className="empty">No photos yet.</div>}
					<div className="stack">
						{submissions.slice(0, 8).map((s) => (
							<div key={s.id} className="row">
								<div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', flex: 'none' }}>
									<Lightbox src={s.photo_url} alt={s.clue_title} />
								</div>
								<div className="grow small">
									<div>
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

				<div className="hq-panel stack">
					<div className="eyebrow">Adjust score</div>
					<div className="preset-row">
						{PRESETS.map((p) => (
							<button key={p} type="button" className={`btn sm ${delta === p && !custom ? '' : 'ghost'}`} style={{ padding: '8px 4px' }} onClick={() => (setDelta(p), setCustom(''))}>
								{p}
							</button>
						))}
					</div>
					<Field label="Custom amount">
						<input className="input" style={dense} placeholder="Custom" value={custom} onChange={(e) => setCustom(e.target.value)} inputMode="numeric" />
					</Field>
					<Field label="Reason (required)">
						<input className="input" style={dense} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Great photo!" />
					</Field>
					<div className="row">
						<button className="btn sm grow" onClick={() => apply(1)}>
							+ Add
						</button>
						<button className="btn sm grow orange" onClick={() => apply(-1)}>
							− Remove
						</button>
					</div>
					<div className="tiny muted">All score changes are logged.</div>
					<div className="eyebrow">Score log</div>
					<ul className="activity" style={{ maxHeight: 220, overflow: 'auto' }}>
						{score_log.map((e) => (
							<li key={e.id}>
								<span className="display" style={{ fontSize: 18, color: e.delta >= 0 ? 'var(--green)' : 'var(--orange)' }}>
									{signed(e.delta)}
								</span>
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
