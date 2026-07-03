<script lang="ts">
	import type { PolicyBuilder } from '$lib/common/policy-builder';

	let { acl = $bindable(), loading = $bindable(false) }: { acl: PolicyBuilder; loading?: boolean } = $props();

	const randomizeClientPort = $derived.by(() => {
		return {
			get enabled() {
				return acl.getRandomizeClientPort() === true;
			},
			set enabled(value: boolean) {
				acl.setRandomizeClientPort(value ? true : undefined);
			},
		};
	});
</script>

<div class="flex items-center mr-2 ml-0 pt-2">
	<div class="w-full md:w-8/12 lg:w-9/12 xl:w-8/12 2xl:w-6/12">
	<div class="grid grid-cols-1 bg-white dark:bg-slate-800 rounded-md p-5">
		<h3 class="font-mono mb-2">Top-level policy settings</h3>
		<div class="flex items-start space-x-3">
			<input
				id="randomize-client-port"
				type="checkbox"
				class="checkbox mt-1"
				bind:checked={randomizeClientPort.enabled}
				disabled={loading}
				data-testid="randomize-client-port-toggle"
			/>
			<div>
				<label for="randomize-client-port" class="font-semibold">randomizeClientPort</label>
				<p class="text-sm opacity-80">
					Enable random client source ports for outbound traffic.
				</p>
			</div>
		</div>
	</div>
	</div>
</div>
