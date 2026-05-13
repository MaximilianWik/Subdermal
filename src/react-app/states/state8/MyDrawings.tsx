import { useEffect, useState } from "react";
import { fetchMine } from "./api";
import type { FeedDrawing } from "./types";
import "./MyDrawings.css";

interface Props {
	onClose: () => void;
	onEdit: (drawing: FeedDrawing) => void;
}

export default function MyDrawings({ onClose, onEdit }: Props) {
	const [items, setItems] = useState<FeedDrawing[] | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		void (async () => {
			try {
				const r = await fetchMine();
				setItems(r);
			} catch (e) {
				setError(e instanceof Error ? e.message : "load failed");
			}
		})();
	}, []);

	return (
		<div className="md" onClick={onClose}>
			<div className="md__card" onClick={(e) => e.stopPropagation()}>
				<button className="md__close" onClick={onClose} aria-label="Close">
					×
				</button>

				<div className="md__title">My drawings</div>
				<div className="md__sub">
					{items === null
						? "loading…"
						: `${items.length} drawing${items.length === 1 ? "" : "s"} on this device`}
				</div>

				{error && <div className="md__error">{error}</div>}

				{items !== null && items.length === 0 && (
					<div className="md__empty">
						You haven't submitted anything from this browser yet.
					</div>
				)}

				{items !== null && items.length > 0 && (
					<div className="md__list">
						{items.map((d) => (
							<div className="md__row" key={d.id}>
								<div className="md__rowMain">
									<div className="md__name">{d.name ?? "anonymous"}</div>
									<div className="md__meta">
										{relTime(d.created_at)}
										{d.country ? " · " + d.country : ""}
										{" · ♥ " + d.likes}
									</div>
								</div>
								<button
									className="md__editBtn"
									onClick={() => onEdit(d)}
								>
									✎ Edit
								</button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function relTime(ms: number): string {
	const diff = Date.now() - ms;
	const s = Math.max(0, Math.round(diff / 1000));
	if (s < 60) return `${s}s ago`;
	const m = Math.round(s / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.round(m / 60);
	if (h < 24) return `${h}h ago`;
	const d = Math.round(h / 24);
	return `${d}d ago`;
}
