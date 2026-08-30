import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { playerApi } from '../../shared/api';
import { formatPoints, isValidTeamName } from '../../shared/format';
import { useGame, useGameState } from '../GameContext';
import { Plank, Screen, TeamTile } from '../components';

const COLORS = ['yellow', 'green', 'blue', 'red', 'purple', 'orange'];

/** Frame 07-team-profile. */
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
			<div className="sheet">
				<Plank>Team profile</Plank>
				<div className="card tc" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '22px 14px' }}>
					<TeamTile color={editing ? color : s.team.color} size="sm" />
					{editing ? (
						<div className="stack" style={{ width: '100%', gap: 10 }}>
							<input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Team name" />
							<div className="row" style={{ justifyContent: 'center', gap: 8 }}>
								{COLORS.map((c) => (
									<TeamTile key={c} color={c} size="xs" label={c} selected={color === c} onClick={() => setColor(c)} />
								))}
							</div>
							{error && <div className="error">{error}</div>}
							<div className="row" style={{ gap: 8 }}>
								<button className="btn sm ghost grow" onClick={() => setEditing(false)} disabled={busy}>
									Cancel
								</button>
								<button className="btn sm grow" onClick={save} disabled={busy || !isValidTeamName(name)}>
									Save
								</button>
							</div>
						</div>
					) : (
						<div>
							<div style={{ fontSize: 26, fontWeight: 700 }}>{s.team.name}</div>
							{s.player.is_leader ? (
								<button className="link" style={{ fontSize: 15, textTransform: 'none', color: 'var(--muted)' }} onClick={() => setEditing(true)}>
									Edit Team Name
								</button>
							) : (
								<div className="tiny muted">Only the team leader can rename the team</div>
							)}
						</div>
					)}

					<div className="score-box" style={{ width: '100%' }}>
						<div className="k">Current score</div>
						<div className="v" key={s.stats.points}>
							{formatPoints(s.stats.points)}
						</div>
						{s.stats.rank && (
							<div className="tiny muted">
								#{s.stats.rank} of {s.leaderboard.length}
							</div>
						)}
					</div>

					<div className="stat-pair" style={{ width: '100%' }}>
						<div>
							<div className="k">Clues found</div>
							<div className="v">
								{s.stats.clues_found}
								<span className="muted" style={{ fontSize: 16, fontFamily: 'var(--f-body)' }}>
									{' '}
									of {s.stats.clues_total}
								</span>
							</div>
						</div>
						<div>
							<div className="k">Photos taken</div>
							<div className="v">{s.stats.photos_submitted}</div>
						</div>
					</div>
				</div>

				<div className="card">
					<div className="label">Team members</div>
					<ul style={{ margin: '8px 0 0', paddingLeft: 18, fontWeight: 600 }}>
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
			</div>

			<button type="button" className="link mt-l" style={{ alignSelf: 'center' }} onClick={() => nav('/install')}>
				📲 Add to Home Screen
			</button>
			<button
				className="link"
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
