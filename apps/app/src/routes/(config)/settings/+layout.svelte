<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import SidebarNav from './SidebarNav.svelte';

	const sidebarNavItems = [
		{ title: 'General', href: '/settings' },
		{ title: 'Recording', href: '/settings/recording' },
		{ title: 'Transcription', href: '/settings/transcription' },
		{ title: 'Shortcuts', href: '/settings/shortcuts' },
		{ title: 'Replacements', href: '/settings/replacements' },
	] as const;

	const isString = (value: unknown): value is string =>
		typeof value === 'string';
	const versionPromise = (async () => {
		const res = await fetch(
			'https://api.github.com/repos/braden-w/whispering/releases/latest',
		);
		const { html_url: latestReleaseUrl, tag_name: latestVersion } =
			await res.json();
		if (!isString(latestVersion) || !isString(latestReleaseUrl)) {
			throw new Error('Failed to fetch latest version');
		}
		if (!window.__TAURI_INTERNALS__)
			return { isOutdated: false, version: latestVersion } as const;
		const { getVersion } = await import('@tauri-apps/api/app');
		const currentVersion = `v${await getVersion()}`;
		if (latestVersion === currentVersion) {
			return { isOutdated: false, version: currentVersion } as const;
		}
		return {
			isOutdated: true,
			latestVersion,
			currentVersion,
			latestReleaseUrl,
		} as const;
	})();
</script>

<main class="container flex w-full flex-1 flex-col pb-4 pt-2">
	<div class="space-y-0.5">
		<h2 class="text-2xl font-bold tracking-tight">Settings</h2>
		<p class="text-muted-foreground">
			{#await versionPromise}
				Customize your Whispering experience.
			{:then v}
				{#if v.isOutdated}
					{@const { latestVersion, currentVersion, latestReleaseUrl } = v}
					Customize your experience for Whispering {currentVersion} (latest
					<Button
						class="px-0"
						variant="link"
						size="inline"
						href={latestReleaseUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						{latestVersion}
					</Button>).
				{:else}
					{@const { version } = v}
					Customize your experience for Whispering {version}.
				{/if}
			{:catch error}
				Customize your Whispering experience.
			{/await}
		</p>
	</div>
	<Separator class="my-6" />
	<div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
		<aside class="-mx-4 lg:w-1/5">
			<SidebarNav items={sidebarNavItems} />
		</aside>
		<div class="flex-1 lg:max-w-2xl">
			<slot />
		</div>
	</div>
</main>
