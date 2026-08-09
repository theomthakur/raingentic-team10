import { GithubIcon, LinkedinIcon } from "../icons";

const LINKS = [
  { href: "https://github.com/theomthakur/raingentic-team10", label: "View source", icon: GithubIcon },
  { href: "https://www.linkedin.com/in/princy-doshi-071b581b3/", label: "Princy Doshi", icon: LinkedinIcon },
  { href: "https://www.linkedin.com/in/theomthakur/", label: "Om Thakur", icon: LinkedinIcon },
];

export function Footer() {
  return (
    <footer className="border-t border-edge">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-6 text-[12.5px] text-muted md:px-10">
        <p>Team 10 · Raingentic Commerce Hackathon NYC</p>
        <div className="flex items-center gap-4">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              title={label}
              className="flex items-center gap-1.5 text-muted transition hover:text-ink-900"
            >
              <Icon />
              <span>{label}</span>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
