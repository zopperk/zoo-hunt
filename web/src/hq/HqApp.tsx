import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { ApiError } from '../shared/api';
import { useSocket } from '../shared/useSocket';
import { adminApi, type Game, type Overview } from './api';
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
		<div className="paper" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 20 }}>
			<form onSubmit={submit} className="hq-panel" style={{ width: 360 }}>
				<div className="eyebrow">Game master</div>
				<h1 className="title-l c-green">HQ login</h1>
				<div className="field mt">
					<label htmlFor="pw">Host password</label>
					<input id="pw" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
				</div>
				{error && <div className="error">{error}</div>}
				<button className="btn block" disabled={busy || !password}>
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
		adminApi.games().then((r) => setGames(r.games)).catch((e) => setError(String(e.message)));
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
			<div style={{ maxWidth: 900, margin: '0 auto' }} className="hq-grid cols-2">
				<div className="hq-panel">
					<h2 className="title-m c-green">Your games</h2>
					{error && <div className="error">{error}</div>}
					{games === null ? (
						<div className="spinner" />
					) : games.length === 0 ? (
						<p className="muted small">No games yet — create one on the right.</p>
					) : (
						<div className="list mt">
							{games.map((g) => (
								<button key={g.id} className="clue-row" style={{ cursor: 'pointer' }} onClick={() => onPick(g.id)}>
									<span className="t">
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
				<form className="hq-panel" onSubmit={create}>
					<div className="eyebrow">Create your hunt!</div>
					<h2 className="title-m c-green">New game</h2>
					<div className="field mt">
						<label>Game name</label>
						<input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
					</div>
					<div className="field">
						<label>Game code (optional)</label>
						<input className="input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Auto-generated" />
					</div>
					<div className="hq-grid cols-2">
						<div className="field">
							<label>Default points per clue</label>
							<input className="input" type="number" min={0} value={points} onChange={(e) => setPoints(Number(e.target.value))} />
						</div>
						<div className="field">
							<label>Photo approval mode</label>
							<select className="select" value={mode} onChange={(e) => setMode(e.target.value as 'manual' | 'auto')}>
								<option value="manual">Manual approval</option>
								<option value="auto">Auto-approve</option>
							</select>
						</div>
					</div>
					<button className="btn block">Create game</button>
				</form>
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
					<small>Game master</small>HQ
				</div>
				<nav className="hq-nav">
					<NavLink to="/hq" end className={cls}>
						📊 Overview
					</NavLink>
					<NavLink to="/hq/teams" className={cls}>
						🐵 Teams
					</NavLink>
					<NavLink to="/hq/review" className={cls}>
						📷 Photo review {pending > 0 && <span className="count">{pending}</span>}
					</NavLink>
					<NavLink to="/hq/clues" className={cls}>
						🔍 Clues
					</NavLink>
					<NavLink to="/hq/scores" className={cls}>
						🏆 Scores
					</NavLink>
					<NavLink to="/hq/bonus" className={cls}>
						⭐ Bonus
					</NavLink>
					<NavLink to="/hq/activity" className={cls}>
						📜 Activity
					</NavLink>
					<NavLink to="/hq/settings" className={cls}>
						⚙️ Settings
					</NavLink>
				</nav>
				<div style={{ flex: 1 }} />
				<button className={`btn sm block ${overview?.game.status === 'ended' ? '' : 'red'}`} onClick={endGame} disabled={!overview}>
					{overview?.game.status === 'ended' ? 'Re-open game' : 'End game'}
				</button>
				<div className="hq-nav" style={{ marginTop: 8 }}>
					<button onClick={switchGame}>↔ Switch game</button>
					<button
						onClick={async () => {
							await adminApi.logout();
							nav('/hq');
							location.reload();
						}}
					>
						⎋ Log out
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
		if (e.type === 'submission_created') toast('New photo to review 📷');
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
					<Route path="*" element={<Navigate to="/hq" replace />} />
				</Routes>
			</Shell>
		</Ctx.Provider>
	);
}
