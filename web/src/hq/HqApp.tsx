import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { ApiError } from '../shared/api';
import { useSocket } from '../shared/useSocket';
import { CameraIcon, ChartIcon, GearIcon, ListIcon, MagnifierIcon, PersonCircleIcon, StarIcon, TrophyIcon } from '../shared/icons';
import { adminApi, type Game, type Overview } from './api';
import { Field, PanelHeader, dense } from './components';
import { OverviewPanel } from './panels/OverviewPanel';
import { TeamsPanel, TeamDetailPanel } from './panels/TeamsPanel';
import { PhotoReviewPanel } from './panels/PhotoReviewPanel';
import { CluesPanel } from './panels/CluesPanel';
import { ScoresPanel } from './panels/ScoresPanel';
import { ActivityPanel } from './panels/ActivityPanel';
import { BonusPanel } from './panels/BonusPanel';
import { SettingsPanel } from './panels/SettingsPanel';

interface HqCtx {
	gameId: string;
	overview: Overview | null;
	tick: number;
	refresh: () => Promise<void>;
	toast: (text: string, kind?: 'good' | 'info') => void;
	switchGame: () => void;
}
const Ctx = createContext<HqCtx | null>(null);
export function useHq(): HqCtx {
	const c = useContext(Ctx);
	if (!c) throw new Error('useHq outside provider');
	return c;
}

