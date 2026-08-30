import { useEffect, useRef, useState } from 'react';
import { clock } from '../../shared/format';
import type { SubmissionStatus } from '../../shared/api';
import { adminApi, type AdminSubmission } from '../api';
import { useHq, useHqData } from '../HqApp';
import { Empty, Lightbox, PanelHeader, TeamChip, dense } from '../components';

const FLOAT_MS = 1400;

export function PhotoReviewPanel() {
	const { gameId, refresh, toast } = useHq();
	const [status, setStatus] = useState<SubmissionStatus>('pending');
	const [team, setTeam] = useState('all');
	const [bonusFor, setBonusFor] = useState<string | null>(null);
	const [bonus, setBonus] = useState('50');
	/** Cards that were just approved: kept on screen while "+N POINTS" floats up. */
	const [floating, setFloating] = useState<Record<string, { sub: AdminSubmission; pts: number }>>({});
	const timers = useRef<number[]>([]);
	useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
	const { data, reload } = useHqData(() => adminApi.submissions(gameId, status), [status]);

	const fromServer = (data?.submissions ?? []).filter((s) => team === 'all' || s.team_id === team);
	const ghosts = status === 'pending' ? Object.values(floating).map((f) => f.sub).filter((s) => !fromServer.some((x) => x.id === s.id)) : [];
	const list = [...fromServer, ...ghosts];
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

	async function approve(s: AdminSubmission, extra = 0) {
		try {
			const r = await adminApi.approve(s.id, extra);
			const pts = r.points_awarded ?? s.clue_points + extra;
			setBonusFor(null);
			setFloating((f) => ({ ...f, [s.id]: { sub: s, pts } }));
			toast(`${s.team_name}: +${pts} points`, 'good');
			timers.current.push(
				window.setTimeout(() => {
					setFloating((f) => {
						const next = { ...f };
						delete next[s.id];
						return next;
					});
					void reload();
					void refresh();
				}, FLOAT_MS),
			);
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Failed');
		}
	}

	return (
		<div className="hq-panel">
			<PanelHeader title="Photo review" sub="Approve to award clue points. Add a bonus for especially great photos!">
				<select className="select" style={{ ...dense, width: 150 }} value={status} onChange={(e) => setStatus(e.target.value as SubmissionStatus)}>
					<option value="pending">Pending</option>
					<option value="approved">Approved</option>
					<option value="rejected">Rejected</option>
				</select>
				<select className="select" style={{ ...dense, width: 180 }} value={team} onChange={(e) => setTeam(e.target.value)}>
					<option value="all">All teams</option>
					{teams.map(([id, name]) => (
						<option key={id} value={id}>
							{name}
						</option>
					))}
				</select>
				{status === 'pending' && fromServer.length > 0 && (
					<button className="btn sm" onClick={() => act(() => adminApi.markAllReviewed(gameId), 'All pending photos approved')}>
						Approve all ({fromServer.length})
					</button>
				)}
			</PanelHeader>

			{!data ? (
				<div className="spinner" />
			) : list.length === 0 ? (
				<Empty>{status === 'pending' ? 'All caught up — no photos waiting for review.' : `No ${status} photos.`}</Empty>
			) : (
				<div className="photo-grid">
					{list.map((s) => {
						const done = floating[s.id];
						return (
							<div key={s.id} className="photo-card">
								{done && (
									<div className="float-pts" style={{ left: 0, right: 0, top: '38%', textAlign: 'center', fontSize: 40, zIndex: 2 }}>
										+{done.pts} points
									</div>
								)}
								<Lightbox src={s.photo_url} alt={`${s.team_name} – ${s.clue_title}`} />
								<div className="body">
									<div className="team">{s.team_name}</div>
									<div className="row between">
										<span>{s.player_name ?? '—'}</span>
										<span className="tiny muted">{clock(s.created_at)}</span>
									</div>
									<div className="meta">
										Clue {String(s.clue_order).padStart(2, '0')} — {s.clue_title.toUpperCase()}
										<span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>
											{' '}
											· {s.clue_points} pts
										</span>
									</div>
									{done ? (
										<span className="pill approved" style={{ alignSelf: 'flex-start' }}>
											Approved · +{done.pts}
										</span>
									) : s.status === 'pending' ? (
										<>
											<div className="actions">
												<button className="btn md" style={{ padding: '12px 10px' }} onClick={() => approve(s)}>
													✓ Approve
												</button>
												<button
													className="btn md ghost orange"
													style={{ padding: '12px 10px' }}
													onClick={() => {
														const reason = window.prompt('Reason (optional, shown to the team):') ?? undefined;
														void act(() => adminApi.reject(s.id, reason), 'Rejected');
													}}
												>
													✕ Reject
												</button>
											</div>
											{bonusFor === s.id ? (
												<div className="row">
													<input
														className="input"
														style={{ ...dense, width: 90 }}
														value={bonus}
														onChange={(e) => setBonus(e.target.value)}
														inputMode="numeric"
														aria-label="Bonus points"
													/>
													<button className="btn sm orange grow" onClick={() => approve(s, Number(bonus) || 0)}>
														Approve + bonus
													</button>
													<button className="btn sm ghost" onClick={() => setBonusFor(null)} aria-label="Cancel bonus">
														✕
													</button>
												</div>
											) : (
												<button type="button" className="link" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setBonusFor(s.id)}>
													+ Bonus
												</button>
											)}
										</>
									) : (
										<div className="row between">
											<span className={`pill ${s.status}`}>{s.status === 'approved' ? `Approved · +${s.points_awarded}` : 'Rejected'}</span>
											<TeamChip name={s.team_name} color={s.team_color} />
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
