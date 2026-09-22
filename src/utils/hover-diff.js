/**
 * What changes when the chain of elements under the pointer changes.
 *
 * `prev` and `next` are ancestor chains, outermost first (the block down to
 * the deepest element). Elements in `next` and not in `prev` are ENTERED,
 * outermost first — the order the browser fires mouseenter. Elements in
 * `prev` and not in `next` are LEFT, deepest first — the order of mouseleave.
 *
 * @param {Element[]} prev the chain that was under the pointer
 * @param {Element[]} next the chain that is under it now
 * @return {{enter: Element[], leave: Element[]}}
 */
export function hoverDiff( prev, next ) {
	const was = new Set( prev );
	const is = new Set( next );
	return {
		enter: next.filter( ( el ) => ! was.has( el ) ),
		leave: prev.filter( ( el ) => ! is.has( el ) ).reverse(),
	};
}
