import { Bot } from "lucide-react";

type AvatarProps = {
  name: string;
  color?: string;
  src?: string;
  size?: "sm" | "md" | "lg";
};

const generatedPortraits: Record<string, string> = {
  "Pi Core": "portrait-pi",
  "Pi": "portrait-pi",
  "Atlas": "portrait-atlas",
  "Muse": "portrait-muse",
  "Heron": "portrait-heron",
};

export function Avatar({ name, color = "cyan", src, size = "md" }: AvatarProps) {
  const portraitClass = src ? "" : generatedPortraits[name] ?? "";
  const resolvedSource = src || (portraitClass ? "/avatars/crew.png" : "");
  const initials = name ? name.split(" ").map((part) => part[0]).join("").slice(0, 2) : "";
  return (
    <span className={"avatar avatar-" + size + " tone-" + color + " " + portraitClass} aria-label={name}>
      {initials ? <span>{initials}</span> : <Bot size={16} />}
      {resolvedSource && <img src={resolvedSource} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
    </span>
  );
}
