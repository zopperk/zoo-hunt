/** HMAC-SHA256 signed tokens: base64url(json).base64url(sig). No external deps. */

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
	const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	let s = '';
	for (const x of b) s += String.fromCharCode(x);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): Uint8Array {
	const norm = s.replace(/-/g, '+').replace(/_/g, '/');
	const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : '';
	const bin = atob(norm + pad);
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function sign(payload: unknown, secret: string): Promise<string> {
	const body = b64url(enc.encode(JSON.stringify(payload)));
	const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
	return `${body}.${b64url(sig)}`;
}

/** Returns the payload if the signature is valid and any `exp` (ms) is in the future; otherwise null. */
export async function verify<T extends object>(token: string | null | undefined, secret: string): Promise<T | null> {
	if (!token) return null;
	const i = token.lastIndexOf('.');
	if (i <= 0) return null;
	const body = token.slice(0, i);
	const sig = token.slice(i + 1);
	try {
		const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64url(sig), enc.encode(body));
		if (!ok) return null;
		const payload = JSON.parse(dec.decode(unb64url(body))) as T & { exp?: number };
		if (typeof payload.exp === 'number' && payload.exp < Date.now()) return null;
		return payload;
	} catch {
		return null;
	}
}

export function timingSafeEqual(a: string, b: string): boolean {
	const ab = enc.encode(a);
	const bb = enc.encode(b);
	if (ab.length !== bb.length) return false;
	let r = 0;
	for (let i = 0; i < ab.length; i++) r |= ab[i] ^ bb[i];
	return r === 0;
}
