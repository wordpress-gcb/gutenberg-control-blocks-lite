/**
 * THE KIT'S DATES (Mark, 2026-10-19: "a more comprehensive version with calendar etc like the example"; the filter kit
 * brief's date range). A from and a to, a month's calendar to pick them on, and presets ("Last 7 days"), for GCB Pro's
 * built sections and GCB Forms, beside the kit's select and slider.
 *
 * THE NATIVE INPUTS STAY THE TRUTH. The markup is two real date inputs (in the kit filter, its data-gcb-kit-min / -max:
 * the filter listens to them and sets them back on a reset; in a form, what is submitted), each in a field if the
 * design likes, with presets and the calendar drawn round them — or left to the kit:
 *
 *   <div data-gcb-kit="dates" data-latest="today">
 *     <div data-gcb-kit-dates-presets><button data-days="7">Last 7 days</button>…</div>     ← optional
 *     <label data-gcb-kit-field><span>From</span><input type="date" data-gcb-kit-min="date"></label>
 *     <label data-gcb-kit-field><span>To</span><input type="date" data-gcb-kit-max="date"></label>
 *     <div data-gcb-kit-dates-calendar></div>                                                 ← optional: where it goes
 *   </div>
 *
 * Here, once the page runs, Zag (@zag-js/date-picker, MIT) gives the calendar its keyboard (arrows, page up/down for
 * months), the screen reader's words and the picking: the first press sets the start, the second the end. Each box
 * shows its date in words ("19 Oct 2026") and opens the calendar; the box the next press will set is marked
 * data-waiting. data-calendar="always" keeps the calendar open (a modal's, beside the fields); otherwise it opens
 * below the fields, kept in view while it grows, and closes on Done. data-latest="today" (or a date) is the last day
 * that can be picked; data-earliest the first. A preset sets from N days ago to today; pressed while on, it lets go.
 *
 * Its parts say their state for styling: a day data-today, data-in-range, data-range-start / -end, data-selected,
 * data-disabled, data-outside-range; the calendar data-open; a preset aria-pressed. kit/dates/style.css gives
 * defaults that any class beats.
 */
import * as datepicker from '@zag-js/date-picker';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { parseDate, today, getLocalTimeZone } from '@internationalized/date';

const ROOT = '[data-gcb-kit="dates"]';
let count = 0;

const zone = getLocalTimeZone();
const iso = ( d ) => ( d ? d.toString().slice( 0, 10 ) : '' );
const dayOf = ( v ) => {
	try {
		return v ? parseDate( String( v ).slice( 0, 10 ) ) : null;
	} catch {
		return null;
	}
};
const boundOf = ( v ) => ( v === 'today' ? today( zone ) : dayOf( v ) );
const el = ( tag, attrs = {}, text = '' ) => {
	const e = document.createElement( tag );
	Object.entries( attrs ).forEach( ( [ k, v ] ) => e.setAttribute( k, v ) );
	if ( text ) {
		e.textContent = text;
	}
	return e;
};
const CHEVRON = ( d ) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ d }"/></svg>`;

