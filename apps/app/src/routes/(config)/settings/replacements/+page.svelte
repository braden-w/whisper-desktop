<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import { settings } from '$lib/stores/settings.svelte';
	import SettingsLabelInput from '../SettingsLabelInput.svelte';
	import { TrashIcon } from '$lib/components/icons';
	const replacementMap = $derived(settings.value.replacementMap);

	let originalWord = $state('');
	let replacementWord = $state('');

	function addReplacement() {
		if (originalWord && replacementWord) {
			settings.value = {
				...settings.value,
				replacementMap: { ...replacementMap, [originalWord]: replacementWord },
			};
		}
	}

	function remove(key: string) {
		const { [key]: removed, ...rest } = replacementMap;
		settings.value = {
			replacementMap: rest,
		};
	}
</script>

<svelte:head>
	<title>Configure word replacements - Whispering</title>
</svelte:head>

<div class="space-y-6">
	<div>
		<h3 class="text-lg font-medium">Shortcuts</h3>
		<p class="text-muted-foreground text-sm">
			Configure word replacements by defining a word to word mapping.
		</p>
	</div>
	<Separator />
	<div>
		{#if Object.keys(replacementMap).length > 0}
			<div
				class="grid grid-cols-11 gap-2 px-4 py-2 bg-gray-100 rounded-t-lg font-medium"
			>
				<div class="col-span-5">Original Word</div>
				<div class="col-span-5">Replacement Word</div>
				<div class="col-span-1 text-center">Delete</div>
			</div>
			{#each Object.entries(replacementMap) as [key, value], index}
				<div
					class="grid items-center gap-2 grid-cols-11 px-4 py-3 bg-white border-l border-b border-r"
					class:rounded-b-lg={index ===
						Object.entries(replacementMap).length - 1}
				>
					<span class="col-span-5 truncate">{key}</span>
					<span class="col-span-5 truncate">{value}</span>
					<Button
						class="col-span-1 flex justify-end"
						onclick={() => remove(key)}><TrashIcon /></Button
					>
				</div>
			{/each}
		{/if}
	</div>
	<div class="grid gap-2 grid-cols-2">
		<div>
			<SettingsLabelInput
				id="replacement-key"
				label="Original word"
				type="text"
				placeholder="Original word"
				value={originalWord}
				oninput={({ currentTarget: { value } }) => {
					originalWord = value;
				}}
			/>
		</div>
		<div>
			<SettingsLabelInput
				id="replacement-key"
				label="Replacement Word"
				type="text"
				placeholder="Replacement Word"
				value={replacementWord}
				oninput={({ currentTarget: { value } }) => {
					replacementWord = value;
				}}
			/>
		</div>
	</div>
	<div class="grid gap-2">
		<Button
			disabled={!originalWord || !replacementWord}
			onclick={addReplacement}>Add a replacement mapping</Button
		>
	</div>
</div>
