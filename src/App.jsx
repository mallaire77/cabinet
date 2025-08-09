import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useRef } from 'preact/hooks';
import { getSavedHandle, readFoldersFromFile, writeFoldersToFile, startPollingForExternalChanges, serializeFoldersToMarkdown } from './utils/filePersistence';
import Fuse from 'fuse.js';

// To use a Bootstrap icon, we need the stylesheet
const bootstrapIconsUrl = "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css";
const styleExists = document.head.querySelector(`link[href="${bootstrapIconsUrl}"]`);
if (!styleExists) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = bootstrapIconsUrl;
  document.head.appendChild(link);
}

// Custom style to hide the default accordion arrow and fix color issues
const customAccordionStyle = `
  .accordion-button.no-arrow::after {
    display: none;
  }
  .accordion-button.no-arrow:focus {
    box-shadow: none;
  }
  .accordion-button.no-arrow:not(.collapsed) {
    background-color: transparent !important;
    box-shadow: none !important;
  }
`;

export function App() {
  const [folders, setFolders] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [hasHandle, setHasHandle] = useState(false);
  const [configError, setConfigError] = useState('');
  const fileHandleRef = useRef(null);
  const stopPollingRef = useRef(null);
  const lastWrittenRef = useRef('');
  const ignorePollUntilRef = useRef(0);
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [editingChatId, setEditingChatId] = useState(null);
  const [editingChatName, setEditingChatName] = useState("");
  const [filter, setFilter] = useState('all'); // 'all', 'gemini', 'claude', 'chatgpt'
  const [searchTerm, setSearchTerm] = useState("");

  const colors = [
    '#d1e7dd', // green
    '#f8d7da', // red
    '#cff4fc', // cyan
    '#fff3cd', // yellow
    '#cfe2ff', // blue
    '#e2e3e5', // gray
    '#e9d8fd', // purple
    '#ffd8b1', // orange
    null
  ]; // Bootstrap theme colors + default

  // Load from markdown file if configured; fallback to storage for legacy
  useEffect(() => {
    (async () => {
      try {
        const handle = await getSavedHandle();
        if (handle) {
          setHasHandle(true);
          fileHandleRef.current = handle;
          // Check permission status in this context
          const perm = await handle.queryPermission({ mode: 'read' });
          if (perm === 'granted') {
            const initialFolders = await readFoldersFromFile(handle);
            setFolders(initialFolders);
            setConfigured(true);
          } else {
            setConfigured(false);
            setConfigError('This page needs access to read your selected file.');
          }
          // start polling for external edits
          stopPollingRef.current = startPollingForExternalChanges(handle, (incoming) => {
            if (Date.now() < ignorePollUntilRef.current) return;
            const incomingText = serializeFoldersToMarkdown(incoming);
            if (incomingText !== lastWrittenRef.current) {
              setFolders(incoming);
            }
          });
        } else {
          // Not configured: do not load legacy data; show configure screen
        }
      } catch (e) {
        setConfigError(e.message || String(e));
      } finally {
        setIsLoaded(true);
      }
    })();
    return () => {
      if (stopPollingRef.current) stopPollingRef.current();
    };
  }, []);

  // Listen for configuration changes from options page
  useEffect(() => {
    function onChanged(changes, area) {
      if (area !== 'local') return;
      if (changes.mdConfigured) {
        (async () => {
          try {
            const handle = await getSavedHandle();
            if (handle) {
              fileHandleRef.current = handle;
              const perm = await handle.queryPermission({ mode: 'read' });
              if (perm === 'granted') {
                const initialFolders = await readFoldersFromFile(handle);
                setFolders(initialFolders);
                setConfigured(true);
              } else {
                setConfigured(false);
              }
              if (stopPollingRef.current) stopPollingRef.current();
              stopPollingRef.current = startPollingForExternalChanges(handle, (incoming) => {
                if (Date.now() < ignorePollUntilRef.current) return;
                const incomingText = serializeFoldersToMarkdown(incoming);
                if (incomingText !== lastWrittenRef.current) {
                  setFolders(incoming);
                }
              });
            } else {
              // cleared
              if (stopPollingRef.current) stopPollingRef.current();
              fileHandleRef.current = null;
              setConfigured(false);
              setHasHandle(false);
              setFolders([]);
            }
          } catch (e) {
            setConfigError(e.message || String(e));
          }
        })();
      }
    }
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, []);

  // Persist to chosen markdown file or local storage
  useEffect(() => {
    if (!isLoaded) return;
    (async () => {
      try {
        if (fileHandleRef.current) {
          const serialized = serializeFoldersToMarkdown(folders);
          if (serialized !== lastWrittenRef.current) {
            // Temporarily ignore polling echoes to avoid flicker/reverts
            ignorePollUntilRef.current = Date.now() + 1200;
            await writeFoldersToFile(fileHandleRef.current, folders);
            lastWrittenRef.current = serialized;
          }
        } else {
          // Not configured: do not persist; hint screen only
        }
      } catch (e) {
        console.warn('Failed to persist folders', e);
      }
    })();
  }, [folders, isLoaded]);

  // Listen for changes in storage from other tabs (legacy). Ignore when file-backed is active.
  useEffect(() => {
    const handleStorageChange = (changes, area) => {
      if (fileHandleRef.current) return; // file-backed mode controls state
      if (area === 'local' && changes.folders) {
        setFolders(changes.folders.newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Removed Bootstrap JS collapse to avoid conflicts; we control open state in React only

  const handleCreateFolder = () => {
    if (newFolderName.trim() === '') return;

    const newFolder = {
      id: Date.now(),
      name: newFolderName,
      color: null,
      chats: [],
      isOpen: false
    };

    setFolders([...folders, newFolder]);
    setNewFolderName(""); // Reset input field
  };

  const handleAddChat = (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();

    chrome.runtime.sendMessage({ action: 'addCurrentChat' }, (response) => {
      if (chrome.runtime.lastError || !response || response.error) {
        console.error("Error getting chat info:", response?.error || chrome.runtime.lastError?.message);
        alert(`Could not save chat. ${response?.error || 'Please ensure you are on a supported chat page.'}`);
        return;
      }
      
      const targetFolder = folders.find(f => f.id === folderId);
      if (targetFolder && targetFolder.chats.some(chat => chat.url === response.url)) {
        alert("This chat is already in this folder.");
        return;
      }

      const newChat = {
        id: Date.now(),
        title: response.title,
        platform: response.platform,
        url: response.url,
      };

      setFolders(folders.map(folder => {
        if (folder.id === folderId) {
          // Add new chat to the beginning of the list
          return { ...folder, chats: [newChat, ...folder.chats], isOpen: true };
        }
        return folder;
      }));
    });
  };

  const onActionClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Action button clicked. Default and propagation stopped.');
  };

  const handleRenameClick = (e, folder) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const handleSaveRename = (folderId) => {
    setFolders(folders.map(f => f.id === folderId ? { ...f, name: editingFolderName } : f));
    setEditingFolderId(null);
    setEditingFolderName("");
  };

  const handleDeleteFolder = (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this folder and all its contents?")) {
      setFolders(folders.filter(folder => folder.id !== folderId));
    }
  };

  const handleDeleteChat = (e, chatId) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this chat from your folder?")) {
      setFolders(folders.map(folder => ({
        ...folder,
        chats: folder.chats.filter(chat => chat.id !== chatId)
      })));
    }
  };

  const handleToggleFolder = (folderId) => {
    setFolders(prev => prev.map(folder =>
      folder.id === folderId ? { ...folder, isOpen: !folder.isOpen } : folder
    ));
  };

  const handleChatRenameClick = (e, chat) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditingChatName(chat.title);
  };

  const handleSaveChatRename = (chatId) => {
    setFolders(folders.map(folder => ({
      ...folder,
      chats: folder.chats.map(chat => 
        chat.id === chatId ? { ...chat, title: editingChatName } : chat
      )
    })));
    setEditingChatId(null);
    setEditingChatName("");
  };

  const changeColor = (e, folderId) => {
    e.preventDefault();
    e.stopPropagation();

    setFolders(prev => prev.map(folder => {
      if (folder.id === folderId) {
        const currentColor = folder.color ?? null;
        const currentIndex = colors.indexOf(currentColor);
        const nextIndex = (currentIndex >= 0 ? currentIndex : colors.length - 1) + 1;
        const normalizedIndex = nextIndex % colors.length;
        return { ...folder, color: colors[normalizedIndex] };
      }
      return folder;
    }));
  };

  const imgStyle = { height: '20px', width: '20px', objectFit: 'contain' };

  const fuse = new Fuse(folders, {
    keys: ['name'],
    includeScore: true,
    threshold: 0.4,
  });

  const searchedFolders = searchTerm.trim() === ''
    ? folders
    : fuse.search(searchTerm).map(result => result.item);

  const filteredFolders = searchedFolders.map(folder => {
    if (filter === 'all') {
      return folder;
    }
    const filteredChats = folder.chats.filter(chat => chat.platform === filter);
    return { ...folder, chats: filteredChats };
  }).filter(folder => filter === 'all' || folder.chats.length > 0);

  if (!configured) {
    return (
      <div class="d-flex flex-column h-100 align-items-center justify-content-center p-3 text-center">
        <h2 class="h5 mb-2">Configure persistence</h2>
        {hasHandle ? (
          <>
            <p class="text-muted mb-3">This panel needs permission to access the selected file.</p>
            <div class="d-flex gap-2">
              <button class="btn btn-primary" onClick={async () => {
                try {
                  const res = await fileHandleRef.current.requestPermission({ mode: 'readwrite' });
                  if (res === 'granted') {
                    const initialFolders = await readFoldersFromFile(fileHandleRef.current);
                    setFolders(initialFolders);
                    setConfigured(true);
                    setConfigError('');
                  } else {
                    setConfigError('Permission denied.');
                  }
                } catch (e) {
                  setConfigError(e.message || String(e));
                }
              }}>Grant access</button>
              <button class="btn btn-outline-secondary" onClick={() => chrome.runtime.openOptionsPage()}>Open settings</button>
            </div>
            {configError && <p class="text-danger small mt-2">{configError}</p>}
          </>
        ) : (
          <>
            <p class="text-muted mb-3">Open extension options and select a Markdown file to act as your Cabinet database.</p>
            <a class="btn btn-primary" href="#" onClick={() => chrome.runtime.openOptionsPage()}>Open settings</a>
            {configError && <p class="text-danger small mt-2">{configError}</p>}
          </>
        )}
        <hr class="w-100 my-3" />
        <p class="small text-muted">Using in-memory storage until configured.</p>
      </div>
    );
  }

  return (
    <>
      <style>{customAccordionStyle}</style>
      <div class="d-flex flex-column h-100">
        {/* Fixed Header */}
        <div class="co-panel-header p-3">
          {/* Create Folder Section */}
          <div class="input-group mb-3">
            <input 
              type="text" 
              class="form-control" 
              placeholder="New folder name..." 
              value={newFolderName} 
              onInput={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <button class="btn btn-primary" type="button" onClick={handleCreateFolder}>Create</button>
          </div>

          {/* Search Section */}
          <div class="input-group mb-3">
            <input 
              type="text" 
              class="form-control" 
              placeholder="Search folders..." 
              value={searchTerm}
              onInput={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Filter Section */}
          <div class="btn-group w-100 co-toolbar" role="group" aria-label="Platform filters">
            <button type="button" class={`btn btn-outline-secondary btn-icon d-flex align-items-center justify-content-center ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              <i class="bi bi-collection"></i>
            </button>
            <button type="button" class={`btn btn-outline-secondary btn-icon d-flex align-items-center justify-content-center ${filter === 'gemini' ? 'active' : ''}`} onClick={() => setFilter('gemini')}>
              <img src={chrome.runtime.getURL('images/gemini.png')} style={imgStyle} alt="Gemini" />
            </button>
            <button type="button" class={`btn btn-outline-secondary btn-icon d-flex align-items-center justify-content-center ${filter === 'claude' ? 'active' : ''}`} onClick={() => setFilter('claude')}>
              <img src={chrome.runtime.getURL('images/claude.png')} style={imgStyle} alt="Claude" />
            </button>
            <button type="button" class={`btn btn-outline-secondary btn-icon d-flex align-items-center justify-content-center ${filter === 'chatgpt' ? 'active' : ''}`} onClick={() => setFilter('chatgpt')}>
              <img src={chrome.runtime.getURL('images/chatgpt.png')} style={imgStyle} alt="ChatGPT" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div class="co-panel-body p-3">
          {/* Folders Section */}
          <div class="accordion" id="folderAccordion">
            {filteredFolders.map(folder => (
              <div class="accordion-item" key={folder.id}>
                <h2 class="accordion-header d-flex" id={`heading${folder.id}`} style={{backgroundColor: folder.color, borderBottom: '1px solid var(--bs-accordion-border-color)'}}>
                  { editingFolderId === folder.id ? (
                    <div class="d-flex flex-grow-1 p-2">
                      <input 
                        type="text" 
                        class="form-control me-2" 
                        value={editingFolderName}
                        onInput={(e) => setEditingFolderName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(folder.id)}
                      />
                      <button class="btn btn-primary" onClick={() => handleSaveRename(folder.id)}>Save</button>
                    </div>
                  ) : (
                    <>
                      <button 
                        class="btn btn-sm btn-link text-secondary p-2" 
                        style={{backgroundColor: folder.color ? 'transparent' : '', zIndex: 1}}
                        onClick={(e) => changeColor(e, folder.id)} title="Change color">
                          <i class="bi bi-palette fs-5"></i>
                      </button>
                      <button
                        class={`accordion-button no-arrow ps-1 pe-2 ${!folder.isOpen ? 'collapsed' : ''}`}
                        style={{backgroundColor: folder.color ? 'transparent' : ''}}
                        type="button"
                        aria-expanded={folder.isOpen ? "true" : "false"}
                        aria-controls={`collapse${folder.id}`}
                        onClick={() => handleToggleFolder(folder.id)}
                      >
                        <span>{folder.name}</span>
                      </button>
                      <span class="folder-actions d-flex align-items-center p-2" style={{backgroundColor: folder.color ? 'transparent' : ''}}>
                        <button class="btn btn-sm btn-link text-secondary p-1" onClick={(e) => handleAddChat(e, folder.id)} title="Add current tab"><i class="bi bi-bookmark-plus fs-5"></i></button>
                        <button class="btn btn-sm btn-link text-secondary p-1" onClick={(e) => handleRenameClick(e, folder)} title="Rename folder"><i class="bi bi-pencil fs-5"></i></button>
                        <button class="btn btn-sm btn-link text-secondary p-1" onClick={(e) => handleDeleteFolder(e, folder.id)} title="Delete folder"><i class="bi bi-trash fs-5"></i></button>
                      </span>
                    </>
                  )}
                </h2>
                <div id={`collapse${folder.id}`} class={`accordion-collapse collapse ${folder.isOpen ? 'show' : ''}`} aria-labelledby={`heading${folder.id}`}>
                  <div class="accordion-body p-0">
                    <div class="list-group list-group-flush">
                      {folder.chats.map(chat => (
                        <div class="list-group-item d-flex justify-content-between align-items-center" key={chat.id}>
                          { editingChatId === chat.id ? (
                            <div class="d-flex flex-grow-1">
                              <input 
                                type="text" 
                                class="form-control me-2" 
                                value={editingChatName}
                                onInput={(e) => setEditingChatName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveChatRename(chat.id)}
                              />
                              <button class="btn btn-primary btn-sm" onClick={() => handleSaveChatRename(chat.id)}>Save</button>
                            </div>
                          ) : (
                            <>
                              <a href={chat.url} class="text-decoration-none text-reset flex-grow-1 d-flex align-items-center me-2" style={{ minWidth: 0 }} target="_top">
                                <img src={chrome.runtime.getURL(`images/${chat.platform}.png`)} style={{...imgStyle, marginRight: '10px', flexShrink: 0}} alt={chat.platform} />
                                <span class="text-truncate">{chat.title}</span>
                              </a>
                              <span class="chat-actions" style={{ flexShrink: 0 }}>
                                <button class="btn btn-sm btn-link text-secondary p-1" onClick={(e) => handleChatRenameClick(e, chat)} title="Rename chat"><i class="bi bi-pencil"></i></button>
                                <button class="btn btn-sm btn-link text-secondary p-1" onClick={(e) => handleDeleteChat(e, chat.id)} title="Delete chat"><i class="bi bi-trash"></i></button>
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
} 