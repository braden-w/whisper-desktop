import { sendMessageToExtension } from '$lib/sendMessageToExtension';
import { MainLive } from '$lib/services';
import { setAlwaysOnTop } from '$lib/services/AlwaysOnTopService';
import { MediaRecorderService } from '$lib/services/MediaRecorderService';
import { NotificationServiceDesktopLive } from '$lib/services/NotificationServiceDesktopLive';
import { NotificationServiceWebLive } from '$lib/services/NotificationServiceWebLive';
import { SetTrayIconService } from '$lib/services/SetTrayIconService';
import { renderErrorAsToast } from '$lib/services/renderErrorAsToast';
import { recordings } from '$lib/stores/recordings.svelte';
import { settings } from '$lib/stores/settings.svelte';
import { NotificationService, type RecorderState } from '@repo/shared';
import { Effect } from 'effect';
import { nanoid } from 'nanoid/non-secure';
import type { Recording } from '../services/RecordingDbService';
import stopSoundSrc from './assets/sound_ex_machina_Button_Blip.mp3';
import startSoundSrc from './assets/zapsplat_household_alarm_clock_button_press_12967.mp3';
import cancelSoundSrc from './assets/zapsplat_multimedia_click_button_short_sharp_73510.mp3';
import { toast } from '$lib/services/ToastService';

const startSound = new Audio(startSoundSrc);
const stopSound = new Audio(stopSoundSrc);
const cancelSound = new Audio(cancelSoundSrc);

export const recorderState = Effect.gen(function* () {
	const { setTrayIcon } = yield* SetTrayIconService;
	let value = $state<RecorderState>('IDLE');
	return {
		get value() {
			return value;
		},
		set value(newValue: RecorderState) {
			value = newValue;
			setTrayIcon(newValue).pipe(
				Effect.catchAll(renderErrorAsToast),
				Effect.runPromise,
			);
		},
	};
}).pipe(Effect.provide(MainLive), Effect.runSync);

const IS_RECORDING_NOTIFICATION_ID = 'WHISPERING_RECORDING_NOTIFICATION';

export const recorder = Effect.gen(function* () {
	const mediaRecorderService = yield* MediaRecorderService;
	const { notify } = yield* NotificationService;

	return {
		get recorderState() {
			return recorderState.value;
		},
		toggleRecording: () =>
			Effect.gen(function* () {
				switch (mediaRecorderService.recordingState) {
					case 'inactive':
						if (settings.value.alwaysOnTop === 'When Recording') {
							yield* setAlwaysOnTop(true);
						}
						yield* mediaRecorderService.startRecording();
						recorderState.value = 'RECORDING';
						yield* Effect.logInfo('Recording started');
						if (settings.value.isPlaySoundEnabled) {
							if (!document.hidden) {
								startSound.play();
							} else {
								yield* sendMessageToExtension({
									name: 'whispering-extension/playSound',
									body: { sound: 'start' },
								}).pipe(Effect.catchAll(renderErrorAsToast));
							}
						}
						yield* notify({
							id: IS_RECORDING_NOTIFICATION_ID,
							title: 'Whispering is recording...',
							description: 'Click to go to recorder',
							action: {
								type: 'link',
								label: 'Go to recorder',
								goto: '/',
							},
						}).pipe(Effect.catchAll(renderErrorAsToast));
						return;
					case 'recording': {
						const audioBlob = yield* mediaRecorderService.stopRecording;
						recorderState.value = 'IDLE';
						yield* Effect.logInfo('Recording stopped');

						if (settings.value.isPlaySoundEnabled) {
							if (!document.hidden) {
								stopSound.play();
							} else {
								yield* sendMessageToExtension({
									name: 'whispering-extension/playSound',
									body: { sound: 'stop' },
								}).pipe(Effect.catchAll(renderErrorAsToast));
							}
						}

						const newRecording: Recording = {
							id: nanoid(),
							title: '',
							subtitle: '',
							timestamp: new Date().toISOString(),
							transcribedText: '',
							blob: audioBlob,
							transcriptionStatus: 'UNPROCESSED',
						};
						yield* recordings.addRecording(newRecording);

						yield* recordings.transcribeRecording(newRecording.id);
						if (settings.value.alwaysOnTop === 'When Recording') {
							yield* setAlwaysOnTop(false);
						}
					}
				}
			}).pipe(
				Effect.tapError(() =>
					Effect.gen(function* () {
						recorderState.value = 'IDLE';
						if (settings.value.alwaysOnTop === 'When Recording') {
							yield* setAlwaysOnTop(false);
						}
					}),
				),
				Effect.catchAll(renderErrorAsToast),
				Effect.runPromise,
			),
		cancelRecording: () =>
			Effect.gen(function* () {
				yield* mediaRecorderService.cancelRecording;
				if (settings.value.isPlaySoundEnabled) {
					if (!document.hidden) {
						cancelSound.play();
					} else {
						yield* sendMessageToExtension({
							name: 'whispering-extension/playSound',
							body: { sound: 'cancel' },
						});
					}
				}
				yield* Effect.logInfo('Recording cancelled');
				recorderState.value = 'IDLE';
				if (settings.value.alwaysOnTop === 'When Recording') {
					yield* setAlwaysOnTop(false);
				}
			}).pipe(Effect.runPromise),
		
		uploadRecording: (file: File) =>
			Effect.gen(function* () {
				  if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
					if (settings.value.isPlaySoundEnabled) {
						if (!document.hidden) {
							cancelSound.play();
						} else {
							yield* sendMessageToExtension({
								name: 'whispering-extension/playSound',
								body: { sound: 'cancel' },
							});
						}
					}
					yield* toast({
						variant: 'error',
						title: 'Invalid file type',
						description: 'Please upload an audio file.',
					});
					recorderState.value = 'IDLE';
					return;
				  }
		  
				  const arrayBuffer = yield* Effect.tryPromise(() => file.arrayBuffer());
				  const audioBlob = new Blob([arrayBuffer], { type: file.type });
		  
				  const newRecording: Recording = {
					id: nanoid(),
					title: file.name,
					subtitle: '',
					timestamp: new Date().toISOString(),
					transcribedText: '',
					blob: audioBlob,
					transcriptionStatus: 'UNPROCESSED',
				  };
		  
				  yield* recordings.addRecording(newRecording);
				  yield* recordings.transcribeRecording(newRecording.id);
				}),
			
	};
}).pipe(Effect.provide(MainLive), Effect.runSync);
