import { useEffect, type ReactNode } from "react";
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
	icon: ReactNode;
}

// ─── Icons ───────────────────────────────────────────────────
// Monochrome line-art at 18×18 picking up `currentColor`.
const ICON_PROPS = {
	width: "18",
	height: "18",
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: "1.6",
	strokeLinecap: "round" as const,
	strokeLinejoin: "round" as const,
} as const;

const InfoIcon = () => (
	<svg {...ICON_PROPS}>
		<circle cx="12" cy="12" r="9" />
		<line x1="12" y1="11" x2="12" y2="17" />
		<circle cx="12" cy="7.5" r="0.9" fill="currentColor" stroke="none" />
	</svg>
);
const PortfolioIcon = () => (
	<svg {...ICON_PROPS}>
		<rect x="3.5" y="3.5" width="7" height="7" rx="1" />
		<rect x="13.5" y="3.5" width="7" height="7" rx="1" />
		<rect x="3.5" y="13.5" width="7" height="7" rx="1" />
		<rect x="13.5" y="13.5" width="7" height="7" rx="1" />
	</svg>
);
const QrIcon = () => (
	<svg {...ICON_PROPS}>
		<rect x="3.5" y="3.5" width="6" height="6" rx="0.5" />
		<rect x="14.5" y="3.5" width="6" height="6" rx="0.5" />
		<rect x="3.5" y="14.5" width="6" height="6" rx="0.5" />
		<rect x="5.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
		<rect x="16.5" y="5.5" width="2" height="2" fill="currentColor" stroke="none" />
		<rect x="5.5" y="16.5" width="2" height="2" fill="currentColor" stroke="none" />
		<rect x="14" y="14" width="2.5" height="2.5" fill="currentColor" stroke="none" />
		<rect x="18.5" y="14" width="2.5" height="2.5" fill="currentColor" stroke="none" />
		<rect x="14" y="18.5" width="2.5" height="2.5" fill="currentColor" stroke="none" />
	</svg>
);
const GameIcon = () => (
	<svg {...ICON_PROPS}>
		<path d="M5 9h14a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3 3 3 0 0 1-2.5-1.3l-1-1.4a2 2 0 0 0-1.6-0.8h-3.8a2 2 0 0 0-1.6 0.8l-1 1.4A3 3 0 0 1 5 17a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3z" />
		<line x1="7" y1="12" x2="9" y2="12" />
		<line x1="8" y1="11" x2="8" y2="13" />
		<circle cx="16" cy="12" r="0.8" fill="currentColor" stroke="none" />
		<circle cx="18" cy="11" r="0.8" fill="currentColor" stroke="none" />
	</svg>
);
const InstagramIcon = () => (
	<svg {...ICON_PROPS}>
		<rect x="3" y="3" width="18" height="18" rx="5" />
		<circle cx="12" cy="12" r="4" />
		<circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
	</svg>
);
const CodeIcon = () => (
	<svg {...ICON_PROPS}>
		<polyline points="8 6 2 12 8 18" />
		<polyline points="16 6 22 12 16 18" />
		<line x1="14" y1="4" x2="10" y2="20" />
	</svg>
);
const HeartIcon = () => (
	<svg {...ICON_PROPS}>
		<path d="M20.8 6.6a5.5 5.5 0 0 0-9-1.6L12 5.6l0-.6a5.5 5.5 0 0 0-9.6 4.7c1 5.6 8.6 9.7 9.6 10.3 1-.6 8.6-4.7 9.6-10.3a5.5 5.5 0 0 0-0.8-3z" />
	</svg>
);
const CardIcon = () => (
	<svg {...ICON_PROPS}>
		<rect x="3" y="5" width="18" height="14" rx="2" />
		<circle cx="9" cy="11" r="2.2" />
		<line x1="14" y1="10" x2="18" y2="10" />
		<line x1="14" y1="13" x2="18" y2="13" />
		<path d="M5.5 16.5c0.6-1.6 2-2.5 3.5-2.5s2.9 0.9 3.5 2.5" />
	</svg>
);
const SparkIcon = () => (
	<svg {...ICON_PROPS}>
		<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
	</svg>
);

