<script lang="ts">
	import CardTileContainer from '$lib/cards/CardTileContainer.svelte';
	import CardTilePage from '$lib/cards/CardTilePage.svelte';
	import Page from '$lib/page/Page.svelte';
	import PageHeader from '$lib/page/PageHeader.svelte';
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { isExpired, dateToStr, getNodesForUser, getTagsFromNodes } from '$lib/common/funcs';
	import { isTaggedDevice } from '$lib/common/types';

	import RawMdiDevices from '~icons/mdi/devices';
	import RawMdiRouter from '~icons/mdi/router';
	import RawMdiUser from '~icons/mdi/user';
	import RawMdiKey from '~icons/mdi/key';
	import RawMdiTag from '~icons/mdi/tag';
	import RawMdiExitRun from '~icons/mdi/exit-run';
	import RawMdiCheckCircle from '~icons/mdi/check-circle';
	import RawMdiAlertCircle from '~icons/mdi/alert-circle';
	import RawMdiLinux from '~icons/mdi/linux';
	import RawMdiApple from '~icons/mdi/apple';
	import RawMdiMicrosoftWindows from '~icons/mdi/microsoft-windows';
	import RawMdiMonitor from '~icons/mdi/monitor';

	import { App } from '$lib/States.svelte';

	type Summary = {
		title: string;
		border: string;
		value: string;
		icon: any;
		path: string;
	};

	// Exit node detection: nodes advertising 0.0.0.0/0 or ::/0
	const EXIT_ROUTES = ['0.0.0.0/0', '::/0'];
	function isExitNode(node: { approvedRoutes: string[] }): boolean {
		return node.approvedRoutes.some((r) => EXIT_ROUTES.includes(r));
	}

	const totalUsers = $derived(App.users.value.length);
	const onlineUsers = $derived(
		App.users.value.filter((user) =>
			getNodesForUser(App.nodes.value, user).some((n) => n.online),
		).length,
	);

	const totalNodes = $derived(App.nodes.value.length);
	const onlineNodes = $derived(App.nodes.value.filter((n) => n.online).length);

	const taggedNodes = $derived(App.nodes.value.filter(isTaggedDevice));
	const taggedNodesOnline = $derived(taggedNodes.filter((n) => n.online).length);

	const exitNodes = $derived(App.nodes.value.filter(isExitNode));
	const exitNodesOnline = $derived(exitNodes.filter((n) => n.online).length);

	const tagCount = $derived(getTagsFromNodes(App.nodes.value).length);

	const validPreAuthKeys = $derived(
		App.preAuthKeys.value.filter(
			(pak) => !isExpired(pak.expiration) && !(pak.used && !pak.reusable),
		).length,
	);

	const totalRoutes = $derived(
		App.nodes.value.reduce(
			(acc, node) => acc + (node.availableRoutes ? node.availableRoutes.length : 0),
			0,
		),
	);

	const summaries = $derived<Summary[]>([
		{
			title: 'Users Online',
			border: 'border-primary-700 dark:border-primary-600',
			icon: RawMdiUser,
			value: `${onlineUsers}/${totalUsers}`,
			path: '/users',
		},
		{
			title: 'Nodes Online',
			border: 'border-secondary-700 dark:border-secondary-600',
			icon: RawMdiDevices,
			value: `${onlineNodes}/${totalNodes}`,
			path: '/nodes',
		},
		{
			title: 'Exit Nodes Online',
			border: 'border-tertiary-700 dark:border-tertiary-600',
			icon: RawMdiExitRun,
			value: `${exitNodesOnline}/${exitNodes.length}`,
			path: '/nodes',
		},
		{
			title: 'Tagged Nodes Online',
			border: 'border-warning-500 dark:border-warning-400',
			icon: RawMdiTag,
			value: `${taggedNodesOnline}/${taggedNodes.length}`,
			path: '/nodes',
		},
		{
			title: 'Tags',
			border: 'border-warning-700 dark:border-warning-600',
			icon: RawMdiTag,
			value: `${tagCount}`,
			path: '/tags',
		},
		{
			title: 'Valid PreAuth Keys',
			border: 'border-slate-700 dark:border-slate-500',
			icon: RawMdiKey,
			value: `${validPreAuthKeys}`,
			path: '/users',
		},
		{
			title: 'Total Routes',
			border: 'border-surface-600 dark:border-surface-400',
			icon: RawMdiRouter,
			value: `${totalRoutes}`,
			path: '/routes',
		},
	]);

	const version = $derived(App.version.value);
	const health = $derived(App.health.value);

	function osIcon(os: string) {
		const lower = os.toLowerCase();
		if (lower === 'linux') return RawMdiLinux;
		if (lower === 'darwin') return RawMdiApple;
		if (lower === 'windows') return RawMdiMicrosoftWindows;
		return RawMdiMonitor;
	}

	function formatBuildDate(iso: string): string {
		try {
			return dateToStr(new Date(iso));
		} catch {
			return iso;
		}
	}
