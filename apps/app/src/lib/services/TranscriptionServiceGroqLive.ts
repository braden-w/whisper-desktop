import { settings } from '$lib/stores/settings.svelte.js';
import { getExtensionFromAudioBlob } from '$lib/utils';
import {
	FetchHttpClient,
	HttpClient,
	HttpClientRequest,
	HttpClientResponse,
} from '@effect/platform';
import { TranscriptionService, WhisperingError } from '@repo/shared';
import { Effect, Layer } from 'effect';
import { WhisperResponseSchema } from './transcription/WhisperResponseSchema';

import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

const convertAudioBlobToMp3 = async (audioBlob: Blob): Promise<Blob> => {
  return new Promise(async (resolve, reject) => {
    // Convert Blob to Readable Stream
    const inputStream = new PassThrough();
    inputStream.end(Buffer.from(await audioBlob.arrayBuffer()));

    const outputStream = new PassThrough();
    const chunks: Buffer[] = [];

    outputStream.on('data', (chunk) => chunks.push(chunk));
    outputStream.on('end', () => {
      const outputBuffer = Buffer.concat(chunks);
      resolve(new Blob([outputBuffer], { type: 'audio/mpeg' }));
    });
    outputStream.on('error', (err) => {
      reject(new Error('Error during audio processing: ' + err.message));
    });

    // Use ffmpeg to process the input stream and pipe to output stream
    ffmpeg(inputStream)
      .format('mp3') // Convert to MP3
      .audioCodec('libmp3lame') // Specify MP3 codec
      .on('error', (err: { message: string }) => {
        reject(new Error('FFmpeg processing error: ' + err.message));
      })
	  .audioBitrate(64)
      .pipe(outputStream, { end: true });
  });
};



const MAX_FILE_SIZE_MB = 25 as const;

export const TranscriptionServiceGroqLive = Layer.succeed(
	TranscriptionService,
	TranscriptionService.of({
		transcribe: (audioBlob) =>
			Effect.gen(function* () {
				const { groqApiKey: apiKey, outputLanguage } = settings.value;

				if (!apiKey) {
					return yield* new WhisperingError({
						title: 'Groq API Key not provided.',
						description: 'Please enter your Groq API key in the settings',
						action: {
							type: 'link',
							label: 'Go to settings',
							goto: '/settings/transcription',
						},
					});
				}

				if (!apiKey.startsWith('gsk_')) {
					return yield* new WhisperingError({
						title: 'Invalid Groq API Key',
						description: 'The Groq API Key must start with "gsk_"',
						action: {
							type: 'link',
							label: 'Update API Key',
							goto: '/settings/transcription',
						},
					});
				}
				const blobSizeInMb = audioBlob.size / (1024 * 1024);
				let processedBlob = audioBlob;
				if (blobSizeInMb > MAX_FILE_SIZE_MB) {
					processedBlob = yield* Effect.promise(() => convertAudioBlobToMp3(audioBlob));
				}
				
				const formDataFile = new File(
					[processedBlob],
					`recording.${getExtensionFromAudioBlob(processedBlob)}`,
					{ type: processedBlob.type },
				);
				const formData = new FormData();
				formData.append('file', formDataFile);
				formData.append('model', 'whisper-large-v3');
				if (outputLanguage !== 'auto')
					formData.append('language', outputLanguage);
				const client = yield* HttpClient.HttpClient;
				const data = yield* HttpClientRequest.post(
					'https://api.groq.com/openai/v1/audio/transcriptions',
				).pipe(
					HttpClientRequest.setHeaders({ Authorization: `Bearer ${apiKey}` }),
					HttpClientRequest.bodyFormData(formData),
					client.execute,
					Effect.flatMap(
						HttpClientResponse.schemaBodyJson(WhisperResponseSchema),
					),
					Effect.scoped,
					Effect.mapError((error) =>
						error._tag === 'ParseError'
							? new WhisperingError({
									title: 'Error parsing response from Groq API',
									description:
										'Please check logs and notify the developer if the issue persists.',
									action: {
										type: 'more-details',
										error: error.message,
									},
								})
							: new WhisperingError({
									title: 'Error sending audio to Groq API',
									description:
										'Please check your network connection and try again.',
									action: {
										type: 'more-details',
										error: error.message,
									},
								}),
					),
				);
				if ('error' in data) {
					return yield* new WhisperingError({
						title: 'Server error from Groq API',
						description: 'This is likely a problem with Groq, not you.',
						action: {
							type: 'more-details',
							error: data.error.message,
						},
					});
				}
				return data.text.trim();
			}).pipe(Effect.provide(FetchHttpClient.layer)),
	}),
);
