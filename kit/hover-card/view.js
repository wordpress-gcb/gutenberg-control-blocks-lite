/**
 * THE KIT'S HOVER CARD (2026-10-21: a host's card over their name, a mini listing over a map pin, an author's bio — a
 * richer preview than a tooltip: a picture, a few lines, a link). The behaviour is Zag's hover card (@zag-js/hover-card,
 * MIT): open after a moment on a pointer over its trigger or on keyboard focus, kept open while the pointer crosses
 * into it, shut a moment after it leaves both, by Escape or a press outside; placed under its trigger (flipped where
 * there is no room, slid to stay on the screen). The interface is ours:
 *
 *   <a href="/hosts/maria" data-gcb-kit-hover-card>Maria</a>
 *   <div data-gcb-kit-hover-card-content><img …><p>Superhost · 6 years hosting</p><a href="/hosts/maria">View profile</a></div>
 *
 * the trigger a link (where a press goes), the card the element right after it. data-place="top" (left, right) puts
 * it on another side. Its box is a popover in the top layer, so no section's overflow or stacking clips it.
 *
 * THE KEYBOARD: focus on the trigger opens it; Tab from the trigger goes into the card's own links (the card's place
 * in the page is right after its trigger), Escape shuts it with the focus back on the trigger, Tab past the card shuts it.
 * A TOUCH SCREEN never hovers: a tap is a press on the link, which goes to its address, and no card shows (Zag skips
 * touch pointers; the focus a tap gives is not taken for the keyboard's either). The card adds, never hides: what it
 * says is on the page the link goes to.
 *
 * ITS BEHAVIOUR, on the trigger (2026-10-26, the kit wears the drawing): data-place any side with an end — "top-start",
 * "bottom-end", "right-start" …; data-open-delay (500, ms) and data-close-delay (250); data-gutter (8px from the
 * trigger) and data-overflow-padding (16px from the screen's edge). A CARD ELSEWHERE (a grid cell, a list beside a map):
 * data-gcb-kit-hover-card="#its-id" (or aria-controls) on the trigger links it; its place in the page stays where it was
 * drawn. A [data-gcb-kit-hover-card-positioner] the design drew round the card is used as its box (its classes kept).
 */
import * as hoverCard from '@zag-js/hover-card';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';

document.documentElement.classList.add( 'gcb-kit-hover-card-on' );

const ROOT = '[data-gcb-kit-hover-card]';
const PLACE = /^(top|bottom|left|right)(-(start|end))?$/;
/* a number the trigger says, else today's */
const ms = ( el, name, d ) => {
	const n = parseFloat( el.getAttribute( name ) ?? '' );
	return Number.isFinite( n ) && n >= 0 ? n : d;
};
const next = () => ( window.__gcbKitHoverCards = ( window.__gcbKitHoverCards || 0 ) + 1 );
const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select, textarea, [tabindex]:not([tabindex="-1"])';

