import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { playerApi, tokenStore, type PublicGame } from '../../shared/api';
import { isValidTeamName, normalizeCode } from '../../shared/format';
import { useGame } from '../GameContext';
import { Screen, TeamTile } from '../components';

const REMEMBER_CODE = 'zoo-hunt:code';
const REMEMBER_NAME = 'zoo-hunt:name';
const COLORS = ['yellow', 'green', 'blue', 'red', 'purple', 'orange'];

function remembered(key: string): string {
	try {
		return localStorage.getItem(key) ?? '';
	} catch {
		return '';
	}
}

/** Frame 02-choose-team: title, "Pick a team name and color.", team-name field, 2×3 monkey tiles, NEXT. */
export function Join() {
	const nav = useNavigate();
	const { state, setState } = useGame();
	const [params] = useSearchParams();
	const [code, setCode] = useState(() => params.get('code') ?? remembered(REMEMBER_CODE));
	const [editingCode, setEditingCode] = useState(false);
	const [game, setGame] = useState<PublicGame | null>(null);
	const [lookupError, setLookupError] = useState<string | null>(null);
	const [playerName, setPlayerName] = useState(() => remembered(REMEMBER_NAME));
	const [teamName, setTeamName] = useState('');
	const [color, setColor] = useState<string>('yellow');
	const [teamId, setTeamId] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const [justJoined, setJustJoined] = useState(false);
	useEffect(() => {
		if (state && !justJoined) nav('/clues', { replace: true });
	}, [state, nav, justJoined]);

	// Resolve the game: explicit/remembered code, otherwise the current live game.
	useEffect(() => {
		let cancelled = false;
		const c = normalizeCode(code);
		const run = async () => {
			try {
				const g = c.length >= 6 ? await playerApi.lookupGame(c) : await playerApi.currentGame();
				if (cancelled) return;
				setGame(g);
				setLookupError(null);
				if (!c) setCode(g.game.code);
			} catch (err) {
				if (cancelled) return;
				setGame(null);
				setLookupError(err instanceof Error ? err.message : 'Game not found');
			}
		};
		const t = window.setTimeout(run, c.length >= 6 || !c ? 250 : 600);
		return () => {
			cancelled = true;
			window.clearTimeout(t);
		};
	}, [code]);

	const joiningExisting = !!teamId;
	const canSubmit = !!game && game.game.status !== 'ended' && playerName.trim().length > 0 && (joiningExisting || isValidTeamName(teamName));

	async function submit(e: FormEvent) {
		e.preventDefault();
		if (!canSubmit || !game) return;
		setBusy(true);
		setError(null);
		try {
			const res = await playerApi.join({
				code: game.game.code,
				playerName: playerName.trim(),
				...(joiningExisting ? { teamId: teamId! } : { teamName: teamName.trim(), color }),
			});
			tokenStore.set(res.token);
			try {
				localStorage.setItem(REMEMBER_CODE, game.game.code);
				localStorage.setItem(REMEMBER_NAME, playerName.trim());
			} catch {
				/* ignore */
			}
			const { token: _token, ...boot } = res;
			void _token;
			setJustJoined(true);
			setState(boot);
			nav('/how-to-play', { replace: true });
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not join');
		} finally {
			setBusy(false);
		}
	}

	return (
		<Screen nav={false}>
			<form onSubmit={submit} className="stack" style={{ flex: 1, gap: 18 }}>
				<div style={{ marginTop: 26 }}>
					<h1 className="display h-title">Choose your team</h1>
					<p className="h-sub" style={{ marginTop: 6 }}>
						Pick a team name and color.
					</p>
				</div>

				<div className="stack" style={{ gap: 10 }}>
					<input
						className="input"
						value={teamName}
						onChange={(e) => {
							setTeamName(e.target.value);
							setTeamId(null);
						}}
						placeholder="Team name"
						maxLength={40}
						aria-label="Team name"
					/>
					<input className="input" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Your name" maxLength={40} required aria-label="Your name" />
				</div>

				<div className="tile-grid" role="radiogroup" aria-label="Team color" style={{ marginTop: 6 }}>
					{COLORS.map((c) => (
						<TeamTile
							key={c}
							color={c}
							label={c}
							selected={!joiningExisting && color === c}
							onClick={() => {
								setColor(c);
								setTeamId(null);
							}}
						/>
					))}
				</div>

				{game && game.teams.length > 0 && (
					<div className="stack" style={{ gap: 8 }}>
						<div className="label tc">Or join a team that’s already playing</div>
						{game.teams.map((t) => (
							<button
								type="button"
								key={t.id}
								className={`team-row light ${teamId === t.id ? 'selected' : ''}`}
								onClick={() => setTeamId(teamId === t.id ? null : t.id)}
								aria-pressed={teamId === t.id}
							>
								<TeamTile color={t.color} size="xs" />
								<span className="name">{t.name}</span>
								<span className="small muted">
									{t.players} {t.players === 1 ? 'player' : 'players'}
								</span>
							</button>
						))}
					</div>
				)}

				<div className="tc small" style={{ color: 'var(--brown)' }}>
					{game ? (
						<>
							Game <b>{game.game.code}</b> · {game.game.name.split(/[—–]/)[0].trim()}{' '}
							<button type="button" className="link" style={{ padding: '0 4px', fontSize: 13 }} onClick={() => setEditingCode(true)}>
								change
							</button>
						</>
					) : lookupError ? (
						<span style={{ color: 'var(--orange)' }}>{lookupError}</span>
					) : (
						'Finding today’s game…'
					)}
					{editingCode && (
						<input
							className="input mt"
							value={code}
							onChange={(e) => setCode(e.target.value.toUpperCase())}
							placeholder="Game code (ZOO-XXXX)"
							autoCapitalize="characters"
							autoCorrect="off"
							spellCheck={false}
							aria-label="Game code"
						/>
					)}
				</div>

				{error && <div className="error">{error}</div>}
				<div className="spacer" />
				<button className="btn md center" style={{ minWidth: 207 }} type="submit" disabled={!canSubmit || busy}>
					{busy ? 'Joining…' : 'Next'}
				</button>
			</form>
		</Screen>
	);
}
