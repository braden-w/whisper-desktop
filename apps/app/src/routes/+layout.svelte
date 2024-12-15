<script lang="ts">
import { goto, onNavigate } from '$app/navigation';
import FasterRerecordExplainedDialog from '$lib/components/FasterRerecordExplainedDialog.svelte';
import MoreDetailsDialog from '$lib/components/MoreDetailsDialog.svelte';
import { sendMessageToExtension } from '$lib/sendMessageToExtension';
import { setAlwaysOnTopToTrueIfAlwaysInSettings } from '$lib/services/AlwaysOnTopService';
import { renderErrorAsToast } from '$lib/services/renderErrorAsToast';
import { recorder, recorderState } from '$lib/stores/recorder.svelte';
import { Effect } from 'effect';
import { ModeWatcher, mode } from 'mode-watcher';
import { onMount } from 'svelte';
import type { ToasterProps } from 'svelte-sonner';
import { Toaster } from 'svelte-sonner';
import '../app.pcss';
import { writable } from 'svelte/store';

onNavigate((navigation) => {
	if (!document.startViewTransition) return;

	return new Promise((resolve) => {
		document.startViewTransition(async () => {
			resolve();
			await navigation.complete;
		});
	});
});

onMount(async () => {
	window.toggleRecording = recorder.toggleRecording;
	window.cancelRecording = recorder.cancelRecording;
	window.goto = goto;
	window.addEventListener('beforeunload', () => {
		if (recorderState.value === 'RECORDING') {
			recorderState.value = 'IDLE';
		}
	});
	if (!window.__TAURI_INTERNALS__) {
		sendMessageToExtension({
			name: 'whispering-extension/notifyWhisperingTabReady',
			body: {},
		}).pipe(Effect.catchAll(renderErrorAsToast), Effect.runPromise);
	}
	setAlwaysOnTopToTrueIfAlwaysInSettings();
});

const TOASTER_SETTINGS = {
	position: 'bottom-right',
	richColors: true,
	duration: 5000,
	visibleToasts: 5,
} satisfies ToasterProps;
const isDragging = writable(false);
// Handle the file upload
function handleFileUpload(file: File) {
		const uploadEffect = recorder.uploadRecording(file);
		Effect.runPromise(uploadEffect);
}

	// Handle drag and drop events
const handleDragOver = (event: DragEvent) => {
	event.preventDefault();
	isDragging.set(true); // Show visual feedback when dragging
};

const handleDrop = (event: DragEvent) => {
	event.preventDefault();
	isDragging.set(false); // Reset visual feedback
		if (event.dataTransfer?.files.length) {
			const file = event.dataTransfer.files[0];
			handleFileUpload(file);
		}
};

const handleDragLeave = () => {
	isDragging.set(false); // Reset visual feedback on drag leave
};
</script>

<svelte:head>
	<title>Whispering</title>
</svelte:head>

<button
	class="xxs:hidden hover:bg-accent hover:text-accent-foreground h-screen w-screen transform duration-300 ease-in-out"
	onclick={recorder.toggleRecording}
>
	<span
		style="filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.5));"
		class="text-[48px] leading-none"
	>
		{#if recorder.recorderState === 'RECORDING'}
			🔲
		{:else}
			🎙️
		{/if}
	</span>
</button>

<div
	class="min-h-screen flex flex-col items-center gap-2"
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	aria-label="Drop area for uploading files"
	role="button"
	tabindex="0"
	style="border: 2px dashed { $isDragging ? '#4caf50' : 'transparent' }; padding: 20px;"
>
	<slot />
</div>



<Toaster class="xs:block hidden" theme={$mode} {...TOASTER_SETTINGS} />
<ModeWatcher />
<FasterRerecordExplainedDialog />
<MoreDetailsDialog />
<style>
	.min-h-screen {
		transition: border-color 0.3s ease;
	}
</style>