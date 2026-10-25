/**
 * THE KIT'S SEGMENTED TOGGLE (2026-10-21: Buy / Rent over a search, grid / list / map over results, per night / per
 * week over prices, monthly / annual over plans). One choice of a few, all in sight, on a track with a thumb that
 * slides to the chosen one — the kit filter's `data-look="segments"`, made a part of its own:
 *
 *   <div data-gcb-kit="segmented" data-gcb-kit-segmented-shows>
 *     <label><input type="radio" name="view" value="grid" checked>Grid</label>
 *     <label><input type="radio" name="view" value="list">List</label>
 *   </div>
 *   <div data-gcb-kit-pane="grid">…</div>  <div data-gcb-kit-pane="list" >…</div>
 *
 * THE NATIVE RADIOS STAY THE TRUTH: a form sends the chosen one (FormData), the browser's own arrows move between
 * them, a page that reads them reads the choice. Zag's radio group (@zag-js/radio-group, MIT) measures the chosen
 * segment for the thumb and keeps the radios, the labels' states and a form's reset as one. Without the script the
 * track and the chosen segment are still drawn (style.css, from the checked radio); the thumb is what the script adds.
 *
 * A PAGE SWITCH: every change says `gcbkit:change` { value, name } on the part. With `data-gcb-kit-segmented-shows`
 * the part also shows the `[data-gcb-kit-pane="<value>"]` that match the choice and hides the rest of its values' panes
 * — among the part's siblings and their insides (no value), or inside the box a selector names
 * (`data-gcb-kit-segmented-shows="#results"`, the nearest box round the part that matches it, else the page's first).
 * Many panes may share a value: every card's "per week" price.
 *
 * RECONFIGURED BY THE DRAWING (2026-10-26, the kit wears the drawing): `data-orientation="vertical"` stacks the segments
 * (the thumb slides up and down); `data-allow-none` lets the chosen one be pressed again to choose none (the change
 * says value null, every pane hides, the form sends nothing). A segment the drawing gave classes is stamped
 * data-gcb-own here (a label is no control the server stamps), so its classes are its look; a drawn
 * `[data-gcb-kit-segmented-thumb]` is used as the thumb, its classes kept. A radio joined to its label by for= is moved
 * into it, and the thumb is the track's first child.
 */
import * as radio from '@zag-js/radio-group';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { kept } from '../_core/kept.js';

/* the part is live: said on <html>, where no swap reaches */
document.documentElement.classList.add( 'gcb-kit-segmented-on' );

const ROOT = '[data-gcb-kit="segmented"]';
let made = 0;

/* the panes this part shows and hides: its values' panes in its scope, none of them inside the part itself */
function panes( root, values ) {
	if ( ! root.hasAttribute( 'data-gcb-kit-segmented-shows' ) ) {
		return [];
	}
	const where = ( root.getAttribute( 'data-gcb-kit-segmented-shows' ) || '' ).trim();
	let scope = root.parentElement;
	if ( where ) {
		try {
			scope = root.closest( where ) || document.querySelector( where ) || scope;
		} catch {
			/* not a selector: the siblings */
		}
	}
	return scope ? [ ...scope.querySelectorAll( '[data-gcb-kit-pane]' ) ].filter( ( p ) => ! root.contains( p ) && values.includes( p.getAttribute( 'data-gcb-kit-pane' ) ) ) : [];
}

