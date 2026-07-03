<script lang="ts">
	import { AccordionItem } from '@skeletonlabs/skeleton';

	import type { Node } from '$lib/common/types';

	import CardListEntry from '../CardListEntry.svelte';
	import NodeInfo from './NodeInfo.svelte';
	import OnlineNodeIndicator from '$lib/parts/OnlineNodeIndicator.svelte';
	import NodeTagsIcon from '$lib/parts/NodeTagsIcon.svelte';

	type NodeListCardProps = {
		node: Node,
		open?: boolean,
	}

	let { node = $bindable(), open = $bindable(false) }: NodeListCardProps = $props()

</script>

<style>
	:global(.node-list-card) {
		position: relative;
		z-index: 0;
	}

	:global(.node-list-card:has([data-popup-open='true'])) {
		z-index: 60;
	}
</style>

<AccordionItem
	{open}
	bind:id={node.id}
	class="node-list-card backdrop-blur-xl backdrop-brightness-100 bg-white/25 dark:bg-white/5 rounded-md"
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
				{#if node.tags.length > 0}
					<span class="ml-1"><NodeTagsIcon tags={node.tags} id="node-list-{node.id}" /></span>
				{/if}
			</CardListEntry>
		</div>
	</svelte:fragment>
	<svelte:fragment slot="content">
		<NodeInfo {node} />
	</svelte:fragment>
</AccordionItem>
