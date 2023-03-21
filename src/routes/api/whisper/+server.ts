import { error, text } from '@sveltejs/kit';
import type { RequestHandler } from '../../whisper/$types';
import { getTranscriptionFromWhisperAPI } from '$lib/whisperTranscription';

export const OPTIONS = (async () => {
	return text('', {
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': '*',
			'Access-Control-Max-Age': '86400'
		}
	});
}) satisfies RequestHandler;

export const POST = (async ({ request }) => {
	try {
		const WHISPER_API_KEY = request.headers.get('x-whisper-api-key');
		if (!WHISPER_API_KEY) throw error(400, 'Missing WHISPER_API_KEY');
		const wavBlob = new Blob([new Uint8Array(await request.arrayBuffer())]);
		const whisperText = await getTranscriptionFromWhisperAPI(wavBlob, WHISPER_API_KEY);
		return text(whisperText, {
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'POST, OPTIONS',
				'Access-Control-Allow-Headers': '*',
				'Access-Control-Max-Age': '86400'
			}
		});
	} catch (err) {
		if (err instanceof Error) throw error(500, `Error processing audio: ${err.message}`);
	}
	throw error(500, 'Error processing audio');
}) satisfies RequestHandler;
