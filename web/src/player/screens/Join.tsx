import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { playerApi, tokenStore, type PublicGame } from '../../shared/api';
import { isValidTeamName, normalizeCode } from '../../shared/format';
import { useGame } from '../GameContext';
import { Avatar, Screen } from '../components';

const REMEMBER_CODE = 'zoo-hunt:code';
const REMEMBER_NAME = 'zoo-hunt:name';

function remembered(key: string): string {
	try {
		return localStorage.getItem(key) ?? '';
	} catch {
		return '';
	}
}

export function Join() {
	const nav = useNavigate();
	const { state, setState } = useGame();
	const [params] = useSearchParams();
	const [code, setCode] = useState(() => params.get('code') ?? remembered(REMEMBER_CODE));
	const [playerName, setPlayerName] = useState(() => remembered(REMEMBER_NAME));
	const [game, setGame] = useState<PublicGame | null>(null);
	const [lookupError, setLookupError] = useState<string | null>(null);
	const [mode, setMode] = useState<'pick' | 'create'>('pick');
	const [teamId, setTeamId] = useState<string | null>(null);
	const [teamName, setTeamName] = useState('');
	const [color, setColor] = useState('yellow');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (state) nav('/clues', { replace: true });
	}, [state, nav]);

	// Look up the game whenever a plausible code is typed.
	useEffect(() => {
		const c = normalizeCode(code);
		if (c.length < 6) {
			setGame(null);
			return;
		}
		let cancelled = false;
		const t = window.setTimeout(async () => {
			try {
				const g = await playerApi.lookupGame(c);
				if (cancelled) return;
				setGame(g);
				setLookupError(null);
				if (g.teams.length === 0) setMode('create');
			} catch (err) {
				if (cancelled) return;
				setGame(null);
				setLookupError(err instanceof Error ? err.message : 'Not found');
			}
		}, 350);
		return () => {
			cancelled = true;
			window.clearTimeout(t);
		};
	}, [code]);

	const canSubmit =
		!!game && game.game.status !== 'ended' && playerName.trim().length > 0 && (mode === 'pick' ? !!teamId : isValidTeamName(teamName));

	async function submit(e: FormEvent) {
		e.preventDefault();
		if (!canSubmit || !game) return;
		setBusy(true);
		setError(null);
		try {
			const res = await playerApi.join({
				code: game.game.code,
				playerName: playerName.trim(),
				...(mode === 'pick' ? { teamId: teamId! } : { teamName: teamName.trim(), color }),
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
			setState(boot);
			nav('/clues', { replace: true });
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not join');
		} finally {
			setBusy(false);
		}
	}

	return (
		<Screen nav={false}>
			<form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
				<h1 className="title-l tc c-green" style={{ marginTop: 20 }}>
					Choose your team
				</h1>
				<p className="tc small muted" style={{ marginTop: 6 }}>
					Enter the game code, your name, then pick or create a team.
				</p>

				<div className="field mt">
					<label htmlFor="code">Game code</label>
					<input
						id="code"
						className="input"
						value={code}
						onChange={(e) => setCode(e.target.value.toUpperCase())}
						placeholder="ZOO-2929"
						autoCapitalize="characters"
						autoCorrect="off"
						spellCheck={false}
						inputMode="text"
						required
					/>
					{game ? (
						<div className="small c-green bold">✓ {game.game.name}</div>
					) : lookupError && normalizeCode(code).length >= 6 ? (
						<div className="small c-red bold">{lookupError}</div>
					) : null}
				</div>

				<div className="field">
					<label htmlFor="pname">Your name</label>
					<input id="pname" className="input" value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Alex" maxLength={40} required />
				</div>

				{game && (
					<>
						{game.teams.length > 0 && (
							<div className="row gap mb">
								<button type="button" className={`btn sm ${mode === 'pick' ? '' : 'ghost'}`} onClick={() => setMode('pick')}>
									Join a team
								</button>
								<button type="button" className={`btn sm ${mode === 'create' ? '' : 'ghost'}`} onClick={() => setMode('create')}>
									New team
								</button>
							</div>
						)}
						{mode === 'pick' ? (
							<div className="list">
								{game.teams.map((t) => (
									<button
										type="button"
										key={t.id}
										className={`team-row team-${t.color} ${teamId === t.id ? 'selected' : ''}`}
										onClick={() => setTeamId(t.id)}
										aria-pressed={teamId === t.id}
									>
										<Avatar color={t.color} size="sm" />
										<span className="name">{t.name}</span>
										<span className="small">
											{t.players} {t.players === 1 ? 'player' : 'players'}
										</span>
									</button>
								))}
							</div>
						) : (
							<>
								<div className="field">
									<label htmlFor="tname">Team name</label>
									<input id="tname" className="input" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Banana Bunch" maxLength={40} />
								</div>
								<div className="field">
									<label>Team color</label>
									<div className="swatches" role="radiogroup" aria-label="Team color">
										{game.colors.map((c) => (
											<button
												type="button"
												key={c}
												role="radio"
												aria-checked={color === c}
												aria-label={c}
												className={`swatch team-${c} ${color === c ? 'selected' : ''}`}
												onClick={() => setColor(c)}
											/>
										))}
									</div>
								</div>
							</>
						)}
					</>
				)}

				{error && <div className="error">{error}</div>}
				<div style={{ flex: 1 }} />
				<button className="btn block mt-l" type="submit" disabled={!canSubmit || busy}>
					{busy ? 'Joining…' : 'Next'}
				</button>
			</form>
		</Screen>
	);
}
