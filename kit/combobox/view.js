/**
 * THE KIT'S COMBOBOX (2026-10-21): a box to type in that suggests as you type — "Where to?" and the suburbs and towns,
 * a make or a model, any long list picked from by typing.
 *
 *   <div data-gcb-kit="combobox" data-min-chars="1" data-empty="No places found">
 *     <label data-gcb-kit-label for="where">Where</label>
 *     <input id="where" name="location" placeholder="Search destinations">
 *     <ul data-gcb-kit-combobox-list><li data-gcb-kit-combobox-option></li></ul>     ← one pattern, for every option
 *     <datalist><option value="Bondi Beach" data-hint="NSW"></option>…</datalist>    ← the options
 *   </div>
 *
 * THE NATIVE CONTROL STAYS THE TRUTH, one of two:
 *   - the INPUT, when the options are a <datalist> (drawn, or the site's terms — data-gcb-terms="location", filled by
 *     the server, kit/combobox/Combobox.php): a form sends what is in the box, a pick or words of the visitor's own
 *     (data-strict: a pick only);
 *   - a <select> in the part, when it holds one: its options are the list, a pick is its value, and the input only
 *     the box typed in (no name). In a kit filter this is the facet — `<select data-gcb-kit-facet="location">` — whose
 *     options the filter draws (the values its records carry, the chosen one selected) and whose change it hears.
 * A pick is written back with `input` + `change`, so a form, a filter and a page's own script hear it as they always
 * have; a value the page sets on the select (the filter's reset, a chip taken off) is followed.
 *
 * Zag's combobox (@zag-js/combobox, MIT) gives it the keyboard (arrows, Home/End, Enter picks, Escape shuts), the
 * screen reader's words and the list's place: its own positioner, in the top layer (a popover the server draws, as
 * kit/select's is) — not the widget panel, whose own dismissable layer and focus would fight the combobox's: the focus
 * stays in the input while the list's highlight moves. Here: the options filtered as typed, by the start of a word
 * ("bea" finds Bondi Beach), the typed part marked, "No matches" when none fit.
 *
 * Its parts say their state: the root `data-state="open|closed"` and `data-chosen`, an option `data-highlighted` and
 * `data-state="checked"`, the typed part `<mark data-gcb-kit-combobox-match>`.
 */
import * as combobox from '@zag-js/combobox';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';

/* the part is live, said on <html> where no swap reaches */
document.documentElement.classList.add( 'gcb-kit-combobox-on' );

const ROOT = '[data-gcb-kit="combobox"]';
/* numbered once for the page, whichever bundle makes one (kit/_core/widget.js's lesson) */
const next = () => ( window.__gcbKitComboboxes = ( window.__gcbKitComboboxes || 0 ) + 1 );

/* WORDS COMPARED AS A VISITOR READS THEM: case and accents aside ("mel" finds Mélbourne), one letter for one, so a
   place found in the folded words is the same place in the shown ones */
