/**
 * THE KIT'S TOAST (2026-10-21: "Saved to your list", "Enquiry sent" — a brief message that comes and goes by itself).
 * The behaviour is Zag's toast (@zag-js/toast, MIT): a queue, its time, paused while the pointer or the focus is on
 * it, Escape on it, a screen reader told (a polite live region). The interface is the kit's: the AI writes markup and
 * there is no app code, so a toast is asked for four ways —
 *
 *   <button data-gcb-toast="Saved to your list">          pressing it shows it (a submit button: when its form is sent)
 *   <form data-gcb-toast="Enquiry sent">                  its form sent
 *   <p data-gcb-toast-now>Thanks — we'll be in touch</p>  a message on the page shows as a toast when it appears (a
 *                                                         form's success message: the value, else its words)
 *   el.dispatchEvent(new CustomEvent('gcbkit:toast', { bubbles: true, detail: { title, description, type } }))
 *
 * with data-gcb-toast-description="…" for a second, quieter line, and data-gcb-toast-type="success" (a tick, the
 * default) | "info" (no mark) | "error". The kit's saved list says "saved" with data-gcb-toast-saved (gcb-pro kit/saved).
 *
 * ONE REGION for the page, made here, at the foot of the screen: a popover in the top layer, so no section's stacking
 * hides it — and moved into an open modal dialog (a drawer's enquiry form), where the page behind is inert and a live
 * region outside it is neither seen above it nor read.
 *
 * RECONFIGURED BY THE DRAWING (2026-10-26, the kit wears the drawing). On the asking element, beside its words:
 *   data-gcb-toast-type          "warning" too: the error's "!" in the warning colour (--gcb-toast-warning)
 *   data-gcb-toast-duration      how long it stays, in ms ("4000" today; "0" or "none": until it is shut)
 *   data-gcb-toast-closable      "false": no ×, it goes by itself (or by Escape)
 *   data-gcb-toast-action        an action's words ("Undo"): a link to data-gcb-toast-action-href, else pressing it says
 *                                `gcbkit:toast-action` { label, title } on the element that asked, and the toast goes
 * And for the page, a drawn `<div data-gcb-kit-toast-region>` (anywhere, once) is the region, with data-placement
 * ("bottom" today; top, top-start, top-end, bottom-start, bottom-end), data-max (3), data-duration (4000), data-gap
 * (12), data-offset ("24px") and aria-label ("Notifications") read off it as the page starts.
 */
import * as toast from '@zag-js/toast';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';

document.documentElement.classList.add( 'gcb-kit-toast-on' );

const CLOSE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const el = ( tag, attrs = {} ) => {
	const e = document.createElement( tag );
	Object.entries( attrs ).forEach( ( [ k, v ] ) => e.setAttribute( k, v ) );
	return e;
};

/* how long, read off an attribute: ms, or none (0, "none", "infinite": until shut); undefined: the region's */
const lasting = ( v ) => {
	if ( v === null || v === undefined || v === '' ) {
		return undefined;
	}
	const n = Number( v );
	return /^(none|infinite|0)$/i.test( String( v ).trim() ) ? Infinity : Number.isFinite( n ) && n > 0 ? n : undefined;
};
const PLACES = [ 'top-start', 'top', 'top-end', 'bottom-start', 'bottom', 'bottom-end' ];

