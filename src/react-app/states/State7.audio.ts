// ─────────────────────────────────────────────────────────────
//  State 7 audio engine — Web Audio synth.
//
//  All sounds are generated programmatically. No asset files,
//  no network fetches, no autoplay-policy gotchas around <audio>
//  elements. Lazily initializes the AudioContext and silently
//  no-ops if the browser blocks playback (visuals still work).
//
//  iOS Safari note: a QR-scan navigation counts as user
//  activation, so AudioContext is allowed to start. If for some
//  reason it's still suspended, we register a one-shot touch
//  listener to resume on the first interaction.
// ─────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

function getCtx(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (ctx) {
		if (ctx.state === "suspended") ctx.resume().catch(() => {});
		return ctx;
	}
	const Ctor =
		window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
	if (!Ctor) return null;
	try {
		ctx = new Ctor();
		master = ctx.createGain();
		master.gain.value = 0.7;
		master.connect(ctx.destination);
	} catch {
		return null;
	}
	if (ctx.state === "suspended") {
		const resume = () => {
			ctx?.resume().catch(() => {});
			window.removeEventListener("touchstart", resume);
			window.removeEventListener("click", resume);
		};
		window.addEventListener("touchstart", resume, { once: true });
		window.addEventListener("click", resume, { once: true });
		ctx.resume().catch(() => {});
	}
	return ctx;
}

function noiseBuf(c: AudioContext, dur: number, sparse = false): AudioBuffer {
	const len = Math.max(1, Math.floor(c.sampleRate * dur));
	const buf = c.createBuffer(1, len, c.sampleRate);
	const d = buf.getChannelData(0);
	if (sparse) {
		for (let i = 0; i < len; i++) {
			d[i] =
				(Math.random() < 0.002 ? Math.random() * 2 - 1 : 0) +
				(Math.random() * 2 - 1) * 0.04;
		}
	} else {
		for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
	}
	return buf;
}

function bitCrushCurve(steps: number): Float32Array {
	const c = new Float32Array(256);
	for (let i = 0; i < 256; i++) {
		const x = (i - 128) / 128;
		c[i] = Math.round(x * steps) / steps;
	}
	return c;
}

function tanhCurve(amount: number): Float32Array {
	const c = new Float32Array(256);
	for (let i = 0; i < 256; i++) {
		const x = (i - 128) / 128;
		c[i] = Math.tanh(x * amount);
	}
	return c;
}

// ─── BSOD entry: heavy two-tone alarm + sub-bass thud ──────────
export function bsodAlarm() {
	const c = getCtx();
	if (!c || !master) return;
	const t = c.currentTime;
	// Two-tone square (the "system error" feel)
	const tones: Array<[number, number, number]> = [
		[920, 0, 0.18],
		[640, 0.18, 0.22],
	];
	for (const [freq, start, dur] of tones) {
		const o = c.createOscillator();
		o.type = "square";
		o.frequency.value = freq;
		const g = c.createGain();
		g.gain.setValueAtTime(0, t + start);
		g.gain.linearRampToValueAtTime(0.22, t + start + 0.008);
		g.gain.setValueAtTime(0.22, t + start + dur - 0.02);
		g.gain.linearRampToValueAtTime(0, t + start + dur);
		o.connect(g).connect(master);
		o.start(t + start);
		o.stop(t + start + dur + 0.01);
	}
	// Sub-bass thud
	const sub = c.createOscillator();
	sub.type = "sine";
	sub.frequency.setValueAtTime(90, t);
	sub.frequency.exponentialRampToValueAtTime(28, t + 0.55);
	const sg = c.createGain();
	sg.gain.setValueAtTime(0.55, t);
	sg.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
	sub.connect(sg).connect(master);
	sub.start(t);
	sub.stop(t + 0.6);
}

// ─── Sharp short glitch click ──────────────────────────────────
export function glitchClick(volume = 0.35) {
	const c = getCtx();
	if (!c || !master) return;
	const t = c.currentTime;
	const dur = 0.06;
	const src = c.createBufferSource();
	src.buffer = noiseBuf(c, dur);
	const ws = c.createWaveShaper();
	ws.curve = bitCrushCurve(3);
	const hp = c.createBiquadFilter();
	hp.type = "highpass";
	hp.frequency.value = 1800;
	const g = c.createGain();
	g.gain.setValueAtTime(volume, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + dur);
	src.connect(ws).connect(hp).connect(g).connect(master);
	src.start(t);
	src.stop(t + dur + 0.01);
}

// ─── Glitch transition: harsh sweep + bit-crush burst ──────────
export function glitchSweep() {
	const c = getCtx();
	if (!c || !master) return;
	const t = c.currentTime;
	const dur = 0.5;
	// Filtered noise sweep
	const src = c.createBufferSource();
	src.buffer = noiseBuf(c, dur);
	const ws = c.createWaveShaper();
	ws.curve = bitCrushCurve(2);
	const bp = c.createBiquadFilter();
	bp.type = "bandpass";
	bp.Q.value = 8;
	bp.frequency.setValueAtTime(8000, t);
	bp.frequency.exponentialRampToValueAtTime(180, t + dur);
	const g = c.createGain();
	g.gain.setValueAtTime(0.55, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + dur);
	src.connect(ws).connect(bp).connect(g).connect(master);
	src.start(t);
	src.stop(t + dur + 0.01);
	// Shrill descending saw
	const o = c.createOscillator();
	o.type = "sawtooth";
	o.frequency.setValueAtTime(2200, t);
	o.frequency.exponentialRampToValueAtTime(70, t + dur);
	const og = c.createGain();
	og.gain.setValueAtTime(0.18, t);
	og.gain.exponentialRampToValueAtTime(0.001, t + dur);
	o.connect(og).connect(master);
	o.start(t);
	o.stop(t + dur + 0.01);
}

