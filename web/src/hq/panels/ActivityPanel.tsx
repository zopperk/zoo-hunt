import { timeAgo, clock } from '../../shared/format';
import { adminApi } from '../api';
import { useHq, useHqData } from '../HqApp';
import { Empty, PanelHeader } from '../components';

const ICON: Record<string, string> = {
	team_joined: '🐵',
	team_created: '🐵',
	team_removed: '🗑️',
	photo_submitted: '📷',
	photo_approved: '✅',
	photo_rejected: '❌',
	clue_released: '🔓',
	clue_locked: '🔒',
	clue_scheduled: '⏰',
	score_adjusted: '🎯',
	bonus_posted: '⭐',
	bonus_awarded: '🏅',
	game_created: '🎉',
	game_status: '🚦',
};

export function ActivityPanel() {
	const { gameId } = useHq();
	const { data } = useHqData(() => adminApi.activity(gameId));
	return (
		<div className="hq-panel">
			<PanelHeader title="Activity" sub="Everything that happened in this game, newest first" />
			{!data ? (
				<div className="spinner" />
			) : data.activity.length === 0 ? (
				<Empty>Nothing yet.</Empty>
			) : (
				<ul className="activity" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
					{data.activity.map((a) => (
						<li key={a.id}>
							<span aria-hidden>{ICON[a.type] ?? '•'}</span>
							<span>{a.message}</span>
							<time title={clock(a.created_at)}>{timeAgo(a.created_at)}</time>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
