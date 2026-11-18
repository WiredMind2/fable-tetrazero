/*
	Box tables for the isometric modules. Each box is
	[x, y, z, width, depth, height, layer, accent?] on a ~5–6 unit grid.
	The camera looks from +x/+y/+z: +x runs down-right on screen, -y runs
	up-right, so "left to right" flows along +x or -y. Each module is an
	icon extruded in 3D, readable from its silhouette alone.
*/

export type Box = [number, number, number, number, number, number, number, number?];

const T_BAR: Box[] = [
	// Two-step plinth ...
	[0, 0, 0, 5.6, 2.8, 0.35, 0],
	[0.4, 0.4, 0.35, 4.8, 2.0, 0.35, 1],
	// ... carrying an upright, chunky "T" (one layer, so it never splits)
	[2.0, 0.8, 0.7, 1.6, 1.2, 2.8, 2, 1],
	[0.4, 0.8, 3.5, 4.8, 1.2, 1.3, 2, 1],
];

const STACK: Box[] = [
	// Four books, alternately offset, one per layer ...
	[0, 0.1, 0, 4.6, 3.2, 0.6, 0],
	[0.4, 0, 0.6, 4.6, 3.2, 0.6, 1],
	[0, 0.1, 1.2, 4.6, 3.2, 0.6, 2],
	[0.4, 0, 1.8, 4.6, 3.2, 0.6, 3],
	// ... topped by a rolled diploma
	[1.1, 1.25, 2.4, 3.2, 0.7, 0.7, 4, 1],
];

const AGENTS: Box[] = [
	[0, 0, 0, 6, 6, 0.3, 0],
	// The model in the middle ...
	[2.3, 2.3, 0.3, 1.4, 1.4, 2.2, 1, 1],
	// ... wired to four tool nodes (same layer, so links never break)
	[1.0, 2.8, 0.3, 1.3, 0.4, 0.3, 1],
	[3.7, 2.8, 0.3, 1.3, 0.4, 0.3, 1],
	[2.8, 1.0, 0.3, 0.4, 1.3, 0.3, 1],
	[2.8, 3.7, 0.3, 0.4, 1.3, 0.3, 1],
	[0.2, 2.6, 0.3, 0.8, 0.8, 0.8, 1],
	[5.0, 2.6, 0.3, 0.8, 0.8, 0.8, 1],
	[2.6, 0.2, 0.3, 0.8, 0.8, 0.8, 1],
	[2.6, 5.0, 0.3, 0.8, 0.8, 0.8, 1],
];

const BOARD: Box[] = (() => {
	// Tic-tac-toe: flat 3x3 tiles, three pieces in a row, winning move accented
	const tiles: Box[] = [[0, 0, 0, 5.4, 5.4, 0.3, 0]];
	// Anti-diagonal: renders as a level row across the board
	const win = [2, 4, 6];
	for (let i = 0; i < 9; i++) {
		const x = 0.3 + (i % 3) * 1.7;
		const y = 0.3 + Math.floor(i / 3) * 1.7;
		tiles.push([x, y, 0.3, 1.4, 1.4, 0.25, 1]);
		if (win.includes(i)) {
			tiles.push([x + 0.25, y + 0.25, 0.55, 0.9, 0.9, 1.0, 2, i === 4 ? 1 : 0]);
		}
	}
	return tiles;
})();

const PIPELINE: Box[] = [
	// Front-end -> IR -> back-end -> binary, shrinking down-right along +x
	[0, 0, 0, 6.3, 2.4, 0.3, 0],
	[0.2, 0.55, 0.3, 1.3, 1.3, 1.3, 1],
	[1.5, 1.0, 0.3, 0.7, 0.4, 0.3, 1],
	[2.2, 0.675, 0.3, 1.05, 1.05, 1.05, 1],
	[3.25, 1.0, 0.3, 0.7, 0.4, 0.3, 1],
	[3.95, 0.775, 0.3, 0.85, 0.85, 0.85, 1],
	[4.8, 1.0, 0.3, 0.7, 0.4, 0.3, 1],
	[5.5, 0.875, 0.3, 0.65, 0.65, 0.65, 1, 1],
];

const CHART: Box[] = (() => {
	// Candles rising up-right along -y: a body bar with a thin wick on top,
	// a small pullback mid-run, the latest (tallest) candle accented.
	// Wick and body share a layer so the candle never splits.
	const bars: Box[] = [[0, 0, 0, 2, 5.9, 0.3, 0]];
	const bodies = [0.6, 1.1, 0.9, 1.7, 2.5];
	bodies.forEach((h, i) => {
		const y = 0.4 + (bodies.length - 1 - i) * 1.1;
		const accent = i === bodies.length - 1 ? 1 : 0;
		bars.push([0.6, y, 0.3, 0.8, 0.8, h, 1, accent]);
		bars.push([0.9, y + 0.3, 0.3 + h, 0.2, 0.2, 0.45, 1, accent]);
	});
	return bars;
})();

const SHELF: Box[] = (() => {
	// Thumbnail wall: 3x3 flat 16:9 tiles on one layer, the playing one
	// popped up on its own layer and accented
	const tiles: Box[] = [[0, 0, 0, 5.7, 3.7, 0.3, 0]];
	for (let i = 0; i < 9; i++) {
		const playing = i === 4;
		tiles.push([
			0.3 + (i % 3) * 1.8,
			0.3 + Math.floor(i / 3) * 1.1,
			0.3,
			1.6,
			0.9,
			playing ? 0.8 : 0.2,
			playing ? 2 : 1,
			playing ? 1 : 0,
		]);
	}
	return tiles;
})();

const PODIUM: Box[] = [
	// 2-1-3 podium across the screen (left = high y), winner accented
	[0, 0, 0, 2.6, 5.6, 0.3, 0],
	[0.6, 3.6, 0.3, 1.4, 1.6, 1.4, 1],
	[0.6, 2.0, 0.3, 1.4, 1.6, 2.4, 1, 1],
	[0.6, 0.4, 0.3, 1.4, 1.6, 0.8, 1],
];

export const MODULES: Record<string, Box[]> = {
	mark: T_BAR,
	stack: STACK,
	agents: AGENTS,
	board: BOARD,
	pipeline: PIPELINE,
	chart: CHART,
	shelf: SHELF,
	podium: PODIUM,
};

export type ModuleName = keyof typeof MODULES;
