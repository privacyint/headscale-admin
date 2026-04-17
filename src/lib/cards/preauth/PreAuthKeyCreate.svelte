<script lang="ts">
	import { createPreAuthKey } from '$lib/common/api';
	import { debug } from '$lib/common/debug';
	import { toastError, toastSuccess } from '$lib/common/funcs';
	import { getToastStore, getModalStore, type ModalSettings } from '@skeletonlabs/skeleton';
	import PreAuthKeyModal from '$lib/parts/PreAuthKeyModal.svelte';

	import RawMdiCheckCircleOutline from '~icons/mdi/check-circle-outline';

	import { App } from '$lib/States.svelte';
	import type { User } from '$lib/common/types';

	type PreAuthKeyCreateProps = {
		show: boolean,
	}

	let { show = $bindable(false) }: PreAuthKeyCreateProps = $props()

	let selectedUser = $state<User | null>(null);
	let selectedTags = $state('');
	let keyType = $state<'user' | 'tags'>('user');
	let ephemeral = $state(false);
	let reusable = $state(false);
	let expiration = $state(defaultExpiration());
	let loading = $state(false);
	const ToastStore = getToastStore();
	const ModalStore = getModalStore();

	function defaultExpiration(hours: number = 1, minutes: number = 0) {
		const tzOffset = new Date().getTimezoneOffset() * 60 * 1000;
		return new Date(Date.now() - tzOffset + minutes * 60 * 1000 + hours * 60 * 60 * 1000)
			.toISOString()
			.split(':')
			.slice(0, 2) // up to minutes, remove TZ info
			.join(':');
	}

	async function newPreAuthKey() {
		if (keyType === 'user' && !selectedUser) {
			toastError('Please select a user', ToastStore);
			return;
		}
		if (keyType === 'tags' && !selectedTags.trim()) {
			toastError('Please enter at least one tag', ToastStore);
			return;
		}
		loading = true;
		try {
			const tags = keyType === 'tags' ? selectedTags.split(',').map(t => t.trim()).filter(t => t) : null;
			const preAuthKey = await createPreAuthKey(
				keyType === 'user' ? selectedUser : null,
				tags,
				ephemeral,
				reusable,
				expiration
			);
			App.preAuthKeys.value.push(preAuthKey);

			const modal: ModalSettings = {
				type: 'component',
				component: { ref: PreAuthKeyModal, props: { key: preAuthKey.key } },
			};
			ModalStore.trigger(modal);

			toastSuccess('Created PreAuthKey', ToastStore);

			show = false;
			selectedUser = null;
			selectedTags = '';
			keyType = 'user';
			ephemeral = false;
			reusable = false;
			expiration = defaultExpiration();
		} catch (error) {
			if (error instanceof Error) {
				debug(error);
				toastError('Failed to create PreAuthKey', ToastStore, error);
			}
		} finally {
			loading = false;
		}
	}
</script>

{#if show}
<div class="flex w-full">
	<form onsubmit={newPreAuthKey} class="w-full flex flex-col space-y-4">
		<div class="flex flex-row space-x-4">
			<label class="flex items-center space-x-2">
				<input
					class="radio"
					type="radio"
					bind:group={keyType}
					value="user"
					disabled={loading}
				/>
				<span>User</span>
			</label>
			<label class="flex items-center space-x-2">
				<input
					class="radio"
					type="radio"
					bind:group={keyType}
					value="tags"
					disabled={loading}
				/>
				<span>Tags</span>
			</label>
		</div>
		
		{#if keyType === 'user'}
			<div class="flex flex-row space-x-4">
				<select class="select rounded-md w-full md:w-1/2" bind:value={selectedUser} required>
					<option value={null} disabled>Select a user...</option>
					{#each App.users.value as user}
						<option value={user}>{user.name} (ID: {user.id})</option>
					{/each}
				</select>
				<input
					class="input rounded-md w-full md:w-1/2"
					type="datetime-local"
					bind:value={expiration}
					disabled={loading}
				/>
			</div>
		{:else}
			<div class="flex flex-row space-x-4">
				<input
					class="input rounded-md w-full md:w-1/2"
					type="text"
					placeholder="Enter tags (comma-separated)"
					bind:value={selectedTags}
					disabled={loading}
				/>
				<input
					class="input rounded-md w-full md:w-1/2"
					type="datetime-local"
					bind:value={expiration}
					disabled={loading}
				/>
			</div>
		{/if}
		
		<div class="flex flex-row space-x-4 items-center">
			<label class="flex items-center space-x-2">
				<input
					class="checkbox"
					type="checkbox"
					bind:checked={ephemeral}
					disabled={loading}
				/>
				<span>Ephemeral</span>
			</label>
			<label class="flex items-center space-x-2">
				<input
					class="checkbox"
					type="checkbox"
					bind:checked={reusable}
					disabled={loading}
				/>
				<span>Reusable</span>
			</label>
			<button type="submit" class="btn btn-icon" disabled={loading}>
				<RawMdiCheckCircleOutline />
			</button>
		</div>
	</form>
</div>
{/if}
