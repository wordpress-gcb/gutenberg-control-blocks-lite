/**
 * THE KIT'S COLLAPSIBLE (2026-10-21: "Read more" under a listing's long description, "Show all 24 amenities" under its
 * first ten). Long content shown in part — its first lines, a set height, or its first items — and opened in place to
 * its whole height by a trigger whose words swap:
 *
 *   <div data-gcb-kit="collapsible" data-lines="4">
 *     <div>…the description…</div>
 *     <button type="button" data-gcb-kit-collapsible-trigger data-more="Show more" data-less="Show less">Show more</button>
 *   </div>
 *
 * How much shows shut: `data-lines="N"` (its first N lines of text, measured where they fall — paragraphs, a heading,
 * mixed sizes), `data-height="240"` (px), or `data-items="10"` (the first N of the list inside it: amenities, specs,
 * a long set of links — no fade, the cut falls between items). Lines and a height end on a soft fade.
 *
 * WHAT THE PART SAYS BESIDES (2026-10-26, the kit wears any drawing; each defaults to what it always did): a height in
 * any unit (`data-height="12rem"`, `"40vh"`); on a wide screen its own cut — `data-lines-md`, `data-height-md`,
 * `data-items-md` (from 768px, or `data-md="1024"`); `data-fade="none"` (a hard cut); `data-scroll="off"` (shutting
 * never brings the trigger back into view). The cut in use is said on the part: `data-cut="lines|height|items"`.
 *
 * Zag's collapsible (@zag-js/collapsible, MIT) keeps the open state, the trigger's aria-expanded / aria-controls and
 * the hidden part's links out of the Tab order while shut; the opening is the kit's expand motion. The content is the
 * part's one other child (or `[data-gcb-kit-collapsible-content]`; several children are wrapped in one). WITHOUT THE
 * SCRIPT everything shows and the trigger is out of sight. Content that fits in what shows needs no trigger: it hides.
 *
 * A sibling of the kit's accordion (gcb-pro kit/accordion): its trigger's aria-expanded for classes, an optional
 * `[data-gcb-kit-icon]` that turns when open, `gcbkit:change` { open } on the part, and `el.gcbKit.open()`, `.close()`,
 * `.toggle()`.
 */
import * as collapsible from '@zag-js/collapsible';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { kept } from '../_core/kept.js';

/* the part is live: its trigger shows, said on <html>, where no swap reaches */
document.documentElement.classList.add( 'gcb-kit-collapsible-on' );

const ROOT = '[data-gcb-kit="collapsible"]';
const TRIGGER = '[data-gcb-kit-collapsible-trigger]';
let made = 0;
const num = ( v ) => ( v === null || v === '' || Number.isNaN( parseFloat( v ) ) ? null : parseFloat( v ) );

/* the content: marked, else the part's one child that is not the trigger, else those children wrapped in one */
function contentOf( root ) {
	const marked = root.querySelector( '[data-gcb-kit-collapsible-content]' );
	if ( marked ) {
		return marked;
	}
	const kids = [ ...root.children ].filter( ( k ) => ! k.matches( TRIGGER ) && ! k.querySelector( TRIGGER ) && ! k.matches( 'style, script, template' ) );
	if ( ! kids.length ) {
		return null;
	}
	if ( kids.length === 1 ) {
		kids[ 0 ].setAttribute( 'data-gcb-kit-collapsible-content', '' );
		return kids[ 0 ];
	}
	const box = document.createElement( 'div' );
	box.setAttribute( 'data-gcb-kit-collapsible-content', '' );
	kids[ 0 ].before( box );
	box.append( ...kids );
	return box;
}

/* the lines of text inside a box, top to bottom: each its bottom, measured where the browser laid it */
function lineBottoms( box ) {
	const walk = document.createTreeWalker( box, NodeFilter.SHOW_TEXT, { acceptNode: ( n ) => ( n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT ) } );
	const range = document.createRange();
	const lines = [];
	for ( let n = walk.nextNode(); n; n = walk.nextNode() ) {
		range.selectNodeContents( n );
		/* a text's box is its glyphs'; its line is as tall as its line-height, the rest shared above and below */
		const cs = getComputedStyle( n.parentElement );
		const lh = parseFloat( cs.lineHeight ) || parseFloat( cs.fontSize ) * 1.2;
		for ( const g of range.getClientRects() ) {
			if ( ! g.height ) {
				continue;
			}
			const pad = Math.max( 0, ( lh - g.height ) / 2 );
			const r = { top: g.top - pad, bottom: g.bottom + pad };
			const same = lines.find( ( l ) => r.top < l.bottom - 1 && r.bottom > l.top + 1 );
			if ( same ) {
				same.top = Math.min( same.top, r.top );
				same.bottom = Math.max( same.bottom, r.bottom );
			} else {
				lines.push( r );
			}
		}
	}
	return lines.sort( ( a, b ) => a.top - b.top ).map( ( l ) => l.bottom );
}