function make() {
	/* the region: the drawing's own, its settings read off it, else the kit's at the foot of the screen */
	const region = document.querySelector( '[data-gcb-kit-toast-region]' ) || el( 'div', { 'data-gcb-kit-toast-region': '' } );
	region.setAttribute( 'popover', 'manual' );
	const setting = ( a ) => region.getAttribute( a );
	const label = setting( 'aria-label' ) || setting( 'data-label' ) || 'Notifications';
	const store = toast.createStore( {
		placement: PLACES.includes( setting( 'data-placement' ) ) ? setting( 'data-placement' ) : 'bottom',
		overlap: false,
		max: parseInt( setting( 'data-max' ) || '', 10 ) || 3,
		duration: lasting( setting( 'data-duration' ) ) ?? 4000,
		gap: Number( setting( 'data-gap' ) ) || 12,
		offsets: setting( 'data-offset' ) || '24px',
		removeDelay: 400,
	} );
	const group = new VanillaMachine( toast.group.machine, { id: 'gcb-toasts', store } );
	const items = new Map();

	/* where the region lives: the open modal dialog the visitor is in, else the page */
	const host = () => [ ...document.querySelectorAll( 'dialog' ) ].filter( ( d ) => d.matches( ':modal' ) ).pop() || document.body;
	const shown = () => region.matches( ':popover-open' );
	const layer = ( on, again = false ) => {
		try {
			if ( on && again && shown() ) {
				region.hidePopover(); // shown again, so it is above what opened since (the top layer is in the order shown)
			}
			if ( on && ! shown() ) {
				region.showPopover();
			} else if ( ! on && shown() ) {
				region.hidePopover();
			}
		} catch {
			/* not connected: shown when it is */
		}
	};
	const place = () => {
		const h = host();
		if ( region.parentElement !== h ) {
			h.append( region );
		}
		layer( items.size > 0, true );
	};

	const draw = ( item ) => {
		const a = toast.connect( item.service.service, normalizeProps );
		spreadProps( item.root, a.getRootProps() );
		spreadProps( item.before, a.getGhostBeforeProps() );
		spreadProps( item.after, a.getGhostAfterProps() );
		spreadProps( item.title, a.getTitleProps() );
		spreadProps( item.desc, a.getDescriptionProps() );
		spreadProps( item.close, a.getCloseTriggerProps() );
		if ( item.action ) {
			const { type, ...props } = a.getActionTriggerProps();
			spreadProps( item.action, item.action.tagName === 'BUTTON' ? { type, ...props } : props );
		}
		/* its words written only when they change: Zag measures the card on every change inside it, and tells the group */
		const words = ( e, w ) => e.textContent !== w && ( e.textContent = w );
		words( item.title, a.title || '' );
		words( item.desc, a.description || '' );
		if ( item.desc.hidden !== ! a.description ) {
			item.desc.hidden = ! a.description;
		}
	};
	const render = () => {
		const g = toast.group.connect( group.service, normalizeProps );
		spreadProps( region, g.getGroupProps( { label } ) );
		const list = g.getToasts();
		const ids = new Set( list.map( ( t ) => t.id ) );
		for ( const [ id, item ] of items ) {
			if ( ! ids.has( id ) ) {
				item.service.stop();
				item.root.remove();
				items.delete( id );
			}
		}
		list.forEach( ( t, index ) => {
			let item = items.get( t.id );
			if ( item ) {
				/* told again only when its place or its words changed: each telling makes Zag measure it again */
				if ( item.index !== index || item.t !== t ) {
					item.index = index;
					item.t = t;
					item.service.updateProps( { ...t, parent: group.service, index } );
				}
				draw( item ); // its place reads the group's heights: drawn again whenever the group changes
				return;
			}
			const root = el( 'div', { 'data-gcb-kit-toast': '' } );
			item = {
				root,
				before: el( 'div' ),
				after: el( 'div' ),
				mark: el( 'span', { 'data-gcb-kit-toast-mark': '', 'aria-hidden': 'true' } ),
				words: el( 'div', { 'data-gcb-kit-toast-words': '' } ),
				title: el( 'p', { 'data-gcb-kit-toast-title': '' } ),
				desc: el( 'p', { 'data-gcb-kit-toast-description': '' } ),
				close: el( 'button', { 'data-gcb-kit-toast-close': '' } ),
				action: t.action ? el( t.action.href ? 'a' : 'button', { 'data-gcb-kit-toast-action': '' } ) : null,
				index,
				t,
			};
			item.close.innerHTML = CLOSE;
			item.words.append( item.title, item.desc );
			root.append( item.before, item.mark, item.words );
			if ( item.action ) {
				item.action.textContent = t.action.label;
				if ( t.action.href ) {
					item.action.href = t.action.href;
				}
				root.append( item.action );
			}
			if ( t.closable !== false ) {
				root.append( item.close );
			}
			root.append( item.after );
			item.service = new VanillaMachine( toast.machine, { ...t, parent: group.service, index } );
			item.service.subscribe( () => draw( item ) );
			items.set( t.id, item );
			region.append( root );
			item.service.start();
			draw( item );
		} );
		if ( ! list.length ) {
			layer( false );
		}
	};
	group.subscribe( render );
	group.start();
	place();
	render();
	/* a dialog shut with the region in it: the region goes back to the page, its toasts still showing */
	document.addEventListener( 'close', ( e ) => e.target === region.parentElement && setTimeout( place ), true );

	/** @param {{title?: string, description?: string, type?: string, duration?: number, closable?: boolean, action?: {label: string, href?: string, onClick?: Function}}} d */
	const show = ( d = {} ) => {
		const title = String( d.title ?? '' ).trim();
		const description = String( d.description ?? '' ).trim();
		if ( ! title && ! description ) {
			return;
		}
		/* in place first, so the live region is there before its words */
		const h = host();
		if ( region.parentElement !== h ) {
			h.append( region );
		}
		layer( true, true );
		store.create( {
			title,
			description: description || undefined,
			type: d.type || 'success',
			duration: d.duration,
			closable: d.closable !== false,
			...( d.action?.label ? { action: d.action } : {} ),
		} );
	};
	return { show, store, region };
}

