jest.mock( '@wordpress/api-fetch', () => jest.fn( () => Promise.resolve( {} ) ) );
import apiFetch from '@wordpress/api-fetch';
import { scheduleValidationSync } from '../../src/hooks/useRepeaterValidation';

describe( 'the validation report: one per post, not one per block', () => {
	beforeEach( () => {
		jest.useFakeTimers();
		apiFetch.mockClear();
		window.gcbValidationErrors = {};
	} );
	afterEach( () => jest.useRealTimers() );

	it( 'sends one request for a burst of blocks mounting', () => {
		for ( let i = 0; i < 29; i++ ) {
			scheduleValidationSync( 101 );
		}
		jest.runAllTimers();
		expect( apiFetch ).toHaveBeenCalledTimes( 1 );
		expect( apiFetch.mock.calls[ 0 ][ 0 ].data ).toEqual( { post_id: '101', has_errors: false, errors: {} } );
	} );

	it( 'does not send a state the server already has', () => {
		scheduleValidationSync( 102 );
		jest.runAllTimers();
		scheduleValidationSync( 102 );
		jest.runAllTimers();
		expect( apiFetch ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'sends again when the state changes, and when it is fixed', () => {
		scheduleValidationSync( 103 );
		jest.runAllTimers();
		window.gcbValidationErrors.abc = { _minChildren: 'Slides needs at least 1 item (has 0).' };
		scheduleValidationSync( 103 );
		jest.runAllTimers();
		delete window.gcbValidationErrors.abc;
		scheduleValidationSync( 103 );
		jest.runAllTimers();
		expect( apiFetch ).toHaveBeenCalledTimes( 3 );
		expect( apiFetch.mock.calls[ 1 ][ 0 ].data.has_errors ).toBe( true );
		expect( apiFetch.mock.calls[ 2 ][ 0 ].data.has_errors ).toBe( false );
	} );

	it( 'keeps posts apart', () => {
		scheduleValidationSync( 104 );
		scheduleValidationSync( 105 );
		jest.runAllTimers();
		expect( apiFetch ).toHaveBeenCalledTimes( 2 );
	} );
} );
