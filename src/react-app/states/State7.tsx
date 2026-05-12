import { useEffect, useRef, useState } from "react";
import "./State7.css";
import {
	bsodAlarm,
	glitchClick,
	glitchSweep,
	hddTick,
	heartbeatTick,
	keyClick,
	panicAlarm,
	revealChime,
	startStatic,
	teardown,
} from "./State7.audio";

// ─────────────────────────────────────────────────────────────
//  State 7 — BSOD / Kernel panic / rm -rf chaos cinematic.
//
//  Phone-first: uses 100dvh, large tap-target-friendly typography,
//  responsive layout that stacks vertically on narrow viewports.
//
//  Phase timeline (auto-advances):
//    0.0s  bsod      Pixel-accurate Windows 11 BSOD; bsodAlarm()
//                    haptic boom + sub-bass thud + two-tone alarm
//    2.6s  glitch    500ms fracture + RGB tear; glitchSweep()
//    3.2s  terminal  Types `sudo rm -rf / --no-preserve-root` with
//                    keyClick() per char, then 100 lines/sec of
//                    deletion output with hddTick() per row
//    7.2s  panic     Authentic Linux kernel panic with full stack
//                    + register dump; panicAlarm() + shaking text
//   10.5s  reveal    Black screen, heartbeat ticks, types
//                    "...just kidding." with revealChime()
//
//  All audio synthesized live via Web Audio (no asset files).
// ─────────────────────────────────────────────────────────────

type Phase = "bsod" | "glitch" | "terminal" | "panic" | "reveal";

const TIMELINE: Array<{ phase: Phase; at: number }> = [
	{ phase: "bsod", at: 0 },
	{ phase: "glitch", at: 2600 },
	{ phase: "terminal", at: 3200 },
	{ phase: "panic", at: 7200 },
	{ phase: "reveal", at: 10500 },
];

function vibrate(p: number | number[]) {
	if (typeof navigator !== "undefined" && "vibrate" in navigator) {
		try {
			navigator.vibrate(p);
		} catch {
			/* ignore */
		}
	}
}

