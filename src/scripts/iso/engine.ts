/*
	Isometric SVG engine — hand-rolled, dependency-free.

	Technique: boxes are axis-aligned cuboids projected with a classic
	isometric projection and rendered as SVG polygons. One directional
	light shades each visible face; a painter's sort by z-extents orders
	the boxes. Motion is driven by a shared "phase clock": every visual
	property is a pure function of the phase, so the slow explode/collapse
	loop and the hover "seek to next rest pose" never jump.

	Performance contract:
	- one requestAnimationFrame for every scene on the page; it fully
	  stops when nothing visible is moving
	- IntersectionObserver gates work to on-screen scenes
	- polygons are rebuilt only when the visible face set changes;
	  otherwise existing nodes just get attribute updates
	- the viewBox is precomputed from rotation/explosion extremes so the
	  drawing never resizes while animating
*/

import { MODULES, type Box } from './modules';

const UNIT = 18; // world unit -> SVG px
const ISO_X = Math.cos(Math.PI / 6); // cos(30deg)
const PERIOD = 11; // seconds per loop cycle
const SWAY = 0.3; // yaw oscillation amplitude (rad)
const FIT_YAW = 0.5; // yaw extremes used to precompute the viewBox
const GAP = 0.55; // vertical separation between exploded layers (world units)
const DROP = 3.2; // assembly drop-in height (world units)
const ASSEMBLE_MS = 1400;
const CLOSE_WIN: [number, number] = [0.08, 0.44]; // phase window, top layer first
const OPEN_WIN: [number, number] = [0.56, 0.92]; // phase window, bottom layer first

const LIGHT = (() => {
	const l = [-0.4, 0.5, 1];
	const n = Math.hypot(...l);
	return l.map((v) => v / n) as [number, number, number];
})();

// Local cuboid corner order: 4 bottom (CCW), 4 top.
const FACES: Array<{ idx: [number, number, number, number]; n: [number, number, number] }> = [
	{ idx: [4, 5, 6, 7], n: [0, 0, 1] },
	{ idx: [0, 3, 2, 1], n: [0, 0, -1] },
	{ idx: [1, 2, 6, 5], n: [1, 0, 0] },
	{ idx: [0, 4, 7, 3], n: [-1, 0, 0] },
	{ idx: [3, 7, 6, 2], n: [0, 1, 0] },
	{ idx: [0, 1, 5, 4], n: [0, -1, 0] },
];

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const project = (p: [number, number, number]): [number, number] => [
	(p[0] - p[1]) * ISO_X * UNIT,
	((p[0] + p[1]) / 2 - p[2]) * UNIT,
];

/** Fractional clock: integers are resting (exploded) poses. */
class PhaseClock {
	phase: number;
	private slow = 1 / PERIOD;
	private v: number;
	private seek: { from: number; v0: number; to: number; dur: number; t0: number } | null =
		null;

	constructor(phase = 0) {
		this.phase = phase;
		this.v = this.slow;
	}

	/** Accelerate to the next rest pose and park there (zero end velocity). */
	hold(now: number) {
		if (this.seek) return;
		const from = this.phase;
		const v0 = Math.max(0, this.v);
		const to = Math.ceil(from - 1e-4);
		const distance = to - from;
		// Duration grows with distance, but stays monotonic for the spline.
		let dur = 0.5 + 0.9 * distance;
		if (v0 > 0) dur = Math.min(dur, Math.max(0.12, (3 * distance) / v0));
		this.seek = { from, v0, to, dur, t0: now };
	}

	/** Resume the slow loop from wherever we parked. */
	release() {
		this.seek = null;
	}

	get resting() {
		return this.seek !== null && this.v === 0 && this.phase === this.seek.to;
	}

