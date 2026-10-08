/**
 * Accordion — the block's own small driver: each row's head toggles its body; one at a time when the block says so;
 * the first row open to start when it says so. With no script every row shows open.
 */
( function () {
	function setUp( root ) {
		if ( root.hasAttribute( 'data-gcb-ready' ) ) {
			return;
		}
		var items = Array.prototype.slice.call( root.children ).filter( function ( el ) {
			return el.classList.contains( 'gcb-accordion__item' );
		} );
		if ( ! items.length ) {
			return;
		}
		var single = root.getAttribute( 'data-single' ) === '1';
		var firstOpen = root.getAttribute( 'data-first-open' ) === '1';
		var rows = items.map( function ( item, i ) {
			var head = item.querySelector( ':scope > .gcb-accordion__head' );
			var body = item.querySelector( ':scope > .gcb-accordion__body' );
			if ( ! head || ! body ) {
				return null;
			}
			body.id = body.id || 'gcb-acc-' + Math.random().toString( 36 ).slice( 2, 8 ) + '-' + i;
			head.setAttribute( 'aria-controls', body.id );
			return { head: head, body: body };
		} ).filter( Boolean );
		function set( row, open ) {
			row.head.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
			row.body.hidden = ! open;
		}
		rows.forEach( function ( row, i ) {
			set( row, firstOpen && i === 0 );
			row.head.addEventListener( 'click', function () {
				var open = row.head.getAttribute( 'aria-expanded' ) !== 'true';
				if ( single && open ) {
					rows.forEach( function ( r ) {
						if ( r !== row ) { set( r, false ); }
					} );
				}
				set( row, open );
			} );
		} );
		root.setAttribute( 'data-gcb-ready', '' );
	}
	function all() {
		document.querySelectorAll( '[data-gcb-accordion]' ).forEach( setUp );
	}
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', all );
	} else {
		all();
	}
} )();
