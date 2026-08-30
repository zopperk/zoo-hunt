import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { GameProvider, useGame } from './GameContext';
import { Screen, Spinner, Toasts } from './components';
import { Welcome } from './screens/Welcome';
import { HowToPlay } from './screens/HowToPlay';
import { Join } from './screens/Join';
import { Clues } from './screens/Clues';
import { ClueDetail } from './screens/ClueDetail';
import { Snap } from './screens/Snap';
import { Submitted } from './screens/Submitted';
import { ZooMap } from './screens/ZooMap';
import { Scoreboard } from './screens/Scoreboard';
import { Profile } from './screens/Profile';

function RequireJoined({ children }: { children: React.ReactElement }) {
	const { state, loading } = useGame();
	const loc = useLocation();
	if (loading) {
		return (
			<Screen nav={false} center>
				<Spinner />
			</Screen>
		);
	}
	if (!state) return <Navigate to="/join" replace state={{ from: loc.pathname }} />;
	return children;
}

export function PlayerApp() {
	return (
		<GameProvider>
			<div className="app">
				<Toasts />
				<Routes>
					<Route path="/" element={<Welcome />} />
					<Route path="/how-to-play" element={<HowToPlay />} />
					<Route path="/join" element={<Join />} />
					<Route
						path="/clues"
						element={
							<RequireJoined>
								<Clues />
							</RequireJoined>
						}
					/>
					<Route
						path="/clues/:id"
						element={
							<RequireJoined>
								<ClueDetail />
							</RequireJoined>
						}
					/>
					<Route
						path="/clues/:id/snap"
						element={
							<RequireJoined>
								<Snap />
							</RequireJoined>
						}
					/>
					<Route
						path="/clues/:id/done"
						element={
							<RequireJoined>
								<Submitted />
							</RequireJoined>
						}
					/>
					<Route
						path="/map"
						element={
							<RequireJoined>
								<ZooMap />
							</RequireJoined>
						}
					/>
					<Route
						path="/scores"
						element={
							<RequireJoined>
								<Scoreboard />
							</RequireJoined>
						}
					/>
					<Route
						path="/profile"
						element={
							<RequireJoined>
								<Profile />
							</RequireJoined>
						}
					/>
					<Route path="*" element={<Navigate to="/" replace />} />
				</Routes>
			</div>
		</GameProvider>
	);
}
