/**
 * Buffer per-block render requests for one tick, then fire a single POST to
 * /gcblite/v1/render-batch. Without this, opening a page with N blocks fires
 * N parallel REST requests — each one a network hop, each one possibly a
 * server-to-server hit on the component server.
 *
 * Mirrors the full plugin's batch-render-coordinator. Singleton on purpose:
 * every usePreview hook on the page shares the same queue.
 */

import apiFetch from '@wordpress/api-fetch';

const BATCH_DELAY_MS = 1;

class BatchRenderCoordinator {
	constructor() {
		this.pending = new Map(); // clientId → { blockName, attributes, resolve, reject }
		this.timer = null;
		this.processing = false;
	}

	/**
	 * @returns Promise<{ html: string, wrapperAttributes: object }>
	 */
	requestRender(clientId, blockName, attributes) {
		return new Promise((resolve, reject) => {
			// If this block already has a pending request, supersede it —
			// only the latest attributes matter.
			const existing = this.pending.get(clientId);
			if (existing) {
				existing.reject(new Error('superseded'));
			}
			this.pending.set(clientId, { blockName, attributes, resolve, reject });
			this.schedule();
		});
	}

	schedule() {
		if (this.processing || this.timer) return;
		this.timer = setTimeout(() => this.flush(), BATCH_DELAY_MS);
	}

	async flush() {
		this.timer = null;
		if (this.pending.size === 0 || this.processing) return;

		this.processing = true;
		const callbacks = new Map(this.pending);
		const blocks = Array.from(this.pending.entries()).map(([clientId, data]) => ({
			clientId,
			blockName: data.blockName,
			attributes: data.attributes,
		}));
		this.pending.clear();

		try {
			const response = await apiFetch({
				path: '/gcblite/v1/render-batch',
				method: 'POST',
				data: { blocks },
			});

			if (!response || !response.success || !response.results) {
				callbacks.forEach(({ reject }) => reject(new Error('batch render failed')));
				return;
			}

			callbacks.forEach((cb, clientId) => {
				const result = response.results[clientId];
				if (!result) {
					cb.reject(new Error('no result for client'));
					return;
				}
				if (result.success) {
					cb.resolve({
						html: result.html || '',
						wrapperAttributes: result.wrapperAttributes || {},
					});
				} else {
					cb.reject(new Error(result.error || 'render failed'));
				}
			});
		} catch (err) {
			callbacks.forEach(({ reject }) => reject(err));
		} finally {
			this.processing = false;
			// Anything queued while we were in-flight gets its own pass.
			if (this.pending.size > 0) this.schedule();
		}
	}
}

const coordinator = new BatchRenderCoordinator();
export default coordinator;