const kit = ( window.__gcbKitToast ||= make() );

/* what the words are, read off an element */
const said = ( e, attr = 'data-gcb-toast' ) => {
	const title = e.getAttribute( attr ) || ( attr === 'data-gcb-toast-now' ? e.textContent : '' );
	const label = ( e.getAttribute( 'data-gcb-toast-action' ) || '' ).trim();
	const href = e.getAttribute( 'data-gcb-toast-action-href' ) || '';
	return {
		title,
		description: e.getAttribute( 'data-gcb-toast-description' ) || '',
		type: e.getAttribute( 'data-gcb-toast-type' ) || 'success',
		duration: lasting( e.getAttribute( 'data-gcb-toast-duration' ) ),
		closable: e.getAttribute( 'data-gcb-toast-closable' ) !== 'false',
		action: label
			? { label, href: href || undefined, onClick: () => ! href && e.dispatchEvent( new CustomEvent( 'gcbkit:toast-action', { bubbles: true, detail: { label, title: String( title ).trim() } } ) ) }
			: undefined,
	};
};
const submits = ( e ) => !! e.form && ( e.type === 'submit' || ( e.tagName === 'BUTTON' && ! e.getAttribute( 'type' ) ) );

document.addEventListener( 'gcbkit:toast', ( e ) => kit.show( e.detail || {} ) );
document.addEventListener( 'click', ( e ) => {
	const t = e.target.closest?.( '[data-gcb-toast]' );
	if ( ! t || t.tagName === 'FORM' || submits( t ) || t.matches( ':disabled, [aria-disabled="true"]' ) ) {
		return;
	}
	kit.show( said( t ) );
} );
/* a form sent (its own, or its submit button's words): not when the browser refused it — then no submit comes */
document.addEventListener( 'submit', ( e ) => {
	const t = e.submitter?.closest( '[data-gcb-toast]' ) || ( e.target.matches( '[data-gcb-toast]' ) ? e.target : null );
	if ( t ) {
		kit.show( said( t ) );
	}
} );
/* a message on the page: once, when it appears (the page loaded with it, or a swap or a script put it there) */
const told = new Set();
const now = ( root ) =>
	( root.matches?.( '[data-gcb-toast-now]' ) ? [ root ] : [ ...( root.querySelectorAll?.( '[data-gcb-toast-now]' ) ?? [] ) ] ).forEach( ( m ) => {
		const d = said( m, 'data-gcb-toast-now' );
		const key = d.title.trim() + '|' + d.description;
		if ( ! told.has( key ) ) {
			told.add( key );
			kit.show( d );
		}
	} );
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', () => now( document ) );
} else {
	now( document );
}
new MutationObserver( ( muts ) => muts.forEach( ( m ) => m.addedNodes.forEach( ( n ) => n.nodeType === 1 && n !== kit.region && ! kit.region.contains( n ) && now( n ) ) ) ).observe( document.documentElement, { childList: true, subtree: true } );
