# 🥓 Bacon Intake Tracker

A free, no-account calorie and macro tracker in the spirit of MyFitnessPal. Your data stays in your browser. There's no server and no ads.

## Main features
- **Calorie goal.** Set it yourself, or use the built-in calculator (Mifflin-St Jeor + activity level + weekly weight goal).
- **Macro goals.** Set protein, carbs and fat as % of calories or as grams.
- **Food diary.** Breakfast, Lunch, Dinner and Snacks, with a running *Goal − Food + Exercise = Remaining* summary and progress bars for each macro.
- **Logging.** Four ways to log food:
  - **Search** the free [Open Food Facts](https://world.openfoodfacts.org) database, or type a barcode number
  - **Scan barcodes** with the camera, in browsers that support it (Chrome on Android)
  - **Manual entry.** Calories can be left blank and are worked out from the macros.
  - **Quick add.** Just the numbers.

## Also included
- My Foods: foods you log are saved, so you can add them again in one tap
- Saved meals and "copy from yesterday"
- Exercise log with calorie estimates, which adds calories back to your day
- Water tracker
- Daily notes
- Weight log with a trend chart
- 7-day calorie chart, 7-day macro averages and a logging streak
- Move between days to log the past or plan ahead
- Export and import a JSON backup
- Works offline, installs to your home screen as an app, and has dark mode

## Run it
No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

### Put it on your phone for free
Turn on **GitHub Pages** for this repo (Settings → Pages → deploy from branch, root folder). Open the URL on your phone and choose "Add to Home Screen".

> Data is stored per browser/device. Use **Goals → Export backup** to move it or keep it safe.
