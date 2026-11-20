# Kerbside

A small top-down city game in the spirit of the original GTA. Every city is procedurally generated, with streets, blocks of buildings, parks, pedestrians and traffic that keeps left. Wander about on foot, get into a parked car and drive.

Play it at **[leaversmith.com/kerbside](https://leaversmith.com/kerbside/)**.

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Walk / drive | <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or arrow keys | On-screen arrow pad |
| Get in / out of a car | <kbd>E</kbd> | **Enter / exit** button |
| New city | **New city** button | **New city** button |

- In a car, up accelerates, down brakes and then reverses, and left and right steer. Steering only works while the car is moving.
- When a parked car is within reach it is highlighted in yellow and you get an "Enter parked car" prompt.
- You can only get out once you have slowed right down, and only on a side that isn't blocked.
- The minimap in the top right shows the whole city and where you are.

## Cities and seeds

Each city comes from a seed, which is shown under the minimap. **New city** picks a random seed and puts it in the address bar as `?seed=…`, so you can share a link to a particular city or come back to it. Without a seed you get the default city.

## Running it locally

There is no build step and there are no dependencies, just `index.html` and `game.js`. Serve the folder with any static file server, for example:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000/>. Opening `index.html` straight from disk also works.

## Hosting

GitHub Pages serves it from the `main` branch (root folder) at `leaversmith.com/kerbside/`. All the asset paths are relative, so it works under that subpath.
