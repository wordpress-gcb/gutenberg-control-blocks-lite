/**
 * The control hub (2026-10-07): a field type registered by a theme or plugin
 * reaches every GCB field-editor bundle, whichever loads first, and doesn't
 * replace a built-in unless it asks to.
 */
import { connectControlHub } from '../../src/control-registry';

beforeEach( () => {
	delete window.gcbLiteControls;
	jest.isolateModules( () => require( '../../src/control-hub' ) );
} );

const Timeline = () => null;
const MyText = () => null;

describe( 'the control hub', () => {
	it( 'hands a bundle the types registered before it connected, and those after', () => {
		window.gcbLiteControls.register( 'timeline', Timeline );
		const components = { text: 'BuiltInText' };
		expect( connectControlHub( components ) ).toBe( true );
		expect( components.timeline ).toBe( Timeline );

		window.gcbLiteControls.register( 'rating', MyText );
		expect( components.rating ).toBe( MyText );
	} );

	it( 'reaches every connected bundle', () => {
		const a = {};
		const b = {};
		connectControlHub( a );
		connectControlHub( b );
		window.gcbLiteControls.register( 'timeline', Timeline );
		expect( a.timeline ).toBe( Timeline );
		expect( b.timeline ).toBe( Timeline );
	} );

	it( 'leaves a built-in alone unless asked to override it', () => {
		const components = { text: 'BuiltInText' };
		connectControlHub( components );
		window.gcbLiteControls.register( 'text', MyText );
		expect( components.text ).toBe( 'BuiltInText' );
		window.gcbLiteControls.register( 'text', MyText, { override: true } );
		expect( components.text ).toBe( MyText );
	} );

	it( 'refuses a bad registration', () => {
		const warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		expect( window.gcbLiteControls.register( 'Bad Name', Timeline ) ).toBe( false );
		expect( window.gcbLiteControls.register( 'ok', 'not a component' ) ).toBe( false );
		expect( window.gcbLiteControls.types() ).toEqual( [] );
		warn.mockRestore();
	} );

	it( 'is a no-op where there is no hub', () => {
		delete window.gcbLiteControls;
		expect( connectControlHub( {} ) ).toBe( false );
	} );

	it( 'loads once', () => {
		window.gcbLiteControls.register( 'timeline', Timeline );
		jest.isolateModules( () => require( '../../src/control-hub' ) );
		expect( window.gcbLiteControls.get( 'timeline' ) ).toBe( Timeline );
	} );
} );