	/** Advance by dt seconds at time `now`; returns true if the phase moved. */
	step(dt: number, now: number): boolean {
		const before = this.phase;
		if (this.seek) {
			const k = this.seek;
			const s = clamp01((now - k.t0) / k.dur);
			const s2 = s * s;
			const s3 = s2 * s;
			// Cubic Hermite: position + velocity endpoints, zero terminal speed.
			this.phase =
				s >= 1
					? k.to
					: (2 * s3 - 3 * s2 + 1) * k.from +
						(s3 - 2 * s2 + s) * k.dur * k.v0 +
						(-2 * s3 + 3 * s2) * k.to;
			const vel =
				((6 * s2 - 6 * s) * k.from +
					(3 * s2 - 4 * s + 1) * k.dur * k.v0 +
					(-6 * s2 + 6 * s) * k.to) /
				k.dur;
			this.v = s >= 1 ? 0 : vel;
		} else {
			// Ease velocity back toward the slow loop speed, then drift.
			this.v += (this.slow - this.v) * (1 - Math.exp(-dt / 0.7));
			this.phase += this.v * dt;
		}
		return this.phase !== before;
	}
}

/** Layer separations for the fractional part of a phase (1 = closed). */
function layerGaps(frac: number, layers: number): number[] {
	const out = new Array<number>(layers + 1).fill(1);
	if (layers === 0) return out;
	const window = (win: [number, number], order: number, opening: boolean) => {
		const [a, b] = win;
		const span = b - a;
		const dur = span * 0.45;
		const stagger = layers > 1 ? (span - dur) / (layers - 1) : 0;
		const t = smooth((frac - (a + order * stagger)) / dur);
		return opening ? t : 1 - t;
	};
	for (let j = 1; j <= layers; j++) {
		// Closing runs top layer first; opening runs bottom layer first.
		out[j] =
			frac < 0.5
				? window(CLOSE_WIN, layers - j, false)
				: window(OPEN_WIN, j - 1, true);
	}
	return out;
}

interface SceneBox {
	pts: Array<[number, number, number]>;
	z0: number;
	z1: number;
	depth: number;
	accent: boolean;
	alpha: number;
}

class IsoScene {
	private el: HTMLElement;
	private svg: SVGSVGElement;
	private boxes: Box[];
	private layers: number;
	private cx = 0;
	private cy = 0;
	private clock: PhaseClock;
	private animated: boolean;
	private visible = false;
	private hovered = false;
	private asm: number;
	private asmStart: number | null = null;
	private faceSig = '';
	private nodes: SVGPolygonElement[] = [];

	constructor(el: HTMLElement, name: string, animated: boolean, phase: number) {
		this.el = el;
		this.animated = animated;
		this.boxes = MODULES[name] ?? MODULES.stack;
		this.layers = Math.max(...this.boxes.map((b) => b[6]));
		let sx = 0;
		let sy = 0;
		for (const b of this.boxes) {
			sx += b[0] + b[3] / 2;
			sy += b[1] + b[4] / 2;
		}
		this.cx = sx / this.boxes.length;
		this.cy = sy / this.boxes.length;
		this.clock = new PhaseClock(phase);
		this.asm = animated ? 0 : 1;

		this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		this.svg.setAttribute('aria-hidden', 'true');
		this.svg.setAttribute('focusable', 'false');
		el.appendChild(this.svg);

		this.fit();
		this.draw();
		if (this.animated) this.bindHover();
	}

	/** Vertical offset per layer: sum of the gaps below it. */
	private offsets(phase: number): number[] {
		const gaps = layerGaps(phase - Math.floor(phase), this.layers);
		const out = [0];
		for (let j = 1; j <= this.layers; j++) out[j] = out[j - 1] + gaps[j] * GAP;
		return out;
	}

