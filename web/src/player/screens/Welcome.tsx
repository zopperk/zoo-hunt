import { useNavigate } from 'react-router-dom';
import { useGame } from '../GameContext';

/**
 * Frame 01-welcome (235×512 → 390×850):
 * gate painting fills the screen, "ZAID TURNS 29" (green) over "SCAVENGER HUNT!" (orange)
 * across the sky, George leaping in from the bottom-left, LET'S GO at ~80% height.
 */
export function Welcome() {
	const { state, loading } = useGame();
	const nav = useNavigate();
	const eyebrow = state?.game.name.split(/[—–]/)[0]?.trim() || 'Zaid turns 29';
	return (
		<main className="welcome">
			<h1 className="welcome-title">
				<span className="t1">{eyebrow}</span>
				<span className="t2">
					Scavenger
					<br />
					Hunt!
				</span>
			</h1>
			<img className="mascot" src="/art/george-jump.png" alt="" />
			{!loading && (
				<button className="btn orange cta" onClick={() => nav(state ? '/clues' : '/join')}>
					Let’s go!
				</button>
			)}
		</main>
	);
}
