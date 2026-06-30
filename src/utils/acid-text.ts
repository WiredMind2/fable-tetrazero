const acidDot = '<span class="text-acid">.</span>';
const acidComma = '<span class="text-acid">,</span>';

/** Wrap sentence-ending periods, ellipses, and commas in acid spans. */
export function acidifyText(text: string): string {
	return text
		.replace(/\.{3}/g, acidDot + acidDot + acidDot)
		.replace(/\.(?=\s|$|"|'|\))/g, acidDot)
		.replace(/,/g, acidComma);
}
