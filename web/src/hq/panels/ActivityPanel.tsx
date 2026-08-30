import type { ComponentType, SVGProps } from 'react';
import { timeAgo, clock } from '../../shared/format';
import {
	CameraIcon,
	ChartIcon,
	CheckCircleIcon,
	ClockIcon,
	GearIcon,
	ListIcon,
	LockIcon,
	MagnifierIcon,
	PersonCircleIcon,
	StarIcon,
	TrophyIcon,
	XIcon,
} from '../../shared/icons';
import { adminApi } from '../api';
import { useHq, useHqData } from '../HqApp';
import { Empty, PanelHeader } from '../components';

const ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
	team_joined: PersonCircleIcon,
	team_created: PersonCircleIcon,
	team_removed: XIcon,
	photo_submitted: CameraIcon,
	photo_approved: CheckCircleIcon,
	photo_rejected: XIcon,
	clue_released: MagnifierIcon,
	clue_locked: LockIcon,
	clue_scheduled: ClockIcon,
	score_adjusted: ChartIcon,
	bonus_posted: StarIcon,
	bonus_awarded: TrophyIcon,
	game_created: TrophyIcon,
	game_status: GearIcon,
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
				<ul className="activity">
					{data.activity.map((a) => {
						const Icon = ICON[a.type] ?? ListIcon;
						return (
							<li key={a.id}>
								<Icon width={18} height={18} style={{ flex: 'none', color: 'var(--green)' }} aria-hidden />
								<span>{a.message}</span>
								<time title={clock(a.created_at)}>{timeAgo(a.created_at)}</time>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