// ─── Single keystroke click ────────────────────────────────────
export function keyClick() {
	const c = getCtx();
	if (!c || !master) return;
	const t = c.currentTime;
	const o = c.createOscillator();
	o.type = "square";
	o.frequency.value = 1700 + Math.random() * 900;
	const g = c.createGain();
	g.gain.setValueAtTime(0, t);
	g.gain.linearRampToValueAtTime(0.07, t + 0.001);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.025);
	o.connect(g).connect(master);
	o.start(t);
	o.stop(t + 0.03);
}

// ─── HDD-stutter tick (rm cascade) ─────────────────────────────
export function hddTick() {
	const c = getCtx();
	if (!c || !master) return;
	const t = c.currentTime;
	const dur = 0.018;
	const src = c.createBufferSource();
	src.buffer = noiseBuf(c, dur);
	const bp = c.createBiquadFilter();
	bp.type = "bandpass";
	bp.Q.value = 6;
	bp.frequency.value = 3500 + Math.random() * 2500;
	const g = c.createGain();
	g.gain.setValueAtTime(0.09, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + dur);
	src.connect(bp).connect(g).connect(master);
	src.start(t);
	src.stop(t + dur + 0.01);
}

// ─── Continuous static crackle. Returns a stop() function. ─────
export function startStatic(level = 0.04): () => void {
	const c = getCtx();
	if (!c || !master) return () => {};
	const src = c.createBufferSource();
	src.buffer = noiseBuf(c, 1, true);
	src.loop = true;
	const lp = c.createBiquadFilter();
	lp.type = "lowpass";
	lp.frequency.value = 7500;
	const g = c.createGain();
	g.gain.value = level;
	src.connect(lp).connect(g).connect(master);
	src.start();
	return () => {
		try {
			g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.1);
			src.stop(c.currentTime + 0.15);
		} catch {
			/* already stopped */
		}
	};
}

// ─── Kernel panic: descending distorted sweep + pulsing siren ──
export function panicAlarm() {
	const c = getCtx();
	if (!c || !master) return;
	const t = c.currentTime;
	const dur = 1.6;
	// Falling distorted saw
	const o = c.createOscillator();
	o.type = "sawtooth";
	o.frequency.setValueAtTime(620, t);
	o.frequency.exponentialRampToValueAtTime(38, t + dur);
	const ws = c.createWaveShaper();
	ws.curve = tanhCurve(5);
	const g = c.createGain();
	g.gain.setValueAtTime(0.32, t);
	g.gain.exponentialRampToValueAtTime(0.001, t + dur);
	o.connect(ws).connect(g).connect(master);
	o.start(t);
	o.stop(t + dur + 0.01);
	// Pulsing low triangle siren under it
	for (let i = 0; i < 5; i++) {
		const sirenO = c.createOscillator();
		sirenO.type = "triangle";
		sirenO.frequency.value = 130;
		const sg = c.createGain();
		const start = t + i * 0.32;
		sg.gain.setValueAtTime(0, start);
		sg.gain.linearRampToValueAtTime(0.12, start + 0.04);
		sg.gain.linearRampToValueAtTime(0, start + 0.26);
		sirenO.connect(sg).connect(master);
		sirenO.start(start);
		sirenO.stop(start + 0.3);
	}
}

// ─── Heartbeat tick (after panic, before reveal) ───────────────
export function heartbeatTick() {
	const c = getCtx();
	if (!c || !master) return;
	const t = c.currentTime;
	for (const [start, freq] of [
		[0, 50],
		[0.12, 38],
	] as const) {
		const o = c.createOscillator();
		o.type = "sine";
		o.frequency.value = freq;
		const g = c.createGain();
		g.gain.setValueAtTime(0, t + start);
		g.gain.linearRampToValueAtTime(0.45, t + start + 0.01);
		g.gain.exponentialRampToValueAtTime(0.001, t + start + 0.18);
		o.connect(g).connect(master);
		o.start(t + start);
		o.stop(t + start + 0.2);
	}
}

// ─── Soft warm chime for the reveal ────────────────────────────
export function revealChime() {
	const c = getCtx();
	if (!c || !master) return;
	const t = c.currentTime;
	const notes: Array<[number, number]> = [
		[523.25, 0],
		[659.25, 0.13],
		[783.99, 0.26],
	];
	for (const [freq, start] of notes) {
		const o = c.createOscillator();
		o.type = "sine";
		o.frequency.value = freq;
		const g = c.createGain();
		g.gain.setValueAtTime(0, t + start);
		g.gain.linearRampToValueAtTime(0.2, t + start + 0.02);
		g.gain.exponentialRampToValueAtTime(0.001, t + start + 0.65);
		o.connect(g).connect(master);
		o.start(t + start);
		o.stop(t + start + 0.7);
	}
}

// ─── Tear down everything (unmount cleanup) ────────────────────
export function teardown() {
	if (ctx) {
		try {
			ctx.close();
		} catch {
			/* already closed */
		}
		ctx = null;
		master = null;
	}
}
