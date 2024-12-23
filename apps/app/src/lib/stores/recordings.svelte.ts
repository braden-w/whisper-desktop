import { goto } from '$app/navigation';
import { ClipboardService } from '$lib/services/ClipboardService';
import { DownloadService } from '$lib/services/DownloadService';
import { NotificationService } from '$lib/services/NotificationService';
import {
	type Recording,
	RecordingsDbService,
} from '$lib/services/RecordingDbService';
import { toast } from '$lib/services/ToastService';
import { TranscriptionServiceFasterWhisperServerLive } from '$lib/services/TranscriptionServiceFasterWhisperServerLive';
import { TranscriptionServiceGroqLive } from '$lib/services/TranscriptionServiceGroqLive';
import { TranscriptionServiceWhisperLive } from '$lib/services/TranscriptionServiceWhisperLive';
import { renderErrAsToast } from '$lib/services/renderErrorAsToast';
import { nanoid } from 'nanoid/non-secure';
import { settings } from './settings.svelte';
import type { MutationFn } from '@epicenterhq/result';
import type { WhisperingErrProperties, WhisperingResult } from '@repo/shared';

type RecordingsService = {
	readonly isTranscribing: boolean;
	readonly value: Recording[];
	addRecording: MutationFn<Recording, void, WhisperingErrProperties>;
	updateRecording: MutationFn<Recording, void, WhisperingErrProperties>;
	deleteRecordingById: MutationFn<string, void, WhisperingErrProperties>;
	deleteRecordingsById: MutationFn<string[], void, WhisperingErrProperties>;
	transcribeRecording: MutationFn<string, void, WhisperingErrProperties>;
	downloadRecording: MutationFn<string, void, WhisperingErrProperties>;
	copyRecordingText: MutationFn<Recording, void, WhisperingErrProperties>;
};