	private geometry(yaw: number, offsets: number[]): SceneBox[] {
		const cs = Math.cos(yaw);
		const sn = Math.sin(yaw);
		const total = this.boxes.length;
		return this.boxes
			.map((b, i): SceneBox => {
				// Staggered assembly: each box drops in slightly after the previous.
				const local = this.animated
					? clamp01(this.asm * 1.6 - (i / total) * 0.6)
					: 1;
				const z = b[2] + offsets[b[6]] + (1 - easeOutCubic(local)) * DROP;
				const [x, y, w, d, h] = [b[0], b[1], b[3], b[4], b[5]];
				const raw: Array<[number, number, number]> = [
					[x, y, z],
					[x + w, y, z],
					[x + w, y + d, z],
					[x, y + d, z],
					[x, y, z + h],
					[x + w, y, z + h],
					[x + w, y + d, z + h],
					[x, y + d, z + h],
				];
				const pts = raw.map((p) => {
					const dx = p[0] - this.cx;
					const dy = p[1] - this.cy;
					return [dx * cs - dy * sn, dx * sn + dy * cs, p[2]] as [
						number,
						number,
						number,
					];
				});
				const c = pts.reduce(
					(a, p) => [a[0] + p[0] / 8, a[1] + p[1] / 8, a[2] + p[2] / 8],
					[0, 0, 0],
				);
				return {
					pts,
					z0: z,
					z1: z + h,
					depth: c[0] + c[1] + c[2] * 0.9,
					accent: b[7] === 1,
					alpha: easeOutCubic(local),
				};
			})
			.sort((a, b) => {
				// A box entirely above another draws after it; wide plates broke
				// centroid sorting, so compare z extents first.
				if (a.z0 >= b.z1 - 1e-6) return 1;
				if (b.z0 >= a.z1 - 1e-6) return -1;
				return a.depth - b.depth;
			});
	}

	/** Fixed viewBox over rotation + explosion extremes: no layout breathing. */
	private fit() {
		let x0 = Infinity;
		let y0 = Infinity;
		let x1 = -Infinity;
		let y1 = -Infinity;
		const open = this.offsets(0);
		for (const yaw of [-FIT_YAW, 0, FIT_YAW]) {
			for (const g of this.geometry(yaw, open)) {
				for (const p of g.pts) {
					const q = project(p);
					x0 = Math.min(x0, q[0]);
					x1 = Math.max(x1, q[0]);
					y0 = Math.min(y0, q[1]);
					y1 = Math.max(y1, q[1]);
				}
			}
		}
		const pad = 8;
		this.svg.setAttribute(
			'viewBox',
			[x0 - pad, y0 - pad, x1 - x0 + pad * 2, y1 - y0 + pad * 2]
				.map((v) => v.toFixed(1))
				.join(' '),
		);
	}

	private draw() {
		const phase = this.clock.phase;
		const yaw = SWAY * Math.sin(phase * Math.PI * 2);
		const cs = Math.cos(yaw);
		const sn = Math.sin(yaw);
		type Face = { key: string; cls: string; pts: string; fill: string; stroke: string };
		const faces: Face[] = [];
		for (const g of this.geometry(yaw, this.offsets(phase))) {
			if (g.alpha <= 0.01) continue;
			for (let f = 0; f < FACES.length; f++) {
				const { idx, n: n0 } = FACES[f];
				const nx = n0[0] * cs - n0[1] * sn;
				const ny = n0[0] * sn + n0[1] * cs;
				const nz = n0[2];
				if (nx + ny + nz <= 0.001) continue; // facing away
				const lit =
					0.28 + 0.66 * Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
				const base = g.accent ? 0.62 : 0.24;
				const range = g.accent ? 0.36 : 0.6;
				faces.push({
					key: `${g.z0.toFixed(3)}:${g.z1.toFixed(3)}:${f}`,
					cls: g.accent ? 'face--accent' : '',
					pts: idx
						.map((k) => project(g.pts[k]).map((v) => v.toFixed(1)).join(','))
						.join(' '),
					fill: ((base + range * lit) * g.alpha).toFixed(3),
					stroke: g.alpha.toFixed(2),
				});
			}
		}
		const sig = faces.map((f) => f.key).join('|');
		if (sig !== this.faceSig) {
			this.faceSig = sig;
			this.svg.innerHTML = faces
				.map(
					(f) =>
						`<polygon${f.cls ? ` class="${f.cls}"` : ''} points="${f.pts}" fill-opacity="${f.fill}" stroke-opacity="${f.stroke}"/>`,
				)
				.join('');
			this.nodes = Array.from(this.svg.children) as SVGPolygonElement[];
			return;
		}
		for (let i = 0; i < faces.length; i++) {
			const node = this.nodes[i];
			node.setAttribute('points', faces[i].pts);
			node.setAttribute('fill-opacity', faces[i].fill);
			node.setAttribute('stroke-opacity', faces[i].stroke);
		}
	}

