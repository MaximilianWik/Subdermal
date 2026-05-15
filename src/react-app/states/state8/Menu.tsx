import { useEffect } from "react";
import "./Menu.css";

interface Props {
	open: boolean;
	onClose: () => void;
}

interface MenuItem {
	label: string;
	href?: string;
	view?: number;
	external?: boolean;
}

const ITEMS: MenuItem[] = [
	{
		label: "Portfolio",
		href: "https://maximilian-wikstrom.vercel.app/",
		external: true,
	},
	{
		label: "Make your own QR tattoo",
		href: "https://tessera-neon.vercel.app/",
		external: true,
	},
	{
		label: "Play Minigame",
		href: "https://cursedechoes.vercel.app/",
		external: true,
	},
	{
		label: "Instagram",
		href: "https://www.instagram.com/max_wik/",
		external: true,
	},
	{
		label: "Source Code",
		href: "https://github.com/MaximilianWik/Cloudflare-Domain",
		external: true,
	},
	{ label: "Girlfriend ❤", view: 2 },
	{ label: "Contact Card", view: 6 },
	{ label: "Jonte", view: 5 },
	{ label: "GlepGlorp", view: 1 },
];

export default function Menu({ open, onClose }: Props) {
	// Close on Escape
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open) return null;

	const handleView = (n: number) => {
		window.location.hash = "view=" + n;
		onClose();
	};

	return (
		<div className="menu" onClick={onClose}>
			<div
				className="menu__panel"
				onClick={(e) => e.stopPropagation()}
				role="menu"
			>
				<div className="menu__head">
					<div className="menu__title">Menu</div>
					<button
						className="menu__close"
						onClick={onClose}
						aria-label="Close menu"
					>
						×
					</button>
				</div>

				<nav className="menu__list">
					{ITEMS.map((item) =>
						item.href ? (
							<a
								key={item.label}
								className="menu__item"
								href={item.href}
								target={item.external ? "_blank" : undefined}
								rel={
									item.external ? "noopener noreferrer" : undefined
								}
								onClick={onClose}
							>
								<span className="menu__itemLabel">{item.label}</span>
								<svg
									className="menu__itemArrow"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<line x1="7" y1="17" x2="17" y2="7" />
									<polyline points="9 7 17 7 17 15" />
								</svg>
							</a>
						) : (
							<button
								key={item.label}
								className="menu__item"
								onClick={() =>
									item.view !== undefined && handleView(item.view)
								}
							>
								<span className="menu__itemLabel">{item.label}</span>
								<svg
									className="menu__itemArrow"
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<polyline points="9 6 15 12 9 18" />
								</svg>
							</button>
						),
					)}
				</nav>
			</div>
		</div>
	);
}
