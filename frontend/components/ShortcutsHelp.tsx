"use client";

import { Modal } from "./Modal";
import { Button } from "./ui";

/** The list shown by the "?" shortcut and the keyboard button in the top bar. */
export const SHORTCUT_HELP: { keys: string; description: string }[] = [
  { keys: "/", description: "Jump to the search box" },
  { keys: "c", description: "Create (hosted zone, or record inside a zone)" },
  { keys: "r", description: "Refresh the list" },
  { keys: "i", description: "Import a zone file (inside a zone)" },
  { keys: "e", description: "Export the zone (inside a zone)" },
  { keys: "d", description: "Toggle dark mode" },
  { keys: "?", description: "Show this list" },
  { keys: "Esc", description: "Close a dialog" },
];

export function ShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      title="Keyboard shortcuts"
      open={open}
      onClose={onClose}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      <p className="muted" style={{ marginTop: 0 }}>
        Shortcuts are ignored while you are typing in a field.
      </p>
      <table className="data">
        <tbody>
          {SHORTCUT_HELP.map((item) => (
            <tr key={item.keys}>
              <td style={{ width: 90 }}>
                <kbd className="kbd">{item.keys}</kbd>
              </td>
              <td>{item.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Modal>
  );
}
