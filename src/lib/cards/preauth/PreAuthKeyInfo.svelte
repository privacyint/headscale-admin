<script lang="ts">
	import CardListContainer from '../CardListContainer.svelte';
	import CardSeparator from '../CardSeparator.svelte';
	import ItemCreatedAt from '../common/ItemCreatedAt.svelte';
	import ItemDelete from '../common/ItemDelete.svelte';
	import type { PreAuthKey } from '$lib/common/types';
	import PreAuthKeyDetails from './PreAuthKeyDetails.svelte';

	type PreAuthKeyInfoProps = {
		preAuthKey: PreAuthKey,
	}
	let { preAuthKey = $bindable() }: PreAuthKeyInfoProps = $props()
</script>

<CardListContainer>
	<PreAuthKeyDetails {preAuthKey} />
	<CardSeparator />
	<ItemCreatedAt bind:item={preAuthKey} />
	<CardSeparator />
	<ItemDelete bind:item={preAuthKey} />
</CardListContainer>