function live( trigger ) {
	if ( trigger.gcbKitHoverCard || trigger.closest( '.editor-styles-wrapper' ) ) {
		return;
	}
	/* the card: the one the trigger names (an id, or aria-controls), else the element right after it */
	const named = ( trigger.getAttribute( 'data-gcb-kit-hover-card' ) || '' ).replace( /^#/, '' ) || trigger.getAttribute( 'aria-controls' ) || '';
	const linked = named ? document.getElementById( named ) : null;
	const content = linked?.matches( '[data-gcb-kit-hover-card-content]' )
		? linked
		: trigger.nextElementSibling?.matches( '[data-gcb-kit-hover-card-content]' )
		? trigger.nextElementSibling
		: null;
	if ( ! content ) {
		return;
	}
	/* its box: a positioner Zag places, in the top layer, where the card was drawn (so its links follow the trigger in
	   the page's order) — the design's when it drew one round the card */
	let positioner = content.parentElement?.matches( '[data-gcb-kit-hover-card-positioner]' ) ? content.parentElement : null;
	if ( ! positioner ) {
		positioner = document.createElement( 'div' );
		positioner.setAttribute( 'data-gcb-kit-hover-card-positioner', '' );
		content.replaceWith( positioner );
		positioner.append( content );
	}
	positioner.setAttribute( 'popover', 'manual' );
	if ( ! trigger.matches( FOCUSABLE ) ) {
		trigger.tabIndex = 0;
	}

	/* A TAP IS NOT A HOVER: the focus a touch gives the link never opens the card. Heard before Zag's own (added first) */
	let touched = 0;
	trigger.addEventListener( 'pointerdown', ( e ) => {
		touched = e.pointerType === 'touch' || e.pointerType === 'pen' ? Date.now() : 0;
	} );
	/* (Zag hears focusin and focusout, the bubbling pair: these are heard first, on the same element) */
	trigger.addEventListener( 'focusin', ( e ) => {
		if ( touched && Date.now() - touched < 800 ) {
			e.stopImmediatePropagation();
		}
	} );
	/* THE FOCUS GOES INTO THE CARD: leaving the trigger for the card is not leaving (Zag shuts it on the trigger's blur) */
	trigger.addEventListener( 'focusout', ( e ) => {
		if ( e.relatedTarget && content.contains( e.relatedTarget ) ) {
			e.stopImmediatePropagation();
		}
	} );

	const place = trigger.getAttribute( 'data-place' ) || '';
	const ids = Object.fromEntries( [ [ 'trigger', trigger ], [ 'content', content ] ].filter( ( [ , e ] ) => e.id ).map( ( [ k, e ] ) => [ k, e.id ] ) );
	const service = new VanillaMachine( hoverCard.machine, {
		id: 'gcb-hover-card-' + next(),
		ids,
		openDelay: ms( trigger, 'data-open-delay', 500 ),
		closeDelay: ms( trigger, 'data-close-delay', 250 ),
		positioning: {
			placement: PLACE.test( place ) ? place : 'bottom',
			gutter: ms( trigger, 'data-gutter', 8 ),
			strategy: 'fixed',
			flip: true,
			slide: true,
			overflowPadding: ms( trigger, 'data-overflow-padding', 16 ),
		},
	} );
	const api = () => hoverCard.connect( service.service, normalizeProps );
	const layer = ( open ) => {
		try {
			const shown = positioner.matches( ':popover-open' );
			if ( open && ! shown ) {
				positioner.showPopover();
			} else if ( ! open && shown ) {
				positioner.hidePopover();
			}
		} catch {
			/* not connected mid-swap */
		}
	};
	let wasOpen = false;
	const render = () => {
		const a = api();
		const inCard = content.contains( document.activeElement ); // read before the card is hidden takes the focus away
		layer( a.open );
		spreadProps( trigger, a.getTriggerProps() );
		spreadProps( positioner, a.getPositionerProps() );
		spreadProps( content, a.getContentProps() );
		/* shut with the focus in the card (Escape): the focus back on the trigger, never lost to the page */
		if ( wasOpen && ! a.open && inCard ) {
			trigger.focus( { preventScroll: true } );
		}
		wasOpen = a.open;
	};
	/* the focus leaving the card for anywhere but its trigger shuts it */
	content.addEventListener( 'focusout', ( e ) => {
		const to = e.relatedTarget;
		if ( to && ( content.contains( to ) || to === trigger ) ) {
			return;
		}
		api().setOpen( false );
	} );
	/* a keyboard user, open: Tab from the trigger goes to the card's first link */
	trigger.addEventListener( 'keydown', ( e ) => {
		if ( e.key === 'Tab' && ! e.shiftKey && api().open ) {
			const first = content.querySelector( FOCUSABLE );
			if ( first ) {
				e.preventDefault();
				first.focus();
			}
		}
	} );
	service.subscribe( render );
	service.start();
	render();

	trigger.gcbKitHoverCard = { open: () => ( layer( true ), api().setOpen( true ) ), close: () => api().setOpen( false ), isOpen: () => api().open, stop: () => service.stop() };
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
