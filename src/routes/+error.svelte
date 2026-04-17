<script lang="ts">
	import { page } from '$app/state';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
</script>

<div class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 p-8 text-center">
	<h1 class="h1 text-4xl font-bold">{page.status}</h1>
	<p class="text-lg opacity-70">{page.error?.message ?? 'An unexpected error occurred.'}</p>
	<button class="btn variant-filled-primary" onclick={() => goto(base + '/')}>
		Go to dashboard
	</button>
</div>
