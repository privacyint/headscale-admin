<script lang="ts">
	import CardListEntry from '../CardListEntry.svelte';
	import type { Node, User } from '$lib/common/types';
	import { isTaggedDevice } from '$lib/common/types';
	import OnlineNodeIndicator from '$lib/parts/OnlineNodeIndicator.svelte';
	import { openDrawer, getNodesForUser } from '$lib/common/funcs';
	import { getDrawerStore } from '@skeletonlabs/skeleton';
	import { App } from '$lib/States.svelte';

	type UserListNodesProps = {
		user: User,
		title?: string,
	}
	let {
		user = $bindable(),
		title = 'Nodes:',
	}: UserListNodesProps = $props();

	const drawerStore = getDrawerStore();

	const filteredNodes = $derived.by(() => {
		if (App.users.value.filter((u) => u.id == user.id).length == 1) {
			return getNodesForUser(App.nodes.value, user);
		}
		return [];
	});
</script>

<CardListEntry {title}>
	{#each filteredNodes as node}
		<div class="flex flex-row items-center gap-3 justify-end">
			<a
				href=" "
				onclick={() => {
					openDrawer(drawerStore, 'nodeDrawer-' + node.id, node);
				}}
			>
				{node.givenName} ({node.name})
			</a>
			{#if isTaggedDevice(node)}
				<span class="badge variant-soft-warning text-xs px-1.5 py-0.5">tagged</span>
			{/if}
			<OnlineNodeIndicator {node} />
		</div>
	{/each}
</CardListEntry>
