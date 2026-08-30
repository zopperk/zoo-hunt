import { useState, type FormEvent } from 'react';
import { formatPoints } from '../../shared/format';
import { adminApi } from '../api';
import { useHq, useHqData } from '../HqApp';
import { Empty, PanelHeader } from '../components';

export function BonusPanel() {
	const { gameId, overview, refresh, toast } = useHq();
	const { data, reload } = useHqData(() => adminApi.bonuses(gameId));
	const [title, setTitle] = useState("Take a team photo with the zoo's largest animal!");
	const [description, setDescription] = useState('Find the biggest animal in the zoo and get your whole team in the photo.');
	const [points, setPoints] = useState('250');
	const [awardTeam, setAwardTeam] = useState<Record<string, string>>({});

	async function act(fn: () => Promise<unknown>, msg: string) {
		try {
			await fn();
			toast(msg, 'good');
			await reload();
			await refresh();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Failed');
		}
	}

	async function create(e: FormEvent) {
		e.preventDefault();
		await act(() => adminApi.addBonus(gameId, { title, description, points: Number(points) }), 'Bonus challenge posted');
	}

	const teams = overview?.leaderboard ?? [];

	return (
		<div className="hq-grid cols-2">
			<form className="hq-panel" onSubmit={create}>
				<PanelHeader title="Bonus challenge" sub="Create a bonus challenge for all teams" />
				<div className="field">
					<label>Challenge title</label>
					<input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
				</div>
				<div className="field">
					<label>Description (optional)</label>
					<textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
				</div>
				<div className="field" style={{ maxWidth: 160 }}>
					<label>Point value</label>
					<input className="input" type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} />
				</div>
				<button className="btn sm">Save & activate</button>
				<div className="card mt-l tc" style={{ background: 'var(--yellow-soft)' }}>
					<div className="pill" style={{ background: 'var(--red)', color: '#fff' }}>
						Bonus challenge
					</div>
					<div style={{ fontSize: 44 }}>🐘</div>
					<div className="display title-m c-green">{title || 'Your challenge'}</div>
					<div className="display c-red" style={{ fontSize: 18 }}>
						Worth {formatPoints(Number(points) || 0)} points
					</div>
				</div>
			</form>
			<div className="hq-panel">
				<div className="eyebrow mb">Challenges</div>
				{!data ? (
					<div className="spinner" />
				) : data.bonuses.length === 0 ? (
					<Empty>No bonus challenges yet.</Empty>
				) : (
					<div className="list">
						{data.bonuses.map((b) => (
							<div key={b.id} className="hq-tile">
								<div className="row between">
									<div>
										<div className="bold">{b.title}</div>
										<div className="small muted">{b.description}</div>
									</div>
									<div className="tc">
										<div className="display c-green" style={{ fontSize: 22 }}>
											{b.points}
										</div>
										<span className={`pill ${b.status === 'active' ? 'approved' : 'locked'}`}>{b.status}</span>
									</div>
								</div>
								<div className="row gap mt wrap">
									<button
										className="btn xs ghost"
										onClick={() => act(() => adminApi.patchBonus(b.id, { status: b.status === 'active' ? 'inactive' : 'active' }), b.status === 'active' ? 'Deactivated' : 'Activated')}
									>
										{b.status === 'active' ? 'Deactivate' : 'Activate'}
									</button>
									<select className="select" style={{ width: 170, padding: '4px 8px' }} value={awardTeam[b.id] ?? ''} onChange={(e) => setAwardTeam((m) => ({ ...m, [b.id]: e.target.value }))}>
										<option value="">Award to team…</option>
										{teams.map((t) => (
											<option key={t.id} value={t.id}>
												{t.name}
											</option>
										))}
									</select>
									<button
										className="btn xs yellow"
										disabled={!awardTeam[b.id]}
										onClick={() => act(() => adminApi.awardBonus(b.id, awardTeam[b.id]), `Awarded ${b.points} pts`)}
									>
										Award {b.points}
									</button>
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
