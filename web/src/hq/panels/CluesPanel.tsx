import { useState, type ChangeEvent, type FormEvent } from 'react';
import { clock } from '../../shared/format';
import { ClockIcon, LockIcon, XIcon } from '../../shared/icons';
import { adminApi, type AdminClue } from '../api';
import { useHq, useHqData } from '../HqApp';
import { Empty, Field, PanelHeader, dense } from '../components';

const blank = { title: '', body: '', animal: '', points: '', mapX: '', mapY: '' };

export function CluesPanel() {
	const { gameId, overview, refresh, toast } = useHq();
	const { data, reload } = useHqData(() => adminApi.clues(gameId));
	const [form, setForm] = useState(blank);
	const [editing, setEditing] = useState<string | null>(null);
	const [scheduleFor, setScheduleFor] = useState<string | null>(null);
	const [when, setWhen] = useState('');

	async function act(fn: () => Promise<unknown>, msg?: string) {
		try {
			await fn();
			if (msg) toast(msg, 'good');
			await reload();
			await refresh();
		} catch (err) {
			toast(err instanceof Error ? err.message : 'Failed');
		}
	}

	function startEdit(c: AdminClue) {
		setEditing(c.id);
		setForm({ title: c.title, body: c.body, animal: c.animal, points: String(c.points), mapX: c.map_x?.toString() ?? '', mapY: c.map_y?.toString() ?? '' });
	}

	async function save(e: FormEvent) {
		e.preventDefault();
		const payload: Record<string, unknown> = { title: form.title, body: form.body, animal: form.animal };
		if (form.points !== '') payload.points = Number(form.points);
		if (form.mapX !== '') payload.mapX = Number(form.mapX);
		if (form.mapY !== '') payload.mapY = Number(form.mapY);
		await act(
			() => (editing ? adminApi.patchClue(editing, payload) : adminApi.addClue(gameId, payload)),
			editing ? 'Clue updated' : 'Clue added',
		);
		setForm(blank);
		setEditing(null);
	}

	const clues = data?.clues ?? [];
	const set = (k: keyof typeof blank) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

	return (
		<>
			<div className="hq-panel">
				<PanelHeader title="Clues" sub={`${clues.length} clues · ${clues.filter((c) => c.status === 'available').length} released`}>
					<button className="btn sm" onClick={() => act(() => adminApi.releaseNext(gameId), 'Next clue released')}>
						Release next clue
					</button>
					<button className="btn sm orange" onClick={() => act(() => adminApi.releaseAll(gameId), 'All clues released')}>
						Release all
					</button>
					<button className="btn sm ghost orange" onClick={() => act(() => adminApi.lockAll(gameId), 'All clues locked')}>
						<LockIcon width={16} height={16} /> Lock all
					</button>
				</PanelHeader>
				{!data ? (
					<div className="spinner" />
				) : clues.length === 0 ? (
					<Empty>No clues yet. Add your first clue below.</Empty>
				) : (
					<div style={{ overflowX: 'auto' }}>
						<table className="table">
							<thead>
								<tr>
									<th>#</th>
									<th>Title</th>
									<th>Animal</th>
									<th>Points</th>
									<th>Status</th>
									<th>Photos</th>
									<th>Found by</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{clues.map((c) => (
									<tr key={c.id}>
										<td className="display" style={{ fontSize: 20, color: 'var(--brown)' }}>
											{String(c.sort_order).padStart(2, '0')}
										</td>
										<td>
											<div>{c.title}</div>
											<div className="tiny muted" style={{ maxWidth: 320, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
												{c.body}
											</div>
										</td>
										<td>{c.animal || '—'}</td>
										<td>{c.points}</td>
										<td>
											<span className={`pill ${c.status}`}>{c.status === 'available' ? 'Available' : 'Locked'}</span>
											{c.release_at && (
												<div className="tiny muted row" style={{ gap: 4, marginTop: 4 }}>
													<ClockIcon width={12} height={12} /> {clock(c.release_at)}
												</div>
											)}
										</td>
										<td>{c.photos}</td>
										<td>
											{c.completions}
											{overview ? ` / ${overview.stats.teams}` : ''}
										</td>
										<td>
											<div className="row" style={{ justifyContent: 'flex-end' }}>
												{c.status === 'locked' ? (
													<button className="btn xs" onClick={() => act(() => adminApi.patchClue(c.id, { status: 'available' }), `Released ${c.title}`)}>
														Release
													</button>
												) : (
													<button className="btn xs ghost" onClick={() => act(() => adminApi.patchClue(c.id, { status: 'locked' }), `Locked ${c.title}`)}>
														Lock
													</button>
												)}
												<button className="btn xs ghost" onClick={() => (setScheduleFor(c.id), setWhen(''))}>
													Schedule
												</button>
												<button className="btn xs ghost" onClick={() => startEdit(c)}>
													Edit
												</button>
												<button
													className="btn xs ghost orange"
													aria-label={`Delete ${c.title}`}
													onClick={() => window.confirm(`Delete clue "${c.title}"?`) && act(() => adminApi.deleteClue(c.id), 'Clue deleted')}
												>
													<XIcon width={14} height={14} />
												</button>
											</div>
											{scheduleFor === c.id && (
												<div className="row mt">
													<input className="input" type="datetime-local" style={dense} value={when} onChange={(e) => setWhen(e.target.value)} />
													<button
														className="btn xs"
														disabled={!when}
														onClick={() =>
															act(() => adminApi.schedule(c.id, new Date(when).toISOString()), `Scheduled for ${new Date(when).toLocaleTimeString()}`).then(() =>
																setScheduleFor(null),
															)
														}
													>
														Set
													</button>
													<button className="btn xs ghost" onClick={() => setScheduleFor(null)}>
														Cancel
													</button>
												</div>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			<form className="hq-panel stack" onSubmit={save}>
				<PanelHeader title={editing ? 'Edit clue' : 'Add clue'} />
				<div className="hq-grid cols-3">
					<Field label="Title">
						<input className="input" style={dense} value={form.title} onChange={set('title')} required placeholder="Lunch in the Trees" />
					</Field>
					<Field label="Animal (for hosts)">
						<input className="input" style={dense} value={form.animal} onChange={set('animal')} placeholder="giraffe" />
					</Field>
					<Field label="Points">
						<input className="input" style={dense} type="number" min={0} value={form.points} onChange={set('points')} placeholder={String(overview?.game.default_points ?? 150)} />
					</Field>
				</div>
				<Field label="Clue text (shown to players)">
					<textarea className="textarea" style={{ ...dense, fontFamily: 'var(--f-mono)', fontWeight: 500 }} value={form.body} onChange={set('body')} required placeholder="My imposing stature makes it tough to seek shelter in rain…" />
				</Field>
				<div className="hq-grid cols-3">
					<Field label="Map X (0–1, optional)">
						<input className="input" style={dense} type="number" step="0.01" min={0} max={1} value={form.mapX} onChange={set('mapX')} />
					</Field>
					<Field label="Map Y (0–1, optional)">
						<input className="input" style={dense} type="number" step="0.01" min={0} max={1} value={form.mapY} onChange={set('mapY')} />
					</Field>
					<div className="field" style={{ justifyContent: 'flex-end' }}>
						<div className="row">
							<button className="btn sm grow">{editing ? 'Save changes' : '+ Add clue'}</button>
							{editing && (
								<button type="button" className="btn sm ghost" onClick={() => (setEditing(null), setForm(blank))}>
									Cancel
								</button>
							)}
						</div>
					</div>
				</div>
			</form>
		</>
	);
}
