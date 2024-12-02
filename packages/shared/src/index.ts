import { Schema as S } from '@effect/schema';
import { Data, Effect } from 'effect';
import { notificationOptionsSchema } from './services/NotificationService.js';
import {
	SUPPORTED_LANGUAGES,
	TRANSCRIPTION_SERVICES,
} from './services/TranscriptionService.js';

export const WHISPERING_URL =
	process.env.NODE_ENV === 'production'
		? 'https://whispering.bradenwong.com'
		: 'http://localhost:5173';

export const WHISPERING_URL_WILDCARD = `${WHISPERING_URL}/*` as const;

export const BITRATE_VALUES = [
	64_000, 96_000, 128_000, 192_000, 256_000, 320_000,
] as const;
export const BITRATE_OPTIONS = BITRATE_VALUES.map((bitrate) => ({
	label: `${bitrate / 1_000} kbps`,
	value: bitrate,
}));
export const DEFAULT_BITRATE_MS =
	64_000 as const satisfies (typeof BITRATE_VALUES)[number];

const ALWAYS_ON_TOP_VALUES = ['Always', 'Never', 'When Recording'] as const;
export const ALWAYS_ON_TOP_OPTIONS = ALWAYS_ON_TOP_VALUES.map((option) => ({
	label: option,
	value: option,
}));

export const settingsSchema = S.Struct({
	isPlaySoundEnabled: S.Boolean,
	isCopyToClipboardEnabled: S.Boolean,
	isPasteContentsOnSuccessEnabled: S.Boolean,
	isFasterRerecordEnabled: S.Boolean,
	alwaysOnTop: S.Literal(...ALWAYS_ON_TOP_VALUES),

	selectedAudioInputDeviceId: S.String,
	bitsPerSecond: S.optionalWith(
		S.compose(S.Number, S.Literal(...BITRATE_VALUES)),
		{
			default: () => DEFAULT_BITRATE_MS,
		},
	),

	selectedTranscriptionService: S.Literal(...TRANSCRIPTION_SERVICES),
	openAiApiKey: S.String,
	groqApiKey: S.String,
	fasterWhisperServerUrl: S.String,
	fasterWhisperServerModel: S.String,
	outputLanguage: S.Literal(...SUPPORTED_LANGUAGES),

	currentLocalShortcut: S.String,
	currentGlobalShortcut: S.String,
	replacementMap: S.optionalWith(S.Record({ key: S.String, value: S.String }), {
		default: () => ({}),
	}),
});

export const getDefaultSettings = (platform: 'app' | 'extension') =>
	({
		isPlaySoundEnabled: true,
		isCopyToClipboardEnabled: true,
		isPasteContentsOnSuccessEnabled: true,
		isFasterRerecordEnabled: false,
		alwaysOnTop: 'When Recording',

		selectedAudioInputDeviceId: 'default',
		bitsPerSecond: DEFAULT_BITRATE_MS,

		selectedTranscriptionService: 'OpenAI',
		openAiApiKey: '',
		groqApiKey: '',
		fasterWhisperServerUrl: 'http://localhost:8000',
		fasterWhisperServerModel: 'Systran/faster-whisper-medium.en',
		outputLanguage: 'auto',

		currentLocalShortcut: 'space',
		currentGlobalShortcut: platform === 'app' ? 'CommandOrControl+Shift+;' : '',
		replacementMap: {},
	} satisfies Settings);

export type Settings = S.Schema.Type<typeof settingsSchema>;

export type WhisperingErrorProperties = {
	title: string;
	description: string;
	action:
		| {
				type: 'link';
				label: string;
				goto: string;
		  }
		| {
				type: 'more-details';
				error: unknown;
		  }
		| { type: 'none' };
	isWarning?: boolean;
};

export class WhisperingError extends Data.TaggedError(
	'WhisperingError',
)<WhisperingErrorProperties> {}

export type Result<T> =
	| {
			isSuccess: true;
			data: T;
	  }
	| {
			isSuccess: false;
			error: WhisperingErrorProperties;
	  };

export const effectToResult = <T>(
	effect: Effect.Effect<T, WhisperingError>,
): Effect.Effect<Result<T>> =>
	effect.pipe(
		Effect.map((data) => ({ isSuccess: true, data }) as const),
		Effect.catchAll((error) =>
			Effect.succeed({ isSuccess: false, error } as const),
		),
	);

export const resultToEffect = <T>(
	result: Result<T>,
): Effect.Effect<T, WhisperingError> =>
	result.isSuccess
		? Effect.succeed(result.data)
		: Effect.fail(new WhisperingError(result.error));

export const recorderStateSchema = S.Literal('IDLE', 'RECORDING', 'LOADING');

export type RecorderState = S.Schema.Type<typeof recorderStateSchema>;

export const recorderStateToIcons = {
	RECORDING: '🔲',
	LOADING: '🔄',
	IDLE: '🎙️',
} as const satisfies Record<RecorderState, string>;

export const externalMessageSchema = S.Union(
	S.Struct({
		name: S.Literal('whispering-extension/notifyWhisperingTabReady'),
		body: S.Struct({}),
	}),
	S.Struct({
		name: S.Literal('whispering-extension/playSound'),
		body: S.Struct({ sound: S.Literal('start', 'stop', 'cancel') }),
	}),
	S.Struct({
		name: S.Literal('whispering-extension/setClipboardText'),
		body: S.Struct({ transcribedText: S.String }),
	}),
	S.Struct({
		name: S.Literal('whispering-extension/setTrayIcon'),
		body: S.Struct({ recorderState: recorderStateSchema }),
	}),
	S.Struct({
		name: S.Literal('whispering-extension/notifications/create'),
		body: S.Struct({ notifyOptions: notificationOptionsSchema }),
	}),
	S.Struct({
		name: S.Literal('whispering-extension/notifications/clear'),
		body: S.Struct({ notificationId: S.String }),
	}),
	S.Struct({
		name: S.Literal('whispering-extension/writeTextToCursor'),
		body: S.Struct({ transcribedText: S.String }),
	}),
);

export type ExternalMessage = S.Schema.Type<typeof externalMessageSchema>;

export type ExternalMessageBody<T extends ExternalMessage['name']> = Extract<
	ExternalMessage,
	{ name: T }
>['body'];

export type ExternalMessageReturnType<T extends ExternalMessage['name']> = {
	'whispering-extension/notifyWhisperingTabReady': undefined;
	'whispering-extension/playSound': undefined;
	'whispering-extension/setClipboardText': undefined;
	'whispering-extension/setTrayIcon': undefined;
	'whispering-extension/notifications/create': string;
	'whispering-extension/notifications/clear': undefined;
	'whispering-extension/writeTextToCursor': undefined;
}[T];

export * from './services/index.js';
