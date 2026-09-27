import Image from "next/image";
import Link from "next/link";

const menu = [
  "Dashboard",
  "Branding",
  "Form submissions",
  "Families",
  "Children's stories",
  "Events",
  "Go Gold requests",
  "Users",
  "Settings",
];

export default function AdminPage() {
  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <Image
          src="/project-golden-child-logo.png"
          width={190}
          height={190}
          alt="Project Golden Child"
          className="admin-logo"
        />
        <nav>
          {menu.map((item, index) => (
            <a className={index === 1 ? "admin-nav active" : "admin-nav"} href="#" key={item}>
              <span>{["⌂","▧","▤","●","♥","▣","★","◉","⚙"][index]}</span>
              {item}
            </a>
          ))}
        </nav>
        <Link className="admin-back" href="/">← Back to website</Link>
      </aside>

      <section className="admin-main">
        <div className="admin-topbar">
          <div>
            <div className="admin-kicker">Project Golden Child</div>
            <h1>Welcome back, Admin</h1>
            <p>Manage your website, content and community.</p>
          </div>
          <div className="admin-user">Admin ▾</div>
        </div>

        <div className="admin-title">
          <h2>Branding</h2>
          <p>Manage your website&apos;s logo, visual identity and brand assets.</p>
        </div>

        <section className="admin-card">
          <div className="admin-card-heading">
            <h3>Site Branding</h3>
            <p>Update the logo used across the website.</p>
          </div>

          <div className="branding-grid">
            <div>
              <div className="field-label">Current logo</div>
              <div className="logo-preview">
                <Image
                  src="/project-golden-child-logo.png"
                  width={380}
                  height={380}
                  alt="Current Project Golden Child logo"
                />
              </div>
            </div>

            <div className="upload-panel">
              <h3>Upload new logo</h3>
              <p>
                Replace <code>public/project-golden-child-logo.png</code> in the
                project to update the logo everywhere.
              </p>
              <label className="fake-upload">
                Upload new logo
                <input type="file" accept=".png,.jpg,.jpeg,.webp,.svg" disabled />
              </label>
              <small>
                This starter intentionally does not pretend to upload files to a
                database. Wire this control to your existing storage/backend.
              </small>
            </div>
          </div>
        </section>

        <section className="admin-card">
          <div className="admin-card-heading admin-card-row">
            <div>
              <h3>Recent form submissions</h3>
              <p>Connect this table to your existing form database.</p>
            </div>
            <button className="ghost-button" type="button">View all submissions</button>
          </div>

          <div className="submission-empty">
            <strong>No sample family data is included.</strong>
            <span>
              Use your real submission source here rather than placing identifiable
              child or health information into the front-end code.
            </span>
          </div>
        </section>
      </section>
    </main>
  );
}
