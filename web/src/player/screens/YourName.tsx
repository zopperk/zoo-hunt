import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { playerApi } from '../../shared/api';
import { useGame, useGameState } from '../GameContext';
import { Screen, TeamTile } from '../components';

/** Right after joining: "What's your name?" — the random name is pre-filled, keep it or type your own. */
export function YourName() {
	const s = useGameState();
	const { refresh } = useGame();
	const nav = useNavigate();
	const [name, setName] = useState(s.player.name);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const trimmed = name.trim();
	const changed = trimmed !== s.player.name;

	async function submit(e: FormEvent) {
		e.preventDefault();
		if (!trimmed) return;
		setBusy(true);
		setError(null);
		try {
			if (changed) {
				await playerApi.renameMe(trimmed);
				await refresh();
			}
			nav('/how-to-play', { replace: true });
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Could not save your name');
		} finally {
			setBusy(false);
		}
	}

	return (
		<Screen nav={false}>
			<form onSubmit={submit} className="stack" style={{ flex: 1, gap: 18 }}>
				<div style={{ marginTop: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
					<TeamTile color={s.team.color} size="sm" />
					<div className="eyebrow" style={{ color: 'var(--green)' }}>
						Team {s.team.name}
					</div>
					<h1 className="display h-title">What’s your name?</h1>
					<p className="h-sub" style={{ fontSize: 18, lineHeight: 1.35 }}>
						So your team knows who found what. Keep the fun one or type your own.
					</p>
				</div>
				<input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" maxLength={40} autoFocus autoComplete="given-name" aria-label="Your name" />
				{error && <div className="error">{error}</div>}
				<div className="spacer" />
				<button className="btn md center" style={{ minWidth: 207 }} type="submit" disabled={!trimmed || busy}>
					{busy ? 'Saving…' : changed ? 'Next' : `Keep “${s.player.name}”`}
				</button>
			</form>
		</Screen>
	);
}
