import Image from "next/image";
import Link from "next/link";

const links = [
  ["Home", "/"],
  ["About", "/#about"],
  ["Children's Stories", "/#stories"],
  ["Go Gold", "/#go-gold"],
  ["Events", "/#events"],
  ["Families", "/#families"],
  ["Contact", "/#contact"],
];

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="shell nav-wrap">
        <Link href="/" className="brand" aria-label="Project Golden Child home">
          <Image
            src="/project-golden-child-logo.png"
            width={188}
            height={188}
            alt="Project Golden Child"
            priority
          />
        </Link>

        <nav className="main-nav" aria-label="Main navigation">
          {links.map(([label, href]) => (
            <Link key={label} href={href}>
              {label}
            </Link>
          ))}
        </nav>

        <Link className="button button-gold nav-cta" href="#support">
          Support the campaign
        </Link>
      </div>
    </header>
  );
}
