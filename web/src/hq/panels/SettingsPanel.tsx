import { useEffect, useState, type FormEvent } from 'react';
import { adminApi } from '../api';
import { useHq } from '../HqApp';
import { Field, PanelHeader, dense } from '../components';

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
		<form className="hq-panel stack" onSubmit={save} style={{ maxWidth: 720 }}>
			<PanelHeader title="Game settings" />
			<Field label="Game name">
				<input className="input" style={dense} value={name} onChange={(e) => setName(e.target.value)} required />
			</Field>
			<div className="row wrap" style={{ alignItems: 'flex-end' }}>
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
					Regenerate
				</button>
				<a className="btn xs orange" href={`/join?code=${game.code}`} target="_blank" rel="noreferrer">
					Open join link
				</a>
			</div>
			<div className="hq-grid cols-2">
				<Field label="Status">
					<select className="select" style={dense} value={status} onChange={(e) => setStatus(e.target.value)}>
						<option value="draft">Draft (players can join, no photos yet)</option>
						<option value="live">Live</option>
						<option value="ended">Ended</option>
					</select>
				</Field>
				<Field label="Photo approval mode">
					<select className="select" style={dense} value={mode} onChange={(e) => setMode(e.target.value)}>
						<option value="manual">Manual approval</option>
						<option value="auto">Auto-approve on upload</option>
					</select>
				</Field>
				<Field label="Default points per clue">
					<input className="input" style={dense} type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} />
				</Field>
				<div />
				<Field label="Start time">
					<input className="input" style={dense} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
				</Field>
				<Field label="End time">
					<input className="input" style={dense} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
				</Field>
			</div>
			<button className="btn md block">Save settings</button>
		</form>
	);
}
