import {
  ALLOWED_UPLOAD_MIME,
  MEDIA_LIMIT_HINT,
  humanBytes,
  maxBytesForMime,
} from '@/lib/media';

/**
 * Browser side media upload, shared by every admin surface that uploads.
 *
 * The file goes straight from the browser to Supabase Storage through a signed
 * URL. The API route issues that URL and records the result afterwards, so the
 * bytes never enter a serverless function and no request body ceiling in front
 * of one can apply to them.
 *
 * One module rather than three copies, because the three callers (MediaField,
 * MediaPicker, the media library page) previously each had their own
 * `await res.json()` and each broke the same way on a non-JSON response.
 */

export type UploadedMedia = { name: string; url: string; size: number | null };

/**
 * Reads a response body without assuming it is JSON.
 *
 * This is the fix for the reported symptom. A rejection that happens in front
 * of the app never produces JSON, so calling `res.json()` on it throws
 * `Unexpected token 'R', "Request En"... is not valid JSON`, which tells the
 * operator nothing about what actually went wrong. The body is read as text
 * first and only then parsed, so a non-JSON failure can be reported as what it
 * is.
 */
export async function readJsonResponse(
  res: Response,
  fallbackMessage: string,
): Promise<Record<string, unknown>> {
  const text = await res.text();

  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }
  }

  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (!res.ok) {
      // Supabase Storage nests its own message, so prefer that over a bare status.
      const message =
        (typeof obj.error === 'string' && obj.error) ||
        (typeof obj.message === 'string' && obj.message) ||
        fallbackMessage;
      throw new Error(message);
    }
    return obj;
  }

  // Not JSON. Say what the status means rather than echoing markup at the
  // operator, and keep a short excerpt so an unexpected one is still
  // diagnosable.
  throw new Error(describeNonJson(res.status, text, fallbackMessage));
}

function describeNonJson(status: number, body: string, fallbackMessage: string): string {
  const excerpt = body
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

  if (status === 413) {
    return `The upload was rejected as too large before it reached the site. ${MEDIA_LIMIT_HINT}.`;
  }
  if (status === 401 || status === 403) {
    return 'Your admin session has expired. Reload the page and sign in again.';
  }
  if (status === 504 || status === 408) {
    return 'The upload timed out. Check your connection and try again.';
  }
  if (status >= 500) {
    return `The server failed while handling the upload (HTTP ${status})${excerpt ? `: ${excerpt}` : ''}`;
  }
  return `${fallbackMessage} (HTTP ${status})${excerpt ? `: ${excerpt}` : ''}`;
}

/** Client side check, so an obviously wrong file fails instantly and locally. */
export function validateFile(file: File): string | null {
  if (file.type && !ALLOWED_UPLOAD_MIME.has(file.type)) {
    return `${file.name}: ${file.type || 'this file type'} is not a supported type.`;
  }
  const limit = maxBytesForMime(file.type || '');
  if (file.size > limit) {
    return `${file.name} is ${humanBytes(file.size)}, over the ${humanBytes(limit)} limit for this file type.`;
  }
  return null;
}

/**
 * Sign, upload direct to storage, then record.
 *
 * `onProgress` is a fraction from 0 to 1. XMLHttpRequest is used for the PUT
 * rather than fetch purely because it is the only way to observe upload
 * progress in a browser today: fetch exposes download progress but not upload
 * progress. A 25 MB video on a slow connection with no feedback looks like a
 * hung admin.
 */
export async function uploadMedia(
  file: File,
  bucket: string,
  onProgress?: (fraction: number) => void,
): Promise<UploadedMedia> {
  const localProblem = validateFile(file);
  if (localProblem) throw new Error(localProblem);

  // 1. Ask the route for a signed URL. A few hundred bytes of JSON.
  const signRes = await fetch('/api/admin/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'sign',
      bucket,
      filename: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });
  const signed = await readJsonResponse(signRes, 'Could not start the upload');
  const signedUrl = typeof signed.signedUrl === 'string' ? signed.signedUrl : '';
  const name = typeof signed.name === 'string' ? signed.name : '';
  if (!signedUrl || !name) throw new Error('Could not start the upload: no signed URL returned');

  // 2. The file itself, browser to storage, with no function in between.
  await putToSignedUrl(signedUrl, file, onProgress);

  // 3. Record it. The route verifies the object exists before believing us.
  const doneRes = await fetch('/api/admin/media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'complete', bucket, name }),
  });
  const done = await readJsonResponse(doneRes, 'Upload finished but could not be recorded');
  return {
    name,
    url: typeof done.url === 'string' ? done.url : '',
    size: typeof done.size === 'number' ? done.size : null,
  };
}

function putToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl, true);
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) onProgress(e.loaded / e.total);
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      // Storage answers with JSON even on a 413, so read its message when it
      // is there rather than reporting a bare status code.
      let message = `Storage rejected the upload (HTTP ${xhr.status})`;
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        if (parsed.message || parsed.error) {
          message = String(parsed.message || parsed.error);
          if (xhr.status === 400 || xhr.status === 413) {
            message = `${message}. ${MEDIA_LIMIT_HINT}.`;
          }
        }
      } catch {
        if (xhr.status === 413) {
          message = `The upload was rejected as too large by storage. ${MEDIA_LIMIT_HINT}.`;
        }
      }
      reject(new Error(message));
    };
    xhr.onerror = () =>
      reject(new Error('The upload failed to reach storage. Check your connection and try again.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.send(file);
  });
}

/** Uploads several files in sequence, returning the ones that succeeded. */
export async function uploadMediaBatch(
  files: File[],
  bucket: string,
  onProgress?: (fraction: number, index: number, total: number) => void,
): Promise<UploadedMedia[]> {
  const out: UploadedMedia[] = [];
  for (let i = 0; i < files.length; i++) {
    out.push(
      await uploadMedia(files[i], bucket, (f) => onProgress?.(f, i, files.length)),
    );
  }
  return out;
}
