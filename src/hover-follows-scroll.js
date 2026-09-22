/**
 * HOVER FOLLOWS THE SCROLL — the front-end runtime.
 *
 * Mark, 2026-09-22: "if your mouse is on it you're engaged even if your mouse
 * is just on it as you scroll by." A browser updates :hover and fires
 * mouseenter only when the pointer MOVES; a card scrolling under a still
 * pointer engages nothing. So, on every scroll, this asks what is under the
 * pointer inside a gcb block and settles the difference itself:
 *
 *   - `gcb-hover` goes on every element newly under the pointer and comes
 *     off every element no longer under it — the block's stylesheet answers
 *     to it beside :hover (gcb-pro compiles `hover:` utilities and the
 *     block's own `:hover` rules to match either);
 *   - synthetic mouseenter / mouseover / mouseleave / mouseout are fired the
 *     way the browser would, so a script's hover handlers run too.
 *
 * When the pointer really moves, the browser owns hover again: the marks
 * are re-settled to what is under it WITHOUT firing events (the browser has
 * fired the real ones), so nothing runs twice. Dependency-free on purpose.
 */
import { hoverDiff } from './utils/hover-diff';

const CLASS = 'gcb-hover';
let x = -1;
let y = -1;
let chain = [];
/* what the scripts have been TOLD is under the pointer — by us or by the
   browser. Chrome fires its own mouseenter/mouseleave once a scroll has
   fully stopped (a fake mousemove); Safari never does. Having fired ours
   during the scroll, the browser's late copy is swallowed, so a handler runs
   exactly once either way. */
const told = new Set();

/** the block-scoped ancestor chain under the pointer, outermost first */
function under() {
	if ( x < 0 || y < 0 ) {
		return [];
	}
	const deepest = document.elementFromPoint( x, y );
	if ( ! deepest ) {
		return [];
	}
	const block = deepest.closest( '.gcb-block' );
	if ( ! block ) {
		return [];
	}
	const out = [];
	for ( let el = deepest; el && el !== block.parentElement; el = el.parentElement ) {
		out.unshift( el );
	}
	return out;
}

function fire( el, type, related ) {
	el.dispatchEvent(
		new MouseEvent( type, {
			bubbles: type === 'mouseover' || type === 'mouseout',
			cancelable: true,
			clientX: x,
			clientY: y,
			relatedTarget: related || null,
			view: window,
		} )
	);
}

/** settle the marks (and, when `events`, tell the scripts) */
function settle( events ) {
	const next = under();
	const { enter, leave } = hoverDiff( chain, next );
	if ( ! enter.length && ! leave.length ) {
		return;
	}
	const from = chain[ chain.length - 1 ] || null;
	const to = next[ next.length - 1 ] || null;
	for ( const el of leave ) {
		el.classList.remove( CLASS );
	}
	for ( const el of enter ) {
		el.classList.add( CLASS );
	}
	if ( events ) {
		if ( from && leave.length ) {
			fire( from, 'mouseout', to );
		}
		for ( const el of leave ) {
			told.delete( el );
			fire( el, 'mouseleave', to );
		}
		for ( const el of enter ) {
			told.add( el );
			fire( el, 'mouseenter', from );
		}
		if ( to && enter.length ) {
			fire( to, 'mouseover', from );
		}
	}
	chain = next;
}

/* the browser's own enter/leave: passed through when it is news, swallowed
   when the scripts were already told (our synthetic one went first); a
   capture listener on the document sees the non-bubbling ones too */
function dedupe( e ) {
	if ( ! e.isTrusted || ! ( e.target instanceof Element ) || ! e.target.closest( '.gcb-block' ) ) {
		return;
	}
	const entering = e.type === 'mouseenter';
	if ( entering ? told.has( e.target ) : ! told.has( e.target ) ) {
		e.stopImmediatePropagation();
		return;
	}
	if ( entering ) {
		told.add( e.target );
	} else {
		told.delete( e.target );
	}
	/* the browser went first: take its word for what is under the pointer,
	   silently, so the scroll's own settle finds nothing left to say */
	settle( false );
}

let raf = 0;
function onScroll() {
	if ( raf ) {
		return;
	}
	raf = requestAnimationFrame( () => {
		raf = 0;
		settle( true );
	} );
}

if ( typeof window !== 'undefined' && window.matchMedia( '(hover: hover)' ).matches ) {
	document.addEventListener(
		'pointermove',
		( e ) => {
			x = e.clientX;
			y = e.clientY;
			settle( false );
		},
		{ passive: true }
	);
	document.addEventListener(
		'pointerleave',
		() => {
			x = -1;
			y = -1;
			settle( false );
		},
		{ passive: true }
	);
	document.addEventListener( 'mouseenter', dedupe, true );
	document.addEventListener( 'mouseleave', dedupe, true );
	document.addEventListener( 'scroll', onScroll, { passive: true, capture: true } );
	window.addEventListener( 'scrollend', () => settle( true ), { passive: true } );
}
