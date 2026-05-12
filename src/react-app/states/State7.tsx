import { useEffect, useRef, useState } from "react";
import "./State7.css";

// ─────────────────────────────────────────────────────────────
//  State 7 — BSOD / Kernel panic / rm -rf chaos cinematic.
//
//  Phase timeline (auto-advances; total ~12s before settling on
//  the reveal):
//    0.0s  bsod      Pixel-perfect Windows 11 BSOD with climbing %
//    2.6s  glitch    500ms RGB tear / inversion / hue-shift flash
//    3.1s  terminal  Types `sudo rm -rf / --no-preserve-root`,
//                    then high-speed deletion log floods the screen
//    7.0s  panic     Linux kernel panic dump with shaking RGB-split
//                    text, ending in "System halted."
//   10.5s  reveal    Black screen, blinking cursor types "...kidding."
//
//  Vibrates on phase entry (Android only — iOS Safari has no
//  navigator.vibrate, so it just silently no-ops there).
// ─────────────────────────────────────────────────────────────

type Phase = "bsod" | "glitch" | "terminal" | "panic" | "reveal";

const PHASE_TIMELINE: Array<{ phase: Phase; at: number }> = [
	{ phase: "bsod", at: 0 },
	{ phase: "glitch", at: 2600 },
	{ phase: "terminal", at: 3100 },
	{ phase: "panic", at: 7000 },
	{ phase: "reveal", at: 10500 },
];

function vibrate(pattern: number | number[]) {
	if (typeof navigator !== "undefined" && "vibrate" in navigator) {
		try {
			navigator.vibrate(pattern);
		} catch {
			/* ignore — some browsers throw if not user-activated */
		}
	}
}

export default function State7() {
	const [phase, setPhase] = useState<Phase>("bsod");

	useEffect(() => {
		const timers = PHASE_TIMELINE.slice(1).map(({ phase: p, at }) =>
			setTimeout(() => {
				setPhase(p);
				vibrate(p === "glitch" ? [80, 40, 80] : p === "panic" ? 200 : 30);
			}, at),
		);
		// First-frame haptic — long buzz on the BSOD landing
		vibrate([300, 60, 100]);
		return () => timers.forEach(clearTimeout);
	}, []);

	return (
		<div className="s7">
			{phase === "bsod" && <BSOD />}
			{phase === "glitch" && <div className="s7-glitch" />}
			{phase === "terminal" && <Terminal />}
			{phase === "panic" && <KernelPanic />}
			{phase === "reveal" && <Reveal />}
		</div>
	);
}

// ─── PHASE 1 — Windows 11 BSOD ───────────────────────────────

const STOP_CODES = [
	"KERNEL_SECURITY_CHECK_FAILURE",
	"PAGE_FAULT_IN_NONPAGED_AREA",
	"CRITICAL_PROCESS_DIED",
	"IRQL_NOT_LESS_OR_EQUAL",
	"SYSTEM_THREAD_EXCEPTION_NOT_HANDLED",
	"WHEA_UNCORRECTABLE_ERROR",
];

