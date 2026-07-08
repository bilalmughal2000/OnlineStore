// Passenger / cPanel "Setup Node.js App" startup file for the Next.js storefront.
// NOT used by the VPS flow (that uses `next start` via PM2). Passenger loads this
// file and provides the port via process.env.PORT.
//
// Prerequisite: run `npm run build` first so the .next production build exists.
const { createServer } = require('http');
const next = require('next');

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

app.prepare().then(() => {
  createServer((req, res) => handle(req, res)).listen(port, () => {
    console.log(`Storefront (Passenger) listening on ${port}`);
  });
});
