<script lang="ts">
	import { page } from '$app/state';
	import { App } from '$lib/States.svelte';
	import { createPopulateErrorHandler } from '$lib/common/errors';
	import { debug, version } from '$lib/common/debug';
	import { getToastStore } from '@skeletonlabs/skeleton';
	import { fade } from 'svelte/transition';

	import RawMdiEye from '~icons/mdi/eye-outline';
	import RawMdiEyeOff from '~icons/mdi/eye-off-outline';

	const ToastStore = getToastStore();

	let apiUrl = $state(App.apiUrl.value || '');
	let apiKey = $state(App.apiKey.value || '');
	let apiKeyShow = $state(false);
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit(event: Event) {
		event.preventDefault();

		if (!apiKey.trim()) {
			error = 'API key is required.';
			return;
		}

		loading = true;
		error = '';

		const effectiveUrl = apiUrl.trim() || page.url.origin;

		try {
			const response = await fetch(new URL('/api/v1/apikey', effectiveUrl).href, {
				headers: {
					Authorization: 'Bearer ' + apiKey.trim(),
					Accept: 'application/json',
				},
			});

			if (!response.ok) {
				error = 'Invalid API key or URL. Please check your credentials.';
				return;
			}

			// Credentials are valid — persist them
			App.apiUrl.value = effectiveUrl;
			App.apiKey.value = apiKey.trim();
			App.apiKeyInfo.value = {
				authorized: true,
				expires: '',
				informedUnauthorized: false,
				informedExpiringSoon: false,
			};

			// Populate data immediately; the layout polling loop handles subsequent refreshes
			const handler = createPopulateErrorHandler(ToastStore);
			await App.populateAll(handler, false);
		} catch {
			error = 'Unable to connect to the server. Check the API URL.';
		} finally {
			loading = false;
		}
	}
</script>

{#if !App.hasApi}
	<div
		class="fixed inset-0 z-[999] flex items-center justify-center bg-black/60"
		transition:fade={{ duration: 150 }}
	>
		<div class="card p-8 w-full max-w-md mx-4 shadow-xl space-y-6">
			<header class="text-center space-y-1">
				<h2 class="h2 font-bold uppercase">Headscale-Admin</h2>
				<p class="text-sm opacity-60">{version}</p>
				<p class="mt-4">Enter your Headscale API credentials to continue.</p>
			</header>

			<form onsubmit={handleSubmit} class="space-y-4">
				<label class="label">
					<span>API URL</span>
					<input
						class="input"
						type="text"
						placeholder={page.url.origin}
						disabled={loading}
						bind:value={apiUrl}
					/>
				</label>

				<label class="label">
					<span>API Key</span>
					<div class="input-group input-group-divider grid-cols-[1fr_auto]">
						<input
							type={apiKeyShow ? 'text' : 'password'}
							placeholder="Enter your API key"
							disabled={loading}
							bind:value={apiKey}
						/>
						<button
							type="button"
							class="!flex items-center justify-center"
							disabled={loading}
							onclick={() => {
								apiKeyShow = !apiKeyShow;
							}}
							aria-label={apiKeyShow ? 'Hide API key' : 'Show API key'}
						>
							{#if apiKeyShow}
								<RawMdiEyeOff />
							{:else}
								<RawMdiEye />
							{/if}
						</button>
					</div>
				</label>

				{#if error}
					<aside class="alert variant-ghost-error">
						<div class="alert-message">
							<p>{error}</p>
						</div>
					</aside>
				{/if}

				<button type="submit" class="btn variant-filled-primary w-full" disabled={loading}>
					{loading ? 'Connecting…' : 'Connect'}
				</button>
			</form>
		</div>
	</div>
{/if}
