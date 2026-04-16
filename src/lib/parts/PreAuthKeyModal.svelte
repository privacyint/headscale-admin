<script lang="ts">
	import { getModalStore } from '@skeletonlabs/skeleton';
	import { copyToClipboard } from '$lib/common/funcs';
	import { getToastStore } from '@skeletonlabs/skeleton';

	import RawMdiClipboard from '~icons/mdi/clipboard';

	type PreAuthKeyModalProps = {
		key: string;
	};
	let { key }: PreAuthKeyModalProps = $props();

	const ModalStore = getModalStore();
	const ToastStore = getToastStore();

	function close() {
		ModalStore.close();
	}
</script>

<div class="card p-6 w-modal shadow-xl space-y-4">
	<header class="text-2xl font-bold">PreAuth Key Created</header>
	<p class="text-sm text-surface-600-300-token">
		This is the only time the full key will be shown. Headscale stores a
		hashed version — copy it now.
	</p>
	<div class="flex flex-row items-center gap-2">
		<code
			class="flex-1 font-mono text-sm bg-surface-200-700-token p-3 rounded-md break-all select-all"
		>
			{key}
		</code>
		<button
			type="button"
			class="btn-icon variant-filled-primary rounded-md"
			onclick={() => copyToClipboard(key, ToastStore, 'Copied key to clipboard!')}
		>
			<RawMdiClipboard />
		</button>
	</div>
	<footer class="flex justify-end">
		<button class="btn rounded-md variant-filled-surface" onclick={close}>Close</button>
	</footer>
</div>
