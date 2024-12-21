import { sendMessageToExtension } from '$lib/sendMessageToExtension';
import { mediaRecorder } from '$lib/services/mediaRecorder.svelte';
import { NotificationService } from '$lib/services/NotificationService';
import { SetTrayIconService } from '$lib/services/SetTrayIconService';
import { toast } from '$lib/services/ToastService';
import { renderErrAsToast } from '$lib/services/renderErrorAsToast';
import { recordings } from '$lib/stores/recordings.svelte';
import { settings } from '$lib/stores/settings.svelte';
import {
	Ok,
	type WhisperingRecordingState,
	type WhisperingResult,
} from '@repo/shared';
import { nanoid } from 'nanoid/non-secure';
import type { Recording } from '../services/RecordingDbService';
import stopSoundSrc from './assets/sound_ex_machina_Button_Blip.mp3';
import startSoundSrc from './assets/zapsplat_household_alarm_clock_button_press_12967.mp3';
import cancelSoundSrc from './assets/zapsplat_multimedia_click_button_short_sharp_73510.mp3';
import { MediaRecorderService } from '$lib/services/MediaRecorderService';

const startSound = new Audio(startSoundSrc);
const stopSound = new Audio(stopSoundSrc);
const cancelSound = new Audio(cancelSoundSrc);

const IS_RECORDING_NOTIFICATION_ID = 'WHISPERING_RECORDING_NOTIFICATION';

export const recorder = createRecorder();

function createRecorder() {
	let recorderState = $state<WhisperingRecordingState>('IDLE');

	return {
		get recorderState() {
			return recorderState;
		},
		set recorderState(newValue: WhisperingRecordingState) {
			recorderState = newValue;
			(async () => {
				const result = await SetTrayIconService.setTrayIcon(newValue);
				if (!result.ok) renderErrAsToast(result);
			})();
		},

		async toggleRecording(): Promise<void> {
			const onStopError = renderErrAsToast;
			const onStopSuccess = (blob: Blob) => {
				recorderState = 'IDLE';
				console.info('Recording stopped');
				void playSound('stop');

				const newRecording: Recording = {
					id: nanoid(),
					title: '',
					subtitle: '',
					timestamp: new Date().toISOString(),
					transcribedText: '',
					blob,
					transcriptionStatus: 'UNPROCESSED',
				};

				const addRecordingAndTranscribeResultToastId = nanoid();

				void recordings.addRecording(newRecording, {
					onSuccess: () => {
						toast.loading({
							id: addRecordingAndTranscribeResultToastId,
							title: 'Recording added!',
							description: 'Your recording has been added successfully.',
						});
						recordings.transcribeRecording(newRecording.id, {
							toastId: addRecordingAndTranscribeResultToastId,
						});
					},
					onError: renderErrAsToast,
				});
			};

			const onStartSuccess = () => {
				recorderState = 'RECORDING';
				console.info('Recording started');
				void playSound('start');
				void NotificationService.notify({
					id: IS_RECORDING_NOTIFICATION_ID,
					title: 'Whispering is recording...',
					description: 'Click to go to recorder',
					action: {
						type: 'link',
						label: 'Go to recorder',
						goto: '/',
					},
				});
			};

			if (recorderState === 'RECORDING') {
				if (settings.value.isFasterRerecordEnabled) {
					const stopResult = await MediaRecorderService.stopAndCloseStream();
					if (!stopResult.ok) {
						onStopError(stopResult);
						return;
					}
					const blob = stopResult.data;
					onStopSuccess(blob);
				} else {
					const stopResult = await MediaRecorderService.stopKeepStream();
					if (!stopResult.ok) {
						onStopError(stopResult);
						return;
					}
					const blob = stopResult.data;
					onStopSuccess(blob);
				}
			} else {
				if (settings.value.isFasterRerecordEnabled) {
					const startResult =
						await MediaRecorderService.startFromExistingStream({
							bitsPerSecond: Number(settings.value.bitrateKbps) * 1000,
						});
					if (!startResult.ok) {
						switch (startResult.error._tag) {
							case 'OpenStreamDoesNotExistErr': {
								toast.loading({
									title: 'Existing recording session not found',
									description: 'Creating a new recording session...',
								});
								const startResult =
									await MediaRecorderService.startFromNewStream({
										bitsPerSecond: Number(settings.value.bitrateKbps) * 1000,
									});
								if (!startResult.ok) {
									toast.error({
										title: 'Error creating new recording session',
										description: 'Please try again',
									});
									return;
								}
								toast.loading({
									title: 'Recording session created',
									description: 'Recording in progress...',
								});
								break;
							}
							case 'OpenStreamIsInactiveErr':
								toast.loading({
									title: 'Existing recording session is inactive',
									description: 'Refreshing recording session...',
								});
								break;
							case 'InitMediaRecorderFromStreamErr':
								toast.loading({
									title:
										'Error initializing media recorder with preferred device',
									description:
										'Trying to find another available audio input device...',
								});
								break;
						}
						return;
					}
					onStartSuccess();
				} else {
					const startResult =
						await MediaRecorderService.startFromExistingStream({
							bitsPerSecond: Number(settings.value.bitrateKbps) * 1000,
						});
					if (!startResult.ok) {
						switch (startResult.error._tag) {
							case 'OpenStreamDoesNotExistErr':
								toast.loading({
									title: 'Existing recording session not found',
									description: 'Creating a new recording session...',
								});
								break;
							case 'OpenStreamIsInactiveErr':
								toast.loading({
									title: 'Existing recording session is inactive',
									description: 'Refreshing recording session...',
								});
								break;
							case 'InitMediaRecorderFromStreamErr':
								toast.loading({
									title:
										'Error initializing media recorder with preferred device',
									description:
										'Trying to find another available audio input device...',
								});
								break;
						}
						return;
					}
					onStartSuccess();
				}
			}
		},
		async cancelRecording() {
			const onCancelSuccess = () => {
				void playSound('cancel');
				console.info('Recording cancelled');
				recorderState = 'IDLE';
			};

			const cancelResult = await MediaRecorderService.cancelAndCloseStream();
			if (!cancelResult.ok) {
				switch (cancelResult.error._tag) {
					case 'OpenStreamDoesNotExistErr':
						toast.success({
							title: 'No existing recording session found to cancel',
							description: 'You can start a new recording session',
						});
						break;
				}
				return;
			}
			onCancelSuccess();
		},
	};
}

async function playSound(
	sound: 'start' | 'stop' | 'cancel',
): Promise<WhisperingResult<void>> {
	if (!settings.value.isPlaySoundEnabled) return Ok(undefined);

	if (!document.hidden) {
		switch (sound) {
			case 'start':
				await startSound.play();
				break;
			case 'stop':
				await stopSound.play();
				break;
			case 'cancel':
				await cancelSound.play();
				break;
		}
		return Ok(undefined);
	}

	const sendMessageToExtensionResult = await sendMessageToExtension({
		name: 'whispering-extension/playSound',
		body: { sound },
	});

	if (!sendMessageToExtensionResult.ok) return sendMessageToExtensionResult;
	return Ok(undefined);
}
