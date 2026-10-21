# Tapa curriculum reflection prototype

This is a static website prototype for exploring a staff curriculum reflection flow. It is for testing the design, not for collecting real staff responses. Please use fictional answers. `index.html` is the primary site; `index2.html` is a second entry point for the current design.

## Run locally

First extract the entire ZIP into a folder; do not open `index2.html` from inside the ZIP or copy that HTML file out by itself. It needs the neighboring `styles.css`, `app.js`, `icon.svg`, and `assets/` files.

On Windows, double-click `start-index2.bat` to launch Version 2. Keep the server window open while using the site; close that window to stop it. Alternatively, with Python installed, run:

```sh
py -m http.server 5187 --bind 127.0.0.1
```

Then open `http://127.0.0.1:5187/index2.html`.

To run the Node-based preview instead, install Node.js and run:

```sh
npm start
```

Open `http://127.0.0.1:5187/tapa/` in a browser. There are no package dependencies.

## Edit the website

- `index.html` contains the primary page shell and navigation.
- `index2.html` contains the second page entry point.
- `styles.css` controls the layout, typography, colours, and responsive design.
- `app.js` contains the reflection flow, example insights, and browser-only draft storage.
- `icon.svg` is the browser-tab icon.
- `assets/` contains the Adelaide University logo supplied for this prototype and the original abstract background linework.

The site saves each visitor's drafts and simulated records in that visitor's browser using `localStorage`. It has no shared database, user accounts, or live submission. The education-team view displays fictional example data and does not enforce staff permissions.

The earth-toned linework is an original abstract visual treatment, not a reproduction or representation of specific Aboriginal or Torres Strait Islander symbols. The Adelaide University logo is used as supplied; its inclusion does not imply endorsement of this prototype.

Before changing the questions or access wording, confirm them with the project team and client. Test any edits in a fresh browser session before sharing a new version.

## Deployment

Netlify runs `npm run build` and publishes the `dist` folder. Changes merged into the connected GitHub branch trigger a new deployment. Check the deployed page after each change.
