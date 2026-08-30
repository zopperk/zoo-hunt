import { useState, type FormEvent } from 'react';
import { formatPoints } from '../../shared/format';
import { StarIcon } from '../../shared/icons';
import { adminApi } from '../api';
import { useHq, useHqData } from '../HqApp';
import { Empty, Field, PanelHeader, dense } from '../components';

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
			<form className="hq-panel stack" onSubmit={create}>
				<PanelHeader title="Bonus challenge" sub="Create a bonus challenge for all teams" />
				<Field label="Challenge title">
					<input className="input" style={dense} value={title} onChange={(e) => setTitle(e.target.value)} required />
				</Field>
				<Field label="Description (optional)">
					<textarea className="textarea" style={dense} value={description} onChange={(e) => setDescription(e.target.value)} />
				</Field>
				<Field label="Point value" style={{ maxWidth: 160 }}>
					<input className="input" style={dense} type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} />
				</Field>
				<button className="btn md block orange">Save & activate</button>
				<div className="note" style={{ minHeight: 0, padding: '32px 24px 24px', textAlign: 'center' }}>
					<span className="pill rejected">Bonus challenge</span>
					<StarIcon width={44} height={44} style={{ display: 'block', margin: '10px auto', color: 'var(--orange)' }} />
					<div className="display" style={{ fontSize: 26, color: 'var(--brown)' }}>
						{title || 'Your challenge'}
					</div>
					<div className="display" style={{ fontSize: 18, color: 'var(--orange)', marginTop: 8 }}>
						Worth {formatPoints(Number(points) || 0)} points
					</div>
				</div>
			</form>
			<div className="hq-panel">
				<PanelHeader title="Challenges" />
				{!data ? (
					<div className="spinner" />
				) : data.bonuses.length === 0 ? (
					<Empty>No bonus challenges yet.</Empty>
				) : (
					<div className="stack">
						{data.bonuses.map((b) => (
							<div key={b.id} className="hq-tile">
								<div className="row between" style={{ alignItems: 'flex-start' }}>
									<div>
										<div>{b.title}</div>
										<div className="small muted" style={{ fontWeight: 500 }}>
											{b.description}
										</div>
									</div>
									<div className="tc">
										<div className="display" style={{ fontSize: 28, color: 'var(--green)' }}>
											{b.points}
										</div>
										<span className={`pill ${b.status === 'active' ? 'approved' : 'locked'}`}>{b.status}</span>
									</div>
								</div>
								<div className="row mt wrap">
									<button
										className="btn xs ghost"
										onClick={() => act(() => adminApi.patchBonus(b.id, { status: b.status === 'active' ? 'inactive' : 'active' }), b.status === 'active' ? 'Deactivated' : 'Activated')}
									>
										{b.status === 'active' ? 'Deactivate' : 'Activate'}
									</button>
									<select className="select" style={{ ...dense, width: 180, padding: '6px 10px' }} value={awardTeam[b.id] ?? ''} onChange={(e) => setAwardTeam((m) => ({ ...m, [b.id]: e.target.value }))}>
										<option value="">Award to team…</option>
										{teams.map((t) => (
											<option key={t.id} value={t.id}>
												{t.name}
											</option>
										))}
									</select>
									<button className="btn xs orange" disabled={!awardTeam[b.id]} onClick={() => act(() => adminApi.awardBonus(b.id, awardTeam[b.id]), `Awarded ${b.points} pts`)}>
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
