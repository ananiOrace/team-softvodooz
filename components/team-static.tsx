/* eslint-disable @next/next/no-img-element */

import { people, teamInfo } from "@/data/team";
import { SCENE } from "@/lib/scene";

/**
 * Version sans animation : c'est aussi la version qu'on sert à qui préfère
 * réduire les mouvements. Même photo, mêmes fiches, aucune caméra.
 */
export function TeamStatic() {
  return (
    <section className="team-static" id="equipe" aria-label="L'équipe">
      <div className="team-static__hero">
        <img
          src="/scene/base.webp"
          alt="L'équipe Soft Vodooz réunie autour du bureau"
          width={SCENE.width}
          height={SCENE.height}
        />
        <div className="team-static__title">
          <p className="eyebrow">L&apos;équipe · {teamInfo.tagline}</p>
          <h1 className="intro__title">{teamInfo.name}</h1>
          <p className="intro__claim">{teamInfo.claim}</p>
        </div>
      </div>

      <ul className="team-static__grid">
        {people.map((person, index) => (
          <li key={person.id} className="team-static__card">
            <p className="card__index">
              {String(index + 1).padStart(2, "0")} / {String(people.length).padStart(2, "0")}
            </p>
            <h2 className="card__name">{person.name}</h2>
            <p className="card__role">{person.role}</p>
            <p className="card__line">« {person.line} »</p>
            <div className="card__links">
              {person.links.map((link) => (
                <a key={link.label} href={link.href}>
                  {link.label}
                </a>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <div className="finale__panel team-static__finale">
        <dl className="stats">
          {teamInfo.stats.map((stat) => (
            <div key={stat.label} className="stat">
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
        <a className="cta" href={teamInfo.cta.href}>
          {teamInfo.cta.label}
        </a>
      </div>
    </section>
  );
}
