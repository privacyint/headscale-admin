<script lang="ts">
	import { getTime, getTimeDifferenceMessage } from '$lib/common/funcs';
	import type { Node } from '$lib/common/types';
	import { onMount } from 'svelte';
	import CardListEntry from '../CardListEntry.svelte';

	type NodeLastSeenProps = {
		node: Node,
	}
	let { node }: NodeLastSeenProps = $props()

	const getLastSeen = () => getTimeDifferenceMessage(getTime(node.lastSeen))
	let lastSeen = $state(getLastSeen());

	onMount(() => {
		const interval = setInterval(() => {
			lastSeen = getLastSeen();
		}, 1000);
		return () => {
			clearInterval(interval);
		};
	});
</script>

<CardListEntry title="Last Seen:">
	{#if node.online}
		Online Now
	{:else}
		{lastSeen}
	{/if}
</CardListEntry>
