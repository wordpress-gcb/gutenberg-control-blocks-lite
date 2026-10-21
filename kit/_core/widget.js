/**
 * THE KIT'S WIDGET PANEL (2026-10-21, Mark: "the dropdowns are kind of widgets more than actual dropdown like text … what
 * we want is a beautiful consistent feel around the site. considered, and polished" — and "are we reinventing the
 * wheel?": the behaviour is Zag's popover, @zag-js/popover, MIT). Every part that a field opens — the calendar's two
 * months, the guests counter — opens the same panel, the same way:
 *
 *   - beside what opens it (Zag: under it, flipped over it where there is no room, slid to stay on the screen, its
 *     height fitted to the screen's — the panel scrolls inside itself past that), at its start or end edge (`side`);
 *   - in the top layer: its positioner a popover (drawn `popover="manual"` by the server where a swap could undo it),
 *     above every section whatever stacks them;
 *   - shut by Escape or a press outside it and its fields (Zag's dismissable), the focus back where it was;
 *   - a sheet from the bottom on a phone (kit/_core/widget.css).
 *
 * Its look — the surface, radius, shadow, padding — is widget.css's `[data-gcb-kit-widget]`. The interface is the kit's
 * own (open, close, isOpen, place, stop), so the parts never speak Zag's.
 *
 * @param {HTMLElement} panel  what opens (its content)
 * @param {HTMLElement} anchor what it opens beside (a field, or the part round several)
 * @param {Object} [o]
 * @param {'start'|'end'} [o.side]  which edge of the anchor it lines up with
 * @param {() => HTMLElement[]} [o.keep] presses on these do not shut it (the fields that open it)
 * @param {() => void} [o.closed] told when it shuts
 * @param {boolean} [o.focus]  the focus goes into it when it opens (a counter's −/+), or stays (a calendar's fields)
 */
import * as popover from '@zag-js/popover';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';

/* numbered once for the page, whichever part's script makes it: each part's bundle carries its own copy of this file,
   and two "gcb-widget-1"s sent Zag to the wrong box (2026-10-21: the booking card's guests opened at the page's corner) */
const next = () => ( window.__gcbKitWidgets = ( window.__gcbKitWidgets || 0 ) + 1 );

export function widget( panel, anchor, { side = 'end', keep = () => [ anchor ], closed = () => {}, focus = false } = {} ) {
	/* its positioner: the box Zag places — drawn by the server, else made round the panel */
	let positioner = panel.parentElement && panel.parentElement.hasAttribute( 'data-gcb-kit-widget-positioner' ) ? panel.parentElement : null;
	if ( ! positioner ) {
		positioner = document.createElement( 'div' );
		positioner.setAttribute( 'data-gcb-kit-widget-positioner', '' );
		panel.replaceWith( positioner );
		positioner.appendChild( panel );
	}
	if ( ! positioner.hasAttribute( 'popover' ) ) {
		positioner.setAttribute( 'popover', 'manual' );
	}
	panel.setAttribute( 'data-gcb-kit-widget', '' );

	const id = 'gcb-widget-' + next();
	/* the ids the page gave its parts are kept (a label's for, a script's own lookup); Zag makes up the rest */
	const ids = Object.fromEntries( [ [ 'anchor', anchor ], [ 'content', panel ], [ 'positioner', positioner ] ].filter( ( [ , e ] ) => e.id ).map( ( [ k, e ] ) => [ k, e.id ] ) );
	let wasOpen = false;
	const service = new VanillaMachine( popover.machine, {
		id,
		ids,
		modal: false,
		portalled: false,
		autoFocus: focus,
		closeOnEscape: true,
		closeOnInteractOutside: true,
		persistentElements: keep().map( ( k ) => () => k ), // the fields that open it: a press on them is not outside
		positioning: {
			placement: side === 'start' ? 'bottom-start' : 'bottom-end',
			gutter: 8,
			strategy: 'fixed', // the screen's coordinates: what the top layer is placed in
			flip: true,
			slide: true,
			fitViewport: true,
			overflowPadding: 16,
		},
	} );
	const api = () => popover.connect( service.service, normalizeProps );

	/* the top layer while open */
	const layer = ( open ) => {
		if ( typeof positioner.showPopover !== 'function' ) {
			return;
		}
		const shown = positioner.matches( ':popover-open' );
		try {
			if ( open && ! shown ) {
				positioner.showPopover();
			} else if ( ! open && shown ) {
				positioner.hidePopover();
			}
		} catch {
			/* not connected mid-swap: shown on the next open */
		}
	};
	const render = () => {
		const a = api();
		spreadProps( anchor, a.getAnchorProps() );
		spreadProps( positioner, a.getPositionerProps() );
		spreadProps( panel, a.getContentProps() );
		layer( a.open );
		panel.toggleAttribute( 'data-open', a.open );
		if ( wasOpen && ! a.open ) {
			closed();
		}
		wasOpen = a.open;
	};
	service.subscribe( render );
	service.start();
	render();

	return {
		open: () => {
			layer( true ); // first, so Zag measures it where it will show
			api().setOpen( true );
		},
		close: () => api().setOpen( false ),
		isOpen: () => api().open,
		place: () => api().reposition(),
		stop: () => service.stop(),
	};
}
