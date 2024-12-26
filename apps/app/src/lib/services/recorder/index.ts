import type { WhisperingErrProperties, WhisperingResult } from '@repo/shared';
import { createRecorderServiceTauri } from './RecorderServiceTauri';
import { createRecorderServiceWeb } from './RecorderServiceWeb';

// export const WhisperingRecorderService = createTauriRecorderService();
export const WhisperingRecorderService = createRecorderServiceWeb();

export type WhisperingRecorderErrProperties = WhisperingErrProperties;

export type UpdateStatusMessageFn = (args: {
	title: string;
	description: string;
}) => void;

export type RecordingSessionSettings = {
	deviceId: string;
	bitsPerSecond: number;
};

export type WhisperingRecorderService = {
	enumerateRecordingDevices: () => Promise<
		WhisperingResult<Pick<MediaDeviceInfo, 'deviceId' | 'label'>[]>
	>;
	initRecordingSession: (
		settings: RecordingSessionSettings,
		callbacks: { sendStatus: UpdateStatusMessageFn },
	) => Promise<WhisperingResult<void>>;
	closeRecordingSession: (
		_: undefined,
		callbacks: { sendStatus: UpdateStatusMessageFn },
	) => Promise<WhisperingResult<void>>;
	startRecording: (
		recordingId: string,
		callbacks: { sendStatus: UpdateStatusMessageFn },
	) => Promise<WhisperingResult<void>>;
	stopRecording: (
		_: undefined,
		callbacks: { sendStatus: UpdateStatusMessageFn },
	) => Promise<WhisperingResult<Blob>>;
	cancelRecording: (
		_: undefined,
		callbacks: { sendStatus: UpdateStatusMessageFn },
	) => Promise<WhisperingResult<void>>;
};
