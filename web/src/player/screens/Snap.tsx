import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { playerApi, ApiError } from '../../shared/api';
import { useGame, useGameState } from '../GameContext';
import { BackLink, Screen } from '../components';
import { CameraIcon } from '../../shared/icons';

/** Downscale to ≤1600px on the long edge and re-encode as JPEG so uploads stay small. */
export async function shrinkImage(file: File, maxEdge = 1600, quality = 0.85): Promise<Blob> {
	if (typeof createImageBitmap !== 'function') return file;
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		return file;
	}
	const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
	const w = Math.round(bitmap.width * scale);
	const h = Math.round(bitmap.height * scale);
	const canvas = document.createElement('canvas');
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext('2d');
	if (!ctx) return file;
	ctx.drawImage(bitmap, 0, 0, w, h);
	bitmap.close?.();
	return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', quality));
}

/** Frame 09-snap-pic. */
export function Snap() {
	const { id } = useParams();
	const nav = useNavigate();
	const s = useGameState();
	const { refresh } = useGame();
	const clue = s.clues.find((c) => c.id === id);
	const [file, setFile] = useState<File | null>(null);
	const [preview, setPreview] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const input = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!file) {
			setPreview(null);
			return;
		}
		const url = URL.createObjectURL(file);
		setPreview(url);
		return () => URL.revokeObjectURL(url);
	}, [file]);

	if (!clue) return <Navigate to="/clues" replace />;
	if (clue.status !== 'available') return <Navigate to={`/clues/${clue.id}`} replace />;

	async function submit() {
		if (!file || !clue) return;
		setBusy(true);
		setError(null);
		try {
			const blob = await shrinkImage(file);
			const res = await playerApi.submit(clue.id, blob);
			await refresh();
			nav(`/clues/${clue.id}/done`, { replace: true, state: { points: res.points_awarded, photo: res.submission.photo_url } });
		} catch (err) {
			setError(err instanceof ApiError ? err.message : 'Upload failed — check your signal and try again.');
		} finally {
			setBusy(false);
		}
	}

	return (
		<Screen nav={false} className="snap">
			<BackLink to={`/clues/${clue.id}`}>Clue {clue.sort_order}</BackLink>
			<div className="snap-head">
				<h1 className="display h-title">Snap your find</h1>
				<p className="h-sub">Take a clear selfie with the animal that matches the clue! If it’s not visible, a picture of its enclosure will suffice.</p>
			</div>

			<input ref={input} type="file" accept="image/*" capture="environment" hidden data-testid="photo-input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />

			{preview ? (
				<div className="snap-frame">
					<img src={preview} alt="Your photo" />
				</div>
			) : (
				<button type="button" className="snap-frame idle" onClick={() => input.current?.click()}>
					<span className="viewfinder" aria-hidden />
					<CameraIcon />
					<span className="cta">Open camera</span>
					<span className="hint">or pick from your photos</span>
				</button>
			)}

			{error && <div className="error mt">{error}</div>}
			<div className="spacer" />
			{preview && (
				<div className="row" style={{ gap: 10 }}>
					<button type="button" className="btn md ghost" onClick={() => setFile(null)} disabled={busy}>
						Retake
					</button>
					<button type="button" className="btn md grow orange" onClick={submit} disabled={busy}>
						{busy ? 'Sending…' : 'Submit'}
					</button>
				</div>
			)}
		</Screen>
	);
}
