/**
 * Tabs — the block's own small driver: the printed strip becomes a tablist (click, arrow keys, Home/End); every panel
 * but the open one is hidden. With no script every panel shows under its title.
 */
( function () {
	function setUp( root ) {
		if ( root.hasAttribute( 'data-gcb-ready' ) ) {
			return;
		}
		var tabs = Array.prototype.slice.call( root.querySelectorAll( ':scope > .gcb-tabs__list > .gcb-tabs__tab' ) );
		var panelsBox = root.querySelector( ':scope > .gcb-tabs__panels' );
		if ( ! tabs.length || ! panelsBox ) {
			return;
		}
		var panels = Array.prototype.slice.call( panelsBox.children ).filter( function ( p ) {
			return p.classList.contains( 'gcb-tabs__panel' );
		} );
		var id = root.getAttribute( 'data-gcb-tabs' ) || 'gcb-tabs';
		function show( i ) {
			tabs.forEach( function ( t, k ) {
				var on = k === i;
				t.setAttribute( 'aria-selected', on ? 'true' : 'false' );
				t.setAttribute( 'tabindex', on ? '0' : '-1' );
			} );
			panels.forEach( function ( p, k ) {
				p.hidden = k !== i;
				p.id = id + '-panel-' + k;
				p.setAttribute( 'aria-labelledby', id + '-tab-' + k );
			} );
		}
		tabs.forEach( function ( t, i ) {
			t.addEventListener( 'click', function () {
				show( i );
			} );
			t.addEventListener( 'keydown', function ( e ) {
				var n = i;
				if ( e.key === 'ArrowRight' ) { n = ( i + 1 ) % tabs.length; }
				else if ( e.key === 'ArrowLeft' ) { n = ( i - 1 + tabs.length ) % tabs.length; }
				else if ( e.key === 'Home' ) { n = 0; }
				else if ( e.key === 'End' ) { n = tabs.length - 1; }
				else { return; }
				e.preventDefault();
				show( n );
				tabs[ n ].focus();
			} );
		} );
		root.setAttribute( 'data-gcb-ready', '' );
		show( 0 );
	}
	function all() {
		document.querySelectorAll( '[data-gcb-tabs]' ).forEach( setUp );
	}
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', all );
	} else {
		all();
	}
} )();