const fold = ( s ) => {
	let out = '';
	for ( let i = 0; i < s.length; i++ ) {
		const f = s[ i ].normalize( 'NFD' )[ 0 ].toLowerCase();
		out += f.length === 1 ? f : s[ i ];
	}
	return out;
};
const startsWord = ( s, i ) => i === 0 || /[\s\-–—/(,.]/.test( s[ i - 1 ] );
/** where the typed words start a word of these, or -1 */
const hit = ( words, typed ) => {
	if ( ! typed ) {
		return 0;
	}
	const f = fold( words );
	for ( let i = f.indexOf( typed ); i !== -1; i = f.indexOf( typed, i + 1 ) ) {
		if ( startsWord( f, i ) ) {
			return i;
		}
	}
	return -1;
};
const esc = ( s ) => s.replace( /[&<>"]/g, ( c ) => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } )[ c ] );

/* every prop Zag says of an element written again, whatever Zag thinks it last wrote (a router swap puts back the
   server's attributes on the very elements Zag keeps — kit/select's settle) */
const force = ( el, props ) =>
	Object.entries( props ).forEach( ( [ k, v ] ) => {
		if ( k.startsWith( 'on' ) || k === 'value' ) {
			return;
		}
		if ( k === 'style' && typeof v === 'string' ) {
			el.setAttribute( 'style', v );
			return;
		}
		if ( k === 'style' ) {
			Object.entries( v || {} ).forEach( ( [ p, val ] ) => {
				const name = p.startsWith( '--' ) ? p : p.replace( /[A-Z]/g, ( m ) => '-' + m.toLowerCase() );
				val === undefined || val === null ? el.style.removeProperty( name ) : el.style.setProperty( name, String( val ) );
			} );
			return;
		}
		if ( typeof v === 'object' ) {
			return;
		}
		const name = k.toLowerCase();
		if ( typeof v === 'boolean' && name.startsWith( 'aria-' ) ) {
			el.setAttribute( name, String( v ) );
		} else if ( v === undefined || v === null || v === false ) {
			el.removeAttribute( name );
		} else {
			el.setAttribute( name, v === true ? '' : String( v ) );
		}
	} );

function live( root ) {
	if ( root.gcbKitCombobox ) {
		return;
	}
	const input = root.querySelector( 'input:not([type="hidden"])' );
	let list = root.querySelector( '[data-gcb-kit-combobox-list]' );
	if ( ! input || ! list ) {
		return;
	}
	const truth = root.querySelector( 'select' ); // a select: the pick is its value; none: the input's words are
	const strict = !! truth || root.hasAttribute( 'data-strict' );
	const minChars = Math.max( 0, parseInt( root.getAttribute( 'data-min-chars' ) ?? '1', 10 ) || 0 );
	const most = Math.max( 1, parseInt( root.getAttribute( 'data-max' ) || '50', 10 ) || 50 );
	const id = 'gcb-combobox-' + next();

	/* THE OPTIONS: the select's, else the datalist's (in the part, or the one the input names) */
	const optionEls = () => {
		if ( truth ) {
			return [ ...truth.options ];
		}
		const named = input.getAttribute( 'list' ) || input.dataset.gcbKitComboboxNamed || '';
		const lists = [ ...root.querySelectorAll( 'datalist' ) ];
		const far = named && document.getElementById( named );
		if ( far && ! lists.includes( far ) ) {
			lists.push( far );
		}
		return lists.flatMap( ( d ) => [ ...d.querySelectorAll( 'option' ) ] );
	};
	const read = () =>
		optionEls()
			.filter( ( o ) => o.value !== '' )
			.map( ( o ) => {
				const text = ( o.textContent || '' ).trim();
				/* a select's option says its words and sends its value; a datalist's sends what it says */
				const label = truth ? text || o.value : o.value;
				const hint = o.getAttribute( 'data-hint' ) || ( ! truth && text && text !== o.value ? text : '' );
				return { value: o.value, label, hint, disabled: o.disabled || o.hidden };
			} );
	const placeholderOf = () => ( truth && truth.options[ 0 ] && truth.options[ 0 ].value === '' ? truth.options[ 0 ].textContent.trim() : '' );
	let all = read();

	/* the browser's own suggestions (the no-script fallback of a datalist) are ours once this runs */
	const unlist = () => {
		if ( input.hasAttribute( 'list' ) ) {
			input.dataset.gcbKitComboboxNamed = input.getAttribute( 'list' );
			input.removeAttribute( 'list' );
		}
	};
	unlist();
	/* the kit's input, unless the design drew its own (controls.css: data-gcb-kit-control on a bare one) */
	const dress = () => {
		if ( ! input.hasAttribute( 'data-gcb-own' ) && ! input.getAttribute( 'class' ) && ! input.hasAttribute( 'data-gcb-kit-control' ) ) {
			input.setAttribute( 'data-gcb-kit-control', '' );
		}
	};
	dress();

	/* the option pattern: the first drawn, kept aside; one made when none is drawn */
	let pattern = null;
	const takePattern = () => {
		const drawn = list.querySelector( '[data-gcb-kit-combobox-option]:not([id])' ) || list.querySelector( '[data-gcb-kit-combobox-option]' );
		if ( drawn ) {
			pattern = drawn.cloneNode( true );
			pattern.removeAttribute( 'id' );
		}
		list.querySelectorAll( '[data-gcb-kit-combobox-option], [data-gcb-kit-combobox-empty]' ).forEach( ( o ) => o.remove() );
	};
	takePattern();
	if ( ! pattern ) {
		pattern = document.createElement( 'li' );
		pattern.setAttribute( 'data-gcb-kit-combobox-option', '' );
	}
	const empty = document.createElement( 'li' );
	empty.setAttribute( 'data-gcb-kit-combobox-empty', '' );
	empty.setAttribute( 'role', 'presentation' );
	empty.textContent = root.getAttribute( 'data-empty' ) || 'No matches';

	/* the list floats in a positioner Zag places, in the top layer: drawn by the server (Combobox.php) so a swap finds
	   it where it left it; made here for markup drawn some other way */
	let positioner = list.parentElement && list.parentElement.hasAttribute( 'data-gcb-kit-combobox-positioner' ) ? list.parentElement : null;
	if ( ! positioner ) {
		positioner = document.createElement( 'div' );
		positioner.setAttribute( 'data-gcb-kit-combobox-positioner', '' );
		list.replaceWith( positioner );
		positioner.appendChild( list );
	}
	if ( ! positioner.hasAttribute( 'popover' ) ) {
		positioner.setAttribute( 'popover', 'manual' );
	}
	positioner.id ||= id + '-positioner';
	list.id ||= id + '-list';
	input.id ||= id + '-input';
	/* what the list opens under: the box round the input when the design draws one, else the input */
	const anchor = root.querySelector( '[data-gcb-kit-combobox-control]' ) || input;
	anchor.id ||= id + '-control';
	const label = root.querySelector( '[data-gcb-kit-label], label' ) || document.querySelector( `label[for="${ CSS.escape( input.id ) }"]` );
	if ( label ) {
		label.id ||= input.id + '-label';
	}

	/* WHAT FITS THE TYPED WORDS: those a word of which they start, those they start first; at most data-max */
	let typed = '';
	let shown = [];
	const fits = () => {
		const t = fold( typed.trim() );
		const found = [];
		all.forEach( ( item, n ) => {
			const at = hit( item.label, t );
			if ( at !== -1 ) {
				found.push( { item, at, n } );
			}
		} );
		found.sort( ( a, b ) => ( b.at === 0 ) - ( a.at === 0 ) || a.n - b.n );
		return found.slice( 0, most ).map( ( f ) => f.item );
	};
	const collection = () =>
		combobox.collection( { items: shown, itemToValue: ( i ) => i.value, itemToString: ( i ) => i.label, isItemDisabled: ( i ) => i.disabled } );

	/* where it starts: the select's choice, else the words in the box */
	const chosenOf = () => ( truth ? [ ...truth.selectedOptions ].map( ( o ) => o.value ).filter( Boolean ) : all.filter( ( i ) => i.value === input.value ).map( ( i ) => i.value ) );
	const labelOf = ( v ) => ( all.find( ( i ) => i.value === v ) || {} ).label || '';
	let written = truth ? chosenOf().join( '\u0000' ) : input.value;
	let quiet = false;
	shown = fits();

	const service = new VanillaMachine( combobox.machine, {
		id,
		ids: { input: input.id, control: anchor.id, content: list.id, positioner: positioner.id, ...( label ? { label: label.id } : {} ) },
		collection: collection(),
		name: truth ? undefined : input.name || undefined,
		form: input.getAttribute( 'form' ) || undefined,
		placeholder: input.getAttribute( 'placeholder' ) || placeholderOf() || undefined,
		disabled: input.disabled,
		required: input.required,
		defaultValue: chosenOf(),
		defaultInputValue: truth ? labelOf( chosenOf()[ 0 ] ) || input.value : input.value,
		inputBehavior: 'autohighlight', // the first that fits is ready: Enter picks it
		allowCustomValue: ! strict,
		selectionBehavior: 'replace',
		openOnClick: minChars === 0,
		openOnChange: ( { inputValue } ) => inputValue.trim().length >= minChars,
		loopFocus: true,
		positioning: { placement: 'bottom-start', sameWidth: false, gutter: 6, strategy: 'fixed', flip: true, fitViewport: true, overflowPadding: 16 },
		onInputValueChange( { inputValue, reason } ) {
			typed = reason === 'input-change' ? inputValue : '';
			shown = fits();
			service.updateProps( { collection: collection() } );
			draw();
			if ( reason === 'input-change' ) {
				const a = api();
				if ( inputValue.trim().length < minChars && a.open ) {
					a.setOpen( false );
				}
				/* the box emptied: nothing is chosen */
				if ( inputValue === '' && a.value.length ) {
					a.clearValue();
				}
			}
		},
		onValueChange( { value } ) {
			const v = value[ 0 ] ?? '';
			const key = truth ? v : v || input.value;
			if ( key === written || ( ! truth && ! v ) ) {
				return;
			}
			written = key;
			quiet = true;
			const el = truth || input;
			if ( truth ) {
				truth.value = v;
			} else {
				input.value = v;
			}
			[ 'input', 'change' ].forEach( ( type ) => {
				const e = new Event( type, { bubbles: true } );
				e.gcbKitOwn = true;
				el.dispatchEvent( e );
			} );
			quiet = false;
		},
	} );
	const api = () => combobox.connect( service.service, normalizeProps );

	/* EACH OPTION THAT FITS, drawn from the pattern: its words with the typed part marked, its quieter line */
	let drawnEls = [];
	const draw = () => {
		const t = fold( typed.trim() );
		/* every option in the list goes (ours, and any a swap left), so each is drawn once */
		list.querySelectorAll( '[data-gcb-kit-combobox-option]' ).forEach( ( el ) => el.remove() );
		drawnEls = shown.map( ( item ) => {
			const el = pattern.cloneNode( true );
			el.setAttribute( 'data-gcb-kit-combobox-option', item.value );
			const at = t ? hit( item.label, t ) : -1;
			const words = at === -1 ? esc( item.label ) : esc( item.label.slice( 0, at ) ) + '<mark data-gcb-kit-combobox-match>' + esc( item.label.slice( at, at + t.length ) ) + '</mark>' + esc( item.label.slice( at + t.length ) );
			const into = el.querySelector( '[data-gcb-kit-combobox-label]' );
			if ( into ) {
				into.innerHTML = words;
			} else if ( ! el.children.length || ! el.textContent.trim() ) {
				el.innerHTML = `<span data-gcb-kit-combobox-label>${ words }</span>`;
			}
			const hintEl = el.querySelector( '[data-gcb-kit-combobox-hint]' );
			if ( hintEl ) {
				hintEl.textContent = item.hint;
				hintEl.hidden = ! item.hint;
			} else if ( item.hint ) {
				el.insertAdjacentHTML( 'beforeend', `<span data-gcb-kit-combobox-hint>${ esc( item.hint ) }</span>` );
			}
			list.insertBefore( el, empty.parentElement === list ? empty : null );
			return el;
		} );
		if ( empty.parentElement !== list ) {
			list.appendChild( empty );
		}
		empty.hidden = shown.length > 0;
		render();
	};

	/* the list in the top layer while open */
	const layer = ( open ) => {
		if ( typeof positioner.showPopover !== 'function' ) {
			return;
		}
		const on = positioner.matches( ':popover-open' );
		try {
			if ( open && ! on ) {
				positioner.showPopover();
			} else if ( ! open && on ) {
				positioner.hidePopover();
			}
		} catch {
			/* not connected mid-swap: settled after it */
		}
	};
	/* our own `input` event (a pick written back) is the page's news, not typing: Zag hears only the visitor's */
	const inputProps = ( a ) => {
		const props = a.getInputProps();
		const typedIn = props.oninput; // normalizeProps: onChange is the `input` event, its key in lower case
		if ( typedIn ) {
			props.oninput = ( e ) => ( e.gcbKitOwn ? undefined : typedIn( e ) );
		}
		return props;
	};
	const parts = ( a ) => [
		[ input, inputProps( a ) ],
		[ positioner, a.getPositionerProps() ],
		[ list, a.getContentProps() ],
		...( label ? [ [ label, a.getLabelProps() ] ] : [] ),
		...shown.map( ( item, i ) => [ drawnEls[ i ], a.getItemProps( { item } ) ] ).filter( ( [ el ] ) => el ),
	];
	const render = () => {
		const a = api();
		layer( a.open );
		parts( a ).forEach( ( [ el, props ] ) => spreadProps( el, props ) );
		root.setAttribute( 'data-state', a.open ? 'open' : 'closed' );
		root.toggleAttribute( 'data-chosen', truth ? a.value.length > 0 : input.value !== '' );
	};

	/* THE PAGE SETS THE SELECT (the filter's reset, a chip taken off, an answer swapped in): followed, its words in the box */
	const follow = () => {
		if ( quiet || ! truth ) {
			return;
		}
		const now = chosenOf();
		const key = now.join( '\u0000' );
		if ( key !== written ) {
			written = key;
			const a = api();
			a.setValue( now );
			if ( document.activeElement !== input ) {
				a.setInputValue( labelOf( now[ 0 ] ), 'script' );
			}
		}
	};
	if ( truth ) {
		const own = Object.getOwnPropertyDescriptor( HTMLSelectElement.prototype, 'value' );
		Object.defineProperty( truth, 'value', {
			configurable: true,
			get() {
				return own.get.call( this );
			},
			set( v ) {
				own.set.call( this, v );
				queueMicrotask( follow );
			},
		} );
		truth.addEventListener( 'change', follow );
		document.addEventListener( 'gcbkit:change', () => setTimeout( follow, 30 ) );
	}
	/* new options (the filter's answer, a script's): the list from them */
	const reread = () => {
		all = read();
		shown = fits();
		service.updateProps( { collection: collection() } );
		draw();
		follow();
	};
	if ( truth ) {
		new MutationObserver( reread ).observe( truth, { childList: true, subtree: true, attributes: true, attributeFilter: [ 'selected', 'disabled', 'hidden' ] } );
	} else {
		/* only a datalist's changes: the list's own drawing is not news */
		const isOption = ( n ) => n.nodeName === 'OPTION' || n.nodeName === 'DATALIST';
		new MutationObserver( ( muts ) => {
			if ( muts.some( ( m ) => m.target.closest?.( 'datalist' ) || [ ...m.addedNodes, ...m.removedNodes ].some( isOption ) ) ) {
				reread();
			}
		} ).observe( root, { childList: true, subtree: true, attributes: true, attributeFilter: [ 'value', 'data-hint', 'disabled' ] } );
	}
	/* a form's reset empties the box: nothing chosen */
	input.form?.addEventListener( 'reset', () => setTimeout( () => api().clearValue(), 0 ) );

	/* AFTER A ROUTER SWAP: the server's markup put back on the elements kept — its list (with its pattern, no options),
	   its attributes. Ours drawn again over it, every prop written again, an open list placed again */
	const settle = () => {
		if ( ! root.isConnected ) {
			return;
		}
		const now = root.querySelector( '[data-gcb-kit-combobox-list]' );
		if ( now && now !== list ) {
			list.remove();
			list = now;
			drawnEls = [];
		}
		if ( list.querySelector( '[data-gcb-kit-combobox-option]:not([id])' ) ) {
			drawnEls.forEach( ( el ) => el.remove() );
			drawnEls = [];
			takePattern();
		}
		if ( list.parentElement !== positioner ) {
			list.replaceWith( positioner );
			positioner.appendChild( list );
		}
		root.classList.add( 'is-live' );
		unlist();
		dress();
		all = read();
		shown = fits();
		service.updateProps( { collection: collection() } );
		draw();
		follow();
		const a = api();
		parts( a ).forEach( ( [ el, props ] ) => force( el, props ) );
		layer( a.open );
		if ( a.open ) {
			a.reposition();
		}
	};
	document.addEventListener( 'gcbkit:swapped', () => requestAnimationFrame( settle ) );

	service.subscribe( render );
	service.start();
	draw();
	root.classList.add( 'is-live' );
	root.gcbKitCombobox = { service, input, truth };
}

function boot() {
	document.querySelectorAll( ROOT ).forEach( live );
}
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', boot );
} else {
	boot();
}
/* a combobox drawn later (a dialog's content) comes alive when it lands */
new MutationObserver( ( muts ) => {
	for ( const m of muts ) {
		for ( const n of m.addedNodes ) {
			if ( n.nodeType === 1 ) {
				( n.matches?.( ROOT ) ? [ n ] : [ ...( n.querySelectorAll?.( ROOT ) ?? [] ) ] ).forEach( live );
			}
		}
	}
} ).observe( document.documentElement, { childList: true, subtree: true } );
