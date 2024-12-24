import { goto } from '$app/navigation';
import { errorMoreDetailsDialog } from '$lib/components/MoreDetailsDialog.svelte';
import type { ToastAndNotifyOptions } from '@repo/shared';
import { toast as sonnerToast } from 'svelte-sonner';

export const toast = createToastService();

function createToastService() {
	const createToastFn =
		(variant: ToastAndNotifyOptions['variant']) =>
		({ title, action, ...options }: Omit<ToastAndNotifyOptions, 'variant'>) => {
			const getDurationInMs = () => {
				if (variant === 'loading') return 60_000;
				if (variant === 'error' || variant === 'warning') return 5000;
				if (action) return 4000;
				return 3000;
			};

			const durationInMs = getDurationInMs();

			const id = sonnerToast[variant](title, {
				...options,
				duration: durationInMs,
				action: convertActionToToastAction(action),
			});
			return String(id);
		};

	return {
		success: createToastFn('success'),
		info: createToastFn('info'),
		loading: createToastFn('loading'),
		error: createToastFn('error'),
		warning: createToastFn('warning'),
		dismiss: sonnerToast.dismiss,
	};
}

function convertActionToToastAction(action: ToastAndNotifyOptions['action']) {
	switch (action?.type) {
		case 'link':
			return {
				label: action.label,
				onClick: () => goto(action.goto),
			};
		case 'more-details':
			return {
				label: 'More details',
				onClick: () => errorMoreDetailsDialog.openWithError(action.error),
			};
		default:
			return undefined;
	}
}
