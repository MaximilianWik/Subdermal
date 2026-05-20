import "./RomanticPoster.css";

/**
 * Reusable poster: a romantic stylized header above a hero image.
 *
 * Used by states that want the same Cinzel + pink-gradient + glow look.
 * Pass any text and image — the layout handles long headers via wrapping.
 */
export default function RomanticPoster({
	text,
	src,
	alt,
}: {
	text: string;
	src: string;
	alt: string;
}) {
	return (
		<div className="romantic-poster">
			<h1 className="romantic-poster__header">{text}</h1>
			<img className="romantic-poster__image" src={src} alt={alt} />
		</div>
	);
}
