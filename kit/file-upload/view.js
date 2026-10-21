/**
 * THE KIT'S FILE UPLOAD (2026-10-21, the forms family: "Attach your CV", "Photos of the damage", "Upload plans"). A
 * drop zone to drag files onto or press to browse, and the files chosen listed under it:
 *
 *   <div data-gcb-kit="file-upload" data-max-files="5" data-max-size="5MB">
 *     <label data-gcb-kit-label for="photos">Photos of the damage</label>
 *     <input type="file" id="photos" name="photos[]" multiple accept="image/*">
 *   </div>
 *
 * THE NATIVE FILE INPUT STAYS THE TRUTH: the form sends it, so FormData carries the files — every file Zag holds is
 * written back onto it (a DataTransfer: Zag's own, its hidden input being this one), with `change`. Its `name`,
 * `accept`, `multiple` and `required` are the page's. Without the script it is the browser's own file box.
 *
 * Zag's file upload (@zag-js/file-upload, MIT): the drop zone a button (Enter or Space browses), a drag over it marked
 * (`data-dragging`: the accent), a drop or a pick added to what is there, each file's × taking it off. Its checks: the
 * input's `accept` (extensions or types), data-max-files (1 unless the input is `multiple`, then no most), data-max-size
 * and data-min-size ("5MB", "500KB", bytes). A file refused is said under the zone in the kit's error words, the zone's
 * line the error's. The zone's words: data-drop ("Drop photos here"), data-browse ("browse"); its quieter line says the
 * types and the sizes it takes, from the same attributes. Its parts say their state: the zone `data-dragging`,
 * `data-invalid`; the part `data-full` at its most, `data-has-files`.
 */
import * as upload from '@zag-js/file-upload';
import { VanillaMachine, normalizeProps, spreadProps } from '@zag-js/vanilla';
import { kept } from '../_core/kept.js';

/* the part is live, said on <html> where no swap reaches */
document.documentElement.classList.add( 'gcb-kit-file-upload-on' );

const ROOT = '[data-gcb-kit="file-upload"]';
const next = () => ( window.__gcbKitUploads = ( window.__gcbKitUploads || 0 ) + 1 );

/* "5MB", "1.5 GB", "500kb", "2048" (bytes): the bytes */
const UNITS = { b: 1, k: 1024, kb: 1024, m: 1024 ** 2, mb: 1024 ** 2, g: 1024 ** 3, gb: 1024 ** 3 };
const bytes = ( s ) => {
	const m = String( s || '' ).trim().toLowerCase().match( /^(\d+(?:\.\d+)?)\s*([kmg]?b?)?$/ );
	return m ? Math.round( Number( m[ 1 ] ) * ( UNITS[ m[ 2 ] || 'b' ] || 1 ) ) : undefined;
};
/* the bytes as a visitor reads them: 820 B, 240 KB, 1.2 MB */
const size = ( n ) => {
	if ( n < 1024 ) {
		return `${ n } B`;
	}
	const [ v, u ] = n < 1024 ** 2 ? [ n / 1024, 'KB' ] : n < 1024 ** 3 ? [ n / 1024 ** 2, 'MB' ] : [ n / 1024 ** 3, 'GB' ];
	return `${ v < 10 ? Math.round( v * 10 ) / 10 : Math.round( v ) } ${ u }`;
};
/* the accept list as words: ".pdf,.docx,image/*" → "PDF, DOCX, images" */
const kinds = ( accept ) =>
	( accept || '' )
		.split( ',' )
		.map( ( t ) => t.trim().toLowerCase() )
		.filter( Boolean )
		.map( ( t ) => ( t.startsWith( '.' ) ? t.slice( 1 ).toUpperCase() : t.endsWith( '/*' ) ? t.slice( 0, -2 ) + 's' : ( t.split( '/' )[ 1 ] || t ).toUpperCase() ) )
		.filter( ( t, i, all ) => all.indexOf( t ) === i );
