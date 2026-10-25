/**
 * THE KIT'S TOOLTIP (2026-10-21: what an icon means, what a cleaning fee covers, what an energy rating is — a short
 * explanation beside the thing it explains). The behaviour is Zag's tooltip (@zag-js/tooltip, MIT): open on hover after
 * a moment and on keyboard focus at once, shut on leaving, blur, Escape, a press or a scroll, one open at a time, its
 * place on the screen (over its trigger, flipped where there is no room, slid to stay on it). The interface is ours:
 *
 *   <button type="button" data-gcb-kit-tooltip="Covers a full clean between stays">ⓘ</button>
 *   <button type="button" data-gcb-kit-tooltip>Energy rating B</button><span data-gcb-kit-tooltip-content>…</span>
 *
 * the words in the attribute, or in the element after it (data-gcb-kit-tooltip-content, words the design wrote and
 * may style). data-place="bottom" (right, left) puts it on another side. A touch screen has no hover: a tap opens it,
 * and a tap anywhere else, or on it again, shuts it. Its box is a popover in the top layer, so no section's stacking
 * or overflow cuts it. An icon-only trigger with no name is named by its tooltip, for a screen reader.
 *
 * RECONFIGURED BY THE DRAWING (2026-10-26, the kit wears the drawing), each on the trigger, today's without it:
 *   data-place        top (today), bottom, left, right, each with -start or -end ("bottom-start": under it, from its start)
 *   data-open-delay   ms before a hover opens it (250); data-close-delay ms before leaving shuts it (100)
 *   data-gutter       px between it and its trigger (8)
 *   data-arrow="off"  no arrow (a flat label)
 * A drawn [data-gcb-kit-tooltip-arrow] inside the words is the arrow (taken out beside them, its classes kept), else
 * the kit makes one; words the design styled colour the arrow with their own ground. The words, made from the
 * attribute or written after the trigger, sit in a popover the kit makes beside the trigger (an extra sibling there).
 */
import * as tooltip from '@zag-js/tooltip';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';

/* the part is live: the hidden words stay hidden on <html>, where no swap reaches */
document.documentElement.classList.add( 'gcb-kit-tooltip-on' );

const ROOT = '[data-gcb-kit-tooltip]';
const SIDES = { top: 1, bottom: 1, left: 1, right: 1 };
const PLACE = /^(top|bottom|left|right)(-(start|end))?$/;
const ms = ( v, d ) => ( v !== null && v !== '' && Number.isFinite( Number( v ) ) && Number( v ) >= 0 ? Number( v ) : d );
/* numbered once for the page, whichever bundle (kit/_core/widget.js's rule) */
const next = () => ( window.__gcbKitTooltips = ( window.__gcbKitTooltips || 0 ) + 1 );
const el = ( tag, attrs = {} ) => {
	const e = document.createElement( tag );
	Object.entries( attrs ).forEach( ( [ k, v ] ) => e.setAttribute( k, v ) );
	return e;
};
const FOCUSABLE = 'button, a[href], input, select, textarea, summary, [tabindex]';

