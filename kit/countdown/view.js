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
 *
 * WHAT THE PART SAYS BESIDES (2026-10-26, the kit wears any drawing; each defaults to what it always did):
 *   data-duration="15m"     no fixed moment: that long from the visitor's first sight (d, h, m, s: "1d12h"); with
 *                           data-persist (or data-persist="offer-a", a name shared by parts that are one offer) the same
 *                           moment on their every visit after, kept in the browser
 *   data-interval="60000"   how often it counts (ms; 1000)
 *   data-done-action        "hide" (the part goes once the time is up) or "reload" (the page again, when it ran out
 *                           while open)
 *   data-label="{time} to go", data-label-done="…"   the screen reader's words ("{time} left", "Time is up"); the
 *                           units' names in the page's language
 *   a slot's data-digits="2" (days unpadded, the rest two figures), a "weeks" slot, and a [data-gcb-kit-countdown-value]
 *   inside a slot: the number written there, the slot's other children kept
 */
import * as timer from '@zag-js/timer';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { kept } from '../_core/kept.js';

document.documentElement.classList.add( 'gcb-kit-countdown-on' );

const ROOT = '[data-gcb-kit="countdown"]';
const UNITS = { weeks: 604800, days: 86400, hours: 3600, minutes: 60, seconds: 1 };
const NAMES = { weeks: [ 'week', 'weeks' ], days: [ 'day', 'days' ], hours: [ 'hour', 'hours' ], minutes: [ 'minute', 'minutes' ], seconds: [ 'second', 'seconds' ] };
let made = 0;
/* a rolling moment, once worked out for a part: the same after a swap */
const ROLLING = new WeakMap();
const num = ( v ) => ( v === null || v === '' || ! Number.isFinite( Number( v ) ) ? null : Number( v ) );
/* "15m", "2h", "1d12h", "90" (seconds) — in ms; null when it says none */
function duration( v ) {
	const s = ( v || '' ).trim();
	if ( /^\d+(\.\d+)?$/.test( s ) ) {
		return Number( s ) * 1000;
	}
	const parts = [ ...s.matchAll( /(\d+(?:\.\d+)?)\s*([dhms])/g ) ];
	return parts.length ? parts.reduce( ( t, [ , n, u ] ) => t + Number( n ) * { d: 86400, h: 3600, m: 60, s: 1 }[ u ] * 1000, 0 ) : null;
}

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
/* a slot's figures: its data-digits, else days and weeks as they are and the rest two figures */
const said = ( unit, n, digits = null ) => String( n ).padStart( digits ?? ( unit === 'days' || unit === 'weeks' ? 1 : 2 ), '0' );
/* where a slot's number is written: its [data-gcb-kit-countdown-value], else itself */
const box = ( slot ) => slot.querySelector( '[data-gcb-kit-countdown-value]' ) ?? slot;

function live( root ) {
	if ( root.gcbKitCountdown ) {
		return;
	}
	let until = Date.parse( root.getAttribute( 'data-until' ) || '' );
	if ( Number.isNaN( until ) ) {
		/* no moment: a rolling one, from the visitor's first sight (kept in the browser with data-persist) */
		const span = duration( root.getAttribute( 'data-duration' ) );
		if ( ! span ) {
			return;
		}
		const key = root.hasAttribute( 'data-persist' ) ? 'gcb-countdown:' + ( root.getAttribute( 'data-persist' ) || location.pathname + ':' + root.getAttribute( 'data-duration' ) ) : null;
		let stored = null;
		try {
			stored = key ? num( localStorage.getItem( key ) ) : null;
		} catch {}
		until = ROLLING.get( root ) ?? stored ?? Date.now() + span;
		ROLLING.set( root, until );
		try {
			key && localStorage.setItem( key, String( until ) );
		} catch {}
	}
	const iso = () => root.getAttribute( 'data-until' ) || new Date( until ).toISOString();
	const every = Math.max( 100, num( root.getAttribute( 'data-interval' ) ) ?? 1000 );
	const lang = root.closest( '[lang]' )?.getAttribute( 'lang' ) || 'en';
	/* a unit's words in the page's language ("2 days", "2 jours"), English where the browser cannot */
	const named = ( u, n ) => {
		try {
			return new Intl.NumberFormat( lang, { style: 'unit', unit: u.slice( 0, -1 ), unitDisplay: 'long' } ).format( n );
		} catch {
			return `${ n } ${ NAMES[ u ][ n === 1 ? 0 : 1 ] }`;
		}
	};
	let counted = false;
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
			.map( ( [ u, n ] ) => named( u, n ) )
			.join( ' ' );
	const done = () => {
		const action = root.getAttribute( 'data-done-action' );
		if ( action === 'hide' ) {
			root.hidden = true;
		}
		if ( root.hasAttribute( 'data-done' ) ) {
			return;
		}
		root.setAttribute( 'data-done', '' );
		root.dispatchEvent( new CustomEvent( 'gcbkit:change', { bubbles: true, detail: { done: true, until: iso() } } ) );
		/* ran out while it was open: the page again (never on a page drawn already done — no loop) */
		if ( action === 'reload' && counted ) {
			setTimeout( () => location.reload(), 0 );
		}
	};
	function render() {
		if ( stopped ) {
			return;
		}
		const ms = left();
		const time = split( ms, units );
		slots.forEach( ( s, i ) => {
			const text = said( units[ i ], time[ units[ i ] ] ?? 0, num( s.getAttribute( 'data-digits' ) ) );
			const at = box( s );
			if ( at.textContent !== text ) {
				at.textContent = text;
			}
			wrote.set( s, text );
		} );
		if ( service ) {
			spreadProps( area, timer.connect( service.service, normalizeProps ).getAreaProps() );
		}
		area.setAttribute( 'aria-label', ms > 0 ? ( root.getAttribute( 'data-label' ) || '{time} left' ).replace( '{time}', words( time ) ) : root.getAttribute( 'data-label-done' ) || 'Time is up' );
		if ( ms > 0 ) {
			counted = true;
		}
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
			const from = Math.max( every, Math.round( left() / every ) * every );
			service = new VanillaMachine( timer.machine, {
				id: 'gcb-countdown-' + ++made,
				ids: { area: area.id || undefined },
				countdown: true,
				startMs: from,
				targetMs: 0,
				interval: every,
				autoStart: true,
				onTick: render,
				/* Zag's count can end a frame before the clock's moment: said when the clock gets there */
				onComplete: () => setTimeout( render, Math.max( 0, left() ) + 16 ),
			} );
			service.start();
			render();
		}, ms % every );
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
		() => slots.every( ( s ) => root.contains( s ) && box( s ).textContent === wrote.get( s ) ) && ( left() <= 0 ) === root.hasAttribute( 'data-done' ),
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
