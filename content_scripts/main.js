console.log("ChatOrganizer content script loaded.");

const IFRAME_ID = "chat-organizer-panel-iframe";
let panelIframe = null;

function getPanelIframe() {
  if (panelIframe && document.body.contains(panelIframe)) {
    return panelIframe;
  }
  panelIframe = document.getElementById(IFRAME_ID);
  return panelIframe;
}

function createPanel() {
  if (getPanelIframe()) {
    return getPanelIframe();
  }

  console.log("ChatOrganizer: Creating panel iframe");
  const iframe = document.createElement("iframe");
  iframe.id = IFRAME_ID;
  iframe.src = chrome.runtime.getURL("dist/ui/panel.html");

  document.body.appendChild(iframe);
  panelIframe = iframe;
  return iframe;
}

function togglePanel() {
  const iframe = createPanel(); // Ensures panel exists
  if (!iframe) return;

  iframe.classList.toggle("co-panel-hidden");

  if (iframe.classList.contains("co-panel-hidden")) {
    console.log("ChatOrganizer: Panel hidden");
  } else {
    console.log("ChatOrganizer: Panel shown");
  }
}

function getChatInfo() {
  const url = window.location.href;
  let platform = null;
  let title = document.title; // Default to page title

  if (url.includes("gemini.google.com/")) {
    platform = 'gemini';
    // Per user feedback, find the selected conversation's title element
    const titleEl = document.querySelector('conversations-list div[role="button"].selected .conversation-title');
    if (titleEl && titleEl.textContent) {
      title = titleEl.textContent.trim();
    }
  } else if (url.includes("claude.ai/")) {
    platform = 'claude';
    // Claude might have the title in an element with a test ID or specific class.
    const titleEl = document.querySelector('[data-testid="chat-title-header"]');
    if (titleEl) {
      title = titleEl.textContent;
    }
  } else if (url.includes("chatgpt.com/")) {
    platform = 'chatgpt';
    // Let's stick with document.title for ChatGPT as it's generally reliable
    // for active and saved chats.
  }

  if (!platform) {
    return { error: "Not a supported chat platform." };
  }
  
  // A simple validation to see if it looks like a chat page
  if ( (platform === 'gemini' && !url.includes('/prompt/')) && (platform === 'claude' && !url.includes('/chat/')) && (platform === 'chatgpt' && !url.includes('/c/')) ) {
     // This is a basic check. Might need refinement.
     // It checks for path segments that usually indicate an active chat.
  }

  return { platform, title, url };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("ChatOrganizer content script received message:", message);
  if (message.type === "TOGGLE_PANEL") {
    togglePanel();
    sendResponse({ status: "Panel toggled" });
  } else if (message.action === "getChatInfo") {
    const chatInfo = getChatInfo();
    sendResponse(chatInfo);
  } else {
    sendResponse({ status: "Unknown message type" });
  }
  return true; // Indicates that the response will be sent asynchronously (or synchronously)
});

// Create the panel as soon as the content script is injected.
// This makes it appear by default, as its initial CSS state is visible.
createPanel();
