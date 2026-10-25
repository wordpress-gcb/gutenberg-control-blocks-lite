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
 * One date input (or data-mode="single") picks ONE date instead — a delivery day, a date of birth: single(), below.
 *
 * Its parts say their state for styling: a day data-today, data-in-range, data-range-start / -end, data-selected,
 * data-disabled, data-outside-range; the calendar data-open; a preset aria-pressed. kit/dates/style.css gives
 * defaults that any class beats.
 *
 * THE DRAWING'S OWN PARTS FIRST (2026-10-26, kit/AGENTS.md 4): inside [data-gcb-kit-dates-calendar] a design may draw
 * any of the calendar's parts with the hook the kit gives its own — a head, its prev / next arrows and title, a foot,
 * its hint, Clear and Done, the panel's ends row — and that element is used, its classes kept; a day, a weekday and a
 * month / year cell are patterns, drawn once and cloned for each, the number or name written into their
 * [data-gcb-kit-dates-label] (else their text). In a one-date field a drawn [data-gcb-kit-dates-icon] is its icon.
 * What is not drawn the kit makes, as it always has.
 */
import * as datepicker from '@zag-js/date-picker';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { kept } from '../_core/kept.js';
import { widget } from '../_core/widget.js';

/* THE PART IS LIVE, SAID WHERE NO SWAP REACHES (2026-10-20): its look switches from the native control to the drawn one
   on this class on <html>, never on a class of the part's own — a router swap puts the part's attributes back as the
   server drew them, and for that moment the drawn control vanished, taking the focus of an open list with it */
document.documentElement.classList.add( 'gcb-kit-dates-on' );
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
/* a part the drawing drew in the calendar with its hook (taken out of where it was drawn: the kit puts it in its place),
   else null — the kit makes its own */
const drawn = ( scope, name ) => scope?.querySelector( `[data-gcb-kit-dates-${ name }]` ) || null;
/* a pattern drawn once, cloned for each day, weekday or cell; its words in its [data-gcb-kit-dates-label], else its text */
const pattern = ( scope, name ) => {
	const p = drawn( scope, name );
	p?.remove();
	return p;
};
const fill = ( e, text ) => {
	( e.querySelector( '[data-gcb-kit-dates-label]' ) || e ).textContent = text;
	return e;
};
const madeOr = ( p, tag, attrs, text ) => ( p ? fill( p.cloneNode( true ), text ) : el( tag, attrs, text ) );
/* the head's arrows and title, the foot's hint, Clear and Done: the drawing's where it put them in its own head or foot,
   else in the kit's — in the kit's order */
const seat = ( box, parts ) => {
	parts.forEach( ( e, k ) => {
		if ( box.contains( e ) ) {
			return;
		}
		const before = parts.slice( k + 1 ).find( ( x ) => x.parentElement === box );
		box.insertBefore( e, before || null );
	} );
};
/* a date said as a preset says it (2026-10-26): "today", "+7d" / "-1m" / "+2w" / "+1y" from today, "month-start",
   "month-end", or a date */
const presetDay = ( v, t ) => {
	const m = /^([+-]\d+)([dwmy])$/.exec( v );
	if ( m ) {
		return t.add( { [ { d: 'days', w: 'weeks', m: 'months', y: 'years' }[ m[ 2 ] ] ]: Number( m[ 1 ] ) } );
	}
	if ( v === 'month-start' ) {
		return t.set( { day: 1 } );
	}
	if ( v === 'month-end' ) {
		return t.set( { day: 1 } ).add( { months: 1 } ).subtract( { days: 1 } );
	}
	return v === 'today' ? t : dayOf( v );
};
const CHEVRON = ( d ) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ d }"/></svg>`;

