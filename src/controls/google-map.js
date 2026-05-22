import { BaseControl, Notice, TextControl } from '@wordpress/components';
import { useState, useEffect, useRef, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Google Map control — address search with autocomplete + interactive map.
 *
 * Stored shape:  { address, lat, lng, zoom }
 *
 * Requires a Google Maps JS API key, exposed via `window.gcbLite.googleMaps.apiKey`.
 * If no key, falls back to a plain address input that sets `address` only.
 */
export default function GoogleMapField({ control, value, onChange }) {
	const location = value && typeof value === 'object' ? value : { address: '', lat: null, lng: null, zoom: 14 };
	const hasApiKey = !!window.gcbLite?.googleMaps?.hasApiKey;
	const apiKey    = window.gcbLite?.googleMaps?.apiKey;

	const [address, setAddress] = useState(location.address || '');
	useEffect(() => { setAddress(location.address || ''); }, [location.address]);

	const inputRef = useRef(null);
	const mapRef = useRef(null);
	const mapInstance = useRef(null);
	const markerRef = useRef(null);

	const update = useCallback((next) => {
		onChange({ ...location, ...next });
	}, [onChange, location]);

	// Wire up Places autocomplete on the input.
	useEffect(() => {
		if (!hasApiKey || !inputRef.current || !window.google?.maps?.places) return;

		const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
			fields: ['formatted_address', 'geometry'],
		});
		const listener = ac.addListener('place_changed', () => {
			const place = ac.getPlace();
			if (!place.geometry) return;
			const lat = place.geometry.location.lat();
			const lng = place.geometry.location.lng();
			update({ address: place.formatted_address || '', lat, lng });
		});
		return () => window.google.maps.event.removeListener(listener);
	}, [hasApiKey, update]);

	// Wire up the map preview when we have coords.
	useEffect(() => {
		if (!hasApiKey || !mapRef.current || !window.google?.maps) return;
		if (location.lat == null || location.lng == null) return;

		const center = { lat: Number(location.lat), lng: Number(location.lng) };
		if (!mapInstance.current) {
			mapInstance.current = new window.google.maps.Map(mapRef.current, {
				center,
				zoom: location.zoom || 14,
				disableDefaultUI: true,
				clickableIcons: false,
			});
			markerRef.current = new window.google.maps.Marker({
				position: center,
				map: mapInstance.current,
				draggable: true,
			});
			markerRef.current.addListener('dragend', (e) => {
				update({ lat: e.latLng.lat(), lng: e.latLng.lng() });
			});
		} else {
			mapInstance.current.setCenter(center);
			markerRef.current.setPosition(center);
		}
	}, [hasApiKey, location.lat, location.lng, location.zoom, update]);

	if (!hasApiKey) {
		return (
			<BaseControl label={control.label} help={control.helpText} __nextHasNoMarginBottom>
				<Notice status="warning" isDismissible={false}>
					{__('No Google Maps API key configured. Set one with the `gcb_google_maps_api_key` filter to enable autocomplete and the map preview.', 'gcblite')}
				</Notice>
				<TextControl
					label=""
					hideLabelFromVision
					value={address}
					onChange={(next) => {
						setAddress(next);
						update({ address: next });
					}}
					placeholder={__('Enter an address…', 'gcblite')}
					__nextHasNoMarginBottom
				/>
			</BaseControl>
		);
	}

	return (
		<BaseControl label={control.label} help={control.helpText} __nextHasNoMarginBottom>
			<TextControl
				label=""
				hideLabelFromVision
				ref={inputRef}
				value={address}
				onChange={setAddress}
				placeholder={__('Start typing an address…', 'gcblite')}
				__nextHasNoMarginBottom
			/>
			{location.lat != null && location.lng != null && (
				<div
					ref={mapRef}
					style={{ width: '100%', height: 200, marginTop: 8, borderRadius: 4, overflow: 'hidden' }}
				/>
			)}
		</BaseControl>
	);
}
