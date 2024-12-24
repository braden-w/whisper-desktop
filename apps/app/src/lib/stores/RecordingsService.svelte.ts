import type {
	Recording,
	RecordingsDbService,
	RecordingsDbServiceErrorProperties,
} from '$lib/services/RecordingDbService';
import { createRecordingsDbServiceLiveIndexedDb } from '$lib/services/RecordingDbServiceIndexedDbLive.svelte';
import { renderErrAsToast } from '$lib/services/renderErrorAsToast';
import { Ok, type ServiceFn } from '@epicenterhq/result';

export type RecordingsService = {
	get recordings(): Recording[];
	updateRecording: ServiceFn<
		Recording,
		void,
		RecordingsDbServiceErrorProperties
	>;
	deleteRecordingById: ServiceFn<
		string,
		string,
		RecordingsDbServiceErrorProperties
	>;
	deleteRecordingsById: ServiceFn<
		string[],
		string[],
		RecordingsDbServiceErrorProperties
	>;
};

export const RecordingsService = createRecordingsService({
	RecordingsDbService: createRecordingsDbServiceLiveIndexedDb(),
});

function createRecordingsService({
	RecordingsDbService,
}: { RecordingsDbService: RecordingsDbService }): RecordingsService {
	let recordingsArray = $state<Recording[]>([]);

	const syncDbToRecordingsState = async () => {
		const getAllRecordingsResult = await RecordingsDbService.getAllRecordings();
		if (!getAllRecordingsResult.ok) {
			return renderErrAsToast({
				title: 'Failed to initialize recordings',
				description:
					'Unable to load your recordings from the database. This could be due to browser storage issues or corrupted data.',
				action: { type: 'more-details', error: getAllRecordingsResult.error },
			});
		}
		recordingsArray = getAllRecordingsResult.data;
	};

	syncDbToRecordingsState();

	return {
		get recordings() {
			return recordingsArray;
		},
		async updateRecording(recording) {
			const updateRecordingResult =
				await RecordingsDbService.updateRecording(recording);
			if (!updateRecordingResult.ok) {
				return updateRecordingResult;
			}
			recordingsArray = recordingsArray.map((r) =>
				r.id === recording.id ? recording : r,
			);
			return Ok(undefined);
		},
		async deleteRecordingById(id: string) {
			const deleteRecordingByIdResult =
				await RecordingsDbService.deleteRecordingById(id);
			if (!deleteRecordingByIdResult.ok) {
				return deleteRecordingByIdResult;
			}
			recordingsArray = recordingsArray.filter((r) => r.id !== id);
			return Ok(id);
		},
		async deleteRecordingsById(ids: string[]) {
			const deleteRecordingsByIdResult =
				await RecordingsDbService.deleteRecordingsById(ids);
			if (!deleteRecordingsByIdResult.ok) {
				return deleteRecordingsByIdResult;
			}
			recordingsArray = recordingsArray.filter(
				(recording) => !ids.includes(recording.id),
			);
			return Ok(ids);
		},
	};
}
