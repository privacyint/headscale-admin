<script lang="ts">
	import CardListEntry from '../CardListEntry.svelte';
	import type { Node } from '$lib/common/types';
	import { getNodeOwner, isTaggedDevice, isOrphanTaggedDevice } from '$lib/common/types';
	import OnlineUserIndicator from '$lib/parts/OnlineUserIndicator.svelte';
	import { openDrawer } from '$lib/common/funcs';
	import { getDrawerStore } from '@skeletonlabs/skeleton';

	import { App } from '$lib/States.svelte';

	type NodeOwnerProps = {
		node: Node,
	}
	let { node }: NodeOwnerProps = $props()

	const drawerStore = getDrawerStore();
	const owner = $derived(getNodeOwner(node));
	const tagged = $derived(isTaggedDevice(node));
	const orphan = $derived(isOrphanTaggedDevice(node));

</script>

<CardListEntry title="Owner:" top>
	<div class="flex flex-row items-center gap-3 justify-end flex-wrap">
		{#if orphan}
			<span class="badge variant-soft-error text-xs px-1.5 py-0.5">no user</span>
			<span class="italic opacity-60">{node.user.name}</span>
		{:else}
			<a
				href=" "
				onclick={() => {
					openDrawer(drawerStore, 'userDrawer-' + owner.id, owner);
				}}
			>
				{owner.name}
			</a>
			{#if tagged}
				<span class="badge variant-soft-warning text-xs px-1.5 py-0.5">tagged</span>
			{/if}
			<OnlineUserIndicator user={owner} />
		{/if}
	</div>
</CardListEntry>
