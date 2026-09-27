import Image from "next/image";
import Link from "next/link";
import SiteHeader from "../components/SiteHeader";

const storySlots = [
  {
    title: "Every child has a story",
    copy: "A space to recognise each child as a person first, with their story shared only with the family's consent.",
  },
  {
    title: "During treatment",
    copy: "Recognising children and families through the difficult, ordinary and important moments of treatment.",
  },
  {
    title: "Beyond treatment",
    copy: "Continuing to recognise children after treatment and making sure their journey is not simply forgotten.",
  },
];

const eventPlan = [
  ["Year 1", "Two family events", "Our first step: bringing families together in a safe, positive and welcoming setting."],
  ["Year 2", "Four family events", "Building a stronger community and creating more opportunities for families to connect."],
  ["Year 3", "Six family events", "Growing carefully where funding, demand and capacity make it sustainable."],
];

export default function HomePage() {
  return (
    <main>
      <SiteHeader />

      <section className="hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="shell hero-grid">
          <div className="hero-copy">
            <div className="eyebrow">Childhood cancer awareness • recognition • community</div>
            <h1>Making childhood cancer impossible to ignore.</h1>
            <p className="hero-lead">
              Recognising children&apos;s journeys, remembering those who have died,
              supporting families and helping September go gold.
            </p>
            <div className="hero-actions">
              <Link className="button button-gold" href="#stories">
                Share a story
              </Link>
              <Link className="button button-light" href="#support">
                Support the campaign
              </Link>
            </div>
          </div>

          <div className="hero-mark">
            <div className="hero-logo-frame">
              <Image
                src="/project-golden-child-logo.png"
                width={760}
                height={760}
                alt="Project Golden Child golden superhero cape logo"
                priority
              />
            </div>
            <div className="hand-note">
              Every child deserves to be seen, recognised and remembered.
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="stories">
        <div className="shell split-heading">
          <div>
            <div className="eyebrow">Real children. Individual journeys.</div>
            <h2>Children&apos;s Stories</h2>
            <p>
              Project Golden Child exists to ensure children are recognised as
              people first. Stories are published only where the family has given
              clear consent for the information, photographs and level of detail shared.
            </p>
          </div>
          <Link className="text-link" href="#families">Tell us about a child →</Link>
        </div>

        <div className="shell card-grid">
          {storySlots.map((story) => (
            <article className="story-card" key={story.title}>
              <div className="story-image-placeholder">
                <span>Family-approved image</span>
              </div>
              <div className="story-body">
                <h3>{story.title}</h3>
                <p>{story.copy}</p>
                <span className="mini-link">Stories added with consent →</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section gold-section" id="go-gold">
        <div className="shell gold-layout">
          <div>
            <div className="eyebrow">Raise awareness. Show your support.</div>
            <h2>Go Gold September</h2>
            <p>
              We want the gold ribbon to become impossible to miss. Wear gold,
              share accurate information, ask your community to get involved and
              help landmarks shine gold during Childhood Cancer Awareness Month.
            </p>
            <Link className="button button-gold" href="#contact">
              Get involved
            </Link>
          </div>

          <div className="action-grid">
            <div className="action-card">
              <div className="action-icon">◆</div>
              <h3>Wear gold</h3>
              <p>At school, work or in your community.</p>
            </div>
            <div className="action-card">
              <div className="action-icon">◎</div>
              <h3>Share</h3>
              <p>Help childhood cancer reach more people.</p>
            </div>
            <div className="action-card">
              <div className="action-icon">✦</div>
              <h3>Light it up</h3>
              <p>Help local places and landmarks go gold.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="events">
        <div className="shell split-heading">
          <div>
            <div className="eyebrow">Come together. Build a community.</div>
            <h2>Family Events</h2>
            <p>
              Our ambition is to create regular opportunities for families affected
              by childhood cancer to spend time together in a positive environment.
            </p>
          </div>
        </div>

        <div className="shell card-grid">
          {eventPlan.map(([year, title, copy]) => (
            <article className="event-card" key={year}>
              <div className="event-year">{year}</div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section family-section" id="families">
        <div className="shell family-panel">
          <div>
            <div className="eyebrow">For children and families</div>
            <h2>Help us recognise their journey.</h2>
            <p>
              Families will be able to register a child with Project Golden Child
              so that we can maintain appropriate contact, send letters, cards or
              gifts and include them in suitable family opportunities.
            </p>
          </div>
          <div className="family-actions">
            <Link className="button button-gold" href="#contact">
              Register interest
            </Link>
            <Link className="button button-light" href="#contact">
              Make a referral
            </Link>
          </div>
        </div>
      </section>

      <section className="section support-section" id="support">
        <div className="shell support-panel">
          <div>
            <div className="eyebrow">Help Project Golden Child grow</div>
            <h2>Support the campaign.</h2>
            <p>
              Public donations, grants and community fundraising will help us
              raise awareness, recognise children and bring families together.
            </p>
          </div>
          <Link className="button button-gold" href="#contact">
            Contact us
          </Link>
        </div>
      </section>

      <footer className="footer" id="contact">
        <div className="shell footer-grid">
          <div className="footer-brand">
            <Image
              src="/project-golden-child-logo.png"
              width={150}
              height={150}
              alt="Project Golden Child"
            />
          </div>
          <div>
            <h3>Project Golden Child</h3>
            <p>
              Childhood cancer awareness, recognition and community.
            </p>
          </div>
          <div className="footer-links">
            <Link href="/">Home</Link>
            <Link href="/admin">Admin</Link>
            <a href="mailto:hello@projectgoldenchild.org">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
