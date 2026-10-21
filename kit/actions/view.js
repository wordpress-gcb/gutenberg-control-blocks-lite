/**
 * THE KIT'S ACTIONS MENU (2026-10-21: a card's "⋯" — Share, Save, Report; a "Sort by" whose choices go to their
 * address; an account menu — Trips, Wishlists, Log out). Things to DO, never a value a form sends: that is the select
 * (kit/select), whose list this one's is, row for row. The behaviour is Zag's menu (@zag-js/menu, MIT): the arrows,
 * Home and End, typeahead, Enter and Space, Escape, a press outside, the focus back on the trigger, the screen reader's
 * words (a menu of menuitems). The interface is ours:
 *
 *   <div data-gcb-kit="actions" [data-align="end"]>
 *     <button type="button" data-gcb-kit-actions-trigger aria-label="More">⋯</button>
 *     <div data-gcb-kit-actions-list>
 *       <a data-gcb-kit-actions-item href="/share">Share</a>              ← a link: goes to its address
 *       <button type="button" data-gcb-kit-actions-item>Save</button>      ← a button: does what it does (its onclick, a
 *       <hr data-gcb-kit-actions-separator>                                  data-gcb-toast, a dialog's opener)
 *       <div data-gcb-kit-actions-group><span data-gcb-kit-actions-label>Account</span>…items…</div>
 *     </div>
 *   </div>
 *
 * An item that is where the visitor is (the sort in use) says aria-current="page" and is drawn as the select's chosen
 * option. data-tone="danger" on an item (Report, Delete) draws it in the error colour.
 *
 * THE TOP LAYER IS THE SELECT'S, NOT THE WIDGET PANEL'S: the panel is Zag's popover, a dialog — no menu roles, no
 * arrows between items, no typeahead — and a menu inside it would be two machines dismissing and placing one box. Zag's
 * menu places its own positioner; that box is drawn by the server (Actions.php, the select's Select.php) as a popover
 * the script shows while the menu is open, so no section's overflow or stacking clips it and a router swap keeps it.
 */
import * as menu from '@zag-js/menu';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';

/* the part is live, said on <html>, where no swap reaches */
document.documentElement.classList.add( 'gcb-kit-actions-on' );

const ROOT = '[data-gcb-kit="actions"]';
/* numbered once for the page, whichever bundle (kit/_core/widget.js's rule) */
const next = () => ( window.__gcbKitActions = ( window.__gcbKitActions || 0 ) + 1 );

/* what Zag says of an element, written again whole (after a swap took it away): spreadProps writes only what changed */
const assert = ( el, props ) =>
	Object.entries( props ).forEach( ( [ k, v ] ) => {
		if ( k.startsWith( 'on' ) ) {
			return;
		}
		if ( k === 'style' ) {
			Object.entries( v || {} ).forEach( ( [ p, val ] ) => {
				const prop = p.startsWith( '--' ) ? p : p.replace( /[A-Z]/g, ( m ) => '-' + m.toLowerCase() );
				val === undefined || val === null ? el.style.removeProperty( prop ) : el.style.setProperty( prop, String( val ) );
			} );
			return;
		}
		if ( typeof v === 'object' && v !== null ) {
			return;
		}
		const name = k === 'tabIndex' ? 'tabindex' : k;
		if ( typeof v === 'boolean' && name.startsWith( 'aria-' ) ) {
			el.setAttribute( name, String( v ) );
		} else if ( v === undefined || v === null || v === false ) {
			el.removeAttribute( name );
		} else {
			el.setAttribute( name, v === true ? '' : String( v ) );
		}
	} );