const FEATURED: MenuItem = {
	label: "About the project",
	href: "https://tessera-neon.vercel.app/permanence",
	external: true,
	icon: <InfoIcon />,
};

const EXTERNAL_ITEMS: MenuItem[] = [
	{
		label: "Portfolio",
		href: "https://maximilian-wikstrom.vercel.app/",
		external: true,
		icon: <PortfolioIcon />,
	},
	{
		label: "Make your own QR tattoo",
		href: "https://tessera-neon.vercel.app/",
		external: true,
		icon: <QrIcon />,
	},
	{
		label: "Play minigame",
		href: "https://cursedechoes.vercel.app/",
		external: true,
		icon: <GameIcon />,
	},
	{
		label: "Instagram",
		href: "https://www.instagram.com/max_wik/",
		external: true,
		icon: <InstagramIcon />,
	},
	{
		label: "Source code",
		href: "https://github.com/MaximilianWik/Cloudflare-Domain",
		external: true,
		icon: <CodeIcon />,
	},
];

const VIEW_ITEMS: MenuItem[] = [
	{ label: "Girlfriend", view: 2, icon: <HeartIcon /> },
	{ label: "Contact card", view: 6, icon: <CardIcon /> },
	{ label: "GlerpGlorp", view: 1, icon: <SparkIcon /> },
];

const ExternalArrow = () => (
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
		aria-hidden
	>
		<line x1="7" y1="17" x2="17" y2="7" />
		<polyline points="9 7 17 7 17 15" />
	</svg>
);
const InternalArrow = () => (
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
		aria-hidden
	>
		<polyline points="9 6 15 12 9 18" />
	</svg>
);

export default function Menu({ open, onClose }: Props) {
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

	const renderItem = (item: MenuItem) => {
		const arrow = item.href ? <ExternalArrow /> : <InternalArrow />;
		const inner = (
			<>
				<span className="menu__itemIcon" aria-hidden>
					{item.icon}
				</span>
				<span className="menu__itemLabel">{item.label}</span>
				{arrow}
			</>
		);
		return item.href ? (
			<a
				key={item.label}
				className="menu__item"
				href={item.href}
				target={item.external ? "_blank" : undefined}
				rel={item.external ? "noopener noreferrer" : undefined}
				onClick={onClose}
			>
				{inner}
			</a>
		) : (
			<button
				key={item.label}
				className="menu__item"
				onClick={() => item.view !== undefined && handleView(item.view)}
			>
				{inner}
			</button>
		);
	};

	return (
		<div className="menu" onClick={onClose}>
			<div
				className="menu__panel"
				onClick={(e) => e.stopPropagation()}
				role="menu"
			>
				<div className="menu__head">
					<div className="menu__brand">
						<div className="menu__title">Subdermal</div>
						<div className="menu__sub">Menu</div>
					</div>
					<button
						className="menu__close"
						onClick={onClose}
						aria-label="Close menu"
					>
						×
					</button>
				</div>

				<a
					className="menu__featured"
					href={FEATURED.href}
					target="_blank"
					rel="noopener noreferrer"
					onClick={onClose}
				>
					<span className="menu__featuredIcon" aria-hidden>
						{FEATURED.icon}
					</span>
					<div className="menu__featuredText">
						<div className="menu__featuredEyebrow">Read more</div>
						<div className="menu__featuredTitle">{FEATURED.label}</div>
					</div>
					<ExternalArrow />
				</a>

				<div className="menu__sectionLabel">Links</div>
				<nav className="menu__list">
					{EXTERNAL_ITEMS.map(renderItem)}
				</nav>

				<div className="menu__sectionLabel">Destinations</div>
				<nav className="menu__list">{VIEW_ITEMS.map(renderItem)}</nav>
			</div>
		</div>
	);
}
