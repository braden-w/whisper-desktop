import { Context } from 'effect';

export class RecorderWithStateService extends Context.Tag('RecorderWithStateService')<
	RecorderWithStateService,
	{
		readonly recorderState: Uppercase<RecordingState>;
		toggleRecording: () => Promise<any>;
		cancelRecording: () => Promise<any>;
		enumerateRecordingDevices: () => Promise<MediaDeviceInfo[]>;
	}
>() {}
