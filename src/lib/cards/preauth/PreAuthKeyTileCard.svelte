<script lang="ts">
	import { xxHash32 } from 'js-xxhash';
	import type { PreAuthKey } from '$lib/common/types';
	import { onMount } from 'svelte';
	import { dateToStr, openDrawer } from '$lib/common/funcs';
	import { getDrawerStore } from '@skeletonlabs/skeleton';
	import CardTileContainer from '../CardTileContainer.svelte';
	import CardTileEntry from '../CardTileEntry.svelte';

	type PreAuthKeyTileCardProps = {
		preAuthKey: PreAuthKey,
	}

	let { preAuthKey = $bindable() }: PreAuthKeyTileCardProps = $props()

	let pakIsExpired = $state(isExpired(preAuthKey))
	const drawerStore = getDrawerStore();

	let color = $derived(
		(xxHash32(preAuthKey.id + ':' + preAuthKey.key.substring(0,10), 0xbeefbabe) & 0xff_ff_ff)
		.toString(16)
		.padStart(6, '0')
	);

	function isExpired(preAuthKey: PreAuthKey): boolean {
		return new Date() > new Date(preAuthKey.expiration);
	}

	onMount(() => {
		const interval = setInterval(() => {
			pakIsExpired = isExpired(preAuthKey)
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	});
</script>

<CardTileContainer onclick={(_) => openDrawer(drawerStore, 'preauthKeyDrawer-' + preAuthKey.id, preAuthKey)}>
	<div class="flex justify-between items-center mb-4 mt-2">
		<div class="flex items-center">
			<span class="ml-2 text-lg font-semibold">ID: {preAuthKey.id}</span>
		</div>
		<div class="flex items-center font-bold">
			User: {preAuthKey.user?.name || 'N/A'}
		</div>
	</div>
	<CardTileEntry title="Created:">
		{dateToStr(preAuthKey.createdAt)}
	</CardTileEntry>
	<CardTileEntry title="Expiration:">
		<span class="{pakIsExpired ? 'text-red-500' : ''}">{dateToStr(preAuthKey.expiration)}</span>
	</CardTileEntry>
	<CardTileEntry title="Used:">
		<span class="badge {preAuthKey.used ? 'variant-filled-success' : 'variant-filled-surface'}">
			{preAuthKey.used ? 'Yes' : 'No'}
		</span>
	</CardTileEntry>
	<CardTileEntry title="Ephemeral:">
		<span class="badge {preAuthKey.ephemeral ? 'variant-filled-secondary' : 'variant-filled-surface'}">
			{preAuthKey.ephemeral ? 'Yes' : 'No'}
		</span>
	</CardTileEntry>
	<CardTileEntry title="Reusable:">
		<span class="badge {preAuthKey.reusable ? 'variant-filled-tertiary' : 'variant-filled-surface'}">
			{preAuthKey.reusable ? 'Yes' : 'No'}
		</span>
	</CardTileEntry>
	<hr style="background-color: #{color}" class="w-full h-0.5 mx-auto my-4 border-0 rounded" />
</CardTileContainer>
