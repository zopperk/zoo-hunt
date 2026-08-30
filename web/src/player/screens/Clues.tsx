import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clueStatusLabel, formatPoints } from '../../shared/format';
import { useGameState } from '../GameContext';
import { Plank, Screen } from '../components';
import { InstallBanner } from './Install';
import { dismissInstallBanner, installBannerDismissed, isStandalone } from '../../shared/install';
import { QuestionDashedIcon, CameraIcon, CheckCircleIcon, LockIcon, StarIcon } from '../../shared/icons';
import type { TeamClue } from '../../shared/api';

function StatusIcon({ status }: { status: TeamClue['status'] }) {
	const label = clueStatusLabel(status);
	const Icon = status === 'complete' ? CheckCircleIcon : status === 'pending' ? CameraIcon : status === 'locked' ? LockIcon : QuestionDashedIcon;
	return (
		<span className="ic" role="img" aria-label={label}>
			<Icon />
		</span>
	);
}

/** Frame 04-clues: plank + stacked paper clue cards. */
export function Clues() {
	const s = useGameState();
	const done = s.clues.filter((c) => c.status === 'complete').length;
	const [showInstall, setShowInstall] = useState(() => !isStandalone() && !installBannerDismissed());
	return (
		<Screen>
			{showInstall && (
				<InstallBanner
					onDismiss={() => {
						dismissInstallBanner();
						setShowInstall(false);
					}}
				/>
			)}
			<div className="sheet" style={{ marginTop: 0 }}>
				<Plank side={`${done}/${s.clues.length}`}>Clues</Plank>
				{s.bonus && (
					<div className="clue-card" style={{ background: 'var(--t-yellow)' }}>
						<div className="txt">
							<div className="eyebrow">Bonus · {formatPoints(s.bonus.points)} pts</div>
							<div className="body">
								{s.bonus.title}
								{s.bonus.description ? ` — ${s.bonus.description}` : ''}
							</div>
						</div>
						<span className="ic" role="img" aria-label="Bonus challenge">
							<StarIcon />
						</span>
					</div>
				)}
				{s.clues.map((c, i) => (
					<Link
						key={c.id}
						to={`/clues/${c.id}`}
						className={`clue-card ${c.status}`}
						aria-disabled={c.status === 'locked'}
						aria-label={`Clue ${c.sort_order}: ${clueStatusLabel(c.status)}`}
						style={{ animationDelay: `${i * 40}ms`, position: 'relative' }}
					>
						<div className="txt">
							<div className="eyebrow">Clue #{c.sort_order}</div>
							<div className="body">{c.status === 'locked' ? 'Locked — the host will release this clue soon.' : c.body}</div>
							{c.status !== 'locked' && <div className="tiny muted">{formatPoints(c.points)} pts</div>}
						</div>
						{c.status === 'complete' && <span className="stamp">Found</span>}
						<StatusIcon status={c.status} />
					</Link>
				))}
				{s.clues.length === 0 && <div className="card tc muted">No clues yet — the host is still setting up.</div>}
			</div>
			{s.game.status === 'ended' && (
				<div className="card mt tc" style={{ color: 'var(--orange)' }}>
					The hunt has ended. Check the scoreboard!
				</div>
			)}
		</Screen>
	);
}
