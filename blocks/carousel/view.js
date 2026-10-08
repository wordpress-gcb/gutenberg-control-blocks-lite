/**
 * Carousel — the block's own small driver: arrows scroll the snap track a slide at a time, dots are built from the
 * slides and follow the scroll, autoplay (seconds on data-autoplay) pauses under the pointer and on focus.
 * No library; the track is CSS scroll-snap, so it works with no script too (swipe/scroll).
 */
( function () {
	function setUp( root ) {
		var track = root.querySelector( '.gcb-carousel__track' );
		if ( ! track || root.hasAttribute( 'data-gcb-ready' ) ) {
			return;
		}
		root.setAttribute( 'data-gcb-ready', '' );
		var slides = Array.prototype.slice.call( track.children );
		var dotsBox = root.querySelector( '.gcb-carousel__dots' );
		var arrows = root.querySelectorAll( '.gcb-carousel__arrow' );
		var dots = [];
		var current = 0;

		function perView() {
			var per = parseInt( getComputedStyle( root ).getPropertyValue( '--gcb-carousel-per' ), 10 ) || 1;
			return window.matchMedia( '(max-width: 781px)' ).matches ? 1 : per;
		}
		function pages() {
			return Math.max( 1, slides.length - perView() + 1 );
		}
		function goTo( i ) {
			i = Math.max( 0, Math.min( pages() - 1, i ) );
			if ( slides[ i ] ) {
				track.scrollTo( { left: slides[ i ].offsetLeft - track.offsetLeft, behavior: 'smooth' } );
			}
		}
		function paint() {
			dots.forEach( function ( d, i ) {
				d.setAttribute( 'aria-selected', i === current ? 'true' : 'false' );
			} );
			if ( arrows.length === 2 ) {
				arrows[ 0 ].disabled = current <= 0;
				arrows[ 1 ].disabled = current >= pages() - 1;
			}
		}
		function build() {
			if ( ! dotsBox ) {
				return;
			}
			dotsBox.innerHTML = '';
			dots = [];
			for ( var i = 0; i < pages(); i++ ) {
				var b = document.createElement( 'button' );
				b.type = 'button';
				b.className = 'gcb-carousel__dot';
				b.setAttribute( 'role', 'tab' );
				b.setAttribute( 'aria-label', 'Slide ' + ( i + 1 ) );
				b.addEventListener( 'click', goTo.bind( null, i ) );
				dotsBox.appendChild( b );
				dots.push( b );
			}
			paint();
		}
		Array.prototype.forEach.call( arrows, function ( a ) {
			a.addEventListener( 'click', function () {
				goTo( current + ( parseInt( a.getAttribute( 'data-dir' ), 10 ) || 1 ) );
			} );
		} );
		var ticking = false;
		track.addEventListener( 'scroll', function () {
			if ( ticking ) {
				return;
			}
			ticking = true;
			requestAnimationFrame( function () {
				ticking = false;
				var left = track.scrollLeft, best = 0, bestD = Infinity;
				slides.forEach( function ( s, i ) {
					var d = Math.abs( s.offsetLeft - track.offsetLeft - left );
					if ( d < bestD ) {
						bestD = d;
						best = i;
					}
				} );
				current = Math.min( best, pages() - 1 );
				paint();
			} );
		} );
		track.addEventListener( 'keydown', function ( e ) {
			if ( e.key === 'ArrowRight' ) {
				goTo( current + 1 );
			} else if ( e.key === 'ArrowLeft' ) {
				goTo( current - 1 );
			}
		} );
		window.addEventListener( 'resize', build );
		build();

		var every = parseInt( root.getAttribute( 'data-autoplay' ), 10 ) || 0;
		if ( every > 0 && ! window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) {
			var paused = false, timer;
			function tick() {
				if ( ! paused ) {
					goTo( current >= pages() - 1 ? 0 : current + 1 );
				}
			}
			timer = setInterval( tick, every * 1000 );
			[ 'mouseenter', 'focusin', 'touchstart' ].forEach( function ( ev ) {
				root.addEventListener( ev, function () { paused = true; }, { passive: true } );
			} );
			[ 'mouseleave', 'focusout' ].forEach( function ( ev ) {
				root.addEventListener( ev, function () { paused = false; } );
			} );
			document.addEventListener( 'visibilitychange', function () {
				paused = document.hidden || paused;
				if ( ! document.hidden && ! root.matches( ':hover' ) ) { paused = false; }
			} );
		}
	}
	function all() {
		document.querySelectorAll( '[data-gcb-carousel]' ).forEach( setUp );
	}
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', all );
	} else {
		all();
	}
} )();
