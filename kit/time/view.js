/**
 * THE KIT'S TIME (2026-10-22, Mark: "I think we should style the time picker first" — a time was the browser's bare
 * "--:-- --" beside the kit's calendar, and looked out of place). A time of day picked from slots: a table at 19:30, a
 * test drive at 10:00, an appointment from a list. Its field is the kit's single-date field with a clock where the date
 * has its calendar; it opens the kit's widget panel (kit/_core/widget.js) with the slots as chips in the calendar's
 * days' own look.
 *
 *   <div data-gcb-kit="time" data-min="17:00" data-max="21:30" data-step="15">
 *     <div data-gcb-kit-field><input type="time" name="time" data-placeholder="Choose a time"></div>
 *   </div>
 *
 * THE NATIVE INPUT STAYS THE TRUTH: HH:MM, what a form sends and a page sets; picked here, it is written with input and
 * change. Without the script it is the plain time input (in the controls' box where a form draws one).
 *
 * THE SLOTS, the first that applies:
 *   data-times="12:00 12:30 18:00"     an explicit list
 *   data-groups="Lunch 12:00-14:30, Dinner 17:00-21:30"   named sittings, each stepped from its start to its end
 *   data-min / data-max / data-step    a range in minutes (the input's own min, max and step — in seconds — too; the
 *                                      tighter bound wins). Defaults: 00:00, 23:59, 30 minutes.
 * data-unavailable="18:00 18:15 20:00-21:00" strikes slots (a range from its start up to, not including, its end).
 * GROUPS: data-groups names them; a long list of plain slots (more than 12, across more than one part of the day) is
 * set out under Morning, Afternoon, Evening (data-periods="…" for other words; data-groups="none" never groups).
 *
 * WITH A DATE: data-gcb-kit-time-date="<the data-sync of a kit dates part>" pairs it with that date. When the date is
 * today, the times gone by are struck (and a chosen one gone by is let go). Each time the date changes the part asks
 * the page which slots that day has — answer only if a day's slots differ (a restaurant shut on Mondays at lunch):
 *
 *   document.addEventListener( 'gcbkit:time-slots', ( e ) => {
 *     // e.detail = { date: '2026-11-08', times: [ '17:00', … ], unavailable: [], answer( { times, unavailable } ) }
 *     if ( e.detail.date.endsWith( '-08' ) ) e.detail.unavailable.push( '19:00', '19:15' );   // at once, or
 *     fetch( … ).then( ( r ) => r.json() ).then( ( a ) => e.detail.answer( a ) );           // later
 *   } );
 *
 * Its state, for styling: the field data-open / aria-expanded; a slot data-selected (aria-selected), data-unavailable
 * (booked, or gone by: data-past) and aria-disabled. The panel's listbox holds role="option" slots, each named by its
 * words ("5:30 pm"); arrows move through the grid, Home and End to its ends, Enter or Space picks, Escape shuts.
 *
 * WHAT THE PART'S BOX SAYS (2026-10-26, each defaulting to what it always did): data-hour12="true|false" the clock
 * (else the language's), data-lead="120" the minutes' notice a slot today needs (else none), data-period-breaks="12:00
 * 17:00" where the parts of the day turn, data-close="done" keeps the panel open after a pick (else it shuts),
 * data-clear="none" no Clear, data-icon="none" no clock in the field.
 *
 * THE DRAWING'S OWN PARTS FIRST (2026-10-26, kit/AGENTS.md 4): a design may draw, in the part, any of the panel's parts
 * with the hook the kit gives its own — the panel, its slots box, the "no times" words, the foot and its Clear, the
 * field's clock ([data-gcb-kit-time-icon]) — and that element is used, its classes kept. A slot, a heading and a grid
 * of slots are patterns, drawn once and cloned for each: the slot's words go in its [data-gcb-kit-time-label] (else its
 * text), its states said on it as on the kit's (data-selected, aria-selected, data-unavailable, data-past,
 * aria-disabled). What is not drawn the kit makes, as it always has.
 */
import { kept } from '../_core/kept.js';
import { widget } from '../_core/widget.js';

