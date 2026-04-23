<script lang="ts">
	import CardListPage from '$lib/cards/CardListPage.svelte';
	import UserCreate from '$lib/cards/user/UserCreate.svelte';
	import UserListCard from '$lib/cards/user/UserListCard.svelte';
	import UserTileCard from '$lib/cards/user/UserTileCard.svelte';
	import CardTilePage from '$lib/cards/CardTilePage.svelte';
	import PageHeader from '$lib/page/PageHeader.svelte';

	import Page from '$lib/page/Page.svelte';
	import type { User, Direction, OnlineStatus } from '$lib/common/types';
	import { isTaggedDevice } from '$lib/common/types';
	import SortBtn from '$lib/parts/SortBtn.svelte';
	import { App } from '$lib/States.svelte';
	import { getSortedFilteredUsers, getNodesForUser } from '$lib/common/funcs';
	import FilterOnlineBtn from '$lib/parts/FilterOnlineBtn.svelte';
	import RawMdiTag from '~icons/mdi/tag';

	let showCreate = $state(false);
	const layout = $derived(App.layoutUser.value)

	// Sort & Filter
	let sortMethod = $state('id');
	let sortDirection = $state<Direction>('up');
	let filterOnlineStatus = $state<OnlineStatus>('all');
	let filterTagged = $state(false);
	let filterString = $state('');
	
	const usersSortedFiltered = $derived.by(() => {
		let users = getSortedFilteredUsers(
			App.users.value, filterString, sortMethod, sortDirection, filterOnlineStatus,
		);
		if (filterTagged) {
			users = users.filter((u) =>
				getNodesForUser(App.nodes.value, u).some(isTaggedDevice),
			);
		}
		return users;
	})

	const Outer = $derived(layout == 'list' ? CardListPage : CardTilePage);
	const Inner = $derived(layout == 'list' ? UserListCard : UserTileCard);

	function toggle(method: string) {
		if (method != sortMethod) {
			sortMethod = method;
			sortDirection = 'up';
		} else {
			sortDirection = sortDirection === 'up' ? 'down' : 'up';
		}
	}
</script>

<Page>
	<PageHeader title="Users" layout={App.layoutUser} bind:show={showCreate} bind:filterString>
		{#snippet button()}
			<UserCreate bind:show={showCreate} />
		{/snippet}
	</PageHeader>

	<div
		class="btn-group px-0 mx-0 py-0 my-0 rounded-md variant-ghost-secondary [&>*+*]:border-primary-500"
	>
		<SortBtn bind:value={sortMethod} direction={sortDirection} name="ID" {toggle} />
		<SortBtn bind:value={sortMethod} direction={sortDirection} name="Name" {toggle} />
	</div>
	<div
		class="btn-group ml-2 px-0 mx-0 py-0 my-0 rounded-md variant-ghost-secondary [&>*+*]:border-primary-500"
	>
		<FilterOnlineBtn bind:value={filterOnlineStatus} status="all" name="All" />
		<FilterOnlineBtn bind:value={filterOnlineStatus} status="online" name="Online" />
		<FilterOnlineBtn bind:value={filterOnlineStatus} status="offline" name="Offline" />
	</div>
	<div class="inline-flex ml-2">
		<button
			class="btn btn-sm rounded-md {filterTagged ? 'variant-filled-warning' : 'variant-ghost-secondary'}"
			onclick={() => { filterTagged = !filterTagged }}
		>
			<RawMdiTag class="pr-1" />
			Tagged
		</button>
	</div>

	<Outer>
		{#each usersSortedFiltered as user}
			<Inner {user}></Inner>
		{/each}
	</Outer>
	<!--svelte:component this={outer}>
		{#each getSortedUsers(filteredUsers, sortMethod, sortDirection) as user}
			<svelte:component this={inner} {user} />
		{/each}
	</svelte:component-->
</Page>