/** Re-runs `load` on mount and whenever the room emits an event. */
export function useHqData<T>(load: () => Promise<T>, deps: unknown[] = []): { data: T | null; reload: () => Promise<void>; error: string | null } {
	const { tick } = useHq();
	const [data, setData] = useState<T | null>(null);
	const [error, setError] = useState<string | null>(null);
	const loadRef = useRef(load);
	loadRef.current = load;
	const reload = useCallback(async () => {
		try {
			setData(await loadRef.current());
			setError(null);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load');
		}
	}, []);
	useEffect(() => {
		void reload();
	}, [reload, tick, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
	return { data, reload, error };
}

const GAME_KEY = 'zoo-hunt:hq-game';

function Login({ onDone }: { onDone: () => void }) {
	const [password, setPassword] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	async function submit(e: FormEvent) {
		e.preventDefault();
		setBusy(true);
		setError(null);
		try {
			await adminApi.login(password);
			onDone();
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'Login failed');
		} finally {
			setBusy(false);
		}
	}
	return (
		<div className="hq-login">
			<form onSubmit={submit} className="hq-panel stack tc" style={{ marginTop: 70 }}>
				<img src="/art/george-camera.png" alt="" style={{ width: 140, margin: '-88px auto 0' }} />
				<div>
					<div className="eyebrow">Game master</div>
					<h1 className="display" style={{ fontSize: 44, color: 'var(--brown)' }}>
						Game Master HQ
					</h1>
				</div>
				<Field label="Host password">
					<input id="pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
				</Field>
				{error && <div className="error">{error}</div>}
				<button className="btn md block orange" disabled={busy || !password}>
					{busy ? 'Checking…' : 'Enter HQ'}
				</button>
			</form>
		</div>
	);
}

function GamePicker({ onPick }: { onPick: (id: string) => void }) {
	const [games, setGames] = useState<Game[] | null>(null);
	const [name, setName] = useState('Bronx Zoo Birthday Hunt');
	const [code, setCode] = useState('');
	const [points, setPoints] = useState(150);
	const [mode, setMode] = useState<'manual' | 'auto'>('manual');
	const [error, setError] = useState<string | null>(null);
	useEffect(() => {
		adminApi
			.games()
			.then((r) => setGames(r.games))
			.catch((e) => setError(String(e.message)));
	}, []);
	async function create(e: FormEvent) {
		e.preventDefault();
		try {
			const r = await adminApi.createGame({ name, code: code || undefined, defaultPoints: points, approvalMode: mode, status: 'live' });
			onPick(r.game.id);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed');
		}
	}
	return (
		<div className="paper" style={{ minHeight: '100dvh', padding: 24 }}>
			<div style={{ maxWidth: 960, margin: '0 auto' }}>
				<div className="row" style={{ gap: 14, marginBottom: 18 }}>
					<img src="/art/monkey-head.png" alt="" style={{ width: 64 }} />
					<div>
						<div className="eyebrow">Game master</div>
						<div className="display" style={{ fontSize: 40, color: 'var(--brown)' }}>
							Pick a hunt
						</div>
					</div>
				</div>
				<div className="hq-grid cols-2">
					<div className="hq-panel">
						<PanelHeader title="Your games" />
						{error && <div className="error mb">{error}</div>}
						{games === null ? (
							<div className="spinner" />
						) : games.length === 0 ? (
							<div className="empty">No games yet — create one on the right.</div>
						) : (
							<div className="stack">
								{games.map((g) => (
									<button key={g.id} className="team-row light" onClick={() => onPick(g.id)}>
										<span className="name">
											{g.name}
											<div className="tiny muted">
												{g.code} · {new Date(g.created_at).toLocaleDateString()}
											</div>
										</span>
										<span className={`pill ${g.status}`}>{g.status}</span>
									</button>
								))}
							</div>
						)}
					</div>
					<form className="hq-panel stack" onSubmit={create}>
						<PanelHeader title="New game" sub="Create your hunt!" />
						<Field label="Game name">
							<input className="input" style={dense} value={name} onChange={(e) => setName(e.target.value)} required />
						</Field>
						<Field label="Game code (optional)">
							<input className="input" style={dense} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Auto-generated" />
						</Field>
						<div className="hq-grid cols-2">
							<Field label="Default points per clue">
								<input className="input" style={dense} type="number" min={0} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
							</Field>
							<Field label="Photo approval mode">
								<select className="select" style={dense} value={mode} onChange={(e) => setMode(e.target.value as 'manual' | 'auto')}>
									<option value="manual">Manual approval</option>
									<option value="auto">Auto-approve</option>
								</select>
							</Field>
						</div>
						<button className="btn md block orange">Create game</button>
					</form>
				</div>
			</div>
		</div>
	);
}

function Shell({ children }: { children: ReactNode }) {
	const { overview, switchGame, refresh, toast } = useHq();
	const nav = useNavigate();
	const pending = overview?.stats.photos_pending ?? 0;
	const cls = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '');
	async function endGame() {
		if (!overview) return;
		const next = overview.game.status === 'ended' ? 'live' : 'ended';
		await adminApi.patchGame(overview.game.id, { status: next });
		toast(next === 'ended' ? 'Game ended' : 'Game re-opened', 'good');
		await refresh();
	}
	return (
		<div className="hq">
			<aside className="hq-side">
				<div className="brand">
					<img src="/art/monkey-head.png" alt="" />
					<div>
						<small>Game master</small>HQ
					</div>
				</div>
				<nav className="hq-nav">
					<NavLink to="/admin" end className={cls}>
						<ChartIcon /> Overview
					</NavLink>
					<NavLink to="/admin/teams" className={cls}>
						<PersonCircleIcon /> Teams
					</NavLink>
					<NavLink to="/admin/review" className={cls}>
						<CameraIcon /> Photo review {pending > 0 && <span className="count">{pending}</span>}
					</NavLink>
					<NavLink to="/admin/clues" className={cls}>
						<MagnifierIcon /> Clues
					</NavLink>
					<NavLink to="/admin/scores" className={cls}>
						<TrophyIcon /> Scores
					</NavLink>
					<NavLink to="/admin/bonus" className={cls}>
						<StarIcon /> Bonus
					</NavLink>
					<NavLink to="/admin/activity" className={cls}>
						<ListIcon /> Activity
					</NavLink>
					<NavLink to="/admin/settings" className={cls}>
						<GearIcon /> Settings
					</NavLink>
				</nav>
				<div style={{ flex: 1 }} />
				<button className={`btn sm block ${overview?.game.status === 'ended' ? '' : 'orange'}`} onClick={endGame} disabled={!overview}>
					{overview?.game.status === 'ended' ? 'Re-open game' : 'End game'}
				</button>
				<div className="hq-nav" style={{ marginTop: 8 }}>
					<button onClick={switchGame}>Switch game</button>
					<button
						onClick={async () => {
							await adminApi.logout();
							nav('/admin');
							location.reload();
						}}
					>
						Log out
					</button>
				</div>
			</aside>
			<main className="hq-main">{children}</main>
		</div>
	);
}