export const createRecordings = (): RecordingsService => {
	let recordings = $state<Recording[]>([]);
	const transcribingRecordingIds = $state(new Set<string>());

	const syncDbToRecordingsState = async () => {
		const getAllRecordingsResult = await RecordingsDbService.getAllRecordings();
		if (!getAllRecordingsResult.ok) {
			return renderErrAsToast(getAllRecordingsResult);
		}
		recordings = getAllRecordingsResult.data;
	};

	syncDbToRecordingsState();

	return {
		get isTranscribing() {
			return transcribingRecordingIds.size > 0;
		},
		get value() {
			return recordings;
		},
		async addRecording(
			recording: Recording,
			{
				onSuccess,
				onError,
			}: { onSuccess: () => void; onError: (err: WhisperingErr) => void },
		) {
			const addRecordingResult =
				await RecordingsDbService.addRecording(recording);
			if (!addRecordingResult.ok) {
				onError(addRecordingResult);
			}
			recordings.push(recording);
			onSuccess();
		},
		async updateRecording(
			recording: Recording,
			{ onMutate, onSuccess, onError, onSettled },
		) {
			onMutate(recording);
			const oldRecording = recordings.find((r) => r.id === recording.id);
			if (!oldRecording) {
				onError({
					_tag: 'WhisperingError',
					title: `Recording with id ${recording.id} not found`,
					description: 'Please try again.',
					action: { type: 'none' },
				});
				return;
			}
			recordings = recordings.map((r) =>
				r.id === recording.id ? recording : r,
			);
			await RecordingsDbService.updateRecording(recording, {
				onMutate: () => {},
				onSuccess,
				onError: (error) => {
					// Rollback the update
					recordings = recordings.map((r) =>
						r.id === recording.id ? oldRecording : r,
					);
					onError(error);
				},
				onSettled: () => {},
			});
			onSettled();
		},
		async deleteRecordingById(
			id: string,
			{ onMutate, onSuccess, onError, onSettled },
		) {
			onMutate(id);

			await RecordingsDbService.deleteRecordingById(id, {
				onMutate: () => {},
				onSuccess: () => {
					recordings = recordings.filter((r) => r.id !== id);
				},
				onError,
				onSettled: () => {},
			});
			onSuccess();
			onSettled();
		},
		async deleteRecordingsById(
			ids: string[],
			{ onMutate, onSuccess, onError, onSettled },
		) {
			onMutate(ids);
			await RecordingsDbService.deleteRecordingsById(ids, {
				onMutate: () => {},
				onSuccess: () => {
					recordings = recordings.filter(
						(recording) => !ids.includes(recording.id),
					);
				},
				onError,
				onSettled: () => {},
			});
			onSuccess();
			onSettled();
		},
		async transcribeRecording(
			id: string,
			{ onMutate, onSuccess, onError, onSettled },
		) {
			onMutate(id);
			const isDocumentVisible = () => !document.hidden;
			const currentTranscribingRecordingToastId = `transcribing-${id}` as const;
			const selectedTranscriptionService = {
				OpenAI: TranscriptionServiceWhisperLive,
				Groq: TranscriptionServiceGroqLive,
				'faster-whisper-server': TranscriptionServiceFasterWhisperServerLive,
			}[settings.value.selectedTranscriptionService];

			if (isDocumentVisible()) {
				toast.loading({
					id: currentTranscribingRecordingToastId,
					title: 'Transcribing...',
					description: 'Your recording is being transcribed.',
				});
			} else {
				NotificationService.notify({
					id: currentTranscribingRecordingToastId,
					title: 'Transcribing recording...',
					description: 'Your recording is being transcribed.',
					action: {
						type: 'link',
						label: 'Go to recordings',
						goto: '/recordings',
					},
				});
			}

			transcribingRecordingIds.add(id);
			const getRecordingResult = await RecordingsDbService.getRecording(id);
			if (!getRecordingResult.ok) {
				transcribingRecordingIds.delete(id);
				toast.dismiss(currentTranscribingRecordingToastId);
				NotificationService.clear(currentTranscribingRecordingToastId);
				onError({
					_tag: 'WhisperingError',
					title: `Error getting recording ${id} to transcribe`,
					description: 'Please try again.',
					action: { type: 'more-details', error: getRecordingResult.error },
				});
				onSettled();
				return;
			}
			const maybeRecording = getRecordingResult.data;
			if (maybeRecording === null) {
				transcribingRecordingIds.delete(id);
				toast.dismiss(currentTranscribingRecordingToastId);
				NotificationService.clear(currentTranscribingRecordingToastId);
				onError({
					_tag: 'WhisperingError',
					title: `Recording ${id} not found`,
					description: 'Please try again.',
					action: { type: 'none' },
				});
				onSettled();
				return;
			}
			const recording = maybeRecording;

			const updatedRecordingWithTranscribingStatus = {
				...recording,
				transcriptionStatus: 'TRANSCRIBING',
			} satisfies Recording;
			await RecordingsDbService.updateRecording(
				updatedRecordingWithTranscribingStatus,
				{
					onMutate: () => {},
					onSuccess: () => {
						recordings = recordings.map((r) =>
							r.id === recording.id
								? updatedRecordingWithTranscribingStatus
								: r,
						);
					},
					onError: (error) => {
						toast.loading({
							id: currentTranscribingRecordingToastId,
							title: `Error updating recording ${id} to transcribing`,
							description: 'Still trying to transcribe...',
						});
					},
					onSettled: () => {},
				},
			);

			const transcribeResult = await selectedTranscriptionService.transcribe(
				recording.blob,
			);

			if (!transcribeResult.ok) {
				const updatedRecordingWithUnprocessedStatus = {
					...recording,
					transcriptionStatus: 'UNPROCESSED',
				} satisfies Recording;
				await RecordingsDbService.updateRecording(
					updatedRecordingWithUnprocessedStatus,
					{
						onMutate: () => {},
						onSuccess: () => {
							recordings = recordings.map((r) =>
								r.id === recording.id
									? updatedRecordingWithUnprocessedStatus
									: r,
							);
						},
						onError: (error) => {},
						onSettled: () => {},
					},
				);
				transcribingRecordingIds.delete(id);
				toast.dismiss(currentTranscribingRecordingToastId);
				NotificationService.clear(currentTranscribingRecordingToastId);
				onError({
					_tag: 'WhisperingError',
					title: `Error transcribing recording ${id}`,
					description: 'Please try again.',
					action: { type: 'more-details', error: transcribeResult.error },
				});
				onSettled();
				return;
			}

			const transcribedText = transcribeResult.data;
			const updatedRecordingWithDoneStatus = {
				...recording,
				transcriptionStatus: 'DONE',
				transcribedText: transcribedText,
			} satisfies Recording;
			await RecordingsDbService.updateRecording(
				updatedRecordingWithDoneStatus,
				{
					onMutate: () => {},
					onSuccess: () => {
						recordings = recordings.map((r) =>
							r.id === recording.id ? updatedRecordingWithDoneStatus : r,
						);
					},
					onError: (error) => {
						toast.info({
							id: currentTranscribingRecordingToastId,
							title: `Error updating recording ${id} to done with transcribed text`,
							description: transcribedText,
						});
					},
					onSettled: () => {},
				},
			);

			transcribingRecordingIds.delete(id);
			toast.dismiss(currentTranscribingRecordingToastId);
			NotificationService.clear(currentTranscribingRecordingToastId);
			if (isDocumentVisible()) {
				toast.success({
					id: currentTranscribingRecordingToastId,
					title: 'Transcription complete!',
					description: 'Check it out in your recordings',
					action: {
						label: 'Go to recordings',
						onClick: () => goto('/recordings'),
					},
				});
			} else {
				NotificationService.notify({
					id: currentTranscribingRecordingToastId,
					title: 'Transcription complete!',
					description: 'Check it out in your recordings',
					action: {
						type: 'link',
						label: 'Go to recordings',
						goto: '/recordings',
					},
				});
			}

			if (transcribedText === '') return;

			const currentCopyingToClipboardToastId =
				`copying-to-clipboard-${id}` as const;
			// Copy transcription to clipboard if enabled
			if (settings.value.isCopyToClipboardEnabled) {
				const setClipboardTextResult = await ClipboardService.setClipboardText(
					transcribedText,
					{
						onMutate: () => {},
						onSuccess: () => {
							toast.success({
								id: currentCopyingToClipboardToastId,
								title: 'Transcription completed and copied to clipboard!',
								description: transcribedText,
								descriptionClass: 'line-clamp-2',
								action: {
									label: 'Go to recordings',
									onClick: () => goto('/recordings'),
								},
							});
						},
						onError: (errProperties) => {
							toast.error({
								id: currentCopyingToClipboardToastId,
								title: 'Error copying transcription to clipboard',
								description: transcribedText,
								descriptionClass: 'line-clamp-2',
								action: {
									label: 'Go to recordings',
									onClick: () => goto('/recordings'),
								},
							});
						},
						onSettled: () => {},
					},
				);
			}

			const currentPastingToCursorToastId = `pasting-to-cursor-${id}` as const;

			// Paste transcription if enabled
			if (settings.value.isPasteContentsOnSuccessEnabled) {
				await ClipboardService.writeTextToCursor(transcribedText, {
					onMutate: () => {},
					onSuccess: () => {
						toast.success({
							id: currentPastingToCursorToastId,
							title: 'Transcription completed and pasted to cursor!',
							description: transcribedText,
							descriptionClass: 'line-clamp-2',
							action: {
								label: 'Go to recordings',
								onClick: () => goto('/recordings'),
							},
						});
					},
					onError: (errProperties) => {
						toast.error({
							id: currentPastingToCursorToastId,
							title: 'Error pasting transcription to cursor',
							description: transcribedText,
							descriptionClass: 'line-clamp-2',
							action: {
								label: 'Go to recordings',
								onClick: () => goto('/recordings'),
							},
						});
					},
					onSettled: () => {},
				});
			}
		},
		async downloadRecording(
			id: string,
			{
				onSuccess,
				onError,
			}: { onSuccess: () => void; onError: (err: WhisperingErr) => void },
		) {
			const getRecordingResult = await RecordingsDbService.getRecording(id);
			if (!getRecordingResult.ok) {
				onError(getRecordingResult);
				return;
			}
			const maybeRecording = getRecordingResult.data;
			if (maybeRecording === null) {
				return WhisperingErr({
					title: `Recording with id ${id} not found`,
					description: 'Please try again.',
					action: { type: 'none' },
				});
			}
			const recording = maybeRecording;
			const downloadBlobResult = await DownloadService.downloadBlob({
				blob: recording.blob,
				name: `whispering_recording_${recording.id}`,
			});
			if (!downloadBlobResult.ok) return renderErrAsToast(downloadBlobResult);
			onSuccess();
		},
		async copyRecordingText(
			recording: Recording,
			{
				onSuccess,
				onError,
			}: {
				onSuccess: (transcribedText: string) => void;
				onError: (err: WhisperingErr) => void;
			},
		) {
			if (recording.transcribedText === '') return;
			const setClipboardTextResult = await ClipboardService.setClipboardText(
				recording.transcribedText,
			);
			if (!setClipboardTextResult.ok) {
				onError(setClipboardTextResult);
				return;
			}
			onSuccess(recording.transcribedText);
		},
	};
};

export const recordings = createRecordings();
