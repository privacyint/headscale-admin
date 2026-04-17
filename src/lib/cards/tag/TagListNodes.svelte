<script lang="ts">
	import CardListEntry from '../CardListEntry.svelte';
	import type { Tag } from '$lib/common/types';
	import OnlineNodeIndicator from '$lib/parts/OnlineNodeIndicator.svelte';
	import { openDrawer } from '$lib/common/funcs';
	import { getDrawerStore } from '@skeletonlabs/skeleton';

	type TagListNodesProps = {
		tag: Tag,
	}

	let { tag }: TagListNodesProps = $props()

	const drawerStore = getDrawerStore();
</script>

<CardListEntry title="Nodes:">
	{#each tag.nodes as node}
		<div class="flex flex-row items-center gap-3 justify-end">
			<a
				href=" "
				onclick={() => {
					openDrawer(drawerStore, 'nodeDrawer-' + node.id, node);
				}}
			>
				{node.givenName} ({node.name})
			</a>
			<OnlineNodeIndicator {node} />
		</div>
	{/each}
</CardListEntry>
