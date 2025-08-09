import { idbGet, idbSet, idbDelete } from './idb';
import { parseMarkdownToFolders, serializeFoldersToMarkdown } from './markdownStore';

const HANDLE_KEY = 'markdownFileHandle';

export async function pickMarkdownFileHandle() {
  if (!('showOpenFilePicker' in window)) {
    throw new Error('File System Access API not available in this context.');
  }
  const [handle] = await window.showOpenFilePicker({
    types: [{ description: 'Markdown Files', accept: { 'text/markdown': ['.md'] } }],
    excludeAcceptAllOption: false,
    multiple: false,
  });
  // Request readwrite permission immediately (allowed because this runs in a user gesture from Options)
  const permission = await handle.requestPermission({ mode: 'readwrite' });
  if (permission !== 'granted') {
    throw new Error('Write permission not granted. Please allow access to the selected file.');
  }
  await idbSet(HANDLE_KEY, handle);
  return handle;
}

export async function getSavedHandle() {
  return await idbGet(HANDLE_KEY);
}

export async function clearSavedHandle() {
  await idbDelete(HANDLE_KEY);
}

async function assertGranted(handle, mode) {
  const status = await handle.queryPermission({ mode });
  if (status !== 'granted') {
    throw new Error(`${mode === 'readwrite' ? 'Write' : 'Read'} permission not granted; reselect file in Options`);
  }
}

export async function readFoldersFromFile(handle) {
  await assertGranted(handle, 'read');
  const file = await handle.getFile();
  const text = await file.text();
  return parseMarkdownToFolders(text);
}

export async function writeFoldersToFile(handle, folders) {
  await assertGranted(handle, 'readwrite');
  const text = serializeFoldersToMarkdown(folders);
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export function startPollingForExternalChanges(handle, onChange, intervalMs = 1500) {
  let disposed = false;
  let lastModified = 0;
  let timer = null;

  async function poll() {
    try {
      const file = await handle.getFile();
      if (file.lastModified > lastModified) {
        lastModified = file.lastModified;
        const text = await file.text();
        const folders = parseMarkdownToFolders(text);
        onChange(folders);
      }
    } catch (err) {
      console.warn('Polling read failed', err);
    }
  }

  // Initial read to initialize lastModified
  (async () => {
    try {
      const file = await handle.getFile();
      lastModified = file.lastModified;
    } catch {}
  })();

  timer = setInterval(() => {
    if (!disposed) poll();
  }, intervalMs);

  return () => {
    disposed = true;
    if (timer) clearInterval(timer);
  };
}

export { serializeFoldersToMarkdown };


