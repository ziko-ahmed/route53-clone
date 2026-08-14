/** Saves text to the user's downloads folder as a file. */
export function downloadText(filename: string, text: string, mimeType = "text/plain") {
  const blob = new Blob([text], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Clean up, or the blob stays in memory for the life of the tab.
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
