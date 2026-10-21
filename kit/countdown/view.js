/**
 * THE KIT'S COUNTDOWN (2026-10-21: "Sale ends in 2d 04h 12m", "Doors open in…", "Offer closes"). The time left to a
 * moment, in slots the design draws, counted down each second:
 *
 *   <div data-gcb-kit="countdown" data-until="2026-12-01T09:00:00+10:30">
 *     <p data-gcb-kit-countdown-left>Sale ends in <b data-gcb-kit-countdown-part="days">2</b>d
 *       <b data-gcb-kit-countdown-part="hours">04</b>h <b data-gcb-kit-countdown-part="minutes">12</b>m</p>
 *     <p data-gcb-kit-countdown-done>The sale has ended</p>
 *   </div>
 *
 * THE MOMENT is data-until, an ISO 8601 time; its offset is the truth (the server gives one written without an offset
 * the site's: Countdown.php), so every visitor, in any time zone, counts to the same moment.
 *
 * SAID ON THE SERVER FIRST (Countdown.php): the slots hold the time left as the page is drawn, and the part is marked
 * data-done if it is up — a page with no script, the editor and a router swap say something true. This counts on from
 * the visitor's clock, on Zag's timer (@zag-js/timer, MIT) — its ticks on the second, the area a `role="timer"` named
 * by the time left. The largest slot drawn holds the time above it (no days: 50 hours), the smallest is rounded up (no
 * seconds: 12m 30s says 13m), so it says 0 only when the time is up. Then the part is marked data-done (its done shown,
 * its left hidden: style.css) and says `gcbkit:change` { done: true, until }.
 */
import * as timer from '@zag-js/timer';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { kept } from '../_core/kept.js';

document.documentElement.classList.add( 'gcb-kit-countdown-on' );

const ROOT = '[data-gcb-kit="countdown"]';
const UNITS = { days: 86400, hours: 3600, minutes: 60, seconds: 1 };
const NAMES = { days: [ 'day', 'days' ], hours: [ 'hour', 'hours' ], minutes: [ 'minute', 'minutes' ], seconds: [ 'second', 'seconds' ] };
let made = 0;

/* the time left (ms) in the slots drawn, as Countdown.php splits it */
function split( leftMs, units ) {
	const have = Object.keys( UNITS ).filter( ( u ) => units.includes( u ) );
	const out = Object.fromEntries( have.map( ( u ) => [ u, 0 ] ) );
	if ( ! have.length || leftMs <= 0 ) {
		return out;
	}
	const small = UNITS[ have.at( -1 ) ];
	let left = Math.ceil( leftMs / 1000 / small ) * small;
	for ( const u of have ) {
		out[ u ] = Math.floor( left / UNITS[ u ] );
		left -= out[ u ] * UNITS[ u ];
	}
	return out;
}
const said = ( unit, n ) => ( unit === 'days' ? String( n ) : String( n ).padStart( 2, '0' ) );

function live( root ) {
	if ( root.gcbKitCountdown ) {
		return;
	}
	const until = Date.parse( root.getAttribute( 'data-until' ) || '' );
	if ( Number.isNaN( until ) ) {
		return;
	}
	let stopped = false;
	const slots = [ ...root.querySelectorAll( '[data-gcb-kit-countdown-part]' ) ].filter( ( s ) => s.closest( ROOT ) === root );
	const units = slots.map( ( s ) => s.getAttribute( 'data-gcb-kit-countdown-part' ) );
	const area = root.querySelector( '[data-gcb-kit-countdown-left]' ) ?? root;
	const wrote = new Map();
	const left = () => until - Date.now();
	let service = null;
	let wait = 0;

	const words = ( time ) =>
		Object.entries( time )
			.filter( ( [ , n ], i, all ) => n > 0 || i === all.length - 1 )
			.map( ( [ u, n ] ) => `${ n } ${ NAMES[ u ][ n === 1 ? 0 : 1 ] }` )
			.join( ' ' );
	const done = () => {
		if ( root.hasAttribute( 'data-done' ) ) {
			return;
		}
		root.setAttribute( 'data-done', '' );
		root.dispatchEvent( new CustomEvent( 'gcbkit:change', { bubbles: true, detail: { done: true, until: root.getAttribute( 'data-until' ) } } ) );
	};
	function render() {
		if ( stopped ) {
			return;
		}
		const ms = left();
		const time = split( ms, units );
		slots.forEach( ( s, i ) => {
			const text = said( units[ i ], time[ units[ i ] ] ?? 0 );
			if ( s.textContent !== text ) {
				s.textContent = text;
			}
			wrote.set( s, text );
		} );
		if ( service ) {
			spreadProps( area, timer.connect( service.service, normalizeProps ).getAreaProps() );
		}
		area.setAttribute( 'aria-label', ms > 0 ? words( time ) + ' left' : 'Time is up' );
		if ( ms <= 0 ) {
			done();
			stop();
		} else {
			root.removeAttribute( 'data-done' );
		}
	}
	const stop = () => {
		clearTimeout( wait );
		service?.stop();
		service = null;
	};
	/* the ticks on the second: started as the time left crosses a whole second, then every second after (the shown time is
	   always the clock's, so a tab put to sleep says the truth when it wakes) */
	const start = () => {
		stop();
		const ms = left();
		if ( ms <= 0 ) {
			return render();
		}
		wait = setTimeout( () => {
			if ( stopped ) {
				return;
			}
			const from = Math.max( 1000, Math.round( left() / 1000 ) * 1000 );
			service = new VanillaMachine( timer.machine, {
				id: 'gcb-countdown-' + ++made,
				ids: { area: area.id || undefined },
				countdown: true,
				startMs: from,
				targetMs: 0,
				interval: 1000,
				autoStart: true,
				onTick: render,
				/* Zag's count can end a frame before the clock's moment: said when the clock gets there */
				onComplete: () => setTimeout( render, Math.max( 0, left() ) + 16 ),
			} );
			service.start();
			render();
		}, ms % 1000 );
	};
	render();
	start();
	area.setAttribute( 'role', 'timer' );
	document.addEventListener( 'visibilitychange', () => ! stopped && document.visibilityState === 'visible' && ( render(), left() > 0 && start() ) );

	root.gcbKitCountdown = {
		get left() {
			return Math.max( 0, left() );
		},
		get done() {
			return left() <= 0;
		},
	};
	/* a router swap (the server's markup put back, its time as it was drawn): counted again from the clock */
	kept(
		root,
		() => slots.every( ( s ) => root.contains( s ) && s.textContent === wrote.get( s ) ) && ( left() <= 0 ) === root.hasAttribute( 'data-done' ),
		() => {
			stopped = true;
			stop();
			delete root.gcbKitCountdown;
			live( root );
		}
	);
	document.addEventListener( 'gcbkit:swapped', () => ! stopped && root.isConnected && requestAnimationFrame( render ) );
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
