<script lang="ts">
	import { AccordionItem } from '@skeletonlabs/skeleton';

	import type { Node } from '$lib/common/types';
	import { isTaggedDevice } from '$lib/common/types';

	import CardListEntry from '../CardListEntry.svelte';
	import NodeInfo from './NodeInfo.svelte';
	import OnlineNodeIndicator from '$lib/parts/OnlineNodeIndicator.svelte';

	type NodeListCardProps = {
		node: Node,
		open?: boolean,
	}

	let { node = $bindable(), open = $bindable(false) }: NodeListCardProps = $props()

</script>

<AccordionItem
	{open}
	bind:id={node.id}
	class="backdrop-blur-xl backdrop-brightness-100 bg-white/25 dark:bg-white/5 rounded-md"
	padding="py-4 px-4"
	regionControl="!rounded-none"
>
	<svelte:fragment slot="lead">
		<OnlineNodeIndicator bind:node />
	</svelte:fragment>
	<svelte:fragment slot="summary">
		<div class="grid">
			<CardListEntry title="ID: {node.id}">
				<span class="font-bold">{node.givenName}</span>
				{#if isTaggedDevice(node)}
					<span class="badge variant-soft-warning text-xs px-1.5 py-0.5 ml-2">tagged</span>
				{/if}
			</CardListEntry>
		</div>
	</svelte:fragment>
	<svelte:fragment slot="content">
		<NodeInfo {node} />
	</svelte:fragment>
</AccordionItem>