function live( root ) {
	if ( root.gcbKitDates ) {
		return;
	}
	let stopped = false; // a part started again over a swap: the old one's listeners do nothing
	const inputs = [ ...root.querySelectorAll( 'input' ) ].filter( ( i ) => i.type === 'date' || i.hasAttribute( 'data-gcb-kit-min' ) || i.hasAttribute( 'data-gcb-kit-max' ) ).slice( 0, 2 );
	/* ONE DATE (data-mode="single", or one date input): a day, not a stay — its own calendar, below */
	if ( inputs.length && ( root.getAttribute( 'data-mode' ) === 'single' || inputs.length === 1 ) ) {
		single( root, inputs[ 0 ] );
		return;
	}
	if ( inputs.length < 2 ) {
		return;
	}
	const locale = root.getAttribute( 'data-locale' ) || document.documentElement.lang || 'en-GB';
	const always = root.getAttribute( 'data-calendar' ) === 'always';
	/* A PANEL OF ITS OWN (Mark, 2026-10-21, a booking card: "the double calendar view means you can select the buttons
	   'to' 'from' so it's less fiddly … the two calendars mean you can span months"): data-calendar="panel" opens a card
	   over the page beside the boxes — the design's heading for it ([data-gcb-kit-dates-heading] in the calendar), the
	   two boxes again to choose which end the next press sets, two months side by side, Clear and Close */
	const panel = root.getAttribute( 'data-calendar' ) === 'panel';
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
	const placeholders = inputs.map( ( input ) => input.getAttribute( 'data-placeholder' ) || root.getAttribute( 'data-placeholder' ) || 'Add date' );
	/* WHAT THE PART'S BOX SAYS (2026-10-26, each defaulting to what it always did): data-close="pick" shuts the calendar
	   once the range is whole (else on Done), data-fixed-weeks="false" shows only a month's own weeks (else six rows),
	   data-flash="off" / data-scroll="off" keep a press from flashing it or scrolling it into view, data-min-nights /
	   data-max-nights the shortest and longest stay the end can make, data-weekday="short|long" the weekdays' words
	   (else a letter) */
	const says = ( k ) => root.getAttribute( 'data-' + k );
	const closeOnPick = says( 'close' ) === 'pick';
	const weekday = [ 'short', 'long' ].includes( says( 'weekday' ) ) ? says( 'weekday' ) : 'narrow';
	const minNights = Math.max( 0, Number( says( 'min-nights' ) ) || 0 );
	const maxNights = Math.max( 0, Number( says( 'max-nights' ) ) || 0 );

	/* THE CALENDAR: where the design put it, else after the fields */
	let calendar = root.querySelector( '[data-gcb-kit-dates-calendar]' );
	if ( ! calendar ) {
		calendar = el( 'div', { 'data-gcb-kit-dates-calendar': '' } );
		root.appendChild( calendar );
	}
	const inner = el( 'div', { 'data-gcb-kit-dates-inner': '' } );
	/* the patterns first, out of the calendar: a day, a weekday */
	const dayPattern = pattern( calendar, 'day' );
	const weekdayPattern = pattern( calendar, 'weekday' );
	const head = drawn( calendar, 'head' ) || el( 'div', { 'data-gcb-kit-dates-head': '' } );
	let prev = drawn( calendar, 'prev' );
	if ( ! prev ) {
		prev = el( 'button', { type: 'button', 'data-gcb-kit-dates-prev': '' } );
		prev.innerHTML = CHEVRON( 'M15 6l-6 6 6 6' );
	}
	const title = drawn( calendar, 'title' ) || el( 'span', { 'data-gcb-kit-dates-title': '' } );
	title.setAttribute( 'aria-live', 'polite' );
	const titleWords = title.querySelector( '[data-gcb-kit-dates-label]' ) || title;
	let next = drawn( calendar, 'next' );
	if ( ! next ) {
		next = el( 'button', { type: 'button', 'data-gcb-kit-dates-next': '' } );
		next.innerHTML = CHEVRON( 'M9 6l6 6-6 6' );
	}
	seat( head, [ prev, title, next ] );
	/* A MONTH OR SEVERAL SIDE BY SIDE (2026-10-21, a home's availability: two months at once, as the design draws it):
	   data-months="2". Each month its own grid; the head's arrows move them all */
	const months = Math.max( 1, Math.min( 3, Number( root.getAttribute( 'data-months' ) ) || ( panel ? 2 : 1 ) ) );
	const grids = Array.from( { length: months }, () => {
		const table = el( 'table', { 'data-gcb-kit-dates-grid': '' } );
		const caption = el( 'caption', { 'data-gcb-kit-dates-month': '' } );
		const thead = el( 'thead' );
		const headRow = el( 'tr' );
		thead.appendChild( headRow );
		const tbody = el( 'tbody' );
		table.append( thead, tbody );
		if ( months > 1 ) {
			table.prepend( caption );
		}
		return { table, caption, thead, headRow, tbody, cells: [], range: null };
	} );
	const table = grids.length > 1 ? el( 'div', { 'data-gcb-kit-dates-grids': '' } ) : grids[ 0 ].table;
	if ( grids.length > 1 ) {
		table.append( ...grids.map( ( g ) => g.table ) );
	}
	const foot = drawn( calendar, 'foot' ) || el( 'div', { 'data-gcb-kit-dates-foot': '' } );
	const hint = drawn( calendar, 'hint' ) || el( 'span', { 'data-gcb-kit-dates-hint': '' } );
	hint.setAttribute( 'aria-live', 'polite' );
	/* data-clear="none": no Clear dates (the design has none) */
	const noClear = says( 'clear' ) === 'none';
	const clear = drawn( calendar, 'clear' ) || el( 'button', { type: 'button', 'data-gcb-kit-dates-clear': '' }, ( ! noClear && says( 'clear' ) ) || 'Clear dates' );
	const drewDone = drawn( calendar, 'done' );
	const done = drewDone || el( 'button', { type: 'button', 'data-gcb-kit-dates-done': '' }, root.getAttribute( 'data-done' ) || ( root.getAttribute( 'data-calendar' ) === 'panel' ? 'Close' : 'Done' ) );
	seat( foot, ! always || drewDone ? [ hint, clear, done ] : [ hint, clear ] );
	inner.append( head, table, foot );
	calendar.appendChild( inner );
	calendar.toggleAttribute( 'data-always', always );
	calendar.toggleAttribute( 'data-panel', panel );
	/* the panel's own boxes: the design's two, drawn again (their look is the design's), each with a × to take its
	   date off; the one the next press sets is data-active */
	/* data-ends="none": a panel with no ends row (the design's boxes beside it say the dates) */
	const ends = panel && says( 'ends' ) !== 'none'
		? fields.map( ( f, k ) => {
				/* a box, never a <label>: a press on a label works the first control inside it — the × — and took the date off */
				/* the design's words in it, not its box: the field's classes are its place in the design (a card's grid, its
				   borders) — the panel's ends are one box of the kit's (Mark, 2026-10-21: the borders broke) */
				const box = el( 'div' );
				box.append( ...[ ...f.cloneNode( true ).childNodes ] );
				box.querySelectorAll( 'input' ).forEach( ( i ) => i.remove() );
				box.setAttribute( 'data-gcb-kit-dates-end', String( k ) );
				box.setAttribute( 'data-gcb-kit-field', '' ); // the kit's field: its states and its look
				box.setAttribute( 'role', 'button' );
				box.setAttribute( 'tabindex', '0' );
				const unset = el( 'button', { type: 'button', 'data-gcb-kit-dates-unset': '', 'data-gcb-kit-field-clear': '', 'aria-label': ( says( 'unset' ) || 'Clear' ) + ' ' + ( f.textContent.trim().split( /\s+/ )[ 0 ] || 'date' ) }, '×' );
				box.appendChild( unset );
				return { box, shown: box.querySelector( '[data-gcb-kit-dates-shown]' ), unset };
		  } )
		: [];
	if ( ends.length ) {
		const row = drawn( calendar, 'ends' ) || el( 'div', { 'data-gcb-kit-dates-ends': '' } );
		row.append( ...ends.map( ( e ) => e.box ) );
		calendar.insertBefore( row, inner );
	} else {
		drawn( calendar, 'ends' )?.remove();
	}

	const presets = [ ...root.querySelectorAll( '[data-gcb-kit-dates-presets] :is([data-days], [data-from], [data-to])' ) ];

	let quiet = false;
	let editing = null; // a panel's end the next press sets: 0 the start, 1 the end; null — the calendar decides
	let hovered = null; // the day under the pointer, for the trail while an end is chosen
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
	/* DAYS THAT CANNOT BE HAD (a home's bookings): data-unavailable="2027-01-03,2027-02-01/2027-02-07" — days, and spans */
	const unavailable = ( root.getAttribute( 'data-unavailable' ) || '' )
		.split( ',' )
		.map( ( part ) => part.trim().split( '/' ).map( dayOf ) )
		.filter( ( [ from ] ) => from );
	const isUnavailable = ( d ) => unavailable.some( ( [ from, to ] ) => d.compare( from ) >= 0 && d.compare( to || from ) <= 0 );
	/* A STAY'S SHORTEST AND LONGEST (data-min-nights, data-max-nights): while a start waits for its end, the ends that
	   would make it shorter or longer cannot be had */
	const tooShortOrLong = ( d ) => {
		const [ s, e ] = read();
		const n = s && ! e ? d.compare( s ) : 0;
		return n > 0 && ( ( minNights && n < minNights ) || ( maxNights && n > maxNights ) );
	};
	const service = new VanillaMachine( datepicker.machine, {
		id: 'gcb-dates-' + ++count,
		locale,
		timeZone: zone,
		inline: true,
		selectionMode: 'range',
		startOfWeek: Number( root.getAttribute( 'data-week-starts' ) ?? 1 ),
		fixedWeeks: says( 'fixed-weeks' ) !== 'false', // six rows: the calendar never changes height between months
		numOfMonths: months,
		isDateUnavailable: unavailable.length || minNights || maxNights ? ( d ) => isUnavailable( d ) || tooShortOrLong( d ) : undefined,
		min: boundOf( root.getAttribute( 'data-earliest' ) ) ?? undefined,
		max: boundOf( root.getAttribute( 'data-latest' ) ) ?? undefined,
		defaultValue: initial,
		defaultFocusedValue: initial[ 0 ] ?? ( boundOf( root.getAttribute( 'data-latest' ) ) ?? today( zone ) ),
		onValueChange: ( d ) => {
			write( d.value[ 0 ] ?? null, d.value[ 1 ] ?? null );
			tell( d.value );
		},
	} );
	const api = () => datepicker.connect( service.service, normalizeProps );

	/* CALENDARS THAT ARE ONE STAY (2026-10-21: a home's availability and its booking card's check-in and checkout are the
	   same dates): data-sync="KEY" — a range picked in one is the range in every other with that key */
	const sync = root.getAttribute( 'data-sync' ) || '';
	const tell = ( value ) => {
		if ( sync && ! quiet ) {
			document.dispatchEvent( new CustomEvent( 'gcbkit:dates-sync', { detail: { key: sync, from: root, value: value.map( iso ) } } ) );
		}
	};
	if ( sync ) {
		document.addEventListener( 'gcbkit:dates-sync', ( e ) => {
			if ( stopped || e.detail.key !== sync || e.detail.from === root ) {
				return;
			}
			const a = api();
			const want = e.detail.value.filter( Boolean );
			if ( want.join() === a.value.map( iso ).join() ) {
				return;
			}
			if ( want.length ) {
				a.setValue( want.map( dayOf ) );
			} else {
				a.clearValue();
			}
		} );
	}

	/* the day under the pointer: the trail's end while a start waits for its end */
	inner.addEventListener( 'pointerover', ( ev ) => {
		const day = ev.target.closest && ev.target.closest( '[data-gcb-kit-dates-day]' );
		const cell = day && grids.flatMap( ( g ) => g.cells ).find( ( c ) => c.day === day );
		const next = cell && ! day.hasAttribute( 'data-disabled' ) && ! day.hasAttribute( 'data-outside-range' ) ? cell.value : null;
		if ( ( next && iso( next ) ) !== ( hovered && iso( hovered ) ) ) {
			hovered = next;
			render();
		}
	} );
	inner.addEventListener( 'pointerleave', () => {
		if ( hovered ) {
			hovered = null;
			render();
		}
	} );

	/* a weekday's heading: the drawing's pattern in it, else its words */
	const weekdayCell = ( w ) => {
		if ( ! weekdayPattern ) {
			return el( 'th', { scope: 'col', 'aria-label': w.long }, w[ weekday ] );
		}
		const th = el( 'th', { scope: 'col', 'aria-label': w.long } );
		th.appendChild( fill( weekdayPattern.cloneNode( true ), w[ weekday ] ) );
		return th;
	};
	/* the grids are made once a month and their days given their state on every change — never re-made under the pointer */
	let month = '';
	const build = ( a ) => {
		const key = iso( a.visibleRange.start );
		if ( key === month ) {
			return;
		}
		month = key;
		grids.forEach( ( g, i ) => {
			const shown = i === 0 ? { weeks: a.weeks, visibleRange: a.visibleRange } : a.getOffset( { months: i } );
			g.range = shown.visibleRange;
			g.caption.textContent = new Intl.DateTimeFormat( locale, { month: 'long', year: 'numeric' } ).format( shown.visibleRange.start.toDate( zone ) );
			g.headRow.replaceChildren( ...a.weekDays.map( ( w ) => weekdayCell( w ) ) );
			g.cells = [];
			g.tbody.replaceChildren(
				...shown.weeks.map( ( week ) => {
					const tr = el( 'tr' );
					week.forEach( ( value ) => {
						const td = el( 'td' );
						const day = madeOr( dayPattern, 'div', { 'data-gcb-kit-dates-day': '' }, String( value.day ) );
						td.appendChild( day );
						tr.appendChild( td );
						g.cells.push( { value, td, day } );
					} );
					return tr;
				} )
			);
		} );
	};

	const render = () => {
		const a = api();
		build( a );
		spreadProps( calendar, a.getRootProps() );
		spreadProps( inner, a.getContentProps() );
		inner.hidden = false; // inline: always drawn; whether it shows is the calendar's data-open
		spreadProps( prev, a.getPrevTriggerProps() );
		spreadProps( next, a.getNextTriggerProps() );
		/* THE STAY AS THE INPUTS HOLD IT (Mark, 2026-10-21: "there's no need for that trail once you've already clicked an
		   end date"): the machine can think an end is still being chosen after the range is whole, and marks the days
		   under the pointer in range — so the stay is drawn from the truth: its start, its end, the days between, and the
		   trail to the day pointed at only while a start waits for its end */
		const [ vs, ve ] = read();
		const trailTo = vs && ! ve && hovered && hovered.compare( vs ) > 0 ? hovered : null;
		grids.forEach( ( g, i ) => {
			const range = i === 0 ? undefined : g.range;
			g.cells.forEach( ( c ) => {
				const v = c.value;
				const outside = c.day.hasAttribute( 'data-outside-range' );
				c.day.toggleAttribute( 'data-stay-start', ! outside && !! vs && v.compare( vs ) === 0 );
				c.day.toggleAttribute( 'data-stay-end', ! outside && !! ve && v.compare( ve ) === 0 );
				c.day.toggleAttribute( 'data-stay-in', ! outside && !! vs && !! ve && v.compare( vs ) > 0 && v.compare( ve ) < 0 );
				c.day.toggleAttribute( 'data-stay-trail', ! outside && !! trailTo && v.compare( vs ) > 0 && v.compare( trailTo ) <= 0 );
				c.day.toggleAttribute( 'data-stay-trail-end', ! outside && !! trailTo && v.compare( trailTo ) === 0 );
				/* the ends the band runs from or to: a start with an end or a trail after it, an end after its start */
				const joinsStart = !! vs && v.compare( vs ) === 0 && ( ( !! ve && ve.compare( vs ) > 0 ) || !! trailTo );
				const joinsEnd = !! ve && !! vs && v.compare( ve ) === 0 && ve.compare( vs ) > 0;
				c.day.toggleAttribute( 'data-stay-joins', ! outside && ( joinsStart || joinsEnd ) );
			} );
			spreadProps( g.table, a.getTableProps( { view: 'day', id: 'gcb-dates-' + count + '-' + i } ) );
			spreadProps( g.thead, a.getTableHeadProps( { view: 'day' } ) );
			spreadProps( g.tbody, a.getTableBodyProps( { view: 'day' } ) );
			g.cells.forEach( ( c ) => {
				spreadProps( c.td, a.getDayTableCellProps( { value: c.value, visibleRange: range } ) );
				spreadProps( c.day, a.getDayTableCellTriggerProps( { value: c.value, visibleRange: range } ) );
			} );
		} );
		titleWords.textContent = months > 1 ? `${ grids[ 0 ].caption.textContent } – ${ grids[ months - 1 ].caption.textContent }` : a.visibleRangeText.start;
		const [ start, end ] = [ a.value[ 0 ] ?? null, a.value[ 1 ] ?? null ];
		shown.forEach( ( s, k ) => {
			const d = k === 0 ? start : end;
			s.textContent = d ? say( d ) : placeholders[ k ];
			s.toggleAttribute( 'data-placeholder', ! d );
		} );
		/* the box the next press sets: the one pressed last (a panel's), else the start until there is one, then the end */
		const waiting = editing ?? ( ! start || end ? 0 : 1 );
		ends.forEach( ( e, k ) => {
			const d = k === 0 ? start : end;
			if ( e.shown ) {
				e.shown.textContent = d ? say( d ) : placeholders[ k ];
				e.shown.toggleAttribute( 'data-placeholder', ! d );
			}
			e.box.toggleAttribute( 'data-active', k === waiting );
			/* its room kept whether it shows or not: an end never changes width as a date is picked */
			e.unset.style.visibility = d ? '' : 'hidden';
			e.unset.tabIndex = d ? 0 : -1;
		} );
		fields.forEach( ( f, k ) => {
			if ( f ) {
				const on = calendar.hasAttribute( 'data-open' ) && k === waiting;
				f.toggleAttribute( 'data-waiting', on );
				f.toggleAttribute( 'data-active', on && panel ); // a panel's: the kit field's active look
			}
		} );
		/* the hint, unless the design shows none (data-hint="none") */
		hint.textContent = root.getAttribute( 'data-hint' ) === 'none' ? '' : waiting === 0 ? root.getAttribute( 'data-hint-start' ) || 'Pick a start date' : root.getAttribute( 'data-hint-end' ) || 'Now pick an end date';
		/* THE RANGE SAID WHERE THE DESIGN SAYS IT (2026-10-21, a home's availability: "28 nights", "13 Jan 2027 – 10 Feb
		   2027" over the calendar): [data-gcb-kit-dates-nights] the nights (or days) between, [data-gcb-kit-dates-range]
		   the dates in words; the drawn words while nothing is picked */
		const nights = start && end ? end.compare( start ) : 0;
		root.querySelectorAll( '[data-gcb-kit-dates-nights]' ).forEach( ( n ) => {
			n.dataset.drawn ??= n.textContent;
			n.textContent = nights ? String( nights ) : n.dataset.drawn;
		} );
		root.querySelectorAll( '[data-gcb-kit-dates-range]' ).forEach( ( n ) => {
			n.dataset.drawn ??= n.textContent;
			n.textContent = start && end ? `${ say( start ) } – ${ say( end ) }` : n.dataset.drawn;
		} );
		/* THE DESIGN'S WORDS FOR EACH MOMENT: [data-gcb-kit-dates-when="empty"] while nothing is picked ("Select check-in
		   date"), "start" once a start is ("Select checkout date"), "picked" once the range is whole ("28 nights") */
		const moment = start && end ? 'picked' : start ? 'start' : 'empty';
		calendar.toggleAttribute( 'data-choosing-end', !! start && ! end );
		/* a panel's checkout waits for its check-in: its boxes say so, and pass a press to the check-in */
		if ( panel ) {
			[ fields[ 1 ], ends[ 1 ] && ends[ 1 ].box ].forEach( ( b ) => b && b.setAttribute( 'aria-disabled', String( ! start ) ) );
		}
		root.querySelectorAll( '[data-gcb-kit-dates-when]' ).forEach( ( n ) => {
			n.hidden = ! n.getAttribute( 'data-gcb-kit-dates-when' ).split( /\s+/ ).includes( moment );
		} );
		clear.hidden = noClear || ! start;
		if ( pane && pane.isOpen() ) {
			pane.place();
		}
		presets.forEach( ( p ) => p.setAttribute( 'aria-pressed', String( presetOn( p, start, end ) ) ) );
	};

	/* a preset's range: data-days="N" the N days to today; data-from / data-to ("today", "+7d", "-1m", "month-start",
	   "month-end", a date) any other — "Next 7 days" is data-from="today" data-to="+7d" */
	const presetRange = ( p ) => {
		const t = today( zone );
		const from = p.hasAttribute( 'data-from' ) ? presetDay( p.getAttribute( 'data-from' ), t ) : t.subtract( { days: Number( p.getAttribute( 'data-days' ) ) || 0 } );
		const to = p.hasAttribute( 'data-to' ) ? presetDay( p.getAttribute( 'data-to' ), t ) : t;
		return [ from, to ];
	};
	const presetOn = ( p, start, end ) => {
		const [ from, to ] = presetRange( p );
		return !! start && !! end && !! from && !! to && iso( end ) === iso( to ) && iso( start ) === iso( from );
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
			const [ from, to ] = presetRange( p );
			if ( ! from || ! to ) {
				return;
			}
			a.setValue( from.compare( to ) <= 0 ? [ from, to ] : [ to, from ] );
			a.setFocusedValue( from.compare( to ) <= 0 ? from : to );
		} );
	} );

	/* OPEN BELOW THE FIELDS, KEPT IN VIEW WHILE IT GROWS (the brief: "keep scrolling the drawer so the calendar's bottom
	   stays in view"), and flashing so a press visibly does something even when it is already open */
	/* THE PANEL IN THE TOP LAYER (Mark, 2026-10-21: "the calendars z index"): the kit's widget panel — the one every
	   field opens (kit/_core/widget.js): above every section, beside the boxes, on the screen, a sheet on a phone */
	const pane = panel
		? widget( calendar, root, {
				keep: () => fields,
				closed: () => {
					editing = null;
					render();
				},
				focus: false, // the fields keep the focus: the next day picked is said on them
		  } )
		: null;
	const flash = () => {
		if ( says( 'flash' ) === 'off' ) {
			return;
		}
		calendar.removeAttribute( 'data-flash' );
		void calendar.offsetWidth;
		calendar.setAttribute( 'data-flash', '' );
		/* as long as the flash the style gives it: --gcb-dates-flash-dur (700ms) */
		const dur = getComputedStyle( calendar ).getPropertyValue( '--gcb-dates-flash-dur' ).trim();
		const ms = /ms$/.test( dur ) ? parseFloat( dur ) : /s$/.test( dur ) ? parseFloat( dur ) * 1000 : NaN;
		setTimeout( () => calendar.removeAttribute( 'data-flash' ), Number.isFinite( ms ) ? ms : 700 );
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
		if ( panel ) {
			editing = k === 1 && ! read()[ 0 ] ? 0 : k; // no check-in yet: the check-in first
		}
		if ( pane ) {
			pane.open();
		} else {
			calendar.setAttribute( 'data-open', '' );
		}
		const a = api();
		const d = read()[ k ];
		if ( d ) {
			a.setFocusedValue( d );
		}
		flash();
		if ( ! panel && says( 'scroll' ) !== 'off' ) {
			keepInView(); // a panel is placed on the screen already
		}
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
	const shut = () => {
		if ( pane ) {
			pane.close();
		} else {
			calendar.removeAttribute( 'data-open' );
		}
		editing = null;
		render();
	};
	done.addEventListener( 'click', shut );
	/* THE PANEL'S ENDS: a box pressed is the end the next day pressed sets — a checkout moved keeps its check-in, and a
	   check-in moved keeps its checkout, so neither end means starting again */
	ends.forEach( ( e, k ) => {
		const choose = () => {
			if ( k === 1 && ! read()[ 0 ] ) {
				return; // a checkout waits for its check-in
			}
			editing = k;
			render();
		};
		e.box.addEventListener( 'click', ( ev ) => {
			if ( ! e.unset.contains( ev.target ) ) {
				choose();
			}
		} );
		e.box.addEventListener( 'keydown', ( ev ) => {
			if ( ( ev.key === 'Enter' || ev.key === ' ' ) && ev.target === e.box ) {
				ev.preventDefault();
				choose();
			}
		} );
		e.unset.addEventListener( 'click', () => {
			const a = api();
			const start = a.value[ 0 ] ?? null;
			editing = k;
			if ( k === 0 || ! start ) {
				a.clearValue();
			} else {
				a.setValue( [ start ] );
			}
			render();
		} );
	} );
	if ( panel ) {
		inner.addEventListener(
			'click',
			( ev ) => {
				const day = ev.target.closest && ev.target.closest( '[data-gcb-kit-dates-day]' );
				const cell = day && grids.flatMap( ( g ) => g.cells ).find( ( c ) => c.day === day );
				if ( ! cell || day.hasAttribute( 'data-disabled' ) || day.hasAttribute( 'data-unavailable' ) ) {
					return;
				}
				const a = api();
				/* the stay as the inputs hold it — the part's truth — not the machine's, which lets an end go when a
				   range is set from here */
				const [ start, end ] = read();
				const picked = cell.value;
				if ( editing === 1 && start && picked.compare( start ) > 0 ) {
					ev.stopPropagation();
					a.setValue( [ start, picked ] );
				} else if ( editing === 0 && end && picked.compare( end ) < 0 ) {
					ev.stopPropagation();
					a.setValue( [ picked, end ] );
					editing = 1;
				} else {
					editing = 1; // Zag's own pick: a fresh start, or the end of one begun — the end comes next
					return;
				}
				render();
			},
			true
		);
	}
	clear.addEventListener( 'click', () => api().clearValue() );
	/* data-close="pick": the range whole by a day pressed (or Enter on it), the calendar shuts — as Done would */
	if ( closeOnPick && ! always ) {
		const whole = ( ev ) => {
			const day = ev.target.closest && ev.target.closest( '[data-gcb-kit-dates-day]' );
			if ( day && ( ev.type === 'click' || ev.key === 'Enter' || ev.key === ' ' ) ) {
				setTimeout( () => {
					const [ s, e ] = read();
					if ( ! stopped && s && e && day.hasAttribute( 'data-stay-end' ) ) {
						shut();
					}
				} );
			}
		};
		inner.addEventListener( 'click', whole );
		inner.addEventListener( 'keydown', whole );
	}

	/* a date set by the page (the filter's reset, a chip taken off): the calendar follows */
	const follow = () => {
		if ( stopped ) {
			return;
		}
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
	root.gcbKitDates = { service, inputs, editing: () => editing }; // editing: the end a panel's next press sets
	/* a router swap that takes what it built: started again over the markup the server drew (../_core/kept.js) */
	kept( root, () => !! root.querySelector( '[data-gcb-kit-dates-shown]' ) && inputs.every( ( i ) => i.isConnected && i.hasAttribute( 'data-gcb-kit-dates-input' ) ), () => {
		stopped = true;
		service.stop();
		pane?.stop();
		delete root.gcbKitDates;
		live( root );
	} );
}

/**
 * ONE DATE (2026-10-21: a delivery day, an appointment, a date of birth, an event's day; GCB Forms' date field). One
 * real date input — the truth, ISO, what a form sends — in the design's field:
 *
 *   <div data-gcb-kit="dates" data-mode="single" data-earliest="today">
 *     <label data-gcb-kit-field><span>Delivery day</span><input type="date" name="day" min="…" max="…"></label>
 *   </div>
 *
 * The field shows the date in the page's language (its <html lang>, through Intl: "15 Nov 2026", "Nov 15, 2026") and
 * opens one month in the kit's widget panel; a day pressed (or Enter on it) is the date — the panel shuts and the input
 * is written with input and change. The heading opens Zag's month view, and again its years (a date of birth is
 * decades back). The input's min and max, and data-earliest / data-latest ("today" or a date), bound it — the tighter
 * of each wins. data-calendar="always" draws the month open in place instead. data-close="done" keeps the month open
 * after a day is pressed (shut by Escape, a press outside, or the field); data-icon="none" draws no calendar mark in the
 * field; data-fixed-weeks, data-weekday and data-clear as a range's.
 */
function single( root, input ) {
	let stopped = false;
	const n = ++count;
	const locale = root.getAttribute( 'data-locale' ) || document.documentElement.lang || 'en-GB';
	const always = root.getAttribute( 'data-calendar' ) === 'always';
	const words = new Intl.DateTimeFormat( locale, { day: 'numeric', month: 'short', year: 'numeric' } );
	const say = ( d ) => ( d ? words.format( d.toDate( zone ) ) : '' );
	const later = ( a, b ) => ( ! a ? b : ! b ? a : a.compare( b ) >= 0 ? a : b );
	const sooner = ( a, b ) => ( ! a ? b : ! b ? a : a.compare( b ) <= 0 ? a : b );
	const min = later( dayOf( input.getAttribute( 'min' ) ), boundOf( root.getAttribute( 'data-earliest' ) ) );
	const max = sooner( dayOf( input.getAttribute( 'max' ) ), boundOf( root.getAttribute( 'data-latest' ) ) );
	const says = ( k ) => root.getAttribute( 'data-' + k );
	const closeOnPick = says( 'close' ) !== 'done';
	const weekday = [ 'short', 'long' ].includes( says( 'weekday' ) ) ? says( 'weekday' ) : 'narrow';
	const noClear = says( 'clear' ) === 'none';

	/* THE FIELD: the design's box round the input, else one made for it; it shows the date in words and opens the month */
	let field = input.closest( '[data-gcb-kit-field]' );
	if ( ! field || ! root.contains( field ) ) {
		field = input.closest( 'label' );
	}
	if ( ! field || ! root.contains( field ) || field === root ) {
		field = el( 'div', { 'data-gcb-kit-field': '' } );
		input.replaceWith( field );
		field.appendChild( input );
	}
	field.setAttribute( 'data-gcb-kit-dates-single', '' );
	const shown = el( 'span', { 'data-gcb-kit-dates-shown': '', id: `gcb-dates-${ n }-shown` } );
	input.after( shown );
	input.setAttribute( 'data-gcb-kit-dates-input', '' );
	input.tabIndex = -1; // out of sight, and out of the tab order: the field is what a visitor reaches
	/* its mark: the drawing's [data-gcb-kit-dates-icon] in the field, else the kit's calendar — none with data-icon="none" */
	if ( ! drawn( field, 'icon' ) && says( 'icon' ) !== 'none' ) {
		const icon = el( 'span', { 'data-gcb-kit-dates-icon': '', 'aria-hidden': 'true' } );
		icon.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
		field.appendChild( icon );
	}
	const placeholder = input.getAttribute( 'data-placeholder' ) || input.getAttribute( 'placeholder' ) || says( 'placeholder' ) || 'Add date';
	if ( ! always ) {
		field.setAttribute( 'tabindex', field.getAttribute( 'tabindex' ) ?? '0' );
		field.setAttribute( 'role', field.getAttribute( 'role' ) ?? 'button' );
		field.setAttribute( 'aria-haspopup', 'dialog' );
	}
	/* named by the form's own label (a <label for> outside the field) and the date it shows */
	const outside = [ ...( input.labels || [] ) ].filter( ( l ) => ! field.contains( l ) );
	if ( outside.length ) {
		outside.forEach( ( l, k ) => {
			l.id = l.id || `gcb-dates-${ n }-label-${ k }`;
			l.addEventListener( 'click', ( e ) => {
				e.preventDefault(); // the input is out of sight: the label's press goes to the field
				field.focus();
			} );
		} );
		field.setAttribute( 'aria-labelledby', [ ...outside.map( ( l ) => l.id ), shown.id ].join( ' ' ) );
	}
	/* the input's state said on the field: its error (a form's check), what describes it, whether it can be used */
	const mirror = () => {
		[ 'aria-invalid', 'aria-describedby', 'aria-required' ].forEach( ( a ) => {
			const v = input.getAttribute( a ) ?? ( a === 'aria-required' && input.required ? 'true' : null );
			if ( v === null ) {
				field.removeAttribute( a );
			} else {
				field.setAttribute( a, v );
			}
		} );
		if ( input.disabled ) {
			field.setAttribute( 'aria-disabled', 'true' );
		} else if ( field.getAttribute( 'aria-disabled' ) === 'true' ) {
			field.removeAttribute( 'aria-disabled' );
		}
	};
	mirror();
	const watch = new MutationObserver( mirror );
	watch.observe( input, { attributes: true, attributeFilter: [ 'aria-invalid', 'aria-describedby', 'aria-required', 'required', 'disabled' ] } );

	/* THE CALENDAR: where the design put it, else after the field */
	let calendar = root.querySelector( '[data-gcb-kit-dates-calendar]' );
	if ( ! calendar ) {
		calendar = el( 'div', { 'data-gcb-kit-dates-calendar': '' } );
		root.appendChild( calendar );
	}
	calendar.setAttribute( 'data-single', '' );
	calendar.toggleAttribute( 'data-always', always );
	const inner = el( 'div', { 'data-gcb-kit-dates-inner': '' } );
	/* the patterns first, out of the calendar: a day, a weekday, a month or year cell */
	const dayPattern = pattern( calendar, 'day' );
	const weekdayPattern = pattern( calendar, 'weekday' );
	const cellPattern = pattern( calendar, 'cell' );
	const head = drawn( calendar, 'head' ) || el( 'div', { 'data-gcb-kit-dates-head': '' } );
	let prev = drawn( calendar, 'prev' );
	if ( ! prev ) {
		prev = el( 'button', { type: 'button', 'data-gcb-kit-dates-prev': '' } );
		prev.innerHTML = CHEVRON( 'M15 6l-6 6 6 6' );
	}
	/* the heading is a button: the month view, then the years (Zag's views) — a drawn one says its words in its
	   [data-gcb-kit-dates-label] (else all of it), with its own caret or none */
	let title = drawn( calendar, 'title' );
	let titleWords;
	if ( title ) {
		title.setAttribute( 'data-gcb-kit-dates-view', '' );
		titleWords = title.querySelector( '[data-gcb-kit-dates-label]' ) || title;
		titleWords.setAttribute( 'aria-live', 'polite' );
	} else {
		title = el( 'button', { type: 'button', 'data-gcb-kit-dates-title': '', 'data-gcb-kit-dates-view': '' } );
		titleWords = el( 'span', { 'aria-live': 'polite' } );
		const caret = el( 'span', { 'data-gcb-kit-dates-caret': '', 'aria-hidden': 'true' } );
		caret.innerHTML = CHEVRON( 'M6 9l6 6 6-6' );
		title.append( titleWords, caret );
	}
	let next = drawn( calendar, 'next' );
	if ( ! next ) {
		next = el( 'button', { type: 'button', 'data-gcb-kit-dates-next': '' } );
		next.innerHTML = CHEVRON( 'M9 6l6 6-6 6' );
	}
	seat( head, [ prev, title, next ] );
	/* the days: a month's grid, made once a month */
	const days = el( 'table', { 'data-gcb-kit-dates-grid': '' } );
	const thead = el( 'thead' );
	const headRow = el( 'tr' );
	thead.appendChild( headRow );
	const tbody = el( 'tbody' );
	days.append( thead, tbody );
	/* the months of a year, or the years of a decade: one grid, made once a year or a decade */
	const pick = el( 'table', { 'data-gcb-kit-dates-pick': '' } );
	const pickBody = el( 'tbody' );
	pick.appendChild( pickBody );
	const foot = drawn( calendar, 'foot' ) || el( 'div', { 'data-gcb-kit-dates-foot': '' } );
	const clear = drawn( calendar, 'clear' ) || el( 'button', { type: 'button', 'data-gcb-kit-dates-clear': '' }, ( ! noClear && says( 'clear' ) ) || 'Clear' );
	seat( foot, [ clear ] );
	inner.append( head, days, pick, foot );
	calendar.appendChild( inner );

	const unavailable = ( root.getAttribute( 'data-unavailable' ) || '' )
		.split( ',' )
		.map( ( part ) => part.trim().split( '/' ).map( dayOf ) )
		.filter( ( [ from ] ) => from );
	const isUnavailable = ( d ) => unavailable.some( ( [ from, to ] ) => d.compare( from ) >= 0 && d.compare( to || from ) <= 0 );

	let quiet = false; // the input written here: its own events are not the page setting it
	let following = false; // the page set the input: the calendar follows, and stays as it is
	const read = () => dayOf( input.value );
	const write = ( d ) => {
		const v = iso( d );
		if ( input.value === v ) {
			return;
		}
		quiet = true;
		input.value = v;
		input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		input.dispatchEvent( new Event( 'change', { bubbles: true } ) );
		quiet = false;
	};
	const initial = read();
	const t = today( zone );
	const start = initial ?? sooner( later( t, min ), max ) ?? t;
	const service = new VanillaMachine( datepicker.machine, {
		id: 'gcb-dates-' + n,
		locale,
		timeZone: zone,
		inline: true,
		selectionMode: 'single',
		startOfWeek: Number( root.getAttribute( 'data-week-starts' ) ?? 1 ),
		fixedWeeks: says( 'fixed-weeks' ) !== 'false',
		numOfMonths: 1,
		isDateUnavailable: unavailable.length ? isUnavailable : undefined,
		min: min ?? undefined,
		max: max ?? undefined,
		defaultValue: initial ? [ initial ] : [],
		defaultFocusedValue: start,
		onValueChange: ( d ) => {
			write( d.value[ 0 ] ?? null );
			if ( d.value[ 0 ] && ! following && closeOnPick ) {
				shut(); // a day picked: the date is chosen
			}
		},
	} );
	const api = () => datepicker.connect( service.service, normalizeProps );

	let month = '';
	const build = ( a ) => {
		const key = iso( a.visibleRange.start );
		if ( key === month ) {
			return;
		}
		month = key;
		headRow.replaceChildren(
			...a.weekDays.map( ( w ) => {
				if ( ! weekdayPattern ) {
					return el( 'th', { scope: 'col', 'aria-label': w.long }, w[ weekday ] );
				}
				const th = el( 'th', { scope: 'col', 'aria-label': w.long } );
				th.appendChild( fill( weekdayPattern.cloneNode( true ), w[ weekday ] ) );
				return th;
			} )
		);
		cells = [];
		tbody.replaceChildren(
			...a.weeks.map( ( week ) => {
				const tr = el( 'tr' );
				week.forEach( ( value ) => {
					const td = el( 'td' );
					const day = madeOr( dayPattern, 'div', { 'data-gcb-kit-dates-day': '' }, String( value.day ) );
					td.appendChild( day );
					tr.appendChild( td );
					cells.push( { value, td, day } );
				} );
				return tr;
			} )
		);
	};
	let cells = [];
	let picks = [];
	let pickKey = '';
	const COLUMNS = 4;
	const buildPick = ( a ) => {
		const key = a.view === 'month' ? 'm' + a.focusedValue.year : 'y' + a.getDecade().start;
		if ( key === pickKey ) {
			return;
		}
		pickKey = key;
		const rows = a.view === 'month' ? a.getMonthsGrid( { columns: COLUMNS, format: 'short' } ) : a.getYearsGrid( { columns: COLUMNS } );
		picks = [];
		pickBody.replaceChildren(
			...rows.map( ( row ) => {
				const tr = el( 'tr' );
				row.forEach( ( c ) => {
					const td = el( 'td' );
					const cell = madeOr( cellPattern, 'div', { 'data-gcb-kit-dates-cell': '' }, c.label );
					td.appendChild( cell );
					tr.appendChild( td );
					picks.push( { value: c.value, td, cell } );
				} );
				return tr;
			} )
		);
	};

	const render = () => {
		if ( stopped ) {
			return;
		}
		const a = api();
		const view = a.view;
		build( a );
		spreadProps( calendar, a.getRootProps() );
		spreadProps( inner, a.getContentProps() );
		inner.hidden = false;
		spreadProps( prev, a.getPrevTriggerProps( { view } ) );
		spreadProps( next, a.getNextTriggerProps( { view } ) );
		spreadProps( title, a.getViewTriggerProps( { view } ) );
		calendar.setAttribute( 'data-view', view );
		titleWords.textContent = view === 'day' ? a.visibleRangeText.start : view === 'month' ? String( a.focusedValue.year ) : `${ a.getDecade().start } – ${ a.getDecade().end }`;
		days.hidden = view !== 'day';
		pick.hidden = view === 'day';
		const value = read();
		if ( view === 'day' ) {
			spreadProps( days, a.getTableProps( { view: 'day', id: `gcb-dates-${ n }-0` } ) );
			spreadProps( thead, a.getTableHeadProps( { view: 'day' } ) );
			spreadProps( tbody, a.getTableBodyProps( { view: 'day' } ) );
			cells.forEach( ( c ) => {
				spreadProps( c.td, a.getDayTableCellProps( { value: c.value } ) );
				spreadProps( c.day, a.getDayTableCellTriggerProps( { value: c.value } ) );
				/* the day chosen: the stay's end circle, one day long */
				const on = ! c.day.hasAttribute( 'data-outside-range' ) && !! value && c.value.compare( value ) === 0;
				c.day.toggleAttribute( 'data-stay-start', on );
				c.day.toggleAttribute( 'data-stay-end', on );
			} );
		} else {
			buildPick( a );
			spreadProps( pick, a.getTableProps( { view, columns: COLUMNS, id: `gcb-dates-${ n }-${ view }` } ) );
			spreadProps( pickBody, a.getTableBodyProps( { view } ) );
			picks.forEach( ( p ) => {
				const props = { value: p.value, columns: COLUMNS };
				if ( view === 'month' ) {
					spreadProps( p.td, a.getMonthTableCellProps( props ) );
					spreadProps( p.cell, a.getMonthTableCellTriggerProps( props ) );
				} else {
					spreadProps( p.td, a.getYearTableCellProps( props ) );
					spreadProps( p.cell, a.getYearTableCellTriggerProps( props ) );
				}
				/* this month, this year: as today is marked among the days */
				p.cell.toggleAttribute( 'data-today', view === 'month' ? a.focusedValue.year === t.year && p.value === t.month : p.value === t.year );
			} );
		}
		shown.textContent = value ? say( value ) : placeholder;
		shown.toggleAttribute( 'data-placeholder', ! value );
		said();
		clear.hidden = noClear || ! value;
		foot.hidden = noClear || ! value;
		if ( pane && pane.isOpen() ) {
			pane.place();
		}
	};

	/* the field says whether its month is open — as the panel says it (the widget sets its data-open) */
	const said = () => {
		if ( ! always ) {
			const on = calendar.hasAttribute( 'data-open' );
			field.setAttribute( 'aria-expanded', String( on ) );
			field.toggleAttribute( 'data-open', on );
		}
	};
	const opened = new MutationObserver( said );
	opened.observe( calendar, { attributes: true, attributeFilter: [ 'data-open' ] } );
	/* the focus back on the field when the panel shuts with it inside (a day picked, Escape) */
	const back = () => {
		const at = document.activeElement;
		if ( ! at || at === document.body || calendar.contains( at ) ) {
			requestAnimationFrame( () => field.isConnected && field.focus( { preventScroll: true } ) );
		}
	};
	const pane = always
		? null
		: widget( calendar, field, {
				side: 'start',
				keep: () => [ field ],
				closed: () => {
					back();
					render();
				},
				focus: false, // the day to start from takes it, below
		  } );
	/* into the month on the day to start from — the chosen one, else today's (within the limits): arrows from there */
	const toDay = () =>
		requestAnimationFrame( () => {
			const cell = inner.querySelector( '[data-part="table-cell-trigger"][data-focus]:not([data-outside-range])' );
			if ( cell ) {
				cell.focus( { preventScroll: true } );
			}
		} );
	const openUp = () => {
		if ( ! pane || input.disabled ) {
			return;
		}
		const a = api();
		if ( a.view !== 'day' ) {
			a.setView( 'day' );
		}
		const d = read();
		a.setFocusedValue( d ?? start );
		pane.open();
		render();
		toDay();
	};
	const shut = () => {
		if ( pane && pane.isOpen() ) {
			pane.close(); // its closed() puts the focus back on the field
		}
	};
	if ( always ) {
		calendar.setAttribute( 'data-open', '' );
	} else {
		field.addEventListener( 'click', ( e ) => {
			e.preventDefault(); // a <label> field: never the hidden input's own picker
			if ( pane.isOpen() ) {
				shut();
			} else {
				openUp();
			}
		} );
		field.addEventListener( 'keydown', ( e ) => {
			if ( e.target !== field ) {
				return;
			}
			if ( e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' ) {
				e.preventDefault();
				openUp();
			}
		} );
	}
	/* the day already chosen, pressed again: still the date — the panel shuts */
	inner.addEventListener( 'click', ( ev ) => {
		const day = ev.target.closest && ev.target.closest( '[data-gcb-kit-dates-day]' );
		if ( day && day.hasAttribute( 'data-stay-start' ) && closeOnPick ) {
			shut();
		}
	} );
	inner.addEventListener(
		'keydown',
		( ev ) => {
			if ( ev.key !== 'Enter' && ev.key !== ' ' ) {
				return;
			}
			const day = ev.target.closest && ev.target.closest( '[data-gcb-kit-dates-day]' );
			if ( day && day.hasAttribute( 'data-stay-start' ) && closeOnPick ) {
				setTimeout( shut );
			}
		},
		true
	);
	clear.addEventListener( 'click', () => {
		api().clearValue();
		write( null );
		render();
		field.focus( { preventScroll: true } );
		shut();
	} );

	/* a date set by the page (a reset, a script): the calendar follows */
	const follow = () => {
		if ( stopped || quiet ) {
			return;
		}
		const want = read();
		const a = api();
		if ( iso( want ) !== iso( a.value[ 0 ] ) ) {
			following = true;
			if ( want ) {
				a.setValue( [ want ] );
				a.setFocusedValue( want );
			} else {
				a.clearValue();
			}
			following = false;
		}
		render();
	};
	const own = Object.getOwnPropertyDescriptor( HTMLInputElement.prototype, 'value' );
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
	input.form?.addEventListener( 'reset', () => setTimeout( follow ) );

	service.subscribe( render );
	service.start();
	render();
	root.classList.add( 'is-live' );
	root.gcbKitDates = { service, inputs: [ input ], mode: 'single', open: openUp, close: shut };
	kept( root, () => !! root.querySelector( '[data-gcb-kit-dates-shown]' ) && input.isConnected && input.hasAttribute( 'data-gcb-kit-dates-input' ), () => {
		stopped = true;
		watch.disconnect();
		opened.disconnect();
		service.stop();
		pane?.stop();
		delete root.gcbKitDates;
		live( root );
	} );
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
