import { useState } from "react";
import "./SignModal.css";

interface Props {
	defaultName: string;
	pending: boolean;
	error: string | null;
	onCancel: () => void;
	onSubmit: (name: string) => void;
}

export default function SignModal({
	defaultName,
	pending,
	error,
	onCancel,
	onSubmit,
}: Props) {
	const [name, setName] = useState(defaultName);
	const trimmed = name.trim();
	const valid = trimmed.length > 0 && trimmed.length <= 40;

	return (
		<div className="signOverlay">
			<div className="signCard">
				<div className="signCard__title">Sign your drawing</div>
				<div className="signCard__sub">
					This will be displayed on your piece. Required.
				</div>
				<input
					className="signCard__input"
					type="text"
					value={name}
					maxLength={40}
					placeholder="your name"
					onChange={(e) => setName(e.target.value)}
					autoFocus
					onKeyDown={(e) => {
						if (e.key === "Enter" && valid && !pending)
							onSubmit(trimmed);
						if (e.key === "Escape" && !pending) onCancel();
					}}
				/>
				<div className="signCard__notice">
					<strong>Heads up:</strong> when you submit, this page will
					publicly display your name, country, city, IP address, device
					info, and browser details on your drawing's signature card.
				</div>
				{error && <div className="signCard__error">{error}</div>}
				<div className="signCard__actions">
					<button
						className="signCard__btn"
						onClick={onCancel}
						disabled={pending}
					>
						Cancel
					</button>
					<button
						className="signCard__btn signCard__btn--primary"
						disabled={!valid || pending}
						onClick={() => onSubmit(trimmed)}
					>
						{pending ? "Submitting…" : "Submit"}
					</button>
				</div>
			</div>
		</div>
	);
}
