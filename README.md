# Boundless Classroom · Family demo

An independent copy of Boundless Classroom for a teacher, parent and student meeting prototype. The original repository and its deployment are not modified.

## Original design, small changes

The current version restores the original homepage: **Beyond boundaries.**, the original infinity wordmark, serif typography, star field, floating classroom and **Love, Share and Peace.**

- The left entrance changes from **Match** to **Study**. It opens a short explanation of the future learning area.
- **Reservation** opens the original Common Room with its original modeled interior and clickable wall portraits.
- **Enter the VR** opens the separate fixed-seat meeting prototype, immediately showing the original glass classroom. No initial seat picker, Enter Room screen, or large participant panel is displayed.
- All visible interface, teacher-profile, report and status text is English.
- The ISP PROGRAM / SUIS QP lettering is reconstructed as a transparent, scalable vector mark inside the preparation and meeting rooms. No rectangular image tile or backing plate is used.

The original homepage stylesheet and scene assets are reused, without a new visual theme. The original preparation-room geometry, portraits and lights are retained. The original source documentation is preserved in [SOURCE_PROJECT_README.md](SOURCE_PROJECT_README.md).

## Demo scope

Teachers, time slots and the four-page learning report are fictional examples. Bookings are stored only in the current browser and do not notify a teacher or reserve a real slot.

The meeting prototype has three fixed roles, simple participant representations, four widescreen English ISP family-learning slides on the original whiteboard, and a WebXR entry. The teacher controls slide changes. The seat is derived from the reservation/invitation URL, and the experience opens directly into the classroom with a minimal control strip. Empty seats are clearly waiting, rather than simulated as connected people. The slides use anonymized themes from the user's institutional reference decks; no private student or staff lists are published.

## GitHub Pages

Publish the independent repository's `main` branch from `/(root)`. The site uses native HTML, CSS and ES modules, with relative paths and no build step.

The public `family/config.js` intentionally has an empty `signalingOrigin`. This serves a clearly labeled **local preview**. The original AI gateway is disabled in this copy, and the new pages do not call its paid services.

## Optional meeting service

`server/server.mjs` contains room invitations, role checks, WebRTC signaling and report-page state. It uses Node.js built-ins without extra npm dependencies:

```sh
node server/server.mjs
```

The default address is `http://127.0.0.1:8787`; the service provides its own frontend configuration. Cross-device use still needs an independent HTTPS deployment and suitable ICE configuration. No live backend or paid provider has been deployed. See [server/README.md](server/README.md).

## Verification limits

Only necessary syntax, local source references, release-file consistency and publication status have been checked. The owner deferred browser experience, microphone, network-session and Quest tests. No successful multi-headset or frame-rate result is claimed.

## Source layout

| Path | Purpose |
| --- | --- |
| `index.html`, `family/entry.js` | Restored original homepage with the Study entrance |
| `styles.css`, `space-scene.js`, `space-sky.js` | Original homepage visual assets, preserved |
| `family/reservation.*`, `family/lounge-view.js` | Common Room, wall portraits and demo bookings |
| `family/meeting.*`, `family/meeting-scene.js` | Fixed-seat meeting UI, scene and WebXR |
| `family/report.js`, `family/demo-data.js` | English fictional demo content |
| `family/assets/isp-program-mark.svg` | Transparent outlined school wordmark |
| `family/room-client.js`, `server/` | Optional independent meeting service |

Original source: `Felix160558/boundless-classroom`, homepage baseline `b9a793568caf2e45d3e11da1be6f9a58410d4434`. The imported copy retains its source history. The original upstream push URL is disabled in this checkout.
