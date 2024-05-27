import {
	PleaseEnterAPIKeyToast,
	SomethingWentWrongToast,
	TranscriptionComplete,
	InvalidApiKey,
} from '$lib/toasts';
import { ClipboardService } from '@repo/services/services/clipboard';
import type { Recording } from '@repo/services/services/recordings-db';
import { RecordingsDbService } from '@repo/services/services/recordings-db';
import { TranscriptionError, TranscriptionService } from '@repo/services/services/transcription';
import { Console, Effect, Either, Option } from 'effect';
import { toast } from 'svelte-sonner';
import { settings } from '../settings.svelte';

export const createRecordings = Effect.gen(function* () {
	const recordingsDb = yield* RecordingsDbService;
	const transcriptionService = yield* TranscriptionService;
	const clipboardService = yield* ClipboardService;

	let recordings = $state<Recording[]>([]);
	const updateRecording = (recording: Recording) =>
		Effect.gen(function* () {
			yield* recordingsDb.updateRecording(recording);
			recordings = recordings.map((r) => (r.id === recording.id ? recording : r));
		});
	return {
		get value() {
			return recordings;
		},
		sync: Effect.gen(function* () {
			recordings = yield* recordingsDb.getAllRecordings;
		}).pipe(
			Effect.catchAll((error) => {
				console.error(error);
				toast.error(error.message);
				return Effect.succeed(undefined);
			}),
		),
		addRecording: (recording: Recording) =>
			Effect.gen(function* () {
				yield* recordingsDb.addRecording(recording);
				recordings.push(recording);
			}).pipe(
				Effect.catchAll((error) => {
					console.error(error);
					toast.error(error.message);
					return Effect.succeed(undefined);
				}),
			),
		updateRecording: (recording: Recording) =>
			Effect.gen(function* () {
				yield* updateRecording(recording);
				toast.success('Recording updated!');
			}).pipe(
				Effect.catchAll((error) => {
					console.error(error);
					toast.error(error.message);
					return Effect.succeed(undefined);
				}),
			),
		deleteRecording: (id: string) =>
			Effect.gen(function* () {
				yield* recordingsDb.deleteRecording(id);
				recordings = recordings.filter((recording) => recording.id !== id);
				toast.success('Recording deleted!');
			}).pipe(
				Effect.catchAll((error) => {
					console.error(error);
					toast.error(error.message);
					return Effect.succeed(undefined);
				}),
			),
		transcribeRecording: (id: string) =>
			Effect.gen(function* () {
				const maybeRecording = yield* recordingsDb.getRecording(id);
				if (Option.isNone(maybeRecording)) {
					return yield* new TranscriptionError({ message: `Recording with id ${id} not found` });
				}
				const recording = yield* maybeRecording;
				yield* updateRecording({ ...recording, transcriptionStatus: 'TRANSCRIBING' });
				const transcriptionResult = yield* Effect.either(
					transcriptionService.transcribe(recording.blob, settings),
				);
				if (Either.isLeft(transcriptionResult)) {
					yield* updateRecording({ ...recording, transcriptionStatus: 'UNPROCESSED' });
					const error = transcriptionResult.left;
					return yield* error;
				}
				const transcribedText = transcriptionResult.right;
				yield* updateRecording({ ...recording, transcribedText, transcriptionStatus: 'DONE' });
				if (settings.isCopyToClipboardEnabled && transcribedText)
					yield* clipboardService.setClipboardText(transcribedText);
				if (settings.isPasteContentsOnSuccessEnabled && transcribedText)
					yield* clipboardService.writeText(transcribedText);
			}).pipe(
				Effect.catchAll((error) => Effect.succeed(error)),
				Effect.runPromise,
				(transcribeAndCopyPromise) => {
					toast.promise(transcribeAndCopyPromise, {
						loading: 'Transcribing recording...',
						success: (maybeError) => {
							if (!maybeError) return TranscriptionComplete;
							const error = maybeError;
							Console.error(error).pipe(Effect.runSync);
							switch (error._tag) {
								case 'PleaseEnterApiKeyError':
									return PleaseEnterAPIKeyToast;
								case 'InvalidApiKeyError':
									return InvalidApiKey;
								default:
									return SomethingWentWrongToast;
							}
						},
						error: (uncaughtError) => {
							Console.error(uncaughtError).pipe(Effect.runSync);
							return SomethingWentWrongToast;
						},
					});
				},
			),
		copyRecordingText: (recording: Recording) =>
			Effect.gen(function* () {
				if (recording.transcribedText === '') return;
				yield* clipboardService.setClipboardText(recording.transcribedText);
				toast.success('Copied to clipboard!');
			}).pipe(
				Effect.catchAll((error) => {
					toast.error(error.message);
					return Effect.succeed(undefined);
				}),
				Effect.runPromise,
			),
	};
});
