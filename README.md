# NYC Collision Injury Insight

This beginner-friendly static web app investigates a simple question:

> Is the crash hour with the most total injuries also the hour with the highest injury rate?

The answer is calculated from live data instead of being hard-coded.

## Data source

The app requests the latest 5,000 collision records from the [NYC Open Data Motor Vehicle Collisions API](https://data.cityofnewyork.us/resource/h9gi-nx95.json?$limit=5000&$select=crash_date,crash_time,borough,number_of_persons_injured,contributing_factor_vehicle_1,vehicle_type_code1&$order=crash_date%20DESC,crash_time%20DESC).

The API call happens in `fetchCollisionData()` inside `script.js`.

## Analysis

The records are grouped into hours 0 through 23. For each hour, the app counts:

- crashes
- total people injured
- injuries per 100 crashes

The injury-rate formula is:

```text
injury rate = (total injuries / crash count) * 100
```

Only hours with at least 20 crashes can qualify as the highest injury-rate hour. This helps prevent a rate based on a very small number of crashes from becoming the headline result.

## Visualization

The page includes a compact Data Story component that connects the context, data, method, finding, and why the result matters without calling an external AI service. Its numbers come from the same verified analysis used by the charts. Two aligned Chart.js bar charts provide the visual evidence without mixing different units on one scale. The first shows total injuries, and the second shows injuries per 100 crashes. Both keep all 24 hours visible, use a darker bar to identify the calculated leader, and provide exact values on hover.

The **Refresh Live Data** button makes a new API request, recalculates every hour, redraws the chart, updates the metric cards and timestamp, and reports whether either leading hour changed.

## Run locally

This project has no build step or installed dependencies. Because it fetches an external API, serve the folder with a simple local web server instead of opening `index.html` directly.

If Python is installed, open a terminal in this project folder and run:

```bash
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000) in a browser.

## Project files

- `index.html` contains the page structure and loads Chart.js.
- `styles.css` controls the layout, colors, and responsive design.
- `script.js` fetches, analyzes, and displays the live data.
- `README.md` explains the question, method, and local setup.
