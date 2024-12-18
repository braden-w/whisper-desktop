import { recorder } from '$lib/stores/recorder.svelte';
import { type RecorderState, WhisperingError } from '@repo/shared';
import { Menu, MenuItem } from '@tauri-apps/api/menu';
import { resolveResource } from '@tauri-apps/api/path';
import { TrayIcon } from '@tauri-apps/api/tray';
import { Effect, Layer } from 'effect';
import { SetTrayIconService } from './SetTrayIconService';

async function getIconPath(recorderState: RecorderState) {
	const iconPaths = {
		IDLE: 'recorder-state-icons/studio_microphone.png',
		RECORDING: 'recorder-state-icons/red_large_square.png',
		LOADING: 'recorder-state-icons/arrows_counterclockwise.png',
	} as const;
	return await resolveResource(iconPaths[recorderState]);
}

export const SetTrayIconServiceDesktopLive = Layer.effect(
	SetTrayIconService,
	Effect.gen(function* () {
		const trayPromise = (async () => {
			const quitMenuItem = await MenuItem.new({
				text: 'Quit',
				action: (e) => console.log(e),
			});

			const trayMenu = await Menu.new({
				id: 'quit',
				items: [quitMenuItem],
			});

			const tray = await TrayIcon.new({
				id: 'tray',
				icon: await getIconPath('IDLE'),
				menu: trayMenu,
				tooltip: 'Whispering',
				action: (e) => {
					if ('click' in e) {
						recorder.toggleRecording();
					}
				},
			});
			return tray;
		})();
		return {
			setTrayIcon: (recorderState) =>
				Effect.tryPromise({
					try: async () => {
						const iconPath = await getIconPath(recorderState);
						return (await trayPromise).setIcon(iconPath);
					},
					catch: (error) =>
						new WhisperingError({
							isWarning: true,
							title: `Could not set tray icon to ${recorderState} icon...`,
							description: 'Please check your system tray settings',
							action: {
								type: 'more-details',
								error,
							},
						}),
				}),
		};
	}),
);
