# Midnight Dossier Cyber Portfolio

A static cyber security portfolio and blog homepage with a premium navy dossier visual system.

## Edit These First

- Replace placeholder name, email, and social links in `src/pages/index.astro`.
- Replace the proof board with your achievements, certifications, HTB/TryHackMe profiles, and CTFTime team.
- The HTB profile card is rendered by Astro using HTB profile and experience APIs during `npm run dev` and `npm run build`.
- Replace the project cards in the `Mission files` section with your real labs, CTFs, tools, or writeups.
- Replace the blog cards in the `Blog archive` section with your posts.
- Adjust skill levels in `src/styles/global.css` by changing each card's `--level` value.

## Dev Workflow

Use Astro through npm scripts. Flask and the custom Node dev server have been removed.

```bash
npm run dev
```

This starts Astro's dev server with file watching and live reload at `http://127.0.0.1:3000`.

## Build

```bash
npm run build
```

The build fetches HTB profile and experience data server-side through Astro and outputs a static site in `dist/`.

## Serve Built Site

```bash
npm run serve
```

Then visit `http://127.0.0.1:4321`.
