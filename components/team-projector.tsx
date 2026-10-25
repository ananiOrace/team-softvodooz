"use client";

/* Les calques doivent être posés au pixel près sur la photo : next/image
   réintroduirait un redimensionnement responsive, donc on garde des <img>
   avec les dimensions natives de la scène. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { cardSide, people, teamInfo } from "@/data/team";
import {
  SCENE,
  buildTimeline,
  cameraAt,
  cameraTransform,
  cardOpacity,
  finaleOpacity,
  focusAmount,
  focusCamera,
  homeCamera,
  introOpacity,
  personOpacity,
  type Camera,
} from "@/lib/scene";

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

type Props = {
  /** Identifiants des silhouettes effectivement découpées. */
  available: string[];
};

export function TeamProjector({ available }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const finaleRef = useRef<HTMLDivElement>(null);
  const cutoutRefs = useRef<Record<string, HTMLImageElement | null>>({});
  const cardRefs = useRef<Array<HTMLElement | null>>([]);

  useIsomorphicLayoutEffect(() => {
    const section = sectionRef.current;
    const viewport = viewportRef.current;
    const stage = stageRef.current;
    const blur = blurRef.current;

    if (!section || !viewport || !stage || !blur) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    const timeline = buildTimeline(people.length);
    let width = 0;
    let height = 0;
    let home: Camera = homeCamera(1, 1);
    let targets: Camera[] = [];

    const measure = () => {
      width = viewport.clientWidth;
      height = viewport.clientHeight;
      home = homeCamera(width, height);
      targets = people.map((person) => focusCamera(person.focus, width, height));
    };

    const render = (progress: number) => {
      const cam = cameraAt(timeline, progress, home, targets);
      stage.style.transform = cameraTransform(cam, width, height);
      blur.style.opacity = String(focusAmount(timeline, progress) * 0.97);

      people.forEach((person, index) => {
        const cutout = cutoutRefs.current[person.id];
        if (cutout) {
          cutout.style.opacity = personOpacity(timeline, index, progress).toFixed(3);
        }

        const card = cardRefs.current[index];
        if (!card) return;
        const opacity = cardOpacity(timeline, index, progress);
        card.style.opacity = opacity.toFixed(3);
        card.style.visibility = opacity < 0.02 ? "hidden" : "visible";
        card.style.setProperty("--y", `${((1 - opacity) * 18).toFixed(1)}px`);
        card.toggleAttribute("inert", opacity < 0.1);
      });

      const intro = introRef.current;
      if (intro) {
        const opacity = introOpacity(progress);
        intro.style.opacity = opacity.toFixed(3);
        intro.style.pointerEvents = opacity < 0.2 ? "none" : "auto";
      }

      const finale = finaleRef.current;
      if (finale) {
        const opacity = finaleOpacity(progress);
        finale.style.opacity = opacity.toFixed(3);
        finale.style.pointerEvents = opacity < 0.2 ? "none" : "auto";
        finale.toggleAttribute("inert", opacity < 0.2);
      }
    };

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: () => `+=${Math.round(height * (people.length * 0.9 + 1))}`,
      pin: true,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        measure();
        render(self.progress);
      },
      onUpdate: (self) => render(self.progress),
    });

    measure();
    render(0);
    section.dataset.ready = "true";

    // Défilement lissé : ScrollTrigger ne fait que lire la position qui en
    // résulte, ce qui garde la caméra déterministe (aucune interpolation
    // concurrente entre deux systèmes d'animation).
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      trigger.kill();
      delete section.dataset.ready;
    };
  }, []);

  return (
    <section ref={sectionRef} className="projector" id="equipe" aria-label="L'équipe">
      <div ref={viewportRef} className="projector__viewport">
        <div
          ref={stageRef}
          className="stage"
          style={{ width: SCENE.width, height: SCENE.height }}
        >
          <img
            className="stage__base"
            src="/scene/base.webp"
            alt="L'équipe Soft Vodooz réunie autour du bureau"
            width={SCENE.width}
            height={SCENE.height}
            fetchPriority="high"
            decoding="async"
          />

          <div ref={blurRef} className="stage__blur" aria-hidden="true">
            <img src="/scene/base-blur.webp" alt="" width={SCENE.width} height={SCENE.height} />
          </div>

          {people.map((person) =>
            available.includes(person.id) ? (
              <img
                key={person.id}
                ref={(el) => {
                  cutoutRefs.current[person.id] = el;
                }}
                className="stage__sharp"
                src={`/scene/people/${person.id}.webp`}
                alt=""
                aria-hidden="true"
                style={{
                  left: person.box.x,
                  top: person.box.y,
                  width: person.box.w,
                  height: person.box.h,
                }}
              />
            ) : null,
          )}
        </div>

        <div className="cards">
          {people.map((person, index) => (
            <article
              key={person.id}
              ref={(el) => {
                cardRefs.current[index] = el;
              }}
              className={`card card--${cardSide(person)}`}
              inert
            >
              <div className="card__panel">
                <p className="card__index">
                  {String(index + 1).padStart(2, "0")} / {String(people.length).padStart(2, "0")}
                </p>
                <h2 className="card__name">{person.name}</h2>
                <p className="card__role">{person.role}</p>
                <p className="card__line">« {person.line} »</p>
                <div className="card__links">
                  {person.links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target={link.href.startsWith("http") ? "_blank" : undefined}
                      rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div ref={introRef} className="intro">
          <p className="eyebrow">L&apos;équipe · {teamInfo.tagline}</p>
          <h1 className="intro__title">{teamInfo.name}</h1>
          <p className="intro__claim">{teamInfo.claim}</p>
          <p className="intro__hint">Faites défiler</p>
        </div>

        <div ref={finaleRef} className="finale">
          <div className="finale__panel">
            <dl className="stats">
              {teamInfo.stats.map((stat) => (
                <div key={stat.label} className="stat">
                  <dt>{stat.label}</dt>
                  <dd>{stat.value}</dd>
                </div>
              ))}
            </dl>
            <a
              className="cta"
              href={teamInfo.cta.href}
              target="_blank"
              rel="noreferrer"
            >
              {teamInfo.cta.label}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
