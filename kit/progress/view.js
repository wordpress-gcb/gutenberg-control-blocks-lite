/**
 * THE KIT'S PROGRESS (2026-10-21: "$12,400 of $20,000 raised", "Profile 60% complete", "Step 2 of 4", "4 of 10 spots
 * left"). A goal or a completion, drawn as a bar (the default) or a ring (`data-shape="circle"`):
 *
 *   <div data-gcb-kit="progress" data-value="12400" data-max="20000"><p>$12,400 raised of $20,000</p></div>
 *   <div data-gcb-kit="progress"><span data-gcb-field="complete" data-gcb-field-type="number">60</span>% complete</div>
 *
 * THE VALUE: data-value and data-max; else the design's words inside the part (a record's number field) — the first
 * number the value, a "%" after it out of 100, else the second number the most, else 100 (as Progress.php reads it).
 *
 * DRAWN ON THE SERVER (Progress.php), at its value: the first paint, no script, the editor and a router swap all show
 * it. This draws it only where the server did not, and connects Zag's progress (@zag-js/progress, MIT) to it: the track
 * a progressbar with its aria values, the range at its share (the part's `--percent`). A value the page sets
 * (`el.gcbKitProgress.set(n)`), or words that change (a swap with a new total), move the fill; a bar below the fold is
 * held empty until it is seen, then fills (style.css plays the fill; the tokens' reduced motion stills it).
 */
import * as progress from '@zag-js/progress';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { kept } from '../_core/kept.js';

document.documentElement.classList.add( 'gcb-kit-progress-on' );

const ROOT = '[data-gcb-kit="progress"]';
const DRAWN = '[data-scope="progress"]:is([data-part="track"], [data-part="circle"])';
let made = 0;

