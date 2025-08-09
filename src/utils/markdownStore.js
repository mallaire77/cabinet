// Parse and serialize the Cabinet folders/chats to a markdown format like sample.md

/**
 * Expected structure:
 * [
 *   {
 *     id: number,
 *     name: string,
 *     color: string|null,
 *     isOpen: boolean,
 *     chats: [{ id, title, platform, url }]
 *   }
 * ]
 */

const FOLDER_HEADER_RE = /^##\s+(.*)$/;
const META_COLOR_RE = /^<!--\s*color:\s*([^\s]+)\s*-->$/;
const META_OPEN_RE = /^<!--\s*open:\s*(true|false)\s*-->$/;
const LINK_ITEM_RE = /^-\s*\[(.+?)\]\((.+?)\)\s*<!--\s*platform:\s*(\w+)\s*-->\s*$/;

export function parseMarkdownToFolders(markdownText) {
  const lines = markdownText.split(/\r?\n/);
  const folders = [];
  let currentFolder = null;
  let pendingColor = null;
  let pendingOpen = null;

  for (const line of lines) {
    const folderMatch = line.match(FOLDER_HEADER_RE);
    if (folderMatch) {
      // push previous
      if (currentFolder) {
        folders.push(currentFolder);
      }
      currentFolder = {
        id: Date.now() + Math.floor(Math.random() * 1000000),
        name: folderMatch[1].trim(),
        color: pendingColor,
        isOpen: pendingOpen ?? false,
        chats: [],
      };
      pendingColor = null;
      pendingOpen = null;
      continue;
    }

    const colorMatch = line.match(META_COLOR_RE);
    if (colorMatch) {
      pendingColor = colorMatch[1].trim();
      if (currentFolder) currentFolder.color = pendingColor;
      continue;
    }

    const openMatch = line.match(META_OPEN_RE);
    if (openMatch) {
      pendingOpen = openMatch[1] === 'true';
      if (currentFolder) currentFolder.isOpen = pendingOpen;
      continue;
    }

    const linkMatch = line.match(LINK_ITEM_RE);
    if (linkMatch && currentFolder) {
      const [, title, url, platform] = linkMatch;
      currentFolder.chats.push({
        id: Date.now() + Math.floor(Math.random() * 1000000),
        title: title.trim(),
        platform: platform.trim(),
        url: url.trim(),
      });
    }
  }

  if (currentFolder) folders.push(currentFolder);

  // Normalize color null when empty string or 'null'
  for (const f of folders) {
    if (!f.color || f.color === 'null' || f.color.trim() === '') {
      f.color = null;
    }
  }

  return folders;
}

export function serializeFoldersToMarkdown(folders) {
  const header = '# Cabinet Folders & Links';
  const lines = [header, ''];

  for (const folder of folders) {
    lines.push(`## ${folder.name}`);
    if (folder.color) lines.push(`<!-- color: ${folder.color} -->`);
    if (folder.isOpen) lines.push(`<!-- open: true -->`);
    lines.push('');
    for (const chat of folder.chats) {
      lines.push(`- [${chat.title}](${chat.url}) <!-- platform: ${chat.platform} -->`);
    }
    lines.push('');
  }

  return lines.join('\n');
}


