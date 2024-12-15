<script lang="ts">
import WhisperingButton from '$lib/components/WhisperingButton.svelte';
import {
	GithubIcon,
	ListIcon,
	Minimize2Icon,
	MoonIcon,
	SlidersVerticalIcon,
	SunIcon,
	UploadIcon,
} from '$lib/components/icons';
import { cn } from '$lib/utils';
import { LogicalSize, getCurrentWindow } from '@tauri-apps/api/window';
import { toggleMode } from 'mode-watcher';
import { recorder } from '$lib/stores/recorder.svelte';
import { Effect } from 'effect';

let { class: className }: { class?: string } = $props();

let fileInput: HTMLInputElement;

function handleFileUpload(event: Event) {
	const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			const file = input.files[0];

			const uploadEffect = recorder.uploadRecording(file);
			Effect.runPromise(uploadEffect);
		}
}
</script>

<nav class={cn('flex items-center', className)} style="view-transition-name: nav">
	<WhisperingButton tooltipText="Recordings" href="/recordings" variant="ghost" size="icon">
		<ListIcon class="h-4 w-4" aria-hidden="true" />
	</WhisperingButton>
	<WhisperingButton
    tooltipText="Upload audio file"
    onclick={() => fileInput.click()}
    variant="ghost"
    size="icon"
  >
    <UploadIcon class="h-4 w-4" aria-hidden="true" />
    </WhisperingButton>
	<WhisperingButton tooltipText="Settings" href="/settings" variant="ghost" size="icon">
		<SlidersVerticalIcon class="h-4 w-4" aria-hidden="true" />
	</WhisperingButton>
	<WhisperingButton
		tooltipText="View project on GitHub"
		href="https://github.com/braden-w/whispering"
		target="_blank"
		rel="noopener noreferrer"
		variant="ghost"
		size="icon"
	>
		<GithubIcon class="h-4 w-4" aria-hidden="true" />
	</WhisperingButton>
	<WhisperingButton tooltipText="Toggle dark mode" onclick={toggleMode} variant="ghost" size="icon">
		<SunIcon
			class="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
		/>
		<MoonIcon
			class="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
		/>
	</WhisperingButton>
	{#if window.__TAURI_INTERNALS__}
		<WhisperingButton
			tooltipText="Minimize"
			onclick={() => getCurrentWindow().setSize(new LogicalSize(72, 84))}
			variant="ghost"
			size="icon"
		>
			<Minimize2Icon class="h-4 w-4" aria-hidden="true" />
		</WhisperingButton>
	{/if}
	<input
    type="file"
    accept="audio/*, video/*"
    onchange={handleFileUpload}
    bind:this={fileInput}
    style="display: none;"
 	/>
</nav>