/* a number as a design writes it: "12,400" twelve thousand, "4,5" four and a half */
const number = ( s ) => {
	let t = String( s ?? '' ).replace( /[\s  ]/g, '' );
	if ( t === '' ) {
		return null;
	}
	t = /^\d{1,3}(,\d{3})+(\.\d+)?$/.test( t ) ? t.replace( /,/g, '' ) : t.replace( /,/g, '.' );
	return t !== '' && ! Number.isNaN( Number( t ) ) ? Number( t ) : null;
};
const said = ( n ) => String( Math.round( n * 10000 ) / 10000 );
/* its words, each piece apart ("Uploading 45%", not "Uploading45%"), a "$" kept to its number — as Progress.php */
const words = ( root ) => {
	const bits = [];
	const walk = document.createTreeWalker( root, NodeFilter.SHOW_TEXT );
	while ( walk.nextNode() ) {
		bits.push( walk.currentNode.nodeValue );
	}
	return bits
		.join( ' ' )
		.replace( /\s+/g, ' ' )
		.trim()
		.replace( /([$£€¥#])\s+(?=\d)/g, '$1' )
		.replace( /\s+([%.,:;!?)])/g, '$1' )
		.replace( /([(])\s+/g, '$1' );
};

/* [value, max] from the attributes or the words */
function value( root ) {
	let v = root.hasAttribute( 'data-value' ) ? number( root.getAttribute( 'data-value' ) ) : null;
	let m = root.hasAttribute( 'data-max' ) ? number( root.getAttribute( 'data-max' ) ) : null;
	if ( v === null || m === null ) {
		const nums = [ ...words( root ).matchAll( /\d[\d,.  ]*\s*(%)?/g ) ]
			.map( ( f ) => [ number( f[ 0 ].replace( /\s*%$/, '' ).replace( /[.,]+$/, '' ) ), !! f[ 1 ] ] )
			.filter( ( f ) => f[ 0 ] !== null );
		if ( v === null && nums.length ) {
			v = nums[ 0 ][ 0 ];
		}
		if ( m === null ) {
			m = nums.length && nums[ 0 ][ 1 ] ? 100 : nums[ 1 ]?.[ 0 ] ?? 100;
		}
	}
	m = m > 0 ? m : 100;
	return [ Math.min( m, Math.max( 0, v ?? 0 ) ), m ];
}

/* the bar or the ring, where the server drew none: in the design's [data-gcb-kit-progress-bar], else at the end */
function draw( root, id ) {
	let slot = root.querySelector( '[data-gcb-kit-progress-bar]' );
	if ( ! slot ) {
		slot = document.createElement( 'span' );
		slot.setAttribute( 'data-gcb-kit-progress-bar', '' );
		root.append( slot );
	}
	if ( root.getAttribute( 'data-shape' ) === 'circle' ) {
		const svg = document.createElementNS( 'http://www.w3.org/2000/svg', 'svg' );
		svg.setAttribute( 'data-scope', 'progress' );
		svg.setAttribute( 'data-part', 'circle' );
		svg.id = id + '-circle';
		for ( const part of [ 'circle-track', 'circle-range' ] ) {
			const c = document.createElementNS( 'http://www.w3.org/2000/svg', 'circle' );
			c.setAttribute( 'data-scope', 'progress' );
			c.setAttribute( 'data-part', part );
			svg.append( c );
		}
		slot.replaceChildren( svg );
		return svg;
	}
	const range = document.createElement( 'span' );
	range.setAttribute( 'data-scope', 'progress' );
	range.setAttribute( 'data-part', 'range' );
	slot.setAttribute( 'data-scope', 'progress' );
	slot.setAttribute( 'data-part', 'track' );
	slot.id = id + '-track';
	slot.replaceChildren( range );
	return slot;
}

/* a bar below the fold holds its fill until it is seen (one on screen as the page loads has played it already) */
const seen = new IntersectionObserver( ( found ) => {
	for ( const f of found ) {
		if ( f.isIntersecting ) {
			seen.unobserve( f.target );
			f.target.removeAttribute( 'data-gcb-kit-progress-wait' );
		}
	}
}, { threshold: 0.4 } );

function live( root ) {
	if ( root.gcbKitProgress ) {
		return;
	}
	let stopped = false;
	const circle = root.getAttribute( 'data-shape' ) === 'circle';
	const id = 'gcb-progress-k' + ++made;
	const bar = root.querySelector( DRAWN ) ?? draw( root, id );
	const range = circle ? bar.querySelector( '[data-part="circle-range"]' ) : bar.querySelector( '[data-part="range"]' );
	let [ v, m ] = value( root );
	const name = () => root.getAttribute( 'data-label' ) || ( words( root ).length && words( root ).length <= 120 ? words( root ) : 'Progress' );

	let service = null;
	const start = () => {
		service = new VanillaMachine( progress.machine, {
			id,
			ids: { root: root.id || undefined, track: circle ? undefined : bar.id || undefined, circle: circle ? bar.id || undefined : undefined },
			min: 0,
			max: m,
			defaultValue: v,
			translations: { value: ( d ) => `${ Math.round( d.percent ) }%` },
		} );
		service.subscribe( render );
		service.start();
	};
	const api = () => progress.connect( service.service, normalizeProps );
	function render() {
		if ( stopped || ! service ) {
			return;
		}
		const a = api();
		/* the root's own attributes are the design's (its data-value, data-max): only the one number the look reads */
		root.style.setProperty( '--percent', said( a.percent ) );
		const { style: _size, ...props } = circle ? a.getCircleProps() : a.getTrackProps();
		spreadProps( bar, props );
		bar.setAttribute( 'aria-label', name() );
		bar.setAttribute( 'aria-valuetext', a.valueAsString );
		if ( ! circle ) {
			const { style: _width, ...own } = a.getRangeProps(); // the width is the look's, from --percent
			spreadProps( range, own );
		} else {
			range?.setAttribute( 'data-state', a.value >= a.max ? 'complete' : 'loading' );
			range?.toggleAttribute( 'data-empty', ! a.value );
		}
	}
	start();
	render();

	const r = root.getBoundingClientRect();
	const inView = r.bottom > 0 && r.top < innerHeight && r.width > 0;
	if ( ! inView ) {
		root.setAttribute( 'data-gcb-kit-progress-wait', '' );
		seen.observe( root );
	}

	/* words that change (a total a swap or the page rewrites): the fill follows */
	const follow = () => {
		if ( stopped ) {
			return;
		}
		const [ nv, nm ] = value( root );
		if ( nm !== m ) {
			[ v, m ] = [ nv, nm ];
			service.stop();
			start();
			render();
		} else if ( nv !== api().value ) {
			v = nv;
			api().setValue( nv );
		} else {
			render();
		}
	};
	const words$ = new MutationObserver( () => queueMicrotask( follow ) );
	words$.observe( root, { characterData: true, childList: true, subtree: true, attributeFilter: [ 'data-value', 'data-max' ] } );

	root.gcbKitProgress = {
		get value() {
			return api().value;
		},
		get max() {
			return api().max;
		},
		get percent() {
			return api().percent;
		},
		set: ( n ) => {
			root.setAttribute( 'data-value', said( Math.min( m, Math.max( 0, Number( n ) || 0 ) ) ) );
		},
	};
	/* a router swap that takes the bar (the server's markup put back): drawn and connected again */
	kept(
		root,
		() => root.contains( bar ) && bar.hasAttribute( 'role' ) && ( ! range || bar.contains( range ) ),
		() => {
			stopped = true;
			words$.disconnect();
			service.stop();
			delete root.gcbKitProgress;
			live( root );
		}
	);
	document.addEventListener( 'gcbkit:swapped', () => ! stopped && root.isConnected && requestAnimationFrame( follow ) );
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