export function HqApp() {
	const [authed, setAuthed] = useState<boolean | null>(null);
	const [gameId, setGameId] = useState<string | null>(() => {
		try {
			return localStorage.getItem(GAME_KEY);
		} catch {
			return null;
		}
	});
	const [overview, setOverview] = useState<Overview | null>(null);
	const [tick, setTick] = useState(0);
	const [toasts, setToasts] = useState<{ id: number; text: string; kind: 'good' | 'info' }[]>([]);
	const toastId = useRef(0);

	useEffect(() => {
		adminApi
			.session()
			.then(() => setAuthed(true))
			.catch(() => setAuthed(false));
	}, []);

	const toast = useCallback((text: string, kind: 'good' | 'info' = 'info') => {
		const id = ++toastId.current;
		setToasts((t) => [...t, { id, text, kind }]);
		window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
	}, []);

	const refresh = useCallback(async () => {
		if (!gameId) return;
		try {
			setOverview(await adminApi.overview(gameId));
			setTick((t) => t + 1);
		} catch (err) {
			if (err instanceof ApiError && err.status === 404) {
				localStorage.removeItem(GAME_KEY);
				setGameId(null);
			} else if (err instanceof ApiError && err.status === 401) {
				setAuthed(false);
			}
		}
	}, [gameId]);

	useEffect(() => {
		if (authed && gameId) void refresh();
	}, [authed, gameId, refresh]);

	useSocket(authed && gameId ? gameId : null, (e) => {
		if (e.type === 'submission_created') toast('New photo to review');
		void refresh();
	});

	const pick = (id: string) => {
		try {
			localStorage.setItem(GAME_KEY, id);
		} catch {
			/* ignore */
		}
		setOverview(null);
		setGameId(id);
	};
	const switchGame = () => {
		try {
			localStorage.removeItem(GAME_KEY);
		} catch {
			/* ignore */
		}
		setOverview(null);
		setGameId(null);
	};

	const ctx = useMemo<HqCtx>(() => ({ gameId: gameId ?? '', overview, tick, refresh, toast, switchGame }), [gameId, overview, tick, refresh, toast]);

	if (authed === null) return <div className="paper" style={{ minHeight: '100dvh' }} />;
	if (!authed) return <Login onDone={() => setAuthed(true)} />;
	if (!gameId) return <GamePicker onPick={pick} />;

	return (
		<Ctx.Provider value={ctx}>
			<div aria-live="polite">
				{toasts.map((t, i) => (
					<div key={t.id} className={`toast ${t.kind === 'good' ? 'good' : ''}`} style={{ top: 14 + i * 58 }}>
						{t.text}
					</div>
				))}
			</div>
			<Shell>
				<Routes>
					<Route index element={<OverviewPanel />} />
					<Route path="teams" element={<TeamsPanel />} />
					<Route path="teams/:teamId" element={<TeamDetailPanel />} />
					<Route path="review" element={<PhotoReviewPanel />} />
					<Route path="clues" element={<CluesPanel />} />
					<Route path="scores" element={<ScoresPanel />} />
					<Route path="bonus" element={<BonusPanel />} />
					<Route path="activity" element={<ActivityPanel />} />
					<Route path="settings" element={<SettingsPanel />} />
					<Route path="*" element={<Navigate to="/admin" replace />} />
				</Routes>
			</Shell>
		</Ctx.Provider>
	);
}
