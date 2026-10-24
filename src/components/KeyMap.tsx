/** The fixed §3 key map (shown on first run and in Help). */
export const KEY_MAP: { keys: string; does: string }[] = [
  { keys: "Space", does: "Pen down / pen up" },
  { keys: "Enter", does: "Press the focused button; Accept a note or AI suggestion" },
  { keys: "Esc", does: "Cancel / no; back to the canvas" },
  { keys: "Backspace or Z", does: "Undo" },
  { keys: "Y", does: "Redo" },
  { keys: "M", does: "Microphone on / off" },
  { keys: "R", does: "Recenter" },
  { keys: "P", does: "Pause tracking" },
  { keys: "1, 2, 3", does: "Choose an option" },
];

export default function KeyMap({ caption = "Keys" }: { caption?: string }) {
  return (
    <table className="keymap">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Key</th>
          <th scope="col">What it does</th>
        </tr>
      </thead>
      <tbody>
        {KEY_MAP.map((k) => (
          <tr key={k.keys}>
            <td>
              <kbd>{k.keys}</kbd>
            </td>
            <td>{k.does}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
