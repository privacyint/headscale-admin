<script lang="ts">
	import CardListPage from '$lib/cards/CardListPage.svelte';
	import CardTilePage from '$lib/cards/CardTilePage.svelte';
	import PageHeader from '$lib/page/PageHeader.svelte';
	import PreAuthKeyListCard from '$lib/cards/preauth/PreAuthKeyListCard.svelte';
	import PreAuthKeyTileCard from '$lib/cards/preauth/PreAuthKeyTileCard.svelte';
	import PreAuthKeyCreate from '$lib/cards/preauth/PreAuthKeyCreate.svelte';
	import Page from '$lib/page/Page.svelte';
	import type { Direction } from '$lib/common/types';
	import SortBtn from '$lib/parts/SortBtn.svelte';
	import { getSortedFilteredPreAuthKeys } from '$lib/common/funcs';
	import { App } from '$lib/States.svelte';

	let showCreate = $state(false);

	let sortMethod = $state('id');
	let sortDirection = $state<Direction>('up');
	let filterString = $state('');

	const Outer = $derived(App.layoutPreauth.value === 'list' ? CardListPage : CardTilePage);
	const Inner = $derived(App.layoutPreauth.value === 'list' ? PreAuthKeyListCard : PreAuthKeyTileCard);

	const preAuthKeysSortedFiltered = $derived(
		getSortedFilteredPreAuthKeys(App.preAuthKeys.value, filterString, sortMethod, sortDirection)
	)

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
	<PageHeader title="Preauth Keys" layout={App.layoutPreauth} bind:show={showCreate} bind:filterString>
		{#snippet button()}
			<PreAuthKeyCreate bind:show={showCreate} />
		{/snippet}
	</PageHeader>

	<div
		class="btn-group px-0 mx-0 py-0 my-0 rounded-md variant-ghost-secondary [&>*+*]:border-primary-500"
	>
		<SortBtn bind:value={sortMethod} direction={sortDirection} name="ID" {toggle} />
		<SortBtn bind:value={sortMethod} direction={sortDirection} name="User" {toggle} />
		<SortBtn bind:value={sortMethod} direction={sortDirection} name="Created" {toggle} />
		<SortBtn bind:value={sortMethod} direction={sortDirection} name="Expiration" {toggle} />
	</div>

	<Outer>
		{#each preAuthKeysSortedFiltered as preAuthKey}
			<Inner {preAuthKey}></Inner>
		{/each}
	</Outer>
</Page>