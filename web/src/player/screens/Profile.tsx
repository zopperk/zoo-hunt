import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playerApi } from '../../shared/api';
import { formatPoints, isValidTeamName } from '../../shared/format';
import { useGame, useGameState } from '../GameContext';
import { Avatar, Bar, Screen } from '../components';

const COLORS = ['yellow', 'green', 'blue', 'red', 'purple', 'orange'];

export function Profile() {
	const s = useGameState();
	const { refresh, signOut, toast } = useGame();
	const nav = useNavigate();
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(s.team.name);
	const [color, setColor] = useState(s.team.color);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function save() {
		if (!isValidTeamName(name)) return;
		setBusy(true);
		setError(null);
		try {
			await playerApi.renameTeam({ name: name.trim(), color });
			await refresh();
			setEditing(false);
			toast('Team updated', 'good');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not save');
		} finally {
			setBusy(false);
		}
	}

	return (
		<Screen>
			<Bar>Team profile</Bar>
			<div className="card mt tc">
				<Avatar color={editing ? color : s.team.color} size="lg" />
				{editing ? (
					<div style={{ marginTop: 12, textAlign: 'left' }}>
						<div className="field">
							<label htmlFor="teamname">Team name</label>
							<input id="teamname" className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
						</div>
						<div className="field">
							<label>Color</label>
							<div className="swatches">
								{COLORS.map((c) => (
									<button key={c} type="button" aria-label={c} className={`swatch team-${c} ${color === c ? 'selected' : ''}`} onClick={() => setColor(c)} />
								))}
							</div>
						</div>
						{error && <div className="error">{error}</div>}
						<div className="row gap">
							<button className="btn ghost sm" onClick={() => setEditing(false)} disabled={busy}>
								Cancel
							</button>
							<button className="btn sm grow" onClick={save} disabled={busy || !isValidTeamName(name)}>
								Save
							</button>
						</div>
					</div>
				) : (
					<>
						<h2 className="title-m" style={{ marginTop: 10 }}>
							{s.team.name}
						</h2>
						{s.player.is_leader ? (
							<button className="link" onClick={() => setEditing(true)}>
								Edit team name
							</button>
						) : (
							<div className="tiny muted">Only the team leader can rename the team</div>
						)}
					</>
				)}
			</div>

			<div className="points-plank mt">
				<div className="eyebrow">Total points</div>
				<div className="v">{formatPoints(s.stats.points)}</div>
				{s.stats.rank && (
					<div className="tiny bold">
						#{s.stats.rank} of {s.leaderboard.length}
					</div>
				)}
			</div>

			<div className="stat-grid mt">
				<div className="stat">
					<div className="v">
						{s.stats.clues_found}
						<span className="muted" style={{ fontSize: 16 }}>
							{' '}
							/ {s.stats.clues_total}
						</span>
					</div>
					<div className="k">Clues found</div>
				</div>
				<div className="stat">
					<div className="v">{s.stats.photos_submitted}</div>
					<div className="k">Photos submitted</div>
				</div>
			</div>

			<div className="card soft mt">
				<div className="eyebrow">Team members</div>
				<ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
					{s.players.map((p) => (
						<li key={p.id} className="small">
							{p.name}
							{p.is_leader && <span className="tiny muted"> · leader</span>}
							{p.id === s.player.id && <span className="tiny muted"> · you</span>}
						</li>
					))}
				</ul>
				<div className="tiny muted mt">
					Game code <b>{s.game.code}</b> — share it so friends can join your team.
				</div>
			</div>

			<button
				className="link mt-l"
				style={{ alignSelf: 'center' }}
				onClick={() => {
					signOut();
					nav('/', { replace: true });
				}}
			>
				Leave game
			</button>
		</Screen>
	);
}
