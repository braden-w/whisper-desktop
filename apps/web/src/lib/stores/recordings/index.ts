import { RecordingsDb, type Recording } from '@repo/recorder';
import { Data, Effect } from 'effect';
import { writable } from 'svelte/store';

export function createRecordings() {
	const { subscribe, set, update } = writable<Recording[]>([]);
	return {
		subscribe,
		sync: Effect.gen(function* (_) {
			const recordingsDb = yield* _(RecordingsDb);
			const recordings = yield* _(recordingsDb.getAllRecordings);
			set(recordings);
		}),
		addRecording: (recording: Recording) =>
			Effect.gen(function* (_) {
				const recordingsDb = yield* _(RecordingsDb);
				yield* _(recordingsDb.addRecording(recording));
				update((recordings) => [...recordings, recording]);
			}),
		editRecording: (id: string, recording: Recording) =>
			Effect.gen(function* (_) {
				const recordingsDb = yield* _(RecordingsDb);
				yield* _(recordingsDb.editRecording(id, recording));
				update((recordings) => {
					const index = recordings.findIndex((recording) => recording.id === id);
					if (index === -1) return recordings;
					recordings[index] = recording;
					return recordings;
				});
			}),
		deleteRecording: (id: string) =>
			Effect.gen(function* (_) {
				const recordingsDb = yield* _(RecordingsDb);
				yield* _(recordingsDb.deleteRecording(id));
				update((recordings) => recordings.filter((recording) => recording.id !== id));
			}),
		transcribeRecording: (id: string) =>
			Effect.gen(function* (_) {
				const recordingsDb = yield* _(RecordingsDb);
				const recording = yield* _(recordingsDb.getRecording(id));
				const blob = yield* _(recordingsDb.recordingIdToBlob(id));
				const transcription = yield* _(transcribeAudioWithWhisperApi(blob, apiKey));
				yield* _(recordingsDb.editRecording(id, { ...recording, transcription }));
			})
	};
}

const transcribeAudioWithWhisperApi = (audioBlob: Blob, WHISPER_API_KEY: string) =>
	Effect.gen(function* (_) {
		if (audioBlob.size > 25 * 1024 * 1024) {
			return yield* _(
				new WhisperFileTooLarge({
					message: 'The file is too large. Please upload a file smaller than 25MB.'
				})
			);
		}
		const fileName = 'recording.wav';
		const wavFile = new File([audioBlob], fileName);
		const formData = new FormData();
		formData.append('file', wavFile);
		formData.append('model', 'whisper-1');
		const data = yield* _(
			Effect.tryPromise({
				try: () =>
					fetch('https://api.openai.com/v1/audio/transcriptions', {
						method: 'POST',
						headers: { Authorization: `Bearer ${WHISPER_API_KEY}` },
						body: formData
					}).then((res) => res.json()),
				catch: (error) => new WhisperFetchError({ origError: error })
			})
		);
		console.log('🚀 ~ Effect.gen ~ data:', data);
		return data.text;
	});

class WhisperFileTooLarge extends Data.TaggedError('WhisperFileTooLarge')<{
	message: string;
}> {}

class WhisperFetchError extends Data.TaggedError('WhisperFetchError')<{
	origError: unknown;
}> {}