function BSOD() {
	const [pct, setPct] = useState(0);
	const stopCode = useRef(
		STOP_CODES[Math.floor(Math.random() * STOP_CODES.length)],
	);

	useEffect(() => {
		const id = setInterval(() => {
			setPct((p) => {
				// Climb fast at first, slow near 70%, then stall (just like the real one)
				const step = p < 30 ? 6 : p < 60 ? 3 : p < 70 ? 1 : 0.2;
				return Math.min(p + step * (0.6 + Math.random() * 0.8), 73);
			});
		}, 120);
		return () => clearInterval(id);
	}, []);

	// Fake QR module pattern (deterministic-looking 13×13 grid).
	// Not a real QR — just visual texture.
	const qrCells = useRef(
		Array.from({ length: 169 }, (_, i) => {
			// Position detection markers at three corners
			const x = i % 13;
			const y = Math.floor(i / 13);
			const inMarker = (mx: number, my: number) =>
				x >= mx && x < mx + 3 && y >= my && y < my + 3;
			if (inMarker(0, 0) || inMarker(10, 0) || inMarker(0, 10)) return true;
			// Pseudo-random fill weighted to ~45% black
			return ((i * 9301 + 49297) % 233280) / 233280 > 0.55;
		}),
	);

	return (
		<div className="s7-bsod">
			<div className="s7-bsod__face">:(</div>
			<div className="s7-bsod__title">
				Your device ran into a problem and needs to restart. We're just
				collecting some error info, and then we'll restart for you.
			</div>
			<div className="s7-bsod__progress">{Math.floor(pct)}% complete</div>
			<div className="s7-bsod__qrwrap">
				<div className="s7-bsod__qr">
					{qrCells.current.map((on, i) => (on ? <span key={i} /> : <i key={i} />))}
				</div>
				<div className="s7-bsod__info">
					For more information about this issue and possible fixes, visit{" "}
					<b>https://www.windows.com/stopcode</b>
					<br />
					<br />
					If you call a support person, give them this info:
					<br />
					Stop code: <code>{stopCode.current}</code>
				</div>
			</div>
		</div>
	);
}

// ─── PHASE 3 — Terminal: rm -rf cascade ──────────────────────

const RM_CMD = "sudo rm -rf / --no-preserve-root";

const PATH_DIRS = [
	"/usr/bin",
	"/usr/lib",
	"/usr/share",
	"/usr/local/lib",
	"/etc",
	"/etc/systemd/system",
	"/var/log",
	"/var/lib/dpkg",
	"/var/cache/apt/archives",
	"/home/max",
	"/home/max/.config",
	"/home/max/Documents",
	"/home/max/Pictures",
	"/lib/x86_64-linux-gnu",
	"/lib/modules/6.5.0-generic",
	"/opt",
	"/srv",
	"/root/.ssh",
	"/boot",
	"/boot/efi",
];

const PATH_LEAVES = [
	"libc.so.6",
	"systemd",
	"bash",
	"sshd",
	"kernel.img",
	"vmlinuz-6.5.0",
	"initrd.img",
	"id_rsa",
	"authorized_keys",
	"shadow",
	"passwd",
	"sudoers",
	"hostname",
	"resolv.conf",
	"fstab",
	"crontab",
	"network.conf",
	"docker.sock",
	"nginx.conf",
	"apt.conf.d",
	"sources.list",
	"package-lock.json",
	".bashrc",
	".zshrc",
	".vimrc",
	"thesis_FINAL_v3.docx",
	"taxes_2024.pdf",
	"family_photos.tar.gz",
	"backup.sql",
	"secrets.env",
];

function fakePath(): string {
	const d = PATH_DIRS[Math.floor(Math.random() * PATH_DIRS.length)];
	const l = PATH_LEAVES[Math.floor(Math.random() * PATH_LEAVES.length)];
	return `${d}/${l}`;
}

function Terminal() {
	const [typed, setTyped] = useState("");
	const [lines, setLines] = useState<string[]>([]);

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
				// 3 lines per tick for that "instant cascade" feel
				for (let k = 0; k < 3; k++) {
					const path = fakePath();
					const r = Math.random();
					if (r < 0.04) {
						next.push(
							`rm: cannot remove '${path}': Read-only file system`,
						);
					} else if (r < 0.07) {
						next.push(
							`rm: cannot remove '${path}': Device or resource busy`,
						);
					} else {
						next.push(`rm: removed '${path}'`);
					}
				}
				// Keep last ~50 lines (enough to fill viewport, not infinite memory)
				return next.slice(-50);
			});
		}, 25);
		return () => clearInterval(id);
	}, [typed]);

	const ready = typed === RM_CMD;
	return (
		<div className="s7-term">
			<div>
				<span className="s7-term__green">root@maximilian</span>
				<span className="s7-term__dim">:</span>
				<span className="s7-term__cyan">~</span>
				<span className="s7-term__dim">#</span> {typed}
				{!ready && <span className="s7-term__cursor" />}
			</div>
			{ready && (
				<div className="s7-term__stream">
					{lines.map((l, i) => (
						<div
							key={i}
							className={
								l.startsWith("rm: cannot")
									? "s7-term__red"
									: undefined
							}
						>
							{l}
						</div>
					))}
				</div>
			)}
		</div>
	);
}

