import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import 'bootstrap/dist/css/bootstrap.min.css';
import { pickMarkdownFileHandle, getSavedHandle, clearSavedHandle } from './utils/filePersistence';

export function Options() {
  const [hasHandle, setHasHandle] = useState(false);
  const [fileName, setFileName] = useState('');
  const [writeGranted, setWriteGranted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const handle = await getSavedHandle();
      if (handle) {
        setHasHandle(true);
        setFileName(handle.name || 'Selected file');
        try {
          const perm = await handle.queryPermission({ mode: 'readwrite' });
          setWriteGranted(perm === 'granted');
        } catch {
          setWriteGranted(false);
        }
      } else {
        setHasHandle(false);
        setFileName('');
        setWriteGranted(false);
      }
    })();
  }, []);

  async function onPick() {
    setError('');
    try {
      await pickMarkdownFileHandle();
      const handle = await getSavedHandle();
      setHasHandle(!!handle);
      setFileName(handle?.name || '');
      // After pick we requested readwrite; reflect that
      setWriteGranted(true);
      chrome.storage.local.set({ mdConfigured: Date.now() });
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  async function onClear() {
    await clearSavedHandle();
    setHasHandle(false);
    setFileName('');
    setWriteGranted(false);
    chrome.storage.local.set({ mdConfigured: Date.now() });
  }

  async function onGrantWrite() {
    setError('');
    try {
      const handle = await getSavedHandle();
      if (!handle) return;
      const res = await handle.requestPermission({ mode: 'readwrite' });
      setWriteGranted(res === 'granted');
      chrome.storage.local.set({ mdConfigured: Date.now() });
      if (res !== 'granted') {
        setError('Write permission not granted. Please allow access to enable saving.');
      }
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  function onDownloadSample(e) {
    e.preventDefault();
    const url = chrome.runtime.getURL('sample.md');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Cabinet-sample.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div class="container py-4">
      <h1 class="h4 mb-2">Cabinet Settings</h1>
      <p class="text-muted">Select a Markdown file to use as your live database. You can also download a sample file.</p>
      {error && <div class="alert alert-danger">{error}</div>}

      <div class="card mb-3">
        <div class="card-body">
          <div class="d-flex flex-wrap gap-2 mb-2">
            <button class="btn btn-primary" onClick={onPick}>Select Markdown file</button>
            <button class="btn btn-outline-secondary" onClick={onGrantWrite} disabled={!hasHandle || writeGranted}>
              {writeGranted ? 'Write access granted' : 'Grant write access'}
            </button>
            {hasHandle && <button class="btn btn-outline-danger" onClick={onClear}>Clear selection</button>}
          </div>

          <div class="small text-muted">
            {hasHandle ? (
              <>
                <div>Selected: <span class="fw-semibold">{fileName}</span></div>
                <div>Status: {writeGranted ? <span class="badge bg-success">Ready to save</span> : <span class="badge bg-warning text-dark">Read-only until access granted</span>}</div>
              </>
            ) : (
              <div><span class="badge bg-secondary">Not configured</span></div>
            )}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-body d-flex flex-wrap align-items-center justify-content-between gap-2">
          <div>
            <div class="fw-semibold">Need a sample file?</div>
            <div class="text-muted small">Download a starter `.md` you can edit or move anywhere.</div>
          </div>
          <button class="btn btn-outline-primary" onClick={onDownloadSample}>Download sample.md</button>
        </div>
      </div>
    </div>
  );
}


