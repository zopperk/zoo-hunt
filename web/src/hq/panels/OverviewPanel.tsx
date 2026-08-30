import { Link, useNavigate } from 'react-router-dom';
import { formatPoints, timeAgo, clock } from '../../shared/format';
import { CameraIcon, MagnifierIcon, StarIcon, TrophyIcon } from '../../shared/icons';
import { adminApi } from '../api';
import { useHq } from '../HqApp';
import { TeamChip } from '../components';

const ic = { width: 18, height: 18 };

export function OverviewPanel() {
	const { overview, refresh, toast } = useHq();
	const nav = useNavigate();
	if (!overview) return <div className="spinner" />;
	const { game, stats, leaderboard, activity } = overview;

	async function releaseNext() {
		try {
			const r = await adminApi.releaseNext(game.id);
			toast(`Released clue #${r.clue.sort_order}: ${r.clue.title}`, 'good');
			await refresh();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Failed');
		}
	}

	return (
		<>
			<div className="hq-panel">
				<div className="hq-head">
					<div>
						<h1>{game.name}</h1>
						<div className="row sub">
							<span className={`pill ${game.status}`}>{game.status === 'live' ? '● Live' : game.status}</span>
							<span>{game.starts_at ? `Starts ${clock(game.starts_at)}` : `Created ${new Date(game.created_at).toLocaleDateString()}`}</span>
						</div>
					</div>
					<div className="tc">
						<div className="label">Game code</div>
						<div className="code-box">
							{game.code}
							<button
								className="btn xs orange"
								onClick={() => {
									navigator.clipboard?.writeText(`${location.origin}/join?code=${game.code}`);
									toast('Join link copied', 'good');
								}}
							>
								Copy link
							</button>
						</div>
					</div>
				</div>

				<div className="hq-grid cols-4">
					<div className="hq-tile">
						<div className="k">Teams</div>
						<div className="v">{stats.teams}</div>
						<div className="s">Active</div>
					</div>
					<div className="hq-tile">
						<div className="k">Players</div>
						<div className="v">{stats.players}</div>
						<div className="s">Joined</div>
					</div>
					<div className="hq-tile">
						<div className="k">Clues completed</div>
						<div className="v">
							{stats.clues_completed} <span style={{ fontSize: 18, color: 'var(--muted)' }}>/ {stats.clues_total}</span>
						</div>
						<div className="s">across all teams</div>
					</div>
					<div className="hq-tile">
						<div className="k">Photos pending</div>
						<div className="v" style={{ color: stats.photos_pending ? 'var(--orange)' : undefined }}>
							{stats.photos_pending}
						</div>
						<div className="s">to review</div>
					</div>
				</div>
			</div>

			<div className="hq-grid cols-3 mt">
				<div className="hq-panel">
					<div className="eyebrow mb">Live leaderboard</div>
					{leaderboard.length === 0 && <div className="empty">No teams yet.</div>}
					<div className="stack">
						{leaderboard.map((t) => (
							<Link key={t.id} to={`/admin/teams/${t.id}`} className={`team-row team-${t.color}`} style={{ textDecoration: 'none' }}>
								<span className="rank">{t.rank}</span>
								<span className="name">{t.name}</span>
								<span className="pts">{formatPoints(t.points)}</span>
							</Link>
						))}
					</div>
				</div>
				<div className="hq-panel">
					<div className="eyebrow mb">Recent activity</div>
					<ul className="activity">
						{activity.slice(0, 8).map((a) => (
							<li key={a.id}>
								<span>{a.message}</span>
								<time>{timeAgo(a.created_at)}</time>
							</li>
						))}
						{activity.length === 0 && <li className="muted">Nothing yet.</li>}
					</ul>
					<Link to="/admin/activity" className="link" style={{ paddingLeft: 0 }}>
						View all activity
					</Link>
				</div>
				<div className="hq-panel">
					<div className="eyebrow mb">Quick actions</div>
					<div className="stack">
						<button className="btn sm block" onClick={releaseNext}>
							<MagnifierIcon {...ic} /> Release next clue
						</button>
						<button className="btn sm block orange" onClick={() => nav('/admin/review')}>
							<CameraIcon {...ic} /> Photo review {stats.photos_pending > 0 && `(${stats.photos_pending})`}
						</button>
						<button className="btn sm block ghost" onClick={() => nav('/admin/scores')}>
							<TrophyIcon {...ic} /> Adjust scores
						</button>
						<button className="btn sm block ghost" onClick={() => nav('/admin/bonus')}>
							<StarIcon {...ic} /> Bonus challenge
						</button>
					</div>
					{leaderboard[0] && (
						<div className="mt small row">
							Leading: <TeamChip name={leaderboard[0].name} color={leaderboard[0].color} />
						</div>
					)}
				</div>
			</div>
		</>
	);
}