const list = ( words ) => ( words.length < 2 ? words.join( '' ) : words.slice( 0, -1 ).join( ', ' ) + ' or ' + words[ words.length - 1 ] );

const UP = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18a4.6 4.4 0 0 1 0 -9a5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7h-1"/><path d="M9 15l3 -3l3 3"/><path d="M12 12l0 9"/></svg>';
const DOC = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z"/></svg>';
const X = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
const el = ( tag, attr, html = '' ) => {
	const e = document.createElement( tag );
	e.setAttribute( attr, '' );
	if ( html ) {
		e.innerHTML = html;
	}
	return e;
};

function live( root ) {
	if ( root.gcbKitUpload ) {
		return;
	}
	const truth = root.querySelector( 'input[type="file"]' );
	if ( ! truth ) {
		return;
	}
	let stopped = false;
	const id = 'gcb-upload-' + next();
	truth.id ||= id + '-input';
	const maxFiles = parseInt( root.getAttribute( 'data-max-files' ) || '', 10 ) || ( truth.multiple ? Infinity : 1 );
	const maxSize = bytes( root.getAttribute( 'data-max-size' ) );
	const minSize = bytes( root.getAttribute( 'data-min-size' ) );
	const accept = truth.getAttribute( 'accept' ) || undefined;
	const many = maxFiles > 1;
	const label = root.querySelector( '[data-gcb-kit-label], label' );

	/* THE ZONE: the design's when drawn, else made — its words, the browse word, the quieter line of what it takes */
	let zone = root.querySelector( '[data-gcb-kit-file-drop]' );
	if ( ! zone ) {
		zone = el( 'div', 'data-gcb-kit-file-drop' );
		const drop = root.getAttribute( 'data-drop' ) || ( many ? 'Drop files here' : 'Drop a file here' );
		const browse = root.getAttribute( 'data-browse' ) || 'browse';
		const takes = [
			list( kinds( accept ) ),
			maxSize ? `up to ${ size( maxSize ) }${ many ? ' each' : '' }` : '',
			many && maxFiles !== Infinity ? `${ maxFiles } files at most` : '',
		].filter( Boolean );
		zone.innerHTML = `<span data-gcb-kit-file-icon>${ UP }</span><span data-gcb-kit-file-say><span data-gcb-kit-file-drop-words></span> <span data-gcb-kit-file-browse></span></span>${ takes.length ? '<span data-gcb-kit-file-takes></span>' : '' }`;
		zone.querySelector( '[data-gcb-kit-file-drop-words]' ).textContent = drop + ' or';
		zone.querySelector( '[data-gcb-kit-file-browse]' ).textContent = browse;
		if ( takes.length ) {
			const t = takes.join( ', ' );
			zone.querySelector( '[data-gcb-kit-file-takes]' ).textContent = t.charAt( 0 ).toUpperCase() + t.slice( 1 );
		}
		truth.after( zone );
	}
	/* the zone's name, as its words read (its lines are blocks: a full stop between them) */
	const zoneSays = [ ...zone.children ].map( ( c ) => c.textContent.replace( /\s+/g, ' ' ).trim() ).filter( Boolean ).join( '. ' ) || zone.textContent.trim();
	let files = root.querySelector( '[data-gcb-kit-file-list]' );
	if ( ! files ) {
		files = el( 'ul', 'data-gcb-kit-file-list' );
		zone.after( files );
	}
	let error = root.querySelector( '[data-gcb-kit-file-error]' );
	if ( ! error ) {
		error = el( 'div', 'data-gcb-kit-file-error' );
		error.setAttribute( 'data-gcb-kit-error-text', '' );
		error.setAttribute( 'aria-live', 'polite' );
		error.hidden = true;
		zone.after( error );
	}
	const say = ( lines ) => {
		error.replaceChildren(
			...lines.map( ( l ) => {
				const s = document.createElement( 'span' );
				s.textContent = l;
				return s;
			} )
		);
		error.hidden = ! lines.length;
	};
	/* each file refused, in words: one line a reason, one "at most" for all */
	const why = ( rejected ) => {
		const out = [];
		const types = list( kinds( accept ) );
		rejected.forEach( ( { file, errors } ) => {
			errors.forEach( ( e ) => {
				const line =
					e === 'TOO_MANY_FILES'
						? maxFiles === 1
							? 'Only one file.'
							: `${ maxFiles } files at most.`
						: e === 'FILE_INVALID_TYPE'
						? `${ file.name } can't be added: ${ types ? types + ' only' : 'not a file this takes' }.`
						: e === 'FILE_TOO_LARGE'
						? `${ file.name } is over ${ size( maxSize ) }.`
						: e === 'FILE_TOO_SMALL'
						? `${ file.name } is under ${ size( minSize ) }.`
						: e === 'FILE_EXISTS'
						? `${ file.name } is already added.`
						: `${ file.name } can't be added.`;
				if ( ! out.includes( line ) ) {
					out.push( line );
				}
			} );
		} );
		return out;
	};

	const pageInvalid = () => truth.getAttribute( 'aria-invalid' ) === 'true';
	let refused = false;
	const service = new VanillaMachine( upload.machine, {
		id,
		ids: { root: root.id || undefined, hiddenInput: truth.id, dropzone: id + '-zone', ...( label ? { label: label.id || ( label.id = id + '-label' ) } : {} ) },
		name: truth.name || undefined,
		accept,
		maxFiles,
		maxFileSize: maxSize,
		minFileSize: minSize,
		required: truth.required,
		disabled: truth.disabled,
		capture: truth.getAttribute( 'capture' ) || undefined,
		invalid: pageInvalid(),
		defaultAcceptedFiles: [ ...( truth.files || [] ) ],
		translations: {
			dropzone: `${ ( label?.textContent || '' ).trim() || ( many ? 'Files' : 'File' ) }: ${ zoneSays }`,
			itemPreview: ( f ) => f.name,
			deleteFile: ( f ) => `Remove ${ f.name }`,
		},
		onFileChange: ( { rejectedFiles } ) => {
			refused = rejectedFiles.length > 0;
			say( why( rejectedFiles ) );
			queueMicrotask( () => {
				if ( ! stopped ) {
					service.updateProps( { invalid: refused || pageInvalid() } );
					rewrite();
				}
			} );
		},
	} );
	const api = () => upload.connect( service.service, normalizeProps );

	/* EACH FILE: a row, its thumbnail (a picture's own, else a page), its name and size, its × */
	let drawn = '';
	let rows = [];
	let urls = [];
	const draw = ( accepted ) => {
		const key = accepted.map( ( f ) => `${ f.name }\u0000${ f.size }\u0000${ f.lastModified }` ).join( '\u0001' );
		if ( key === drawn ) {
			return;
		}
		drawn = key;
		urls.forEach( ( u ) => u() );
		urls = [];
		rows = accepted.map( ( file ) => {
			const row = el( 'li', 'data-gcb-kit-file' );
			const preview = el( 'span', 'data-gcb-kit-file-preview' );
			let img = null;
			if ( file.type.startsWith( 'image/' ) ) {
				img = document.createElement( 'img' );
				img.decoding = 'async';
				urls.push( api().createFileUrl( file, ( url ) => ( img.src = url ) ) );
				preview.appendChild( img );
			} else {
				preview.innerHTML = DOC;
			}
			const words = el( 'span', 'data-gcb-kit-file-words' );
			const name = el( 'span', 'data-gcb-kit-file-name' );
			const sz = el( 'span', 'data-gcb-kit-file-size' );
			name.textContent = file.name;
			sz.textContent = size( file.size );
			words.append( name, sz );
			const x = el( 'button', 'data-gcb-kit-file-remove', X );
			row.append( preview, words, x );
			return { file, row, preview, img, name, sz, x };
		} );
		files.replaceChildren( ...rows.map( ( r ) => r.row ) );
	};
	const render = () => {
		if ( stopped ) {
			return;
		}
		const a = api();
		draw( a.acceptedFiles );
		spreadProps( root, a.getRootProps() );
		spreadProps( zone, a.getDropzoneProps() );
		/* the input keeps what the page gave it: its name, accept and required are written by Zag from the same */
		spreadProps( truth, a.getHiddenInputProps() );
		spreadProps( files, a.getItemGroupProps() );
		rows.forEach( ( r ) => {
			const p = { file: r.file };
			spreadProps( r.row, a.getItemProps( p ) );
			spreadProps( r.preview, a.getItemPreviewProps( p ) );
			if ( r.img ) {
				const { src, ...imgProps } = a.getItemPreviewImageProps( { file: r.file, url: r.img.src } );
				spreadProps( r.img, imgProps );
				r.img.alt = '';
			}
			spreadProps( r.name, a.getItemNameProps( p ) );
			spreadProps( r.sz, a.getItemSizeTextProps( p ) );
			spreadProps( r.x, a.getItemDeleteTriggerProps( p ) );
		} );
		zone.setAttribute( 'aria-invalid', String( !! ( refused || pageInvalid() ) ) );
		if ( error.textContent ) {
			zone.setAttribute( 'aria-describedby', error.id || ( error.id = id + '-error' ) );
		} else {
			zone.removeAttribute( 'aria-describedby' );
		}
		root.toggleAttribute( 'data-full', a.maxFilesReached && maxFiles !== Infinity );
		root.toggleAttribute( 'data-has-files', a.acceptedFiles.length > 0 );
	};
	service.subscribe( render );
	service.start();
	render();

	/* THE INPUT HOLDS WHAT ZAG HOLDS, whatever the picker left in it: Zag empties it to open the picker (so one shut with
	   nothing leaves it empty), and writes it back only when what it holds changes (so a pick it refused stays in it) */
	const sig = ( list ) => [ ...( list || [] ) ].map( ( f ) => `${ f.name }\u0000${ f.size }\u0000${ f.lastModified }` ).join( '\u0001' );
	const rewrite = () => {
		const held = api().acceptedFiles;
		if ( stopped || sig( truth.files ) === sig( held ) ) {
			return;
		}
		try {
			const dt = new DataTransfer();
			held.forEach( ( f ) => dt.items.add( f ) );
			truth.files = dt.files;
		} catch {
			/* a browser with no DataTransfer: the input keeps what the picker gave it */
		}
	};
	truth.addEventListener( 'cancel', rewrite );
	window.addEventListener( 'focus', () => setTimeout( rewrite, 300 ) ); // a browser that sends no cancel
	truth.form?.addEventListener( 'submit', rewrite, true );
	/* a reset empties the input: the list with it */
	truth.form?.addEventListener( 'reset', () =>
		setTimeout( () => {
			if ( ! stopped ) {
				api().clearFiles();
				api().clearRejectedFiles();
			}
		}, 0 )
	);
	/* the page's error (the server's check, the form's) on the zone */
	new MutationObserver( () => ! stopped && service.updateProps( { invalid: refused || pageInvalid(), disabled: truth.disabled } ) ).observe( truth, {
		attributes: true,
		attributeFilter: [ 'aria-invalid', 'disabled' ],
	} );
	/* a form that will not send it empty: said under the zone, the zone to press */
	truth.addEventListener( 'invalid', ( e ) => {
		e.preventDefault();
		refused = true;
		say( [ root.getAttribute( 'data-required-words' ) || truth.validationMessage || 'Add a file.' ] );
		service.updateProps( { invalid: true } );
		zone.focus();
	} );

	root.gcbKitUpload = { service, truth, zone, get files() {
		return api().acceptedFiles;
	} };
	kept(
		root,
		() => root.contains( zone ) && root.contains( files ) && zone.hasAttribute( 'data-part' ),
		() => {
			stopped = true;
			urls.forEach( ( u ) => u() );
			service.stop();
			delete root.gcbKitUpload;
			live( root );
		}
	);
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
