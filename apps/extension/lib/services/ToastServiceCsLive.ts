import { sendToBackground } from '@plasmohq/messaging';
import { ToastService, WhisperingError, resultToEffect } from '@repo/shared';
import { Console, Effect, Layer } from 'effect';
import { nanoid } from 'nanoid/non-secure';
import type * as Toast from '~background/messages/toast';

export const ToastServiceCsLive = Layer.succeed(
	ToastService,
	ToastService.of({
		toast: (toastOptions) =>
			Effect.tryPromise({
				try: () =>
					sendToBackground<Toast.RequestBody, Toast.ResponseBody>({
						name: 'toast',
						body: { toastOptions },
					}),
				catch: (error) =>
					new WhisperingError({
						title: `Unable to toast via background service worker`,
						description:
							error instanceof Error
								? error.message
								: 'There was likely an issue sending the message to the background service worker from the popup.',
						error,
					}),
			}).pipe(
				Effect.flatMap(resultToEffect),
				Effect.tapError((error) => Console.error({ ...error })),
				Effect.catchAll(() => Effect.succeed(toastOptions.id ?? nanoid())),
			),
	}),
);
