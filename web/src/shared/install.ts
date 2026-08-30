/** Home-screen install helpers (PWA). */
import { useEffect, useState } from 'react';

export type Platform = 'ios' | 'android' | 'other';

export function detectPlatform(ua: string = navigator.userAgent): Platform {
	if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
	if (/android/i.test(ua)) return 'android';
	return 'other';
}

/** True when running from the home-screen icon (standalone), not in a browser tab. */
export function isStandalone(): boolean {
	try {
		return window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
	} catch {
		return false;
	}
}

/** iOS only installs from Safari — in-app browsers (Instagram, Messenger…) can't add to Home Screen. */
export function isIosSafari(ua: string = navigator.userAgent): boolean {
	return detectPlatform(ua) === 'ios' && /safari/i.test(ua) && !/crios|fxios|edgios|instagram|fbav|fban|messenger|line\//i.test(ua);
}

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== 'undefined') {
	window.addEventListener('beforeinstallprompt', (e) => {
		e.preventDefault();
		deferredPrompt = e as BeforeInstallPromptEvent;
		listeners.forEach((l) => l());
	});
	window.addEventListener('appinstalled', () => {
		deferredPrompt = null;
		listeners.forEach((l) => l());
	});
}

/** Android/Chrome: native install prompt when the browser offers one. */
export function useInstallPrompt() {
	const [available, setAvailable] = useState(!!deferredPrompt);
	useEffect(() => {
		const l = () => setAvailable(!!deferredPrompt);
		listeners.add(l);
		return () => {
			listeners.delete(l);
		};
	}, []);
	return {
		available,
		async install(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
			if (!deferredPrompt) return 'unavailable';
			await deferredPrompt.prompt();
			const { outcome } = await deferredPrompt.userChoice;
			if (outcome === 'accepted') deferredPrompt = null;
			listeners.forEach((l) => l());
			return outcome;
		},
	};
}

const DISMISS_KEY = 'zoo-hunt:install-dismissed';
export function installBannerDismissed(): boolean {
	try {
		return localStorage.getItem(DISMISS_KEY) === '1';
	} catch {
		return false;
	}
}
export function dismissInstallBanner() {
	try {
		localStorage.setItem(DISMISS_KEY, '1');
	} catch {
		/* ignore */
	}
}

export function registerServiceWorker() {
	if (!('serviceWorker' in navigator) || location.hostname === 'localhost' && location.port === '5173') return;
	window.addEventListener('load', () => {
		navigator.serviceWorker.register('/sw.js').catch(() => {
			/* offline support is a bonus, never a blocker */
		});
	});
}
