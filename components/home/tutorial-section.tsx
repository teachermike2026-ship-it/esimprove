"use client";

import { useRef } from "react";
import Link from "next/link";
import { PlayIcon } from "@/components/icons";

export function TutorialSection() {
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
        aria-label="Open the written eSIM installation guide"
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
        <span className="es-video-tag">Written guide · no video published</span>
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
            <span>Installation guide</span>
            <button
              type="button"
              className="es-dialog-close"
              aria-label="Close installation guide"
              onClick={() => dialogRef.current?.close()}
            >
              ×
            </button>
          </div>
          <h2 id="es-guide-title">Install your eSIM, step by step</h2>
          <p className="es-guide-lead">
            No tutorial video is published in this build. This is a written, provider-neutral
            walkthrough; exact menus vary by device and operating-system version.
          </p>
          <ol className="es-guide-steps">
            <li>
              <span>01</span>
              <div>
                <strong>Confirm your device supports eSIM</strong>
                <p>
                  Check for “Add eSIM” or “Add mobile plan” in settings, and confirm the device
                  is carrier-unlocked. Our compatibility checker is a starting point only.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Install while you have reliable Wi-Fi</strong>
                <p>
                  Install before you travel. Keep the QR code and manual activation details
                  until the plan appears in your device’s SIM manager.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Scan the code or enter the details manually</strong>
                <p>
                  Follow the instructions supplied with your plan. Do not delete an eSIM unless
                  you have confirmed it can be re-added.
                </p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <strong>Label the line and choose your data line</strong>
                <p>
                  Give the eSIM a clear label, keep your primary SIM available for calls and
                  messages, and select the travel line for mobile data.
                </p>
              </div>
            </li>
          </ol>
          <p className="es-guide-note">
            This demo does not issue a working eSIM, QR activation code, or carrier
            connection. Read the full guides for device-specific steps.
          </p>
          <div className="es-guide-actions">
            <Link className="es-button es-button-primary" href="/guides">
              Read the full guides
            </Link>
            <button
              type="button"
              className="es-button es-button-secondary"
              onClick={() => dialogRef.current?.close()}
            >
              Close
            </button>
          </div>
        </div>
      </dialog>

      <p className="es-video-note">
        No tutorial video is published yet. The play button opens the written guide instead.{" "}
        <Link href="/guides">Browse all install guides</Link>.
      </p>
    </div>
  );
}