</script>

<Page>
	<PageHeader title="Home" />

	<CardTilePage>
		{#each summaries as summary}
			<CardTileContainer
				classes="border-solid border-[3px] border-l-[18px] {summary.border}"
				onclick={() => {
					goto(base + summary.path);
				}}
			>
				<div class="flex justify-around items-center mb-4 mt-2">
					<div class="flex pr-2">
						<span class="ml-2 text-5xl font-semibold">{summary.value}</span>
					</div>
				</div>
				<div class="flex justify-around items-center">
					<div class="flex items-center text-2xl font-bold">
						<summary.icon />
					</div>
				</div>
				<div class="flex justify-around items-center">
					<div class="text-small flex items-center font-bold">
						{summary.title}
					</div>
				</div>
			</CardTileContainer>
		{/each}
	</CardTilePage>

	<!-- Version & Health Info -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 mr-4 md:mr-8 lg:mr-12">
		<!-- Headscale Version -->
		<div class="card p-4 variant-ghost-surface">
			<h3 class="font-bold text-lg mb-3">Headscale Server</h3>
			{#if version}
				{@const OsIcon = osIcon(version.go.os)}
				<div class="space-y-2 text-sm">
					<div class="flex justify-between items-center">
						<span class="font-semibold">Version:</span>
						<a
							href="https://github.com/juanfont/headscale/releases/tag/{version.version}"
							target="_blank"
							rel="noopener noreferrer"
							class="anchor"
						>
							{version.version}
						</a>
					</div>
					<div class="flex justify-between items-center">
						<span class="font-semibold">Operating System:</span>
						<span class="flex items-center gap-1.5">
							<OsIcon />
							{version.go.os}
						</span>
					</div>
					<div class="flex justify-between items-center">
						<span class="font-semibold">Architecture:</span>
						<span>{version.go.arch}</span>
					</div>
					<div class="flex justify-between items-center">
						<span class="font-semibold">Go Version:</span>
						<span>{version.go.version}</span>
					</div>
					<div class="flex justify-between items-center">
						<span class="font-semibold">Built:</span>
						<span title={version.buildTime}>
							{formatBuildDate(version.buildTime)}
						</span>
					</div>
				</div>
			{:else}
				<p class="text-sm opacity-60">Loading version information…</p>
			{/if}
		</div>

		<!-- Health Status -->
		<div class="card p-4 variant-ghost-surface">
			<h3 class="font-bold text-lg mb-3">Health Status</h3>
			{#if health}
				<div class="space-y-2 text-sm">
					<div class="flex justify-between items-center">
						<span class="font-semibold">Database:</span>
						{#if health.databaseConnectivity}
							<span class="flex items-center gap-1.5 text-success-600 dark:text-success-400">
								<RawMdiCheckCircle />
								Connected
							</span>
						{:else}
							<span class="flex items-center gap-1.5 text-error-500 dark:text-error-400">
								<RawMdiAlertCircle />
								Disconnected
							</span>
						{/if}
					</div>
				</div>
			{:else}
				<p class="text-sm opacity-60">Loading health status…</p>
			{/if}
		</div>
	</div>
</Page>