function live( root ) {
	if ( root.gcbKitActions || root.closest( '.editor-styles-wrapper' ) ) {
		return;
	}
	const trigger = root.querySelector( '[data-gcb-kit-actions-trigger]' );
	const list = root.querySelector( '[data-gcb-kit-actions-list]' );
	if ( ! trigger || ! list ) {
		return;
	}
	/* its box: drawn by the server (Actions.php); made here only for a menu drawn some other way */
	let positioner = list.parentElement?.hasAttribute( 'data-gcb-kit-actions-positioner' ) ? list.parentElement : null;
	if ( ! positioner ) {
		positioner = document.createElement( 'div' );
		positioner.setAttribute( 'data-gcb-kit-actions-positioner', '' );
		list.replaceWith( positioner );
		positioner.appendChild( list );
	}
	if ( ! positioner.hasAttribute( 'popover' ) ) {
		positioner.setAttribute( 'popover', 'manual' );
	}
	/* a trigger inside a form never sends it */
	if ( trigger.tagName === 'BUTTON' && ! trigger.hasAttribute( 'type' ) ) {
		trigger.type = 'button';
	}

	const id = 'gcb-actions-' + next();
	const ids = Object.fromEntries( [ [ 'trigger', trigger ], [ 'content', list ], [ 'positioner', positioner ] ].filter( ( [ , e ] ) => e.id ).map( ( [ k, e ] ) => [ k, e.id ] ) );
	const service = new VanillaMachine( menu.machine, {
		id,
		ids,
		loopFocus: true,
		typeahead: true,
		closeOnSelect: true,
		positioning: {
			placement: root.getAttribute( 'data-align' ) === 'end' ? 'bottom-end' : 'bottom-start',
			gutter: 6, // the select's
			strategy: 'fixed', // the screen's coordinates: the top layer's
			flip: true,
			slide: true,
			overflowPadding: 16,
		},
	} );
	const api = () => menu.connect( service.service, normalizeProps );

	/* its parts, read each time (a list redrawn keeps working): each item's value its own, else its place */
	const parts = () => {
		const items = [ ...list.querySelectorAll( '[data-gcb-kit-actions-item]' ) ].map( ( el, i ) => ( {
			el,
			value: el.getAttribute( 'data-gcb-kit-actions-item' ) || 'item-' + i,
			disabled: el.matches( ':disabled, [aria-disabled="true"], [data-disabled]' ),
		} ) );
		const groups = [ ...list.querySelectorAll( '[data-gcb-kit-actions-group]' ) ].map( ( el, i ) => ( { el, id: id + '-group-' + i, label: el.querySelector( '[data-gcb-kit-actions-label]' ) } ) );
		const seps = [ ...list.querySelectorAll( '[data-gcb-kit-actions-separator]' ) ];
		return { items, groups, seps };
	};
	const props = () => {
		const a = api();
		const { items, groups, seps } = parts();
		return [
			[ trigger, a.getTriggerProps() ],
			[ positioner, a.getPositionerProps() ],
			[ list, a.getContentProps() ],
			...items.map( ( it ) => [ it.el, a.getItemProps( { value: it.value, disabled: it.disabled, valueText: it.el.textContent.trim() } ) ] ),
			...groups.map( ( g ) => [ g.el, a.getItemGroupProps( { id: g.id } ) ] ),
			...groups.filter( ( g ) => g.label ).map( ( g ) => [ g.label, a.getItemGroupLabelProps( { htmlFor: g.id } ) ] ),
			...seps.map( ( s ) => [ s, a.getSeparatorProps() ] ),
		];
	};
	/* the items are rows Zag moves through (aria-activedescendant): never Tab's own stops */
	const unstop = () => list.querySelectorAll( '[data-gcb-kit-actions-item]' ).forEach( ( el ) => el.tabIndex !== -1 && ( el.tabIndex = -1 ) );

	const layer = ( open ) => {
		if ( typeof positioner.showPopover !== 'function' ) {
			return;
		}
		try {
			const shown = positioner.matches( ':popover-open' );
			if ( open && ! shown ) {
				positioner.showPopover();
			} else if ( ! open && shown ) {
				positioner.hidePopover();
			}
		} catch {
			/* not connected mid-swap: settled after it */
		}
	};
	let wasOpen = false;
	const render = () => {
		const a = api();
		layer( a.open ); // before Zag measures it
		props().forEach( ( [ el, p ] ) => spreadProps( el, p ) );
		unstop();
		root.toggleAttribute( 'data-open', a.open );
		if ( a.open && ! wasOpen ) {
			a.reposition();
		}
		wasOpen = a.open;
	};
	service.subscribe( render );
	service.start();
	render();

	/* AFTER A SWAP (the router puts back the server's attributes on the very elements it keeps): Zag's words written
	   again, and an open menu placed again */
	const settle = () => {
		if ( ! root.isConnected ) {
			return;
		}
		if ( root.querySelector( '[data-gcb-kit-actions-list]' ) !== list || list.parentElement !== positioner ) {
			/* the list was drawn anew: this menu is made again round it */
			service.stop();
			delete root.gcbKitActions;
			live( root );
			return;
		}
		props().forEach( ( [ el, p ] ) => assert( el, p ) );
		unstop();
		const a = api();
		layer( a.open );
		if ( a.open ) {
			a.reposition();
		}
	};
	document.addEventListener( 'gcbkit:swapped', () => requestAnimationFrame( settle ) );

	root.gcbKitActions = { open: () => ( layer( true ), api().setOpen( true ) ), close: () => api().setOpen( false ), isOpen: () => api().open, stop: () => service.stop() };
}

function boot() {
	document.querySelectorAll( ROOT ).forEach( live );
}
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', boot );
} else {
	boot();
}
/* a menu drawn later (a card added to a list, a dialog's content) comes alive when it lands */
new MutationObserver( ( muts ) => {
	for ( const m of muts ) {
		for ( const n of m.addedNodes ) {
			if ( n.nodeType === 1 ) {
				( n.matches?.( ROOT ) ? [ n ] : [ ...( n.querySelectorAll?.( ROOT ) ?? [] ) ] ).forEach( live );
			}
		}
	}
} ).observe( document.documentElement, { childList: true, subtree: true } );