// ─── PHASE 4 — Linux Kernel Panic ────────────────────────────

function hex(bits: number): string {
	let s = "";
	for (let i = 0; i < bits / 4; i++) {
		s += Math.floor(Math.random() * 16).toString(16);
	}
	return s;
}

function panicLines(): string[] {
	const ts = (n: number) => `[ ${(12 + n * 0.000123).toFixed(6)}]`;
	const out: string[] = [];
	let t = 0;
	out.push(
		`${ts(t++)} Kernel panic - not syncing: Attempted to kill init! exitcode=0x00000004`,
	);
	out.push(
		`${ts(t++)} CPU: ${Math.floor(Math.random() * 16)} PID: 1 Comm: systemd Not tainted 6.5.0-generic #1`,
	);
	out.push(`${ts(t++)} Hardware name: Cloudflare Workers Edge Runtime`);
	out.push(`${ts(t++)} Call Trace:`);
	out.push(`${ts(t++)}  <TASK>`);
	const frames = [
		"dump_stack_lvl",
		"panic",
		"do_exit.cold",
		"do_group_exit",
		"__x64_sys_exit_group",
		"do_syscall_64",
		"entry_SYSCALL_64_after_hwframe",
		"__schedule",
		"schedule",
		"futex_wait_queue",
		"do_futex",
	];
	for (const f of frames) {
		out.push(`${ts(t++)}  ${f}+0x${hex(8)}/0x${hex(8)}`);
	}
	out.push(`${ts(t++)}  </TASK>`);
	out.push(`${ts(t++)} ---[ end Kernel panic - not syncing ]---`);
	out.push("");
	out.push(`RIP: 0033:0x${hex(48)}`);
	out.push(
		`RSP: 002b:0x${hex(48)} EFLAGS: 0x${hex(8)} ORIG_RAX: 0x${hex(16)}`,
	);
	out.push(
		`RAX: 0x${hex(48)} RBX: 0x${hex(48)} RCX: 0x${hex(48)}`,
	);
	out.push(
		`RDX: 0x${hex(48)} RSI: 0x${hex(48)} RDI: 0x${hex(48)}`,
	);
	out.push(
		`RBP: 0x${hex(48)} R08: 0x${hex(48)} R09: 0x${hex(48)}`,
	);
	out.push("");
	out.push(`*** SYSTEM HALTED ***`);
	return out;
}

function KernelPanic() {
	const [shown, setShown] = useState<string[]>([]);
	const all = useRef(panicLines());

	useEffect(() => {
		let i = 0;
		const id = setInterval(() => {
			i += 1;
			setShown(all.current.slice(0, i));
			if (i >= all.current.length) clearInterval(id);
		}, 80);
		return () => clearInterval(id);
	}, []);

	return (
		<div className="s7-term s7-term--panic">
			{shown.map((l, i) => {
				const cls = l.includes("panic")
					? "s7-term__red"
					: l.includes("HALTED")
						? "s7-term__red"
						: l.startsWith("RIP") ||
								l.startsWith("RSP") ||
								l.startsWith("RAX") ||
								l.startsWith("RDX") ||
								l.startsWith("RBP")
							? "s7-term__yellow"
							: undefined;
				return (
					<div key={i} className={cls}>
						{l}
					</div>
				);
			})}
		</div>
	);
}

// ─── PHASE 5 — Reveal ────────────────────────────────────────

const REVEAL_TEXT = "...just kidding.";

function Reveal() {
	const [typed, setTyped] = useState("");

	useEffect(() => {
		let i = 0;
		const id = setInterval(() => {
			i += 1;
			setTyped(REVEAL_TEXT.slice(0, i));
			if (i >= REVEAL_TEXT.length) clearInterval(id);
		}, 90);
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