/* the list inside a box: the first box (itself or within) holding more than n items */
function listOf( box, n ) {
	if ( box.children.length > n ) {
		return box;
	}
	return [ ...box.querySelectorAll( '*' ) ].find( ( el ) => el.children.length > n ) ?? null;
}

function live( root ) {
	if ( root.gcbKit ) {
		return;
	}
	const trigger = root.querySelector( TRIGGER );
	const content = contentOf( root );
	if ( ! trigger || ! content ) {
		return;
	}
	let stopped = false;
	/* the cut in use: the wide screen's own (any -md attribute) from data-md's width, else the part's */
	const wide = window.matchMedia( `(min-width: ${ num( root.getAttribute( 'data-md' ) ) ?? 768 }px)` );
	const hasWide = [ 'lines', 'height', 'items' ].some( ( k ) => root.hasAttribute( `data-${ k }-md` ) );
	const said = ( k ) => root.getAttribute( hasWide && wide.matches ? `data-${ k }-md` : `data-${ k }` );
	/* a height in px as written, or in any unit the browser measures (rem, vh, em) */
	const px = ( v ) => {
		if ( v === null || v.trim() === '' || /^\s*[\d.]+\s*(px)?\s*$/.test( v ) ) {
			return num( v );
		}
		const probe = document.createElement( 'div' );
		probe.style.cssText = 'position:absolute;visibility:hidden;width:0;height:' + v;
		root.append( probe );
		const h = probe.getBoundingClientRect().height;
		probe.remove();
		return h || null;
	};
	let lines = null;
	let height = null;
	let count = null;
	const cut = () => {
		lines = num( said( 'lines' ) );
		height = px( said( 'height' ) );
		count = num( said( 'items' ) );
		root.setAttribute( 'data-cut', count ? 'items' : lines ? 'lines' : 'height' );
	};
	const words = trigger.querySelector( '[data-gcb-kit-collapsible-words]' );
	const more = trigger.getAttribute( 'data-more' ) ?? ( words ?? trigger ).textContent.trim();
	const less = trigger.getAttribute( 'data-less' ) ?? 'Show less';

	/* how tall it is shut, measured as it lies now (null: nothing to hide) */
	let shut = null;
	const measure = () => {
		cut();
		const was = content.getAttribute( 'style' );
		/* the whole content, for a moment: Zag's shut height and the motion's last frame off */
		content.style.maxHeight = 'none';
		content.style.minHeight = '0';
		content.style.animation = 'none';
		const box = content.getBoundingClientRect();
		const top = box.top;
		let h = null;
		if ( count ) {
			const list = listOf( content, count );
			if ( list ) {
				const kids = [ ...list.children ];
				h = Math.max( ...kids.slice( 0, count ).map( ( k ) => k.getBoundingClientRect().bottom ) ) - top;
				/* the cut between the last shown and the first hidden: never a sliver of the next row */
				const next = kids.slice( count ).map( ( k ) => k.getBoundingClientRect().top - top );
				if ( next.length && Math.min( ...next ) < h ) {
					h = Math.min( ...next.filter( ( t ) => t > 0 ) );
				}
			}
		} else if ( lines ) {
			const b = lineBottoms( content );
			h = b.length > lines ? b[ lines - 1 ] - top : null;
		} else if ( height ) {
			h = height;
		}
		if ( was === null ) {
			content.removeAttribute( 'style' );
		} else {
			content.setAttribute( 'style', was );
		}
		shut = h !== null && box.height - h > 2 ? Math.ceil( h ) : null;
		root.toggleAttribute( 'data-fits', shut === null );
		trigger.hidden = shut === null;
	};
	measure();

	const id = 'gcb-collapsible-' + ++made;
	/* its props read live: the shut height follows a new measure */
	const service = new VanillaMachine( collapsible.machine, () => ( {
		id,
		/* the design's own ids kept (a link to #it, a label's for=); Zag names the rest */
		ids: { root: root.id || undefined, content: content.id || undefined, trigger: trigger.id || undefined },
		defaultOpen: root.hasAttribute( 'data-open' ),
		collapsedHeight: shut ?? undefined,
		onOpenChange: ( d ) => {
			root.dispatchEvent( new CustomEvent( 'gcbkit:change', { bubbles: true, detail: { open: d.open, item: root } } ) );
			/* shut again from far below: its trigger is brought back into view, where the reader was (data-scroll="off": left) */
			if ( ! d.open && root.getAttribute( 'data-scroll' ) !== 'off' ) {
				requestAnimationFrame( () => {
					const r = trigger.getBoundingClientRect();
					if ( r.top < 0 || r.bottom > innerHeight ) {
						setTimeout( () => trigger.scrollIntoView( { block: 'nearest', behavior: matchMedia( '(prefers-reduced-motion: reduce)' ).matches ? 'auto' : 'smooth' } ), 0 );
					}
				} );
			}
		},
	} ) );
	const api = () => collapsible.connect( service.service, normalizeProps );
	const render = () => {
		if ( stopped ) {
			return;
		}
		const a = api();
		spreadProps( root, a.getRootProps() );
		spreadProps( content, a.getContentProps() );
		spreadProps( trigger, a.getTriggerProps() );
		/* nothing to hide: the content whole, never hidden, whatever Zag's state */
		if ( shut === null ) {
			content.hidden = false;
		}
		const said = a.open ? less : more;
		const target = words ?? trigger;
		if ( target.textContent.trim() !== said ) {
			if ( words || ! trigger.firstElementChild ) {
				target.textContent = said;
			} else {
				/* the trigger's own words beside an icon: its first words swapped, the icon kept */
				const text = [ ...trigger.childNodes ].find( ( n ) => n.nodeType === 3 && n.textContent.trim() );
				if ( text ) {
					text.textContent = text.textContent.replace( text.textContent.trim(), said );
				}
			}
		}
	};
	service.subscribe( render );
	/* drawn once before it starts: Zag finds the content by the id drawn here as it starts (its shut part's links taken
	   out of the Tab order) */
	render();
	service.start();
	render();
	/* moved: the motion is for a press, never the page's first paint */
	trigger.addEventListener( 'click', () => root.setAttribute( 'data-moved', '' ) );

	const set = ( open ) => {
		root.setAttribute( 'data-moved', '' );
		api().setOpen( open );
	};
	root.gcbKit = { open: () => set( true ), close: () => set( false ), toggle: () => set( ! api().open ), get isOpen() {
		return api().open;
	} };

	/* laid out again (a wider screen, a font come in): measured again while shut */
	let due = 0;
	new ResizeObserver( () => {
		cancelAnimationFrame( due );
		due = requestAnimationFrame( () => {
			if ( stopped || api().open || service.service.state.matches( 'closing' ) ) {
				return;
			}
			const before = shut;
			measure();
			if ( before !== shut ) {
				render();
			}
		} );
	} ).observe( root );
	/* the wide screen's own cut, crossed into or out of: measured again while shut */
	if ( hasWide ) {
		wide.addEventListener( 'change', () => {
			if ( stopped || api().open ) {
				return;
			}
			const before = shut;
			measure();
			if ( before !== shut ) {
				render();
			}
		} );
	}

	kept(
		root,
		() => root.contains( trigger ) && content.hasAttribute( 'data-part' ),
		() => {
			stopped = true;
			service.stop();
			delete root.gcbKit;
			live( root );
		}
	);
}

function boot() {
	document.querySelectorAll( ROOT ).forEach( live );
}
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', boot );
} else {
	boot();
}
new MutationObserver( ( muts ) => {
	for ( const m of muts ) {
		for ( const n of m.addedNodes ) {
			if ( n.nodeType === 1 ) {
				( n.matches?.( ROOT ) ? [ n ] : [ ...( n.querySelectorAll?.( ROOT ) ?? [] ) ] ).forEach( live );
			}
		}
	}
} ).observe( document.documentElement, { childList: true, subtree: true } );
