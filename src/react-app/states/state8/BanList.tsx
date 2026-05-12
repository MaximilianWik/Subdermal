import { useEffect, useState } from "react";
import { adminUnban, fetchBans, type BanRow } from "./api";
import "./BanList.css";

interface Props {
	onClose: () => void;
}

export default function BanList({ onClose }: Props) {
	const [bans, setBans] = useState<BanRow[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState<string | null>(null);

	const load = async () => {
		setError(null);
		try {
			const list = await fetchBans();
			setBans(list);
		} catch (e) {
			setError(e instanceof Error ? e.message : "load failed");
		}
	};

	useEffect(() => {
		void load();
	}, []);

	const handleUnban = async (ip: string) => {
		if (!confirm(`Unban ${ip}?`)) return;
		setBusy(ip);
		setError(null);
		try {
			await adminUnban(ip);
			setBans((b) => (b ? b.filter((r) => r.ip !== ip) : b));
		} catch (e) {
			setError(e instanceof Error ? e.message : "unban failed");
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="bl" onClick={onClose}>
			<div className="bl__card" onClick={(e) => e.stopPropagation()}>
				<button className="bl__close" onClick={onClose} aria-label="Close">
					×
				</button>

				<div className="bl__title">Banned IPs</div>
				<div className="bl__sub">
					{bans === null
						? "loading…"
						: `${bans.length} ban${bans.length === 1 ? "" : "s"}`}
				</div>

				{error && <div className="bl__error">{error}</div>}

				{bans !== null && bans.length === 0 && (
					<div className="bl__empty">No banned IPs.</div>
				)}

				{bans !== null && bans.length > 0 && (
					<div className="bl__list">
						{bans.map((b) => (
							<div className="bl__row" key={b.ip}>
								<div className="bl__rowMain">
									<div className="bl__ip">{b.ip}</div>
									<div className="bl__meta">
										<span>{relTime(b.banned_at)}</span>
										{b.reason ? <span> · {b.reason}</span> : null}
									</div>
								</div>
								<button
									className="bl__unban"
									onClick={() => handleUnban(b.ip)}
									disabled={busy === b.ip}
								>
									{busy === b.ip ? "…" : "Unban"}
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
