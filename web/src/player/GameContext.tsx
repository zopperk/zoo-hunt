import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { playerApi, tokenStore, ApiError, type Bootstrap } from '../shared/api';
import { useSocket, type RoomEvent } from '../shared/useSocket';

interface Toast {
	id: number;
	text: string;
	kind: 'good' | 'info';
}

interface GameCtx {
	state: Bootstrap | null;
	loading: boolean;
	error: string | null;
	refresh: () => Promise<void>;
	setState: (s: Bootstrap) => void;
	signOut: () => void;
	toast: (text: string, kind?: Toast['kind']) => void;
	toasts: Toast[];
}

const Ctx = createContext<GameCtx | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<Bootstrap | null>(null);
	const [loading, setLoading] = useState<boolean>(!!tokenStore.get());
	const [error, setError] = useState<string | null>(null);
	const [toasts, setToasts] = useState<Toast[]>([]);
	const toastId = useRef(0);

	const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
		const id = ++toastId.current;
		setToasts((t) => [...t, { id, text, kind }]);
		window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
	}, []);

	const refresh = useCallback(async () => {
		if (!tokenStore.get()) {
			setState(null);
			setLoading(false);
			return;
		}
		try {
			const next = await playerApi.me();
			setState(next);
			setError(null);
		} catch (err) {
			if (err instanceof ApiError && err.status === 401) {
				tokenStore.clear();
				setState(null);
			} else {
				setError(err instanceof Error ? err.message : 'Something went wrong');
			}
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	// Poll as a fallback for when the socket is down.
	useEffect(() => {
		if (!state) return;
		const t = window.setInterval(() => void refresh(), 20_000);
		return () => window.clearInterval(t);
	}, [state?.game.id, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

	const stateRef = useRef(state);
	stateRef.current = state;

	useSocket(state?.game.id, (e: RoomEvent) => {
		const me = stateRef.current;
		if (e.type === 'submission_reviewed' && e.teamId === me?.team.id) {
			if (e.status === 'approved') toast(`+${e.points} points! Photo approved 🎉`, 'good');
			else if (e.status === 'rejected') toast('Photo was not accepted — try again!');
		} else if (e.type === 'clue_released' && Array.isArray(e.clueIds) && e.clueIds.length) {
			toast('New clue unlocked! 🔓', 'good');
		} else if (e.type === 'bonus_updated') {
			toast('Bonus challenge updated ⭐');
		} else if (e.type === 'game_ended') {
			toast('The hunt is over! Check the scoreboard 🏆', 'good');
		}
		void refresh();
	});

	const signOut = useCallback(() => {
		tokenStore.clear();
		setState(null);
	}, []);

	const value = useMemo<GameCtx>(() => ({ state, loading, error, refresh, setState, signOut, toast, toasts }), [state, loading, error, refresh, signOut, toast, toasts]);
	return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame(): GameCtx {
	const ctx = useContext(Ctx);
	if (!ctx) throw new Error('useGame must be used inside GameProvider');
	return ctx;
}

/** Only for screens that require a joined player; callers should redirect when null. */
export function useGameState(): Bootstrap {
	const { state } = useGame();
	if (!state) throw new Error('No game state');
	return state;
}