	/** One frame; returns true when another frame is needed. */
	step(dt: number, now: number): boolean {
		if (!this.visible || !this.animated) return false;
		let moving = this.clock.step(dt, now);
		if (this.asmStart !== null && this.asm < 1) {
			this.asm = Math.min(1, (now - this.asmStart) / (ASSEMBLE_MS / 1000));
			moving = true;
		}
		if (moving) this.draw();
		return moving || !this.clock.resting;
	}

	assemble(now: number) {
		if (this.asmStart !== null || !this.animated) return;
		this.asmStart = now;
		wake(this);
	}

	setVisible(visible: boolean) {
		this.visible = visible;
	}

	private bindHover() {
		const zone = this.el.closest('[data-iso-zone]') ?? this.el;
		zone.addEventListener('pointerenter', (e) => {
			if (e.pointerType === 'touch') return; // taps stay taps
			this.hovered = true;
			this.clock.hold(performance.now() / 1000);
			wake(this);
		});
		zone.addEventListener('pointerleave', (e) => {
			if (e.pointerType === 'touch' || !this.hovered) return;
			this.hovered = false;
			this.clock.release();
			wake(this);
		});
	}
}

/* Shared scheduler: one rAF for all scenes, sleeping when idle. */

const scenes: IsoScene[] = [];
const active = new Set<IsoScene>();
let rafId = 0;
let lastT = 0;

function tick(ms: number) {
	const now = ms / 1000;
	const dt = Math.min(0.05, Math.max(0, now - lastT));
	lastT = now;
	for (const scene of active) {
		if (!scene.step(dt, now)) active.delete(scene);
	}
	rafId = active.size > 0 ? requestAnimationFrame(tick) : 0;
}

function wake(scene: IsoScene) {
	active.add(scene);
	if (rafId === 0) {
		lastT = performance.now() / 1000;
		rafId = requestAnimationFrame(tick);
	}
}

export function initIso() {
	const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const byEl = new Map<HTMLElement, IsoScene>();
	document.querySelectorAll<HTMLElement>('.iso[data-module]').forEach((el, i) => {
		if (el.querySelector('svg')) return;
		const name = el.dataset.module ?? 'stack';
		const wantsStatic = el.dataset.isoStatic === 'true';
		const animated = !reduced && !wantsStatic;
		// Stagger sibling phases so scenes never move in unison.
		const scene = new IsoScene(el, name, animated, (i * 0.37) % 1);
		scenes.push(scene);
		byEl.set(el, scene);
	});
	if (scenes.length === 0) return;

	if (!('IntersectionObserver' in window)) {
		scenes.forEach((s) => {
			s.setVisible(true);
			s.assemble(performance.now() / 1000);
		});
		return;
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				const scene = byEl.get(entry.target as HTMLElement);
				if (!scene) continue;
				scene.setVisible(entry.isIntersecting);
				if (entry.isIntersecting) {
					wake(scene);
					if (entry.intersectionRatio >= 0.35) {
						scene.assemble(performance.now() / 1000);
					}
				}
			}
		},
		{ threshold: [0, 0.35] },
	);
	byEl.forEach((_scene, el) => observer.observe(el));

	// Failsafe: nothing stays unassembled if IO never fires.
	setTimeout(() => {
		scenes.forEach((s) => s.assemble(performance.now() / 1000));
	}, 4000);
}
