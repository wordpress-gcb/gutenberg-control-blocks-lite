/**
 * In-place editing on the canvas (2026-09-28): rich text with bold, italic and
 * links, and a heading's level chosen from the toolbar.
 */
import {
	isInlineField,
	formatsFor,
	levelKeyFor,
	headingTag,
	unwrapParagraph,
	isFocusedField,
	isInlineLink,
	linkValue,
	withLink,
} from '../../src/utils/inline-fields';

describe( 'which fields are edited in place', () => {
	it( 'text, textarea and now rich text, on headings, paragraphs, divs and spans', () => {
		expect( isInlineField( 'text', 'h2' ) ).toBe( true );
		expect( isInlineField( 'textarea', 'p' ) ).toBe( true );
		expect( isInlineField( 'richtext', 'h1' ) ).toBe( true );
		expect( isInlineField( 'richtext', 'p' ) ).toBe( true );
		expect( isInlineField( 'url', 'a' ) ).toBe( false );
		expect( isInlineField( 'text', 'ul' ) ).toBe( false );
	} );
	it( 'rich text gets bold, italic and link; plain text gets nothing', () => {
		expect( formatsFor( 'richtext' ) ).toEqual( [
			'core/bold',
			'core/italic',
			'core/link',
		] );
		expect( formatsFor( 'text' ) ).toEqual( [] );
	} );
} );

describe( "a heading field's level", () => {
	const controls = [
		{ attributeKey: 'headline' },
		{ attributeKey: 'headline_level' },
	];
	it( 'is found when the block has the setting and the element is a heading', () => {
		expect( levelKeyFor( 'headline', controls, 'h2' ) ).toBe(
			'headline_level'
		);
		expect( levelKeyFor( 'headline', controls, 'p' ) ).toBe( '' );
		expect(
			levelKeyFor( 'headline', [ { attributeKey: 'headline' } ], 'h2' )
		).toBe( '' );
	} );
	it( 'draws the chosen level, or the drawn tag when the level is not one', () => {
		expect( headingTag( 'h3', 'h2' ) ).toBe( 'h3' );
		expect( headingTag( 'script', 'h2' ) ).toBe( 'h2' );
		expect( headingTag( undefined, 'h2' ) ).toBe( 'h2' );
	} );
} );

describe( 'one paragraph on a line element is its words (the Linfox editor test)', () => {
	it( 'unwraps one paragraph on a heading, a paragraph or a span', () => {
		expect(
			unwrapParagraph( '<p><strong>Leading</strong> the way</p>', 'h1' )
		).toBe( '<strong>Leading</strong> the way' );
		expect( unwrapParagraph( '<p>x</p>', 'span' ) ).toBe( 'x' );
	} );
	it( 'leaves two paragraphs, plain words, and a div alone', () => {
		expect( unwrapParagraph( '<p>a</p><p>b</p>', 'h1' ) ).toBe(
			'<p>a</p><p>b</p>'
		);
		expect( unwrapParagraph( 'plain', 'h1' ) ).toBe( 'plain' );
		expect( unwrapParagraph( '<p>x</p>', 'div' ) ).toBe( '<p>x</p>' );
	} );
} );

describe( "one level switch, the focused field's", () => {
	it( 'only the field the cursor is in, in this block', () => {
		const sel = { clientId: 'b1', attributeKey: 'feature_headline_1' };
		expect( isFocusedField( sel, 'b1', 'feature_headline_1' ) ).toBe(
			true
		);
		expect( isFocusedField( sel, 'b1', 'section_heading' ) ).toBe( false );
		expect( isFocusedField( sel, 'b2', 'feature_headline_1' ) ).toBe(
			false
		);
		expect( isFocusedField( {}, 'b1', 'x' ) ).toBe( false );
		expect( isFocusedField( undefined, 'b1', 'x' ) ).toBe( false );
	} );
} );

describe( 'buttons and links in place', () => {
	it( 'a link field on an a or button holding words alone', () => {
		expect( isInlineLink( 'url', 'a', true ) ).toBe( true );
		expect( isInlineLink( 'link', 'button', true ) ).toBe( true );
		expect( isInlineLink( 'url', 'a', false ) ).toBe( false );
		expect( isInlineLink( 'url', 'iframe', true ) ).toBe( false );
		expect( isInlineLink( 'text', 'a', true ) ).toBe( false );
	} );
	it( "reads a string, an object or nothing as the link control's shape", () => {
		expect( linkValue( 'https://x.test' ) ).toEqual( {
			url: 'https://x.test',
			text: '',
			opensInNewTab: false,
		} );
		expect(
			linkValue( { url: 'u', text: 't', opensInNewTab: 1 } )
		).toEqual( { url: 'u', text: 't', opensInNewTab: true } );
		expect( linkValue( undefined ) ).toEqual( {
			url: '',
			text: '',
			opensInNewTab: false,
		} );
	} );
	it( 'changes one part and keeps the rest', () => {
		const was = {
			url: 'https://x.test',
			text: 'Read it',
			opensInNewTab: false,
		};
		expect( withLink( was, { text: 'Read the magazine' } ) ).toEqual( {
			...was,
			text: 'Read the magazine',
		} );
		expect(
			withLink( was, { url: 'https://y.test', opensInNewTab: true } )
		).toEqual( {
			url: 'https://y.test',
			text: 'Read it',
			opensInNewTab: true,
		} );
	} );
} );
