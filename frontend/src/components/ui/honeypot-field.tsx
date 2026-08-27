"use client";

// Hidden anti-bot field. Real users never see or interact with it — it's
// positioned off-screen rather than `display:none`, since some scripted
// bots skip fields hidden that way but still blindly fill anything with a
// name/id present in the DOM. If this comes back non-empty, the backend
// treats the submission as a bot and silently no-ops it.
export function HoneypotField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="text"
      name="company"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        width: "1px",
        height: "1px",
        opacity: 0,
        pointerEvents: "none",
      }}
    />
  );
}