/* the part is live, said on <html> where no swap reaches (as kit/dates) */
document.documentElement.classList.add( 'gcb-kit-time-on' );

const ROOT = '[data-gcb-kit="time"]';
let count = 0;

const pad = ( n ) => String( n ).padStart( 2, '0' );
/** "17:30" (or "17:30:00") as minutes into the day */
const minsOf = ( v ) => {
	const m = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec( String( v ?? '' ).trim() );
	if ( ! m || +m[ 1 ] > 23 || +m[ 2 ] > 59 ) {
		return null;
	}
	return +m[ 1 ] * 60 + +m[ 2 ];
};
const hhmm = ( n ) => `${ pad( Math.floor( n / 60 ) ) }:${ pad( n % 60 ) }`;
const el = ( tag, attrs = {}, text = '' ) => {
	const e = document.createElement( tag );
	Object.entries( attrs ).forEach( ( [ k, v ] ) => e.setAttribute( k, v ) );
	if ( text ) {
		e.textContent = text;
	}
	return e;
};
const localDay = ( d = new Date() ) => `${ d.getFullYear() }-${ pad( d.getMonth() + 1 ) }-${ pad( d.getDate() ) }`;
/** times and ranges, by spaces or commas: "18:00 18:15, 20:00-21:00" → [ [from, to?] ] */
const spans = ( s ) =>
	String( s || '' )
		.split( /[\s,]+/ )
		.filter( Boolean )
		.map( ( w ) => w.split( /[-–]/ ).map( minsOf ) )
		.filter( ( [ a ] ) => a !== null );
/* a part the drawing drew with its hook, else null — the kit makes its own */
const drawn = ( scope, name ) => scope.querySelector( `[data-gcb-kit-time-${ name }]` ) || null;
/* a pattern drawn once, taken out and cloned for each; its words in its [data-gcb-kit-time-label], else its text */
const pattern = ( scope, name ) => {
	const p = drawn( scope, name );
	p?.remove();
	return p;
};
const fill = ( e, text ) => {
	( e.querySelector( '[data-gcb-kit-time-label]' ) || e ).textContent = text;
	return e;
};
const made = ( p, attrs, text ) => {
	const e = p.cloneNode( true );
	Object.entries( attrs ).forEach( ( [ k, v ] ) => e.setAttribute( k, v ) );
	return text === undefined ? e : fill( e, text );
};
/* the drawing's own in its place, the kit's in the kit's order */
const seat = ( box, parts ) => {
	parts.forEach( ( e, k ) => {
		if ( box.contains( e ) ) {
			return;
		}
		const before = parts.slice( k + 1 ).find( ( x ) => x.parentElement === box );
		box.insertBefore( e, before || null );
	} );
};
const CLOCK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>';