function live( root ) {
	if ( root.gcbKitSegmented ) {
		return;
	}
	let stopped = false;
	const inputs = [ ...root.querySelectorAll( 'input[type="radio"]' ) ].filter( ( i ) => i.closest( ROOT ) === root );
	if ( inputs.length < 2 ) {
		return;
	}
	/* each radio in its label — a label beside it, joined by for=, takes it in (Zag names the radio's id) */
	const items = inputs.map( ( input ) => {
		let label = input.closest( 'label' );
		if ( ! label || ! root.contains( label ) ) {
			label = input.id ? root.querySelector( `label[for="${ CSS.escape( input.id ) }"]` ) : null;
			if ( label ) {
				label.prepend( input );
			}
		}
		if ( label ) {
			label.setAttribute( 'data-gcb-kit-segment', '' );
			/* the drawing's classes, as written (never the pointer's gcb-hover): the segment is its own */
			if ( [ ...label.classList ].some( ( c ) => c !== 'gcb-hover' ) ) {
				label.setAttribute( 'data-gcb-own', '' );
			}
		}
		return { input, label, value: input.value, disabled: input.disabled };
	} );
	const values = items.map( ( x ) => x.value );
	const name = inputs[ 0 ].name || undefined;
	/* one is always chosen: the checked radio, else the first — or none, where the drawing allows none */
	const none = root.hasAttribute( 'data-allow-none' );
	const vertical = root.getAttribute( 'data-orientation' ) === 'vertical';
	const start = none ? items.find( ( x ) => x.input.checked )?.value ?? null : ( items.find( ( x ) => x.input.checked ) ?? items.find( ( x ) => ! x.disabled ) ?? items[ 0 ] ).value;
	const thumb = root.querySelector( ':scope > [data-gcb-kit-segmented-thumb]' ) ?? document.createElement( 'span' );
	thumb.setAttribute( 'data-gcb-kit-segmented-thumb', '' );
	thumb.setAttribute( 'aria-hidden', 'true' );
	if ( ! thumb.parentElement ) {
		root.prepend( thumb );
	}

	const show = ( value ) => {
		panes( root, values ).forEach( ( p ) => {
			p.hidden = p.getAttribute( 'data-gcb-kit-pane' ) !== value;
		} );
	};
	const service = new VanillaMachine( radio.machine, {
		id: 'gcb-segmented-' + ++made,
		name,
		ids: { root: root.id || undefined }, // the design's id kept
		orientation: vertical ? 'vertical' : 'horizontal',
		defaultValue: start,
		disabled: root.hasAttribute( 'data-disabled' ) || undefined,
		onValueChange: ( d ) => {
			if ( stopped ) {
				return;
			}
			show( d.value );
			root.dispatchEvent( new CustomEvent( 'gcbkit:change', { bubbles: true, detail: { value: d.value, name } } ) );
		},
	} );
	const api = () => radio.connect( service.service, normalizeProps );
	const render = () => {
		if ( stopped ) {
			return;
		}
		const a = api();
		spreadProps( root, a.getRootProps() );
		spreadProps( thumb, a.getIndicatorProps() );
		items.forEach( ( x ) => {
			const p = { value: x.value, disabled: x.disabled };
			if ( x.label ) {
				spreadProps( x.label, a.getItemProps( p ) );
			}
			const { 'aria-labelledby': _named, ...own } = a.getItemHiddenInputProps( p );
			spreadProps( x.input, own );
			/* named by the label round it, not by a part of Zag's this draws none of */
			x.input.removeAttribute( 'aria-labelledby' );
		} );
		/* the root is the group, named by nothing of Zag's either: by the design's aria-label if it gives one */
		if ( ! root.querySelector( `[id="${ a.getLabelProps().id }"]` ) ) {
			root.removeAttribute( 'aria-labelledby' );
		}
	};
	service.subscribe( render );
	/* drawn once before it starts: Zag measures the chosen segment for the thumb as it starts, by the ids drawn here */
	render();
	service.start();
	render();
	/* none allowed: the chosen one pressed again lets go (a radio pressed when checked says nothing of its own) */
	if ( none ) {
		items.forEach( ( x ) => {
			let was = false;
			x.label?.addEventListener( 'pointerdown', () => ( was = x.input.checked ) );
			x.label?.addEventListener( 'click', ( e ) => {
				if ( was && ! stopped && ! x.disabled ) {
					was = false;
					e.preventDefault();
					api().clearValue();
					items.forEach( ( y ) => ( y.input.checked = false ) );
				}
			} );
		} );
	}
	/* the radios as the page starts: the chosen one checked (a form sends it), its pane shown */
	items.forEach( ( x ) => ( x.input.checked = x.value === start ) );
	show( start );
	root.gcbKitSegmented = { service, set: ( v ) => api().setValue( String( v ) ), get value() {
		return api().value;
	} };

	/* a router swap that takes the thumb or the radios' states: started again over the server's markup, and its panes
	   shown again (a swap puts back their `hidden` as the server drew it) */
	kept(
		root,
		() => root.contains( thumb ) && inputs.every( ( i ) => root.contains( i ) && i.hasAttribute( 'data-ownedby' ) ),
		() => {
			stopped = true;
			service.stop();
			delete root.gcbKitSegmented;
			live( root );
		}
	);
	document.addEventListener( 'gcbkit:swapped', () => ! stopped && root.isConnected && requestAnimationFrame( () => show( api().value ) ) );
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
