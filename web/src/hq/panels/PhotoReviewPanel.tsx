import { useState } from 'react';
import { clock } from '../../shared/format';
import type { SubmissionStatus } from '../../shared/api';
import { adminApi } from '../api';
import { useHq, useHqData } from '../HqApp';
import { Empty, Lightbox, PanelHeader, TeamChip } from '../components';

export function PhotoReviewPanel() {
	const { gameId, refresh, toast } = useHq();
	const [status, setStatus] = useState<SubmissionStatus>('pending');
	const [team, setTeam] = useState('all');
	const [bonusFor, setBonusFor] = useState<string | null>(null);
	const [bonus, setBonus] = useState('50');
	const { data, reload } = useHqData(() => adminApi.submissions(gameId, status), [status]);

	const list = (data?.submissions ?? []).filter((s) => team === 'all' || s.team_id === team);
	const teams = Array.from(new Map((data?.submissions ?? []).map((s) => [s.team_id, s.team_name])).entries());

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

	return (
		<div className="hq-panel">
			<PanelHeader title="Photo review" sub="Approve to award clue points. Add a bonus for especially great photos!">
				<select className="select" style={{ width: 150 }} value={status} onChange={(e) => setStatus(e.target.value as SubmissionStatus)}>
					<option value="pending">Pending</option>
					<option value="approved">Approved</option>
					<option value="rejected">Rejected</option>
				</select>
				<select className="select" style={{ width: 170 }} value={team} onChange={(e) => setTeam(e.target.value)}>
					<option value="all">All teams</option>
					{teams.map(([id, name]) => (
						<option key={id} value={id}>
							{name}
						</option>
					))}
				</select>
				{status === 'pending' && list.length > 0 && (
					<button className="btn sm" onClick={() => act(() => adminApi.markAllReviewed(gameId), 'All pending photos approved')}>
						Approve all ({list.length})
					</button>
				)}
			</PanelHeader>

			{!data ? (
				<div className="spinner" />
			) : list.length === 0 ? (
				<Empty>{status === 'pending' ? 'All caught up — no photos waiting for review. 🎉' : `No ${status} photos.`}</Empty>
			) : (
				<div className="photo-grid">
					{list.map((s) => (
						<div key={s.id} className="photo-card">
							<Lightbox src={s.photo_url} alt={`${s.team_name} – ${s.clue_title}`} />
							<div className="body">
								<div className="bold small">
									Clue #{s.clue_order}: {s.clue_title} <span className="muted">· {s.clue_points} pts</span>
								</div>
								<div className="row between">
									<TeamChip name={s.team_name} color={s.team_color} />
									<span className="tiny muted">
										{s.player_name ?? '—'} · {clock(s.created_at)}
									</span>
								</div>
								{s.status === 'pending' ? (
									<>
										<div className="actions">
											<button className="btn xs grow" onClick={() => act(() => adminApi.approve(s.id), `Approved +${s.clue_points}`)}>
												Approve
											</button>
											<button
												className="btn xs grow red"
												onClick={() => {
													const reason = window.prompt('Reason (optional, shown to the team):') ?? undefined;
													void act(() => adminApi.reject(s.id, reason), 'Rejected');
												}}
											>
												Reject
											</button>
										</div>
										{bonusFor === s.id ? (
											<div className="row gap">
												<input className="input" style={{ padding: '4px 8px', width: 80 }} value={bonus} onChange={(e) => setBonus(e.target.value)} inputMode="numeric" />
												<button
													className="btn xs yellow grow"
													onClick={() => act(() => adminApi.approve(s.id, Number(bonus) || 0), `Approved +${s.clue_points + (Number(bonus) || 0)}`)}
												>
													Approve + bonus
												</button>
												<button className="btn xs ghost" onClick={() => setBonusFor(null)}>
													✕
												</button>
											</div>
										) : (
											<button className="link" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setBonusFor(s.id)}>
												+ Bonus
											</button>
										)}
									</>
								) : (
									<span className={`pill ${s.status}`}>{s.status === 'approved' ? `Approved · +${s.points_awarded}` : 'Rejected'}</span>
								)}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