function live( root ) {
	if ( root.gcbKitTime ) {
		return;
	}
	const input = root.querySelector( 'input[type="time"]' ) || root.querySelector( 'input' );
	if ( ! input ) {
		return;
	}
	let stopped = false;
	const n = ++count;
	const locale = root.getAttribute( 'data-locale' ) || document.documentElement.lang || 'en-GB';
	const says = ( k ) => root.getAttribute( 'data-' + k );
	/* the page's clock: a 12-hour one says "5:30 pm" as its language does; a 24-hour one "06:30", its hours in two figures
	   as timetables and bookings write them (Intl's numeric hour said "6:30" in en-GB). data-hour12 says which */
	const clock = says( 'hour12' );
	const hour12 = clock === 'true' || ( clock !== 'false' && /h1[12]/.test( new Intl.DateTimeFormat( locale, { hour: 'numeric' } ).resolvedOptions().hourCycle || '' ) );
	const fmt = new Intl.DateTimeFormat( locale, { hour: hour12 ? 'numeric' : '2-digit', minute: '2-digit', ...( clock === 'true' || clock === 'false' ? { hour12 } : {} ) } );
	const say = ( m ) => fmt.format( new Date( 2000, 0, 1, Math.floor( m / 60 ), m % 60 ) );

	/* THE SLOTS the part offers, before a day's answer */
	const tighter = ( a, b, pick ) => ( a === null ? b : b === null ? a : pick( a, b ) );
	const lo = tighter( minsOf( root.getAttribute( 'data-min' ) ), minsOf( input.getAttribute( 'min' ) ), Math.max );
	const hi = tighter( minsOf( root.getAttribute( 'data-max' ) ), minsOf( input.getAttribute( 'max' ) ), Math.min );
	const ownStep = parseFloat( root.getAttribute( 'data-step' ) || '' );
	const nativeStep = parseFloat( input.getAttribute( 'step' ) || '' ) / 60;
	const step = Math.max( 1, Math.round( ownStep > 0 ? ownStep : nativeStep >= 1 ? nativeStep : 30 ) );
	const inBounds = ( m ) => ( lo === null || m >= lo ) && ( hi === null || m <= hi );
	const stepped = ( from, to ) => {
		const out = [];
		for ( let m = from; m <= to; m += step ) {
			out.push( m );
		}
		return out;
	};
	const groupsAttr = ( root.getAttribute( 'data-groups' ) || '' ).trim();
	const named = groupsAttr && ! /^(none|periods)$/i.test( groupsAttr )
		? groupsAttr
				.split( ',' )
				.map( ( g ) => /^(.*?)\s*(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})$/.exec( g.trim() ) )
				.filter( Boolean )
				.map( ( [ , name, a, b ] ) => ( { name: name.trim(), from: minsOf( a ), to: minsOf( b ) } ) )
				.filter( ( g ) => g.from !== null && g.to !== null )
		: [];
	const explicit = spans( root.getAttribute( 'data-times' ) ).map( ( [ a ] ) => a );
	const unique = ( list ) => [ ...new Set( list ) ].sort( ( a, b ) => a - b );
	const base = unique(
		explicit.length
			? explicit.filter( inBounds )
			: named.length
			? named.flatMap( ( g ) => stepped( g.from, g.to ) ).filter( inBounds )
			: stepped( lo ?? 0, hi ?? 23 * 60 + 59 )
	);
	const struck = spans( root.getAttribute( 'data-unavailable' ) );
	const isStruck = ( m, list ) => list.some( ( [ a, b ] ) => ( b === undefined || b === null ? m === a : m >= a && m < b ) );
	/* the parts' words: by commas where there are any ("Early, Late morning, …"), else by spaces */
	const periodWords = root.getAttribute( 'data-periods' ) || 'Morning Afternoon Evening';
	const periods = periodWords.split( periodWords.includes( ',' ) ? /\s*,\s*/ : /\s+/ ).filter( Boolean );
	/* where the parts of the day turn: data-period-breaks="12:00 17:00" (the default) — n breaks, n + 1 parts */
	const breaks = spans( says( 'period-breaks' ) || '12:00 17:00' ).map( ( [ a ] ) => a ).sort( ( a, b ) => a - b );
	const periodOf = ( m ) => breaks.filter( ( b ) => m >= b ).length;
	/* the notice a slot today needs, in minutes: data-lead="120" (none by default) */
	const lead = Math.max( 0, Number( says( 'lead' ) ) || 0 );
	const closeOnPick = says( 'close' ) !== 'done';
	const noClear = says( 'clear' ) === 'none';

	/* THE DATE it is paired with, if any: read each time (a swap may have replaced it) */
	const dateKey = root.getAttribute( 'data-gcb-kit-time-date' ) || '';
	const dateInput = () => {
		if ( ! dateKey ) {
			return null;
		}
		const part = document.querySelector( `[data-gcb-kit="dates"][data-sync="${ CSS.escape( dateKey ) }"]` );
		return part ? part.querySelector( 'input[type="date"]' ) || part.querySelector( 'input' ) : null;
	};
	const dateOf = () => ( dateInput()?.value || '' ).slice( 0, 10 );
	let day = dateOf();
	let answer = null; // the page's answer for `day`: { times, unavailable }

	/** each slot now: its minutes, its value, its words, whether it can be had and why not */
	const slots = () => {
		const times = answer?.times ? unique( answer.times.map( minsOf ).filter( ( m ) => m !== null ) ) : base;
		const extra = answer?.unavailable ? spans( answer.unavailable.join( ' ' ) ) : [];
		const today = localDay();
		const now = new Date();
		const nowM = now.getHours() * 60 + now.getMinutes();
		return times.map( ( m ) => {
			const past = !! day && ( day < today || ( day === today && m <= nowM + lead ) );
			const booked = isStruck( m, struck ) || isStruck( m, extra );
			return { m, v: hhmm( m ), label: say( m ), past, off: past || booked };
		} );
	};
	/** the slots under their headings: data-groups', else the parts of the day for a long list, else one */
	const grouped = ( list ) => {
		if ( named.length ) {
			const out = named.map( ( g ) => ( { name: g.name, slots: list.filter( ( s ) => s.m >= g.from && s.m <= g.to ) } ) );
			const rest = list.filter( ( s ) => ! named.some( ( g ) => s.m >= g.from && s.m <= g.to ) );
			return [ ...out, { name: '', slots: rest } ].filter( ( g ) => g.slots.length );
		}
		const force = /^periods$/i.test( groupsAttr );
		if ( ! /^none$/i.test( groupsAttr ) && ( force || list.length > 12 ) ) {
			const out = breaks
				.concat( [ null ] )
				.map( ( _, p ) => ( { name: periods[ p ] || '', slots: list.filter( ( s ) => periodOf( s.m ) === p ) } ) )
				.filter( ( g ) => g.slots.length );
			if ( out.length > 1 || force ) {
				return out;
			}
		}
		return [ { name: '', slots: list } ];
	};

	/* THE FIELD: the design's box round the input, else one made for it; it shows the time in words and opens the slots */
	let field = input.closest( '[data-gcb-kit-field]' );
	if ( ! field || ! root.contains( field ) ) {
		field = input.closest( 'label' );
	}
	if ( ! field || ! root.contains( field ) || field === root ) {
		field = el( 'div', { 'data-gcb-kit-field': '' } );
		input.replaceWith( field );
		field.appendChild( input );
	}
	field.setAttribute( 'data-gcb-kit-time-field', '' );
	const shown = el( 'span', { 'data-gcb-kit-time-shown': '', id: `gcb-time-${ n }-shown` } );
	input.after( shown );
	input.setAttribute( 'data-gcb-kit-time-input', '' );
	input.tabIndex = -1; // out of sight and out of the tab order: the field is what a visitor reaches
	/* its clock: the drawing's [data-gcb-kit-time-icon] in the field, else the kit's — none with data-icon="none" */
	if ( ! drawn( field, 'icon' ) && says( 'icon' ) !== 'none' ) {
		const icon = el( 'span', { 'data-gcb-kit-time-icon': '', 'aria-hidden': 'true' } );
		icon.innerHTML = CLOCK;
		field.appendChild( icon );
	}
	const placeholder = input.getAttribute( 'data-placeholder' ) || input.getAttribute( 'placeholder' ) || 'Add time';
	field.setAttribute( 'tabindex', field.getAttribute( 'tabindex' ) ?? '0' );
	field.setAttribute( 'role', field.getAttribute( 'role' ) ?? 'button' );
	field.setAttribute( 'aria-haspopup', 'listbox' );
	/* named by the form's own label (a <label for> outside the field) and the time it shows */
	const outside = [ ...( input.labels || [] ) ].filter( ( l ) => ! field.contains( l ) );
	const inside = field.querySelector( ':scope > span:not([data-gcb-kit-time-shown]):not([data-gcb-kit-time-icon])' );
	if ( outside.length ) {
		outside.forEach( ( l, k ) => {
			l.id = l.id || `gcb-time-${ n }-label-${ k }`;
			l.addEventListener( 'click', ( e ) => {
				e.preventDefault(); // the input is out of sight: the label's press goes to the field
				field.focus();
			} );
		} );
		field.setAttribute( 'aria-labelledby', [ ...outside.map( ( l ) => l.id ), shown.id ].join( ' ' ) );
	}
	const labelWords = ( outside[ 0 ]?.textContent || inside?.textContent || input.getAttribute( 'aria-label' ) || placeholder ).replace( /\s+/g, ' ' ).trim();
	/* a script focusing the input (a form's "choose a time") lands on the field */
	input.addEventListener( 'focus', () => field.focus() );
	/* the input's state said on the field: its error, what describes it, whether it can be used */
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

	/* THE PANEL: the slots (a listbox, under their headings), and Clear — the drawing's parts where it drew them */
	const slotPattern = pattern( root, 'slot' );
	const headingPattern = pattern( root, 'heading' );
	const gridPattern = pattern( root, 'grid' );
	gridPattern?.replaceChildren();
	const drewPanel = drawn( root, 'panel' );
	const panel = drewPanel || el( 'div', { 'data-gcb-kit-time-panel': '' } );
	panel.toggleAttribute( 'data-hour12', hour12 );
	const ids = { role: 'listbox', id: `gcb-time-${ n }-list`, 'aria-label': labelWords };
	const drewBox = drawn( panel, 'slots' );
	const box = drewBox ? made( drewBox, ids ) : el( 'div', { 'data-gcb-kit-time-slots': '', ...ids } );
	if ( drewBox ) {
		drewBox.replaceWith( box );
		box.replaceChildren();
	}
	const foot = drawn( panel, 'foot' ) || el( 'div', { 'data-gcb-kit-time-foot': '' } );
	const clear = drawn( panel, 'clear' ) || el( 'button', { type: 'button', 'data-gcb-kit-time-clear': '' }, ( ! noClear && says( 'clear' ) ) || 'Clear' );
	const none = drawn( panel, 'none' ) || el( 'p', { 'data-gcb-kit-time-none': '' }, root.getAttribute( 'data-none' ) || 'No times left on this day.' );
	seat( foot, [ clear ] );
	seat( panel, [ box, none, foot ] );
	if ( ! drewPanel ) {
		root.appendChild( panel );
	}
	field.setAttribute( 'aria-controls', box.id );

	let quiet = false;
	const read = () => minsOf( input.value );
	const write = ( m ) => {
		const v = m === null ? '' : hhmm( m );
		if ( input.value === v ) {
			return;
		}
		quiet = true;
		input.value = v;
		input.dispatchEvent( new Event( 'input', { bubbles: true } ) );
		input.dispatchEvent( new Event( 'change', { bubbles: true } ) );
		quiet = false;
	};

	let options = [];
	let drawnKey = '';
	let current = [];
	const render = () => {
		if ( stopped ) {
			return;
		}
		current = slots();
		const key = JSON.stringify( current.map( ( s ) => [ s.m, s.off, s.past ] ) );
		if ( key !== drawnKey ) {
			drawnKey = key;
			const had = document.activeElement?.closest?.( '[data-gcb-kit-time-slot]' )?.getAttribute( 'data-value' );
			options = [];
			box.replaceChildren(
				...grouped( current ).map( ( g, gi ) => {
					const wrap = el( 'div', { 'data-gcb-kit-time-group': '' } );
					if ( g.name ) {
						const headAttrs = { id: `gcb-time-${ n }-g${ gi }`, role: 'presentation' };
						const head = headingPattern ? made( headingPattern, headAttrs, g.name ) : el( 'div', { 'data-gcb-kit-time-heading': '', ...headAttrs }, g.name );
						wrap.setAttribute( 'role', 'group' );
						wrap.setAttribute( 'aria-labelledby', head.id );
						wrap.appendChild( head );
					} else {
						wrap.setAttribute( 'role', 'presentation' );
					}
					const grid = gridPattern ? made( gridPattern, { role: 'presentation' } ) : el( 'div', { 'data-gcb-kit-time-grid': '', role: 'presentation' } );
					g.slots.forEach( ( s ) => {
						const slotAttrs = { role: 'option', id: `gcb-time-${ n }-${ s.v.replace( ':', '' ) }`, 'data-value': s.v, tabindex: '-1' };
						const o = slotPattern
							? made( slotPattern, slotAttrs, s.label )
							: el( 'div', { role: 'option', id: slotAttrs.id, 'data-gcb-kit-time-slot': '', 'data-value': s.v, tabindex: '-1' }, s.label );
						if ( s.off ) {
							o.setAttribute( 'aria-disabled', 'true' );
							o.setAttribute( 'data-unavailable', '' );
						}
						o.toggleAttribute( 'data-past', s.past );
						grid.appendChild( o );
						options.push( { o, s } );
					} );
					wrap.appendChild( grid );
					return wrap;
				} )
			);
			if ( had ) {
				options.find( ( x ) => x.s.v === had )?.o.focus( { preventScroll: true } );
			}
		}
		const value = read();
		options.forEach( ( { o, s } ) => {
			const on = value !== null && s.m === value;
			o.setAttribute( 'aria-selected', String( on ) );
			o.toggleAttribute( 'data-selected', on );
		} );
		none.hidden = current.some( ( s ) => ! s.off );
		shown.textContent = value === null ? placeholder : say( value );
		shown.toggleAttribute( 'data-placeholder', value === null );
		foot.hidden = noClear || value === null;
		said();
		if ( pane.isOpen() ) {
			pane.place();
		}
	};

	/* the field says whether its slots are open — as the panel says it (the widget sets its data-open) */
	const said = () => {
		const on = panel.hasAttribute( 'data-open' );
		field.setAttribute( 'aria-expanded', String( on ) );
		field.toggleAttribute( 'data-open', on );
	};
	const opened = new MutationObserver( said );
	opened.observe( panel, { attributes: true, attributeFilter: [ 'data-open' ] } );
	const back = () => {
		const at = document.activeElement;
		if ( ! at || at === document.body || panel.contains( at ) ) {
			requestAnimationFrame( () => field.isConnected && field.focus( { preventScroll: true } ) );
		}
	};
	const pane = widget( panel, field, {
		side: 'start',
		keep: () => [ field ],
		closed: () => {
			back();
			render();
		},
		focus: false, // the slot to start from takes it, below
	} );

	/* the focus on one slot (the others out of the tab order), scrolled into the list's view, never the page's */
	const focusOn = ( o, centre = false ) => {
		if ( ! o ) {
			return;
		}
		options.forEach( ( x ) => x.o.setAttribute( 'tabindex', x.o === o ? '0' : '-1' ) );
		o.focus( { preventScroll: true } );
		const top = o.offsetTop - box.offsetTop;
		const sticky = box.querySelector( '[data-gcb-kit-time-heading]' )?.offsetHeight || 0;
		if ( centre ) {
			box.scrollTop = Math.max( 0, top - ( box.clientHeight - o.offsetHeight ) / 2 );
		} else if ( top - sticky < box.scrollTop ) {
			box.scrollTop = top - sticky - 4;
		} else if ( top + o.offsetHeight > box.scrollTop + box.clientHeight ) {
			box.scrollTop = top + o.offsetHeight - box.clientHeight + 4;
		}
	};
	const start = () => {
		const value = read();
		return ( options.find( ( x ) => value !== null && x.s.m === value ) || options.find( ( x ) => ! x.s.off ) || options[ 0 ] )?.o;
	};
	const openUp = () => {
		if ( input.disabled ) {
			return;
		}
		render();
		pane.open();
		render();
		requestAnimationFrame( () => focusOn( start(), true ) );
	};
	const shut = () => {
		if ( pane.isOpen() ) {
			pane.close(); // its closed() puts the focus back on the field
		}
	};
	const pick = ( o ) => {
		const x = options.find( ( y ) => y.o === o );
		if ( ! x || x.s.off ) {
			return;
		}
		write( x.s.m );
		render();
		if ( closeOnPick ) {
			shut();
		}
	};

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
			if ( pane.isOpen() && e.key === 'ArrowDown' ) {
				focusOn( start(), true );
			} else {
				openUp();
			}
		}
	} );
	box.addEventListener( 'click', ( e ) => {
		const o = e.target.closest?.( '[data-gcb-kit-time-slot]' );
		if ( o ) {
			pick( o );
		}
	} );
	/* the keyboard through the grid: left and right in order, up and down to the slot above or below (across headings) */
	const near = ( o, down ) => {
		const r = o.getBoundingClientRect();
		const mid = r.left + r.width / 2;
		const rows = options
			.map( ( x ) => ( { o: x.o, r: x.o.getBoundingClientRect() } ) )
			.filter( ( x ) => ( down ? x.r.top > r.top + 2 : x.r.top < r.top - 2 ) );
		if ( ! rows.length ) {
			return null;
		}
		const row = down ? Math.min( ...rows.map( ( x ) => x.r.top ) ) : Math.max( ...rows.map( ( x ) => x.r.top ) );
		return rows
			.filter( ( x ) => Math.abs( x.r.top - row ) < 2 )
			.sort( ( a, b ) => Math.abs( a.r.left + a.r.width / 2 - mid ) - Math.abs( b.r.left + b.r.width / 2 - mid ) )[ 0 ].o;
	};
	box.addEventListener( 'keydown', ( e ) => {
		const o = e.target.closest?.( '[data-gcb-kit-time-slot]' );
		if ( ! o ) {
			return;
		}
		const i = options.findIndex( ( x ) => x.o === o );
		const to = {
			ArrowRight: () => options[ i + 1 ]?.o,
			ArrowLeft: () => options[ i - 1 ]?.o,
			ArrowDown: () => near( o, true ),
			ArrowUp: () => near( o, false ),
			Home: () => options[ 0 ]?.o,
			End: () => options[ options.length - 1 ]?.o,
		}[ e.key ];
		if ( to ) {
			e.preventDefault();
			focusOn( to() || o );
		} else if ( e.key === 'Enter' || e.key === ' ' ) {
			e.preventDefault();
			pick( o );
		}
	} );
	clear.addEventListener( 'click', () => {
		write( null );
		render();
		shut();
	} );

	/* THE DATE CHANGED: ask the page for that day's slots, strike what has gone by */
	const ask = () => {
		const want = dateOf();
		if ( want === day && answer !== null ) {
			return;
		}
		day = want;
		answer = null;
		const detail = {
			date: day,
			times: base.map( hhmm ),
			unavailable: [],
			answer: ( a ) => {
				if ( stopped || day !== want || ! a ) {
					return;
				}
				answer = { times: a.times || detail.times, unavailable: a.unavailable || [] };
				settle();
			},
		};
		const before = detail.times.join();
		root.dispatchEvent( new CustomEvent( 'gcbkit:time-slots', { bubbles: true, detail } ) );
		answer = detail.times.join() !== before || detail.unavailable.length ? { times: detail.times, unavailable: detail.unavailable } : { times: null, unavailable: null };
		settle();
	};
	/* a chosen time the day no longer has (gone by, booked) is let go */
	const settle = () => {
		render();
		const value = read();
		const had = value === null ? null : current.find( ( s ) => s.m === value );
		if ( had?.off ) {
			write( null );
			render();
		}
	};
	const onDate = ( e ) => {
		if ( ! stopped && dateKey && e.target === dateInput() ) {
			ask();
		}
	};
	document.addEventListener( 'input', onDate );
	document.addEventListener( 'change', onDate );

	/* a time set by the page (a reset, a script): the field follows */
	const follow = () => {
		if ( ! stopped && ! quiet ) {
			render();
		}
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
	/* the minute turns: today's times go by while the page is open */
	const tick = setInterval( () => day && render(), 30000 );

	if ( dateKey ) {
		answer = null;
		ask();
	} else {
		render();
	}
	root.classList.add( 'is-live' );
	root.gcbKitTime = { input, open: openUp, close: shut, refresh: () => ( ( answer = null ), ask() ) };
	kept( root, () => !! root.querySelector( '[data-gcb-kit-time-shown]' ) && input.isConnected && input.hasAttribute( 'data-gcb-kit-time-input' ), () => {
		stopped = true;
		clearInterval( tick );
		watch.disconnect();
		opened.disconnect();
		document.removeEventListener( 'input', onDate );
		document.removeEventListener( 'change', onDate );
		pane.stop();
		panel.closest( '[data-gcb-kit-widget-positioner]' )?.remove();
		delete root.gcbKitTime;
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
		for ( const node of m.addedNodes ) {
			if ( node.nodeType === 1 ) {
				( node.matches?.( ROOT ) ? [ node ] : [ ...( node.querySelectorAll?.( ROOT ) ?? [] ) ] ).forEach( live );
			}
		}
	}
} ).observe( document.documentElement, { childList: true, subtree: true } );