export default function State7() {
	const [phase, setPhase] = useState<Phase>("bsod");

	useEffect(() => {
		// Phase 1 entry — fire immediately
		bsodAlarm();
		vibrate([400, 80, 200, 80, 100]);
		const stopHiss = startStatic(0.025);

		const timers = TIMELINE.slice(1).map(({ phase: p, at }) =>
			setTimeout(() => {
				setPhase(p);
				if (p === "glitch") {
					glitchSweep();
					vibrate([60, 30, 60, 30, 60, 30, 60]);
				} else if (p === "terminal") {
					vibrate(40);
				} else if (p === "panic") {
					panicAlarm();
					vibrate([600, 100, 250, 100, 600]);
				} else if (p === "reveal") {
					heartbeatTick();
					setTimeout(() => revealChime(), 600);
					vibrate([40, 80, 40]);
				}
			}, at),
		);
		return () => {
			timers.forEach(clearTimeout);
			stopHiss();
			teardown();
		};
	}, []);

	return (
		<div className="s7">
			{phase === "bsod" && <BSOD />}
			{phase === "glitch" && <GlitchScreen />}
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
	"MEMORY_MANAGEMENT",
	"UNEXPECTED_KERNEL_MODE_TRAP",
];

function BSOD() {
	const [pct, setPct] = useState(0);
	const stopCode = useRef(
		STOP_CODES[Math.floor(Math.random() * STOP_CODES.length)],
	);

	// Random click-y noises throughout the BSOD phase for "things are wrong" texture
	useEffect(() => {
		const id = setInterval(
			() => {
				if (Math.random() < 0.4) glitchClick(0.18);
			},
			180 + Math.random() * 200,
		);
		return () => clearInterval(id);
	}, []);

	useEffect(() => {
		const id = setInterval(() => {
			setPct((p) => {
				const step = p < 25 ? 6 : p < 55 ? 3 : p < 70 ? 1 : 0.15;
				return Math.min(p + step * (0.6 + Math.random() * 0.8), 73);
			});
		}, 110);
		return () => clearInterval(id);
	}, []);

	return (
		<div className="s7-bsod">
			<div className="s7-bsod__face">:(</div>
			<div className="s7-bsod__title">
				Your device ran into a problem and needs to restart. We're just
				collecting some error info, and then we'll restart for you.
			</div>
			<div className="s7-bsod__progress">{Math.floor(pct)}% complete</div>
			<div className="s7-bsod__bottom">
				<FakeQR />
				<div className="s7-bsod__info">
					<div>
						For more information about this issue and possible fixes, visit
					</div>
					<div className="s7-bsod__url">
						https://www.windows.com/stopcode
					</div>
					<div className="s7-bsod__spacer" />
					<div>If you call a support person, give them this info:</div>
					<div className="s7-bsod__stopcode">
						Stop code: {stopCode.current}
					</div>
				</div>
			</div>
		</div>
	);
}

function FakeQR() {
	// 21×21 module grid with three finder patterns + plausible-looking data area.
	// Not a real QR — visually convincing decoration only.
	const cells = useRef<boolean[]>([]);
	if (cells.current.length === 0) {
		const grid = new Array(21 * 21).fill(false) as boolean[];
		const set = (x: number, y: number, v = true) => {
			if (x >= 0 && x < 21 && y >= 0 && y < 21) grid[y * 21 + x] = v;
		};
		// Finder patterns: 7×7 with inner 3×3
		const drawFinder = (ox: number, oy: number) => {
			for (let y = 0; y < 7; y++) {
				for (let x = 0; x < 7; x++) {
					const isOuter = x === 0 || x === 6 || y === 0 || y === 6;
					const isInner = x >= 2 && x <= 4 && y >= 2 && y <= 4;
					set(ox + x, oy + y, isOuter || isInner);
				}
			}
		};
		drawFinder(0, 0);
		drawFinder(14, 0);
		drawFinder(0, 14);
		// Timing patterns
		for (let i = 8; i < 13; i++) {
			set(i, 6, i % 2 === 0);
			set(6, i, i % 2 === 0);
		}
		// Pseudo-random data area
		let seed = 137;
		const rand = () => {
			seed = (seed * 9301 + 49297) % 233280;
			return seed / 233280;
		};
		for (let y = 0; y < 21; y++) {
			for (let x = 0; x < 21; x++) {
				const inFinder =
					(x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);
				if (!inFinder && rand() > 0.55) set(x, y, true);
			}
		}
		cells.current = grid;
	}
	return (
		<div className="s7-bsod__qr" aria-hidden>
			{cells.current.map((on, i) =>
				on ? <span key={i} /> : <i key={i} />,
			)}
		</div>
	);
}

// ─── PHASE 2 — Glitch transition w/ cracked-screen overlay ───

function GlitchScreen() {
	return (
		<>
			<div className="s7-glitch" />
			<svg
				className="s7-cracks"
				viewBox="0 0 100 200"
				preserveAspectRatio="none"
				aria-hidden
			>
				{/* Spiderweb cracks emanating from a central impact point */}
				<g stroke="white" strokeWidth="0.25" fill="none" opacity="0.85">
					<path d="M50 95 L20 0 L18 -5" />
					<path d="M50 95 L80 0 L82 -5" />
					<path d="M50 95 L0 60" />
					<path d="M50 95 L100 70" />
					<path d="M50 95 L10 130 L0 145" />
					<path d="M50 95 L90 140 L100 155" />
					<path d="M50 95 L30 200" />
					<path d="M50 95 L70 200" />
					<path d="M50 95 L52 200" />
					{/* Concentric fracture rings */}
					<path d="M30 80 L42 90 L50 80 L60 92 L72 78" />
					<path d="M20 110 L40 120 L65 110 L85 125" />
					<path d="M15 70 L35 75 L55 65 L78 72" />
				</g>
				<g stroke="white" strokeWidth="0.12" fill="none" opacity="0.5">
					<path d="M50 95 L25 50" />
					<path d="M50 95 L75 50" />
					<path d="M50 95 L25 140" />
					<path d="M50 95 L75 140" />
					<path d="M50 95 L40 30" />
					<path d="M50 95 L60 30" />
					<path d="M50 95 L40 170" />
					<path d="M50 95 L60 170" />
				</g>
				{/* Impact bullseye */}
				<circle cx="50" cy="95" r="0.8" fill="white" opacity="0.9" />
				<circle
					cx="50"
					cy="95"
					r="2"
					stroke="white"
					strokeWidth="0.15"
					fill="none"
					opacity="0.6"
				/>
			</svg>
		</>
	);
}

// ─── PHASE 3 — Terminal: rm -rf cascade ─────────────────────

const RM_CMD = "sudo rm -rf / --no-preserve-root";

const REAL_PATHS_DIRS = [
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

const REAL_LEAVES = [
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
	const d = REAL_PATHS_DIRS[Math.floor(Math.random() * REAL_PATHS_DIRS.length)];
	const l = REAL_LEAVES[Math.floor(Math.random() * REAL_LEAVES.length)];
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
		const dir = REAL_PATHS_DIRS[
			Math.floor(Math.random() * REAL_PATHS_DIRS.length)
		];
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

	// Typewriter — one keyClick per character
	useEffect(() => {
		let i = 0;
		const id = setInterval(() => {
			i += 1;
			setTyped(RM_CMD.slice(0, i));
			keyClick();
			if (i >= RM_CMD.length) clearInterval(id);
		}, 55);
		return () => clearInterval(id);
	}, []);

	// Once typed, flood deletion lines + HDD ticks
	useEffect(() => {
		if (typed !== RM_CMD) return;
		const id = setInterval(() => {
			setLines((prev) => {
				const next = [...prev];
				for (let k = 0; k < 3; k++) next.push(fakeLine());
				return next.slice(-60);
			});
			if (Math.random() < 0.7) hddTick();
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

// ─── PHASE 4 — Linux Kernel Panic ────────────────────────────

function hex(bits: number): string {
	let s = "";
	for (let i = 0; i < bits / 4; i++) {
		s += Math.floor(Math.random() * 16).toString(16);
	}
	return s;
}

function ts(n: number): string {
	return `[${(98765 + n * 0.000179).toFixed(6).padStart(13, " ")}]`;
}

function buildPanic(): string[] {
	const out: string[] = [];
	let n = 0;
	out.push(
		`${ts(n++)} BUG: kernel NULL pointer dereference, address: 0000000000000050`,
	);
	out.push(
		`${ts(n++)} #PF: supervisor read access in kernel mode`,
	);
	out.push(`${ts(n++)} #PF: error_code(0x0000) - not-present page`);
	out.push(`${ts(n++)} PGD 0 P4D 0`);
	out.push(`${ts(n++)} Oops: 0000 [#1] SMP NOPTI`);
	out.push(
		`${ts(n++)} CPU: ${Math.floor(Math.random() * 16)} PID: 1 Comm: systemd Not tainted 6.5.0-21-generic #21-Ubuntu`,
	);
	out.push(
		`${ts(n++)} Hardware name: Cloudflare Workers/Edge Runtime, BIOS edge-01.7 04/02/2024`,
	);
	out.push(
		`${ts(n++)} RIP: 0010:do_exit+0x${hex(8)}/0x${hex(8)} [kernel]`,
	);
	out.push(`${ts(n++)} Code: ${hex(8)} ${hex(8)} ${hex(8)} ${hex(8)} ${hex(8)} ${hex(8)} ${hex(8)} ${hex(8)}`);
	out.push(
		`${ts(n++)} RSP: 0018:ffff${hex(48)} EFLAGS: 00010246`,
	);
	out.push(
		`${ts(n++)} RAX: 0000${hex(48)} RBX: ffff${hex(48)} RCX: 0000${hex(48)}`,
	);
	out.push(
		`${ts(n++)} RDX: 0000${hex(48)} RSI: 0000${hex(48)} RDI: ffff${hex(48)}`,
	);
	out.push(
		`${ts(n++)} RBP: ffff${hex(48)} R08: 0000${hex(48)} R09: 0000${hex(48)}`,
	);
	out.push(
		`${ts(n++)} R10: 0000${hex(48)} R11: 0000${hex(48)} R12: ffff${hex(48)}`,
	);
	out.push(
		`${ts(n++)} R13: ffff${hex(48)} R14: ffff${hex(48)} R15: 0000${hex(48)}`,
	);
	out.push(
		`${ts(n++)} FS:  0000${hex(48)}(0000) GS:ffff${hex(48)}(0000) knlGS:0000000000000000`,
	);
	out.push(
		`${ts(n++)} CS:  0010 DS: 0000 ES: 0000 CR0: 0000000080050033`,
	);
	out.push(
		`${ts(n++)} CR2: 0000000000000050 CR3: 000000010${hex(8)} CR4: 0000000000770ef0`,
	);
	out.push(`${ts(n++)} Call Trace:`);
	out.push(`${ts(n++)}  <TASK>`);
	const frames = [
		"? __die_body+0x1a/0x60",
		"? page_fault_oops+0x171/0x4e0",
		"? exc_page_fault+0x7f/0x180",
		"? asm_exc_page_fault+0x26/0x30",
		"do_exit+0x10c/0x2c0",
		"do_group_exit+0x35/0x90",
		"__x64_sys_exit_group+0x18/0x20",
		"do_syscall_64+0x5c/0xc0",
		"? exit_to_user_mode_prepare+0x39/0x190",
		"? syscall_exit_to_user_mode+0x37/0x60",
		"? do_syscall_64+0x69/0xc0",
		"entry_SYSCALL_64_after_hwframe+0x6e/0xd8",
	];
	for (const f of frames) {
		out.push(`${ts(n++)}  ${f}`);
	}
	out.push(`${ts(n++)}  </TASK>`);
	out.push(
		`${ts(n++)} Modules linked in: tcp_diag inet_diag binfmt_misc nls_iso8859_1 intel_rapl_msr intel_rapl_common`,
	);
	out.push(`${ts(n++)} CR2: 0000000000000050`);
	out.push(
		`${ts(n++)} ---[ end trace 0000000000000000 ]---`,
	);
	out.push(
		`${ts(n++)} Kernel panic - not syncing: Attempted to kill init! exitcode=0x00000004`,
	);
	out.push(
		`${ts(n++)} Kernel Offset: 0x${hex(8)} from 0xffffffff81000000`,
	);
	out.push(
		`${ts(n++)} ---[ end Kernel panic - not syncing: Attempted to kill init! ]---`,
	);
	out.push("");
	out.push("*** SYSTEM HALTED ***");
	return out;
}

function KernelPanic() {
	const [shown, setShown] = useState<string[]>([]);
	const all = useRef(buildPanic());

	useEffect(() => {
		let i = 0;
		const id = setInterval(() => {
			i += 1;
			setShown(all.current.slice(0, i));
			if (Math.random() < 0.4) hddTick();
			if (i >= all.current.length) clearInterval(id);
		}, 70);
		return () => clearInterval(id);
	}, []);

	return (
		<div className="s7-term s7-term--panic">
			{shown.map((l, i) => {
				let cls: string | undefined;
				if (l.includes("Kernel panic") || l.includes("HALTED")) {
					cls = "s7-term__red";
				} else if (l.startsWith("[") && /\bR(IP|SP|AX|BX|CX|DX|SI|DI|BP|0[89]|1[0-5])\b/.test(l)) {
					cls = "s7-term__yellow";
				} else if (l.includes("BUG:") || l.includes("Oops:")) {
					cls = "s7-term__red";
				}
				return (
					<div key={i} className={cls}>
						{l}
					</div>
				);
			})}
		</div>
	);
}

// ─── PHASE 5 — Reveal ───────────────────────────────────────

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
