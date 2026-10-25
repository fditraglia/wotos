# Who's on the other side?

A classroom demonstration of conditional probability, served at <https://ditraglia.com/wotos/>.

There are three cards: Gaga/Gaga, Obama/Gaga and Obama/Obama. Draw one at random and look at the side facing up. If it is Obama, what is the probability that Obama is on the other side too? The answer is 2/3, and most students guess 1/2.

The site has two modes.

- **Draw a card** (`#draw`) replaces the physical cards. Each student draws on their own phone, and the instructor runs the usual procedure: stand if Obama is facing up, then sit down if he is not on the other side. The phone keeps a running tally across rounds, so a small class can pool several rounds each.
- **Simulate** (`#simulate`) draws 1, 10, 100 or 1,000 cards at a time and shows every draw and the running estimate. The 2/3 reference line and the explanation stay hidden until "Reveal the answer" is opened. Link straight to it with `https://ditraglia.com/wotos/#simulate`.

## Development

The site is plain HTML, CSS and JavaScript with no build step and no dependencies. To preview locally:

```
python3 -m http.server 8000
```

then open <http://localhost:8000>. The service worker (`sw.js`, for offline use in class) is not registered on `localhost`, so edits show up on a normal reload. When deploying a change, bump `CACHE` in `sw.js` so returning visitors pick it up.

GitHub Pages serves the `main` branch from the repository root.
