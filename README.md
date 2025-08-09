# Cabinet Chrome Extension

Cabinet is a Chrome extension designed to enhance your productivity by adding folder-like organization capabilities to popular AI chat platforms: Claude, Gemini, and ChatGPT. It allows you to manage and categorize your conversations seamlessly within a convenient side panel.

This extension injects a panel into the supported AI chat websites, which can be toggled by clicking the extension's icon in the Chrome toolbar.

## Usage

1.  Navigate to one of the supported AI platforms:
    *   [https://gemini.google.com/](https://gemini.google.com/)
    *   [https://claude.ai/](https://claude.ai/)
    *   [https://chatgpt.com/](https://chatgpt.com/)
2.  Click the Cabinet extension icon in your Chrome toolbar.
3.  A panel will appear on the top right side of the page.
4.  Click the icon again to hide the panel.

### Configure Markdown persistence

- Open the extension options (right-click the extension icon → Options, or from `chrome://extensions` → Details → Extension options). Then select a `.md` file to act as your database. The panel will show a configure screen until this is set.

## Building from Source (for Developers)

1.  **Install dependencies:**
    ```bash
    npm install
    ```

2.  **Development Server (for UI - `src` directory):**
    ```bash
    npm run dev
    ```
    This will start a Vite development server, typically on `http://localhost:5173` (or the next available port). This is useful for developing the UI components in isolation. Note that this server provides the UI, but the full extension functionality requires loading it into Chrome as described in the Installation section.

3.  **Build for Production:**
    ```bash
    npm run build
    ```
    This command bundles the Preact application and places the output in the `dist/ui` directory. The manifest.json is configured to use these built assets.

5.  **Load into Chrome:**
    *   Open Google Chrome.
    *   Navigate to `chrome://extensions`.
    *   Enable **Developer mode** (usually a toggle in the top right corner).
    *   Click on the **Load unpacked** button (usually appears in the top left).
    *   Select the root directory of this project (e.g., `Cabinet`).
    *   The Cabinet extension icon should now appear in your Chrome toolbar.