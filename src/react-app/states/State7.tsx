import { useEffect, useState } from "react";
import "./State7.css";

// ─────────────────────────────────────────────────────────────
//  State 7 — `rm -rf /` chaos cinematic.
//
//  Phase timeline (auto-advances; total ~7s before settling on
//  the reveal):
//    0.0s  terminal  Black screen, types `sudo rm -rf / --no-preserve-root`
//                    one char at a time, then floods deletion output
//    6.2s  glitch    500ms RGB tear / inversion / hue-shift
//    6.7s  reveal    Black screen, types "...just kidding."
// ─────────────────────────────────────────────────────────────

type Phase = "terminal" | "glitch" | "reveal";

const TIMELINE: Array<{ phase: Phase; at: number }> = [
	{ phase: "terminal", at: 0 },
	{ phase: "glitch", at: 6200 },
	{ phase: "reveal", at: 6700 },
];

export default function State7() {
	const [phase, setPhase] = useState<Phase>("terminal");

	useEffect(() => {
		const timers = TIMELINE.slice(1).map(({ phase: p, at }) =>
			setTimeout(() => setPhase(p), at),
		);
		return () => timers.forEach(clearTimeout);
	}, []);

	return (
		<div className="s7">
			{phase === "terminal" && <Terminal />}
			{phase === "glitch" && <div className="s7-glitch" />}
			{phase === "reveal" && <Reveal />}
		</div>
	);
}

// ─── Terminal: rm -rf cascade ────────────────────────────────

const RM_CMD = "sudo rm -rf / --no-preserve-root";

const PATH_DIRS = [
	"/usr/bin",
	"/usr/lib/x86_64-linux-gnu",
	"/usr/share/locale/en_US.UTF-8",
	"/usr/local/bin",
	"/etc",
	"/etc/systemd/system",
	"/etc/ssl/certs",
	"/etc/apt/sources.list.d",
	"/var/log",
	"/var/log/journal",
	"/var/lib/dpkg",
	"/var/cache/apt/archives",
	"/var/spool/cron",
	"/home/max",
	"/home/max/.config",
	"/home/max/.ssh",
	"/home/max/Documents",
	"/home/max/Pictures/2024",
	"/home/max/Downloads",
	"/lib/x86_64-linux-gnu",
	"/lib/modules/6.5.0-21-generic",
	"/opt/google/chrome",
	"/srv/www",
	"/root",
	"/root/.ssh",
	"/boot",
	"/boot/efi/EFI/ubuntu",
];

const PATH_LEAVES = [
	"libc.so.6",
	"libpthread.so.0",
	"systemd",
	"systemd-journald",
	"bash",
	"zsh",
	"sshd",
	"sudo",
	"vmlinuz-6.5.0-21-generic",
	"initrd.img-6.5.0-21-generic",
	"id_rsa",
	"id_ed25519",
	"authorized_keys",
	"known_hosts",
	"shadow",
	"passwd",
	"sudoers",
	"hostname",
	"resolv.conf",
	"fstab",
	"crontab",
	"hosts",
	"docker.sock",
	"nginx.conf",
	"package-lock.json",
	".bashrc",
	".zshrc",
	".profile",
	".gitconfig",
	"thesis_FINAL_v3.docx",
	"taxes_2024.pdf",
	"family_photos.tar.gz",
	"backup.sql",
	"secrets.env",
	"wallet.dat",
];

function fakePath(): string {
	const d = PATH_DIRS[Math.floor(Math.random() * PATH_DIRS.length)];
	const l = PATH_LEAVES[Math.floor(Math.random() * PATH_LEAVES.length)];
	return `${d}/${l}`;
}

function fakeLine(): { text: string; cls?: string } {
	const r = Math.random();
	if (r < 0.03) {
		return {
			text: `rm: cannot remove '${fakePath()}': Read-only file system`,
			cls: "s7-term__red",
		};
	}
	if (r < 0.05) {
		return {
			text: `rm: cannot remove '/proc/${Math.floor(Math.random() * 99999)}/exe': Permission denied`,
			cls: "s7-term__red",
		};
	}
	if (r < 0.07) {
		return {
			text: `rm: cannot remove '${fakePath()}': Device or resource busy`,
			cls: "s7-term__red",
		};
	}
	if (r < 0.14) {
		const dir = PATH_DIRS[Math.floor(Math.random() * PATH_DIRS.length)];
		return {
			text: `rm: descending into directory '${dir}'`,
			cls: "s7-term__dim",
		};
	}
	return { text: `rm: removed '${fakePath()}'` };
}

function Terminal() {
	const [typed, setTyped] = useState("");
	const [lines, setLines] = useState<Array<{ text: string; cls?: string }>>(
		[],
	);

	// Typewriter for the command
	useEffect(() => {
		let i = 0;
		const id = setInterval(() => {
			i += 1;
			setTyped(RM_CMD.slice(0, i));
			if (i >= RM_CMD.length) clearInterval(id);
		}, 55);
		return () => clearInterval(id);
	}, []);

	// Once typed, flood deletion lines
	useEffect(() => {
		if (typed !== RM_CMD) return;
		const id = setInterval(() => {
			setLines((prev) => {
				const next = [...prev];
				for (let k = 0; k < 3; k++) next.push(fakeLine());
				return next.slice(-60);
			});
		}, 22);
		return () => clearInterval(id);
	}, [typed]);

	const ready = typed === RM_CMD;
	return (
		<div className="s7-term">
			<div className="s7-term__cmdline">
				<span className="s7-term__green">root@maximilian</span>
				<span className="s7-term__dim">:</span>
				<span className="s7-term__cyan">~</span>
				<span className="s7-term__dim">#</span> {typed}
				{!ready && <span className="s7-term__cursor" />}
			</div>
			{ready && (
				<div className="s7-term__stream">
					{lines.map((l, i) => (
						<div key={i} className={l.cls}>
							{l.text}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ─── Reveal ──────────────────────────────────────────────────

const REVEAL_TEXT = "...just kidding.";

function Reveal() {
	const [typed, setTyped] = useState("");

	useEffect(() => {
		let i = 0;
		const id = setInterval(() => {
			i += 1;
			setTyped(REVEAL_TEXT.slice(0, i));
			if (i >= REVEAL_TEXT.length) clearInterval(id);
		}, 95);
		return () => clearInterval(id);
	}, []);

	return (
		<div className="s7-reveal">
			<div>
				{typed}
				<span className="s7-term__cursor" />
				<span className="s7-reveal__sig">— m</span>
			</div>
		</div>
	);
}
