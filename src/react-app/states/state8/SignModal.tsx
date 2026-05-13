import { useState } from "react";
import { sanitizeInstagram } from "./instagram";
import "./SignModal.css";

interface Props {
	defaultName: string;
	defaultInstagram?: string;
	pending: boolean;
	error: string | null;
	editing?: boolean;
	onCancel: () => void;
	onSubmit: (name: string, instagram: string | null) => void;
}

export default function SignModal({
	defaultName,
	defaultInstagram,
	pending,
	error,
	editing,
	onCancel,
	onSubmit,
}: Props) {
	const [name, setName] = useState(defaultName);
	const [instagram, setInstagram] = useState(defaultInstagram ?? "");
	const trimmedName = name.trim();
	const validName = trimmedName.length > 0 && trimmedName.length <= 40;

	// Empty IG is valid (it's optional). Non-empty must sanitise to non-null.
	const igTrimmed = instagram.trim();
	const igSanitized = igTrimmed ? sanitizeInstagram(igTrimmed) : null;
	const igValid = igTrimmed === "" || igSanitized !== null;
	const valid = validName && igValid;

	const submit = () => {
		if (!valid || pending) return;
		onSubmit(trimmedName, igSanitized);
	};

	return (
		<div className="signOverlay">
			<div className="signCard">
				<div className="signCard__title">
					{editing ? "Save your changes" : "Sign your drawing"}
				</div>
				<div className="signCard__sub">
					{editing
						? "Update the signature shown on your piece."
						: "This will be displayed on your piece. Required."}
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
						if (e.key === "Enter") submit();
						if (e.key === "Escape" && !pending) onCancel();
					}}
				/>
				<div className="signCard__igGroup">
					<label className="signCard__igLabel">
						Instagram <span className="signCard__igOpt">(optional)</span>
					</label>
					<div className="signCard__igInputWrap">
						<span className="signCard__igPrefix">@</span>
						<input
							className="signCard__igInput"
							type="text"
							value={instagram}
							maxLength={64}
							placeholder="your_handle"
							autoComplete="off"
							autoCapitalize="off"
							spellCheck={false}
							onChange={(e) => setInstagram(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") submit();
								if (e.key === "Escape" && !pending) onCancel();
							}}
						/>
					</div>
					{!igValid && (
						<div className="signCard__igError">
							That doesn't look like a valid Instagram handle.
						</div>
					)}
				</div>
				{!editing && (
					<div className="signCard__notice">
						<strong>Heads up:</strong> when you submit, this page will
						publicly display your name, country, city, IP address,
						device info, and browser details on your drawing's
						signature card.
					</div>
				)}
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
						onClick={submit}
					>
						{pending
							? editing
								? "Saving…"
								: "Submitting…"
							: editing
								? "Save"
								: "Submit"}
					</button>
				</div>
			</div>
		</div>
	);
}
