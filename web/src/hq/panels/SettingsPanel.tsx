import { useEffect, useState, type FormEvent } from 'react';
import { adminApi } from '../api';
import { useHq } from '../HqApp';
import { PanelHeader } from '../components';

function toLocal(ms: number | null): string {
	if (!ms) return '';
	const d = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SettingsPanel() {
	const { overview, refresh, toast } = useHq();
	const game = overview?.game;
	const [name, setName] = useState('');
	const [status, setStatus] = useState('live');
	const [points, setPoints] = useState('150');
	const [mode, setMode] = useState('manual');
	const [startsAt, setStartsAt] = useState('');
	const [endsAt, setEndsAt] = useState('');

	useEffect(() => {
		if (!game) return;
		setName(game.name);
		setStatus(game.status);
		setPoints(String(game.default_points));
		setMode(game.approval_mode);
		setStartsAt(toLocal(game.starts_at));
		setEndsAt(toLocal(game.ends_at));
	}, [game?.id, game?.name, game?.status, game?.default_points, game?.approval_mode, game?.starts_at, game?.ends_at]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!game) return <div className="spinner" />;

	async function save(e: FormEvent) {
		e.preventDefault();
		try {
			await adminApi.patchGame(game!.id, {
				name,
				status,
				defaultPoints: Number(points),
				approvalMode: mode,
				startsAt: startsAt ? new Date(startsAt).toISOString() : null,
				endsAt: endsAt ? new Date(endsAt).toISOString() : null,
			});
			toast('Settings saved', 'good');
			await refresh();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Failed');
		}
	}

	return (
		<form className="hq-panel" onSubmit={save} style={{ maxWidth: 720 }}>
			<PanelHeader title="Game settings" />
			<div className="field">
				<label>Game name</label>
				<input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
			</div>
			<div className="row gap mb" style={{ alignItems: 'flex-end' }}>
				<div>
					<div className="label">Game code</div>
					<div className="code-box">{game.code}</div>
				</div>
				<button
					type="button"
					className="btn xs ghost"
					onClick={async () => {
						if (!window.confirm('Regenerate the game code? Players will need the new one to join.')) return;
						await adminApi.regenerateCode(game.id);
						await refresh();
					}}
				>
					↻ Regenerate
				</button>
				<a className="btn xs yellow" href={`/join?code=${game.code}`} target="_blank" rel="noreferrer">
					Open join link
				</a>
			</div>
			<div className="hq-grid cols-2">
				<div className="field">
					<label>Status</label>
					<select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
						<option value="draft">Draft (players can join, no photos yet)</option>
						<option value="live">Live</option>
						<option value="ended">Ended</option>
					</select>
				</div>
				<div className="field">
					<label>Photo approval mode</label>
					<select className="select" value={mode} onChange={(e) => setMode(e.target.value)}>
						<option value="manual">Manual approval</option>
						<option value="auto">Auto-approve on upload</option>
					</select>
				</div>
				<div className="field">
					<label>Default points per clue</label>
					<input className="input" type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} />
				</div>
				<div />
				<div className="field">
					<label>Start time</label>
					<input className="input" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
				</div>
				<div className="field">
					<label>End time</label>
					<input className="input" type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
				</div>
			</div>
			<button className="btn sm">Save settings</button>
		</form>
	);
}
