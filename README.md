# Anime Proxy Suite

3-in-1 proxy project for:

- AnimeKai
- AnimePahe
- HiAnime

One codebase, three runtimes:

- Node server
- Vercel
- Cloudflare Worker

## Endpoints

- `GET /providers`
- `GET /health`
- `GET /proxy/:provider?url=<target>`
- `GET /:provider/m3u8-proxy?url=<target>`
- `GET /:provider/ts-proxy?url=<target>`
- `GET /m3u8-proxy?provider=<provider>&url=<target>`
- `GET /ts-proxy?provider=<provider>&url=<target>`

Supported providers:

- `animekai`
- `animepahe`
- `hianime`

## Local

```bash
npm install
npm start
```

## Worker

```bash
npm run worker:dev
npm run worker:deploy
```

## Vercel

Deploy the repo directly on Vercel. The root `server.js` exports the Hono app for Vercel and also starts the local Node server when run with `npm start`.
