import { ToastService, WhisperingError } from '@repo/shared';
import { Console, Effect, Layer } from 'effect';
import { nanoid } from 'nanoid/non-secure';
import studioMicrophone from 'data-base64:~assets/studio_microphone.png';

export const ToastServiceBgswLive = Layer.succeed(
	ToastService,
	ToastService.of({
		toast: ({ variant, id: maybeId, title, description, descriptionClass, action }) =>
			Effect.gen(function* () {
				const id = maybeId ?? nanoid();

				yield* Effect.tryPromise({
					try: async () => {
						if (!action) {
							chrome.notifications.create(id, {
								title,
								message: description,
								type: 'basic',
								iconUrl: studioMicrophone,
							});
						} else {
							chrome.notifications.create(id, {
								title,
								message: description,
								type: 'basic',
								buttons: [{ title: action.label }],
								iconUrl: studioMicrophone,
							});
							chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
								if (buttonIndex === 0) {
									chrome.notifications.clear(id);
									chrome.tabs.create({ url: action.goto });
								}
							});
						}
					},
					catch: (error) =>
						new WhisperingError({
							title: 'Failed to show toast',
							description: error instanceof Error ? error.message : `Unknown error: ${error}`,
							error,
						}),
				}).pipe(
					Effect.tapError((error) => Console.error({ ...error })),
					Effect.catchAll(() => Effect.succeed(maybeId ?? nanoid())),
				);

				return id;
			}),
	}),
);
