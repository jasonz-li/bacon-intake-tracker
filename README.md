# 🥓 Bacon Intake Tracker

A free, no-account calorie and macro tracker in the spirit of MyFitnessPal. Your data stays in your browser. There's no server and no ads.

## Main features
- **Calorie goal.** Set it yourself, or use the built-in calculator (Mifflin-St Jeor + activity level + weekly weight goal).
- **Macro goals.** Set protein, carbs and fat as % of calories or as grams.
- **Food diary.** Breakfast, Lunch, Dinner and Snacks, with a running *Goal − Food + Exercise = Remaining* summary and progress bars for each macro.
- **Logging.** Four ways to log food:
  - **Search** the free [Open Food Facts](https://world.openfoodfacts.org) database, or type a barcode number
  - **Scan barcodes** with the camera (📷 next to "Add food"). It looks the product up in Open Food Facts and fills in the nutrition. Products you scan are remembered, so the next scan is instant and works offline. Unknown products only need entering once.
  - **Manual entry.** Calories can be left blank and are worked out from the macros.
  - **Quick add.** Just the numbers.

## Also included
- My Foods: foods you log are saved, so you can add them again in one tap
- Saved meals and "copy from yesterday"
- Exercise log with calorie estimates, which adds calories back to your day
- Daily notes
- Weight log with a trend chart
- 7-day calorie chart, 7-day macro averages and a logging streak
- Move between days to log the past or plan ahead
- Export and import a JSON backup
- Pick an accent color (presets or any custom color) and a light, dark or auto theme
- Enter height as 5'8", 5 8, 68 in, or cm
- Works offline and installs to your home screen as an app

## Run it
No build step. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

### Put it on your iPhone (free)
1. Host it: make the repo public, then go to **Settings → Pages**, choose "Deploy from a branch", pick the branch and `/ (root)`, and save. Private repos need GitHub Pro for Pages. If you'd rather keep it private, Netlify and Cloudflare Pages are free alternatives.
2. On the iPhone, open the Pages URL **in Safari**.
3. Tap **Share → Add to Home Screen**.
4. Open it from the home-screen icon. It runs full-screen like a normal app and works offline.

> Log your food from the home-screen app, not a Safari tab. iOS keeps them as separate storage, and Safari can clear website data that hasn't been used for a while. Use **Goals → Export backup** now and then.

Barcode scanning works on iPhone through the bundled [ZXing](https://github.com/zxing-js/library) decoder (Apache-2.0, `vendor/`).
