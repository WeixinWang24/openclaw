import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

const TRANSCRIBE_TIMEOUT_MS = 180000;
const DEFAULT_MODEL_SIZE = process.env.VIODASHBOARD_WHISPER_MODEL || 'medium';

function decodeBase64Payload(audioBase64 = '') {
  const cleaned = String(audioBase64 || '').trim();
  if (!cleaned) {throw new Error('audio payload is empty');}
  return Buffer.from(cleaned, 'base64');
}

function sanitizeExtension(mimeType = '') {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.includes('webm')) {return '.webm';}
  if (normalized.includes('ogg')) {return '.ogg';}
  if (normalized.includes('mp4') || normalized.includes('mpeg')) {return '.m4a';}
  if (normalized.includes('wav')) {return '.wav';}
  return '.webm';
}

function buildPythonScript() {
  return String.raw`
import json
import os
import sys

try:
    from faster_whisper import WhisperModel
except ModuleNotFoundError:
    print(json.dumps({
        "ok": False,
        "code": "missing_dependency",
        "error": "faster-whisper is not installed for this Python environment.",
        "hint": "Install it with: python3 -m pip install faster-whisper",
    }, ensure_ascii=False))
    sys.exit(0)
except Exception as exc:
    print(json.dumps({
        "ok": False,
        "code": "import_failed",
        "error": f"Failed to import faster-whisper: {exc}",
        "hint": "Check your Python environment and faster-whisper installation.",
    }, ensure_ascii=False))
    sys.exit(0)

input_path = os.environ.get("VIO_AUDIO_PATH", "")
model_size = os.environ.get("VIO_WHISPER_MODEL", "small")

if not input_path or not os.path.exists(input_path):
    print(json.dumps({
        "ok": False,
        "code": "missing_audio",
        "error": "Audio file was not found on disk before transcription started.",
    }, ensure_ascii=False))
    sys.exit(0)

try:
    model = WhisperModel(model_size, device="auto", compute_type="auto")

    def run_transcribe(**kwargs):
        segments, info = model.transcribe(input_path, **kwargs)
        text = " ".join((segment.text or "").strip() for segment in segments).strip()
        return text, info

    text, info = run_transcribe(
        task="transcribe",
        language="zh",
        beam_size=5,
        best_of=5,
        vad_filter=True,
        condition_on_previous_text=True,
        initial_prompt="中文为主，夹英文术语。",
    )

    if not text:
        text, info = run_transcribe(
            task="transcribe",
            language="zh",
            beam_size=1,
            best_of=1,
            vad_filter=False,
            condition_on_previous_text=False,
            initial_prompt="中文为主，夹英文术语。",
        )

    print(json.dumps({
        "ok": True,
        "text": text,
        "language": getattr(info, "language", None),
        "language_probability": getattr(info, "language_probability", None),
        "model": model_size,
    }, ensure_ascii=False))
except Exception as exc:
    print(json.dumps({
        "ok": False,
        "code": "transcription_failed",
        "error": f"Transcription failed: {exc}",
        "hint": "Check ffmpeg availability and that faster-whisper can load its model.",
    }, ensure_ascii=False))
`;}

export async function transcribeAudioBase64({ audioBase64, mimeType }) {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'viodashboard-voice-'));
  const audioPath = path.join(tempDir, `voice-input${sanitizeExtension(mimeType)}`);
  try {
    await fs.promises.writeFile(audioPath, decodeBase64Payload(audioBase64));
    const result = await new Promise((resolve, reject) => {
      execFile(
        'python3',
        ['-c', buildPythonScript()],
        {
          timeout: TRANSCRIBE_TIMEOUT_MS,
          maxBuffer: 4 * 1024 * 1024,
          env: {
            ...process.env,
            VIO_AUDIO_PATH: audioPath,
            VIO_WHISPER_MODEL: DEFAULT_MODEL_SIZE,
          },
        },
        (error, stdout, stderr) => {
          if (error && error.killed) {
            reject(new Error('Voice transcription timed out. Try a shorter recording or check local whisper performance.'));
            return;
          }
          if (error && !stdout) {
            reject(new Error(stderr?.trim() || error.message || 'Voice transcription process failed.'));
            return;
          }
          try {
            resolve(JSON.parse(String(stdout || '{}').trim() || '{}'));
          } catch {
            reject(new Error(stderr?.trim() || 'Voice transcription returned invalid JSON.'));
          }
        },
      );
    });

    if (!result?.ok) {
      const error = new Error(result?.error || 'Voice transcription failed.');
      error.code = result?.code || 'transcription_failed';
      error.hint = result?.hint || null;
      throw error;
    }

    return {
      text: String(result.text || '').trim(),
      language: result.language || null,
      languageProbability: result.language_probability || null,
      model: result.model || DEFAULT_MODEL_SIZE,
    };
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
