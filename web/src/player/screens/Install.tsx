import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../GameContext';
import { Plank, Screen } from '../components';
import { detectPlatform, isIosSafari, isStandalone, useInstallPrompt } from '../../shared/install';

function Step({ n, children }: { n: number; children: React.ReactNode }) {
	return (
		<li className="install-step">
			<span className="install-n">{n}</span>
			<span>{children}</span>
		</li>
	);
}

const ShareGlyph = () => (
	<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-5px' }} aria-label="Share icon">
		<path d="M12 3v12M8 7l4-4 4 4" />
		<path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
	</svg>
);
const DotsGlyph = ({ horizontal = false }: { horizontal?: boolean }) => (
	<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" style={{ verticalAlign: '-5px' }} aria-label="Menu icon">
		{horizontal ? (
			<>
				<circle cx="5" cy="12" r="2" />
				<circle cx="12" cy="12" r="2" />
				<circle cx="19" cy="12" r="2" />
			</>
		) : (
			<>
				<circle cx="12" cy="5" r="2" />
				<circle cx="12" cy="12" r="2" />
				<circle cx="12" cy="19" r="2" />
			</>
		)}
	</svg>
);

/** /install — friendly "add to Home Screen" guide for iPhone and Android. */
export function Install() {
	const { state } = useGame();
	const nav = useNavigate();
	const [platform, setPlatform] = useState(() => detectPlatform());
	const { available, install } = useInstallPrompt();
	const standalone = isStandalone();
	const iosOk = isIosSafari();
	const url = 'zoo-hunt.com';

	return (
		<Screen nav={!!state}>
			<div className="sheet">
				<Plank>Get the app</Plank>
				<div className="card tc" style={{ padding: 18 }}>
					<img src="/icons/icon-192.png" alt="" width={84} height={84} style={{ margin: '0 auto 8px', borderRadius: 18 }} />
					{standalone ? (
						<>
							<div className="display" style={{ fontSize: 30, color: 'var(--green)' }}>
								You’re all set!
							</div>
							<p className="small" style={{ marginTop: 6 }}>
								Zoo Hunt is on your Home Screen and runs full-screen like a real app.
							</p>
						</>
					) : (
						<>
							<div className="display" style={{ fontSize: 30, color: 'var(--brown)' }}>
								Add to Home Screen
							</div>
							<p className="small" style={{ marginTop: 6 }}>
								Takes 10 seconds. Then Zoo Hunt opens full-screen from an icon — no browser bars, faster camera.
							</p>
						</>
					)}
				</div>

				{!standalone && (
					<>
						<div className="row" style={{ justifyContent: 'center', gap: 8 }}>
							<button type="button" className={`btn sm ${platform === 'ios' ? '' : 'ghost'}`} onClick={() => setPlatform('ios')}>
								iPhone
							</button>
							<button type="button" className={`btn sm ${platform === 'android' ? '' : 'ghost'}`} onClick={() => setPlatform('android')}>
								Android
							</button>
						</div>

						{platform === 'ios' || platform === 'other' ? (
							<div className="card">
								<div className="eyebrow" style={{ fontSize: 16 }}>
									iPhone / iPad
								</div>
								{!iosOk && platform === 'ios' && (
									<div className="error" style={{ marginTop: 8 }}>
										Open this page in <b>Safari</b> first — other apps’ browsers can’t add to the Home Screen. Copy the link: <b>{url}</b>
									</div>
								)}
								<ol className="install-steps">
									<Step n={1}>
										Open <b>{url}</b> in <b>Safari</b>.
									</Step>
									<Step n={2}>
										Tap the <b>⋯</b> button <DotsGlyph horizontal /> at the right end of the address bar.
									</Step>
									<Step n={3}>
										Tap <b>Share</b> <ShareGlyph />, then scroll down and tap <b>Add to Home Screen</b>.
										<span className="tiny muted" style={{ display: 'block', fontWeight: 600 }}>
											(On some layouts <b>Add to Home Screen</b> is right there in the ⋯ list — tap it directly.)
										</span>
									</Step>
									<Step n={4}>
										Leave <b>Open as Web App</b> on, then tap <b>Add</b> (top-right). Done — look for the monkey on your Home Screen!
									</Step>
								</ol>
								<div className="tiny muted" style={{ marginTop: 10, fontWeight: 600 }}>
									Older iPhone (iOS 17/18)? Tap the <b>Share</b> button <ShareGlyph /> at the bottom of Safari instead, then <b>Add to Home Screen</b> → <b>Add</b>.
								</div>
							</div>
						) : (
							<div className="card">
								<div className="eyebrow" style={{ fontSize: 16 }}>
									Android
								</div>
								{available && (
									<button
										type="button"
										className="btn md block orange"
										style={{ margin: '10px 0' }}
										onClick={async () => {
											const r = await install();
											if (r === 'accepted') nav('/install', { replace: true });
										}}
									>
										Install Zoo Hunt
									</button>
								)}
								<ol className="install-steps">
									<Step n={1}>
										Open <b>{url}</b> in <b>Chrome</b>.
									</Step>
									<Step n={2}>
										Tap the <b>⋮</b> menu <DotsGlyph /> at the right of the address bar.
									</Step>
									<Step n={3}>
										Tap <b>Install and create shortcut</b> (older Chrome says <b>Add to Home screen</b> or <b>Install app</b>).
									</Step>
									<Step n={4}>
										Tap <b>Install</b>. Look for the monkey on your Home Screen!
									</Step>
								</ol>
								<div className="tiny muted" style={{ marginTop: 10, fontWeight: 600 }}>
									Samsung Internet: tap the <b>≡</b> menu at the bottom → <b>Add page to</b> → <b>Home screen</b>.
								</div>
							</div>
						)}

						<div className="card" style={{ background: 'var(--paper-2)' }}>
							<div className="eyebrow" style={{ fontSize: 16 }}>
								Tips
							</div>
							<ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18, fontWeight: 600, lineHeight: 1.5 }}>
								<li>Allow <b>Camera</b> and <b>Location</b> when asked — you need them for photos and the map.</li>
								<li>Your team stays signed in on the Home Screen app.</li>
								<li>Got it working? Tell your teammates to do the same.</li>
							</ul>
						</div>
					</>
				)}

				<button type="button" className="btn md block" onClick={() => nav(state ? '/clues' : '/')}>
					{state ? 'Back to clues' : 'Back'}
				</button>
			</div>
		</Screen>
	);
}

/** Slim banner for the in-browser experience: points to /install until dismissed. */
export function InstallBanner({ onDismiss }: { onDismiss: () => void }) {
	const nav = useNavigate();
	return (
		<div className="install-banner" role="status">
			<img src="/icons/icon-192.png" alt="" width={36} height={36} style={{ borderRadius: 9 }} />
			<span className="grow">
				<b>Add Zoo Hunt to your Home Screen</b>
				<span className="tiny" style={{ display: 'block', fontWeight: 600 }}>
					Full-screen, faster camera, one tap to open.
				</span>
			</span>
			<button type="button" className="btn xs orange" onClick={() => nav('/install')}>
				How
			</button>
			<button type="button" className="link" style={{ padding: 4, fontSize: 18, lineHeight: 1 }} aria-label="Dismiss" onClick={onDismiss}>
				×
			</button>
		</div>
	);
}