function live( root ) {
	if ( root.gcbKitDates ) {
		return;
	}
	const inputs = [ ...root.querySelectorAll( 'input' ) ].filter( ( i ) => i.type === 'date' || i.hasAttribute( 'data-gcb-kit-min' ) || i.hasAttribute( 'data-gcb-kit-max' ) ).slice( 0, 2 );
	if ( inputs.length < 2 ) {
		return;
	}
	const locale = root.getAttribute( 'data-locale' ) || document.documentElement.lang || 'en-GB';
	const always = root.getAttribute( 'data-calendar' ) === 'always';
	const words = new Intl.DateTimeFormat( locale, { day: 'numeric', month: 'short', year: 'numeric' } );
	const say = ( d ) => ( d ? words.format( d.toDate( zone ) ) : '' );

	/* EACH BOX SHOWS ITS DATE IN WORDS and opens the calendar; the input itself stays, out of sight, the truth */
	const shown = inputs.map( ( input ) => {
		const s = el( 'span', { 'data-gcb-kit-dates-shown': '' } );
		input.after( s );
		input.setAttribute( 'data-gcb-kit-dates-input', '' );
		return s;
	} );
	const fields = inputs.map( ( input ) => input.closest( 'label' ) || input.parentElement );
	const placeholders = inputs.map( ( input, k ) => input.getAttribute( 'data-placeholder' ) || ( k === 0 ? 'Add date' : 'Add date' ) );

	/* THE CALENDAR: where the design put it, else after the fields */
	let calendar = root.querySelector( '[data-gcb-kit-dates-calendar]' );
	if ( ! calendar ) {
		calendar = el( 'div', { 'data-gcb-kit-dates-calendar': '' } );
		root.appendChild( calendar );
	}
	const inner = el( 'div', { 'data-gcb-kit-dates-inner': '' } );
	const head = el( 'div', { 'data-gcb-kit-dates-head': '' } );
	const prev = el( 'button', { type: 'button', 'data-gcb-kit-dates-prev': '' } );
	prev.innerHTML = CHEVRON( 'M15 6l-6 6 6 6' );
	const title = el( 'span', { 'data-gcb-kit-dates-title': '', 'aria-live': 'polite' } );
	const next = el( 'button', { type: 'button', 'data-gcb-kit-dates-next': '' } );
	next.innerHTML = CHEVRON( 'M9 6l6 6-6 6' );
	head.append( prev, title, next );
	const table = el( 'table', { 'data-gcb-kit-dates-grid': '' } );
	const thead = el( 'thead' );
	const headRow = el( 'tr' );
	thead.appendChild( headRow );
	const tbody = el( 'tbody' );
	table.append( thead, tbody );
	const foot = el( 'div', { 'data-gcb-kit-dates-foot': '' } );
	const hint = el( 'span', { 'data-gcb-kit-dates-hint': '', 'aria-live': 'polite' } );
	const clear = el( 'button', { type: 'button', 'data-gcb-kit-dates-clear': '' }, root.getAttribute( 'data-clear' ) || 'Clear dates' );
	const done = el( 'button', { type: 'button', 'data-gcb-kit-dates-done': '' }, root.getAttribute( 'data-done' ) || 'Done' );
	foot.append( hint, clear );
	if ( ! always ) {
		foot.append( done );
	}
	inner.append( head, table, foot );
	calendar.appendChild( inner );
	calendar.toggleAttribute( 'data-always', always );

	const presets = [ ...root.querySelectorAll( '[data-gcb-kit-dates-presets] [data-days]' ) ];

	let quiet = false;
	const read = () => inputs.map( ( i ) => dayOf( i.value ) );
	const write = ( start, end ) => {
		quiet = true;
		[ start, end ].forEach( ( d, k ) => {
			const v = iso( d );
			if ( inputs[ k ].value !== v ) {
				inputs[ k ].value = v;
				inputs[ k ].dispatchEvent( new Event( 'input', { bubbles: true } ) );
				inputs[ k ].dispatchEvent( new Event( 'change', { bubbles: true } ) );
			}
		} );
		quiet = false;
	};
	const initial = read().filter( Boolean );
	const service = new VanillaMachine( datepicker.machine, {
		id: 'gcb-dates-' + ++count,
		locale,
		timeZone: zone,
		inline: true,
		selectionMode: 'range',
		startOfWeek: Number( root.getAttribute( 'data-week-starts' ) ?? 1 ),
		fixedWeeks: true, // six rows always: the calendar never changes height between months
		min: boundOf( root.getAttribute( 'data-earliest' ) ) ?? undefined,
		max: boundOf( root.getAttribute( 'data-latest' ) ) ?? undefined,
		defaultValue: initial,
		defaultFocusedValue: initial[ 0 ] ?? ( boundOf( root.getAttribute( 'data-latest' ) ) ?? today( zone ) ),
		onValueChange: ( d ) => write( d.value[ 0 ] ?? null, d.value[ 1 ] ?? null ),
	} );
	const api = () => datepicker.connect( service.service, normalizeProps );

	/* the grid is made once a month and its days given their state on every change — never re-made under the pointer */
	let month = '';
	let cells = [];
	const build = ( a ) => {
		const key = iso( a.visibleRange.start );
		if ( key === month ) {
			return;
		}
		month = key;
		headRow.replaceChildren( ...a.weekDays.map( ( w ) => el( 'th', { scope: 'col', 'aria-label': w.long }, w.narrow ) ) );
		cells = [];
		tbody.replaceChildren(
			...a.weeks.map( ( week ) => {
				const tr = el( 'tr' );
				week.forEach( ( value ) => {
					const td = el( 'td' );
					const day = el( 'div', { 'data-gcb-kit-dates-day': '' }, String( value.day ) );
					td.appendChild( day );
					tr.appendChild( td );
					cells.push( { value, td, day } );
				} );
				return tr;
			} )
		);
	};

	const render = () => {
		const a = api();
		build( a );
		spreadProps( calendar, a.getRootProps() );
		spreadProps( inner, a.getContentProps() );
		inner.hidden = false; // inline: always drawn; whether it shows is the calendar's data-open
		spreadProps( prev, a.getPrevTriggerProps() );
		spreadProps( next, a.getNextTriggerProps() );
		spreadProps( table, a.getTableProps( { view: 'day' } ) );
		spreadProps( thead, a.getTableHeadProps( { view: 'day' } ) );
		spreadProps( tbody, a.getTableBodyProps( { view: 'day' } ) );
		title.textContent = a.visibleRangeText.start;
		cells.forEach( ( c ) => {
			spreadProps( c.td, a.getDayTableCellProps( { value: c.value } ) );
			spreadProps( c.day, a.getDayTableCellTriggerProps( { value: c.value } ) );
		} );
		const [ start, end ] = [ a.value[ 0 ] ?? null, a.value[ 1 ] ?? null ];
		shown.forEach( ( s, k ) => {
			const d = k === 0 ? start : end;
			s.textContent = d ? say( d ) : placeholders[ k ];
			s.toggleAttribute( 'data-placeholder', ! d );
		} );
		/* the box the next press sets: the start until there is one, then the end until the range is whole */
		const waiting = ! start || end ? 0 : 1;
		fields.forEach( ( f, k ) => f && f.toggleAttribute( 'data-waiting', calendar.hasAttribute( 'data-open' ) && k === waiting ) );
		hint.textContent = waiting === 0 ? root.getAttribute( 'data-hint-start' ) || 'Pick a start date' : root.getAttribute( 'data-hint-end' ) || 'Now pick an end date';
		clear.hidden = ! start;
		presets.forEach( ( p ) => p.setAttribute( 'aria-pressed', String( presetOn( p, start, end ) ) ) );
	};

	const presetOn = ( p, start, end ) => {
		const n = Number( p.getAttribute( 'data-days' ) );
		const t = today( zone );
		return !! start && !! end && iso( end ) === iso( t ) && iso( start ) === iso( t.subtract( { days: n } ) );
	};
	presets.forEach( ( p ) => {
		if ( p.tagName === 'BUTTON' && ! p.hasAttribute( 'type' ) ) {
			p.type = 'button';
		}
		p.addEventListener( 'click', () => {
			const a = api();
			const [ start, end ] = [ a.value[ 0 ] ?? null, a.value[ 1 ] ?? null ];
			if ( presetOn( p, start, end ) ) {
				a.clearValue();
				return;
			}
			const t = today( zone );
			const from = t.subtract( { days: Number( p.getAttribute( 'data-days' ) ) } );
			a.setValue( [ from, t ] );
			a.setFocusedValue( from );
		} );
	} );

	/* OPEN BELOW THE FIELDS, KEPT IN VIEW WHILE IT GROWS (the brief: "keep scrolling the drawer so the calendar's bottom
	   stays in view"), and flashing so a press visibly does something even when it is already open */
	const flash = () => {
		calendar.removeAttribute( 'data-flash' );
		void calendar.offsetWidth;
		calendar.setAttribute( 'data-flash', '' );
		setTimeout( () => calendar.removeAttribute( 'data-flash' ), 700 );
	};
	const keepInView = () => {
		const until = performance.now() + 480;
		const step = () => {
			calendar.scrollIntoView( { block: 'nearest' } );
			if ( performance.now() < until ) {
				requestAnimationFrame( step );
			}
		};
		requestAnimationFrame( step );
	};
	const open = ( k ) => {
		calendar.setAttribute( 'data-open', '' );
		const a = api();
		const d = read()[ k ];
		if ( d ) {
			a.setFocusedValue( d );
		}
		flash();
		keepInView();
		render();
	};
	if ( always ) {
		calendar.setAttribute( 'data-open', '' );
	}
	fields.forEach( ( f, k ) => {
		if ( ! f ) {
			return;
		}
		f.setAttribute( 'tabindex', f.getAttribute( 'tabindex' ) ?? '0' );
		f.setAttribute( 'role', f.getAttribute( 'role' ) ?? 'button' );
		f.addEventListener( 'click', ( e ) => {
			e.preventDefault();
			open( k );
		} );
		f.addEventListener( 'keydown', ( e ) => {
			if ( e.key === 'Enter' || e.key === ' ' ) {
				e.preventDefault();
				open( k );
			}
		} );
	} );
	done.addEventListener( 'click', () => {
		calendar.removeAttribute( 'data-open' );
		render();
	} );
	clear.addEventListener( 'click', () => api().clearValue() );

	/* a date set by the page (the filter's reset, a chip taken off): the calendar follows */
	const follow = () => {
		if ( quiet ) {
			return;
		}
		const want = read();
		const a = api();
		if ( want.map( iso ).join() !== [ a.value[ 0 ], a.value[ 1 ] ].map( iso ).join() ) {
			if ( want[ 0 ] ) {
				a.setValue( want.filter( Boolean ) );
			} else {
				a.clearValue();
			}
		}
	};
	const own = Object.getOwnPropertyDescriptor( HTMLInputElement.prototype, 'value' );
	inputs.forEach( ( input ) => {
		Object.defineProperty( input, 'value', {
			configurable: true,
			get() {
				return own.get.call( this );
			},
			set( v ) {
				own.set.call( this, v );
				queueMicrotask( follow );
			},
		} );
		input.addEventListener( 'change', follow );
	} );

	service.subscribe( render );
	service.start();
	render();
	root.classList.add( 'is-live' );
	root.gcbKitDates = { service, inputs };
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