function live( trigger ) {
	if ( trigger.gcbKitTooltip || trigger.closest( '.editor-styles-wrapper' ) ) {
		return;
	}
	const words = ( trigger.getAttribute( 'data-gcb-kit-tooltip' ) || '' ).trim();
	let content = trigger.nextElementSibling?.matches( '[data-gcb-kit-tooltip-content]' ) ? trigger.nextElementSibling : null;
	if ( ! content && ! words ) {
		return;
	}
	if ( ! content ) {
		content = el( 'span', { 'data-gcb-kit-tooltip-content': '' } );
		content.textContent = words;
		trigger.after( content );
	}
	/* its box: a positioner Zag places, in the top layer, the arrow in it — the drawing's arrow if it drew one, none
	   with data-arrow="off" */
	const positioner = el( 'span', { 'data-gcb-kit-tooltip-positioner': '', popover: 'manual' } );
	const drawnArrow = content.querySelector( '[data-gcb-kit-tooltip-arrow]' );
	const arrow = trigger.getAttribute( 'data-arrow' ) === 'off' ? null : drawnArrow ?? el( 'span', { 'data-gcb-kit-tooltip-arrow': '' } );
	drawnArrow?.remove();
	const tip = arrow ? arrow.querySelector( '[data-gcb-kit-tooltip-arrow-tip]' ) ?? el( 'span', { 'data-gcb-kit-tooltip-arrow-tip': '' } ) : null;
	if ( arrow && ! tip.parentElement ) {
		arrow.append( tip );
	}
	content.replaceWith( positioner );
	positioner.append( ...( arrow ? [ arrow ] : [] ), content );

	/* reachable by the keyboard, and named, whatever the design wrote it as */
	if ( ! trigger.matches( FOCUSABLE ) ) {
		trigger.tabIndex = 0;
	}
	if ( ! trigger.textContent.trim() && ! trigger.hasAttribute( 'aria-label' ) && ! trigger.hasAttribute( 'aria-labelledby' ) ) {
		trigger.setAttribute( 'aria-label', content.textContent.trim() );
	}

	const place = ( trigger.getAttribute( 'data-place' ) || '' ).trim();
	const ids = Object.fromEntries( [ [ 'trigger', trigger ], [ 'content', content ] ].filter( ( [ , e ] ) => e.id ).map( ( [ k, e ] ) => [ k, e.id ] ) );
	const service = new VanillaMachine( tooltip.machine, {
		id: 'gcb-tooltip-' + next(),
		ids,
		openDelay: ms( trigger.getAttribute( 'data-open-delay' ), 250 ),
		closeDelay: ms( trigger.getAttribute( 'data-close-delay' ), 100 ),
		positioning: { placement: SIDES[ place ] || PLACE.test( place ) ? place : 'top', gutter: ms( trigger.getAttribute( 'data-gutter' ), 8 ), strategy: 'fixed', flip: true, slide: true, overflowPadding: 12 },
	} );
	const api = () => tooltip.connect( service.service, normalizeProps );
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
	/* words the design styled: the arrow wears their ground, read once they are shown (the token stays for the rest) */
	let worn = false;
	const wear = () => {
		if ( worn || ! arrow || ! content.hasAttribute( 'data-gcb-own' ) ) {
			return;
		}
		worn = true;
		const bg = getComputedStyle( content ).backgroundColor;
		if ( bg && bg !== 'transparent' && ! /^rgba\(.*,\s*0\)$/.test( bg ) ) {
			positioner.style.setProperty( '--arrow-background', bg );
		}
	};
	const render = () => {
		const a = api();
		spreadProps( trigger, a.getTriggerProps() );
		spreadProps( positioner, a.getPositionerProps() );
		if ( arrow ) {
			spreadProps( arrow, a.getArrowProps() );
			spreadProps( tip, a.getArrowTipProps() );
		}
		spreadProps( content, a.getContentProps() );
		layer( a.open );
		if ( a.open ) {
			wear();
		}
	};
	service.subscribe( render );
	service.start();
	render();

	/* A TAP: a touch screen never hovers, so a tap opens it (Zag shuts it on a press) and a tap again shuts it */
	let touch = false;
	let was = false;
	trigger.addEventListener(
		'pointerdown',
		( e ) => {
			touch = e.pointerType === 'touch' || e.pointerType === 'pen';
			was = api().open;
		},
		true
	);
	trigger.addEventListener( 'click', () => {
		if ( touch ) {
			layer( ! was );
			api().setOpen( ! was );
		}
	} );
	/* a tap anywhere else shuts it */
	document.addEventListener(
		'pointerdown',
		( e ) => {
			if ( trigger.isConnected && api().open && ! trigger.contains( e.target ) ) {
				api().setOpen( false );
			}
		},
		true
	);
	trigger.gcbKitTooltip = { open: () => ( layer( true ), api().setOpen( true ) ), close: () => api().setOpen( false ), stop: () => service.stop() };
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
