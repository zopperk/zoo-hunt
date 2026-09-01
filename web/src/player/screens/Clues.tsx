import { useState } from 'react';
import { Link } from 'react-router-dom';
import { clueStatusLabel, formatPoints } from '../../shared/format';
import { useGameState } from '../GameContext';
import { Plank, Screen } from '../components';
import { InstallBanner } from './Install';
import { dismissInstallBanner, installBannerDismissed, isStandalone } from '../../shared/install';
import { QuestionDashedIcon, CameraIcon, CheckCircleIcon, LockIcon, StarIcon } from '../../shared/icons';
import type { TeamClue } from '../../shared/api';

/** The right-hand slot: the team's own photo once found, otherwise the status glyph. */
function ClueMark({ clue }: { clue: TeamClue }) {
	const label = clueStatusLabel(clue.status);
	if (clue.status === 'complete' && clue.photo_url) {
		return <img className="shot" src={clue.photo_url} alt={label} />;
	}
	const Icon = clue.status === 'complete' ? CheckCircleIcon : clue.status === 'pending' ? CameraIcon : clue.status === 'locked' ? LockIcon : QuestionDashedIcon;
	return (
		<span className="ic" role="img" aria-label={label}>
			<Icon />
		</span>
	);
}

/** Frame 04-clues: plank + numbered rows, each a paper card with the clue text. */
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
					<div className="clue-row">
						<span className="clue-no bonus" aria-hidden>
							<StarIcon />
						</span>
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
					</div>
				)}
				{s.clues.map((c, i) => (
					<div key={c.id} className="clue-row" style={{ animationDelay: `${i * 40}ms` }}>
						<span className={`clue-no ${c.status}`} aria-hidden>
							{String(c.sort_order).padStart(2, '0')}
						</span>
						<Link
							to={`/clues/${c.id}`}
							className={`clue-card ${c.status}`}
							aria-disabled={c.status === 'locked'}
							aria-label={`Clue ${c.sort_order}: ${clueStatusLabel(c.status)}`}
						>
							<div className="txt">
								<div className="body">{c.status === 'locked' ? 'Locked — the host will release this clue soon.' : c.body}</div>
							</div>
							{c.status === 'complete' && (
								<>
									<span className="stamp">Found!</span>
									{/* Decorative: "Found" is already in the card's aria-label and the photo's alt. */}
									<span className="clue-check" aria-hidden>
										<CheckCircleIcon />
									</span>
									<span className="clue-pts">+{formatPoints(c.points)} pts</span>
								</>
							)}
							<ClueMark clue={c} />
						</Link>
					</div>
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
