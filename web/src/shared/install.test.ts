import { describe, it, expect } from 'vitest';
import { detectPlatform, isIosSafari } from './install';

const IOS_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0 Mobile/15E148 Safari/604.1';
const IOS_INSTAGRAM = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

describe('install helpers', () => {
	it('detects platforms', () => {
		expect(detectPlatform(IOS_SAFARI)).toBe('ios');
		expect(detectPlatform(ANDROID)).toBe('android');
		expect(detectPlatform(MAC)).toBe('other');
	});
	it('only counts real Safari on iOS as installable', () => {
		expect(isIosSafari(IOS_SAFARI)).toBe(true);
		expect(isIosSafari(IOS_CHROME)).toBe(false);
		expect(isIosSafari(IOS_INSTAGRAM)).toBe(false);
		expect(isIosSafari(ANDROID)).toBe(false);
	});
});
