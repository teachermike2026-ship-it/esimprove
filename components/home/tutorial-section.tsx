"use client";

import { useRef } from "react";
import Link from "next/link";
import { PlayIcon } from "@/components/icons";
import { useI18n } from "@/components/i18n-provider";

export function TutorialSection() {
  const { t, href } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);

  function openGuide() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  return (
    <div className="es-video-wrap">
      <button
        type="button"
        className="es-video"
        onClick={openGuide}
        aria-label={t("home.tutorial.openAria")}
      >
        <span className="es-video-scene" aria-hidden="true">
          <span className="es-video-grain" />
          <span className="es-video-phone">
            <span className="es-video-phone-notch" />
            <span className="es-video-screen">
              <span className="es-video-screen-head" />
              <span className="es-video-copy-line is-wide" />
              <span className="es-video-copy-line" />
              <span className="es-video-pill" />
              <span className="es-video-flag-row">
                <span />
                <span />
                <span />
                <span />
              </span>
              <span className="es-video-plan-card">
                <span />
                <span />
              </span>
            </span>
          </span>
          <span className="es-video-orbit" />
        </span>
        <span className="es-video-play">
          <PlayIcon />
        </span>
        <span className="es-video-tag">{t("home.tutorial.tag")}</span>
      </button>

      <dialog
        ref={dialogRef}
        className="es-guide-dialog"
        aria-labelledby="es-guide-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
      >
        <div className="es-guide-dialog-inner">
          <div className="es-guide-dialog-head">
            <span>{t("home.tutorial.heading")}</span>
            <button
              type="button"
              className="es-dialog-close"
              aria-label={t("home.tutorial.closeAria")}
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </div>
          <h2 id="es-guide-title">{t("home.tutorial.title")}</h2>
          <p className="es-guide-lead">{t("home.tutorial.lead")}</p>
          <ol className="es-guide-steps">
            {[1, 2, 3, 4].map((step) => (
              <li key={step}>
                <span>{String(step).padStart(2, "0")}</span>
                <div>
                  <strong>{t(`home.tutorial.step${step}Title`)}</strong>
                  <p>{t(`home.tutorial.step${step}Body`)}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="es-guide-note">{t("home.tutorial.note")}</p>
          <div className="es-guide-actions">
            <Link className="es-button es-button-primary" href={href("/guides")}>
              {t("home.tutorial.readFull")}
            </Link>
            <button
              type="button"
              className="es-button es-button-secondary"
              onClick={() => dialogRef.current?.close()}
            >
              {t("home.tutorial.close")}
            </button>
          </div>
        </div>
      </dialog>

      <p className="es-video-note">
        {t("home.tutorial.videoNote")}{" "}
        <Link href={href("/guides")}>{t("home.tutorial.browseGuides")}</Link>.
      </p>
    </div>
  );
}
