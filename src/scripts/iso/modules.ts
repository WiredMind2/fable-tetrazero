/*
	Box tables for the isometric modules. Each box is
	[x, y, z, width, depth, height, layer, accent?] on a ~5–6 unit grid.
	Shapes are our own: a "T" monogram for the hero, a compiler layer
	stack, an agent constellation, a ratings board, and per-project marks.
*/

export type Box = [number, number, number, number, number, number, number, number?];

const T_BAR: Box[] = [
	[0, 0, 0, 5.6, 3.6, 0.3, 0],
	// Horizontal bar of the T
	[0.5, 0.6, 0.3, 4.6, 0.9, 0.7, 1],
	// Stem, accented
	[2.2, 1.6, 1.0, 1.2, 1.4, 1.7, 2, 1],
];

const STACK: Box[] = [
	// Three compilation layers (IR stages) ...
	[0, 0, 0, 5, 4, 0.35, 0],
	[0, 0, 1, 5, 4, 0.35, 1],
	[0, 0, 2, 5, 4, 0.35, 2],
	// ... crowned by scattered tokens
	[0.5, 0.5, 2.35, 1.8, 1.4, 0.25, 3, 1],
	[2.6, 0.5, 2.35, 1.9, 1.4, 0.25, 3],
	[0.5, 2.2, 2.35, 4.0, 1.2, 0.25, 3],
];

const AGENTS: Box[] = [
	[0, 0, 0, 5, 5, 0.3, 0],
	// The model in the middle ...
	[1.4, 1.4, 0.3, 2.2, 2.2, 2.2, 1, 1],
	// ... orbited by small tool cubes
	[0.3, 0.4, 0.3, 0.9, 0.9, 0.9, 2],
	[3.9, 0.5, 0.3, 0.8, 0.8, 0.8, 2],
	[0.5, 3.8, 0.3, 0.8, 0.8, 0.8, 2],
	[3.7, 3.6, 0.3, 1.0, 1.0, 1.0, 2],
	[2.1, 2.1, 2.5, 0.8, 0.8, 0.8, 3],
];

const BOARD: Box[] = (() => {
	// Contest board: 3x3 performance tiles, the record one accented
	const tiles: Box[] = [[0, 0, 0, 5.4, 5.4, 0.3, 0]];
	const heights = [0.4, 0.8, 0.5, 1.1, 0.6, 1.5, 0.5, 1.0, 0.7];
	for (let i = 0; i < 9; i++) {
		tiles.push([
			0.3 + (i % 3) * 1.7,
			0.3 + Math.floor(i / 3) * 1.7,
			0.3,
			1.4,
			1.4,
			heights[i],
			1 + (i % 3),
			i === 5 ? 1 : 0,
		]);
	}
	return tiles;
})();

const PIPELINE: Box[] = [
	// Front-end -> IR -> passes -> back-end, descending as a flow
	[0, 0, 0, 6, 4.2, 0.3, 0],
	[0.4, 0.5, 0.3, 1.2, 1.2, 0.9, 1, 1],
	[1.6, 0.8, 0.3, 1.2, 0.6, 0.2, 1],
	[2.8, 0.5, 0.3, 1.2, 1.2, 0.9, 2],
	[3.1, 1.7, 0.3, 0.6, 1.0, 0.2, 2],
	[2.8, 2.7, 0.3, 1.2, 1.2, 0.9, 3],
	[4.4, 3.0, 0.3, 1.2, 0.6, 0.2, 3],
	[4.5, 0.6, 0.3, 1.0, 1.0, 0.5, 2],
];

const CHART: Box[] = [
	// Ascending equity curve
	[0, 0, 0, 6, 3, 0.3, 0],
	[0.4, 1, 0.3, 0.8, 1, 0.8, 1],
	[1.5, 1, 0.3, 0.8, 1, 1.3, 2],
	[2.6, 1, 0.3, 0.8, 1, 1.1, 3],
	[3.7, 1, 0.3, 0.8, 1, 2.1, 4],
	[4.8, 1, 0.3, 0.8, 1, 2.9, 5, 1],
];

const SHELF: Box[] = (() => {
	// Media library grid with one tile playing (tall + accented)
	const tiles: Box[] = [[0, 0, 0, 5.4, 3.8, 0.3, 0]];
	for (let i = 0; i < 6; i++) {
		tiles.push([
			0.35 + (i % 3) * 1.7,
			0.45 + Math.floor(i / 3) * 1.6,
			0.3,
			1.4,
			1.2,
			i === 4 ? 1.6 : 0.5,
			1 + (i % 2),
			i === 4 ? 1 : 0,
		]);
	}
	return tiles;
})();

const PODIUM: Box[] = [
	[0, 0, 0, 6, 3.2, 0.3, 0],
	[0.5, 0.9, 0.3, 1.3, 1.4, 1.7, 1],
	[2.35, 0.9, 0.3, 1.3, 1.4, 1.1, 2, 1],
	[4.2, 0.9, 0.3, 1.3, 1.4, 0.6, 3],
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
