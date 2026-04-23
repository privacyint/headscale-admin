<script lang="ts">
	import type { User } from '$lib/common/types';
	import RawMdiUser from '~icons/mdi/user';
	import { App } from '$lib/States.svelte';
	import { getNodesForUser } from '$lib/common/funcs';

	type OnlineUserIndicatorProps = {
		user: User,
	}

	let {
		user = $bindable(),
	}: OnlineUserIndicatorProps = $props()

	const color = $derived(
		getNodesForUser(App.nodes.value, user).some((n) => n.online)
		? 'text-success-600 dark:text-success-400'
		: 'text-error-500 dark:text-error-400'
	)
</script>

<RawMdiUser class={color} />
