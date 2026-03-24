import { readJsonRequest, sendJson } from '../httpUtils.mjs';

export function handleVoiceRoutes({ req, res, requestUrl, transcribeAudioBase64 }) {
  if (requestUrl.pathname === '/api/voice/transcribe' && req.method === 'POST') {
    readJsonRequest(req)
      .then(async body => {
        const audioBase64 = String(body?.audioBase64 || '').trim();
        const mimeType = String(body?.mimeType || 'audio/webm').trim() || 'audio/webm';
        if (!audioBase64) {
          sendJson(res, 400, { ok: false, error: 'audioBase64 is required' });
          return;
        }
        const result = await transcribeAudioBase64({ audioBase64, mimeType });
        if (!result?.text) {
          sendJson(res, 422, {
            ok: false,
            error: 'No speech was detected. Try speaking a bit louder or recording a little longer.',
          });
          return;
        }
        sendJson(res, 200, { ok: true, transcript: result.text, meta: result });
      })
      .catch(error => sendJson(res, 500, {
        ok: false,
        error: error?.message || String(error),
        code: error?.code || 'voice_transcription_failed',
        hint: error?.hint || null,
      }));
    return true;
  }

  return false;
}
