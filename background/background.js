// background/background.js

chrome.action.onClicked.addListener((tab) => {
  if (tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" }, (response) => {
      if (chrome.runtime.lastError) {
        // Log error if message fails (e.g., content script not injected yet or page not allowed)
        console.warn("ChatOrganizer: Could not send TOGGLE_PANEL message to tab " + tab.id + ": " + chrome.runtime.lastError.message);
        // Potentially inject content script here if it's missing, though manifest should handle it.
        // chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content_scripts/main.js", "content_scripts/styles.css"] });
      }
      // You can handle responses from the content script here if needed
    });
  } else {
    console.warn("ChatOrganizer: Clicked action on a tab with no ID:", tab);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'addCurrentChat') {
    // 1. Get the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab && activeTab.id) {
        // 2. Send a message to the content script of that tab
        chrome.tabs.sendMessage(activeTab.id, { action: "getChatInfo" }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error sending message to content script:", chrome.runtime.lastError.message);
            sendResponse({ error: "Could not communicate with the page." });
            return;
          }
          
          if (response && response.error) {
             sendResponse(response); // Forward the specific error from content script
          } else if (response) {
            // 3. Forward the content script's response back to the panel
            sendResponse(response);
          } else {
            sendResponse({ error: "No response from content script."})
          }
        });
      } else {
        sendResponse({ error: "Could not find active tab." });
      }
    });

    return true; // Indicates we will send a response asynchronously
  }
});

// Optional: Listen for initial installation or updates
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    console.log("ChatOrganizer extension installed.");
    // Perform any first-time setup here if needed
  } else if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
    console.log("ChatOrganizer extension updated to version " + chrome.runtime.getManifest().version);
  }
});
