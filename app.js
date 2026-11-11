/* Bacon Intake Tracker — a free, local-first calorie & macro tracker. */
(() => {
  "use strict";

  // ---------- Storage ----------
  const KEY = "bacon-intake-v1";
  const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const defaults = () => ({
    goals: { calories: 2000, protein: 30, carbs: 40, fat: 30, macroMode: "pct" },
    profile: { unit: "imperial" },
    settings: { accent: "purple", custom: "#7c3aed", appearance: "auto" },
    days: {},
    foods: [],
    savedMeals: [],
    weights: [],
  });

  const load = (data) => {
    const s = Object.assign(defaults(), data || {});
    s.settings = Object.assign(defaults().settings, s.settings);
    return s;
  };
  let state;
  try {
    state = load(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    state = defaults();
  }
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast("Couldn't save — storage full?"); }
  };

  // ---------- Helpers ----------
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const r0 = (n) => Math.round(n);
  const r1 = (n) => Math.round(n * 10) / 10;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const iso = (d) => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0, 10); };
  const fromIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = fromIso(s); d.setDate(d.getDate() + n); return iso(d); };
  const today = () => iso(new Date());

  let current = today();

  const day = (date = current, create = false) => {
    let d = state.days[date];
    if (!d && create) {
      d = state.days[date] = { meals: Object.fromEntries(MEALS.map((m) => [m, []])), exercise: [], notes: "" };
    }
    return d || { meals: Object.fromEntries(MEALS.map((m) => [m, []])), exercise: [], notes: "" };
  };

  // Each entry: { id, name, serving, qty, cal, p, c, f } where cal/p/c/f are PER serving.
  const entryTotals = (e) => ({ cal: e.cal * e.qty, p: e.p * e.qty, c: e.c * e.qty, f: e.f * e.qty });
  const sum = (list) => list.reduce((a, e) => { const t = entryTotals(e); a.cal += t.cal; a.p += t.p; a.c += t.c; a.f += t.f; return a; }, { cal: 0, p: 0, c: 0, f: 0 });
  const dayTotals = (date) => sum(Object.values(day(date).meals).flat());
  const exerciseTotal = (date) => day(date).exercise.reduce((a, x) => a + num(x.cal), 0);
  const hasLog = (date) => { const d = state.days[date]; return !!d && (Object.values(d.meals).some((m) => m.length) || d.exercise.length > 0); };

  // Goals in grams regardless of mode
  const macroGrams = () => {
    const g = state.goals;
    if (g.macroMode === "pct") {
      return { p: (g.calories * g.protein) / 100 / 4, c: (g.calories * g.carbs) / 100 / 4, f: (g.calories * g.fat) / 100 / 9 };
    }
    return { p: g.protein, c: g.carbs, f: g.fat };
  };

  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2200);
  }

  // ---------- Navigation ----------
  $$(".tabbar button").forEach((b) =>
    b.addEventListener("click", () => {
      $$(".tabbar button").forEach((x) => x.classList.toggle("on", x === b));
      $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + b.dataset.view));
      $("#datenav").style.visibility = b.dataset.view === "diary" ? "visible" : "hidden";
      render();
      window.scrollTo(0, 0);
    })
  );

  $("#prevDay").onclick = () => { current = addDays(current, -1); render(); };
  $("#nextDay").onclick = () => { current = addDays(current, 1); render(); };
  $("#datePicker").onchange = (e) => { if (e.target.value) { current = e.target.value; render(); } };

  function dateLabel(s) {
    const t = today();
    if (s === t) return "Today";
    if (s === addDays(t, -1)) return "Yesterday";
    if (s === addDays(t, 1)) return "Tomorrow";
    return fromIso(s).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  // ---------- Diary ----------
  function renderDiary() {
    $("#dateLabel").textContent = dateLabel(current);
    $("#datePicker").value = current;
    const d = day();
    const tot = dayTotals(current);
    const ex = exerciseTotal(current);
    const goal = state.goals.calories;
    const remaining = goal - tot.cal + ex;

    $("#sumGoal").textContent = r0(goal);
    $("#sumFood").textContent = r0(tot.cal);
    $("#sumExercise").textContent = r0(ex);
    $("#sumRemaining").textContent = r0(remaining);
    $("#sumRemaining").parentElement.classList.toggle("over", remaining < 0);

    const budget = goal + ex;
    const pct = budget > 0 ? tot.cal / budget : 0;
    const ring = $("#calRing");
    ring.style.strokeDashoffset = 314.16 * (1 - Math.min(pct, 1));
    ring.classList.toggle("over", pct > 1);
    $("#ringPct").textContent = r0(pct * 100) + "%";

    const mg = macroGrams();
    const macros = [
      ["Protein", tot.p, mg.p, "var(--protein)"],
      ["Carbs", tot.c, mg.c, "var(--carbs)"],
      ["Fat", tot.f, mg.f, "var(--fat)"],
    ];
    $("#macroBars").innerHTML = macros
      .map(([name, have, want, color]) => {
        const left = want - have;
        const w = want > 0 ? Math.min(100, (have / want) * 100) : 0;
        return `<div class="macro ${left < 0 ? "over" : ""}">
          <div class="name"><span>${name}</span><span>${r0(have)}/${r0(want)}g</span></div>
          <div class="bar"><i style="width:${w}%;background:${color}"></i></div>
          <div class="left">${left >= 0 ? r0(left) + "g left" : r0(-left) + "g over"}</div>
        </div>`;
      })
      .join("");

    // Meals
    $("#meals").innerHTML = MEALS.map((m) => {
      const list = d.meals[m] || [];
      const t = sum(list);
      const items = list.length
        ? list.map((e) => {
            const et = entryTotals(e);
            return `<li data-meal="${m}" data-id="${e.id}">
              <div class="main" data-act="edit">
                <div class="title">${esc(e.name)}</div>
                <div class="sub">${e.serving || e.qty !== 1 ? (e.qty !== 1 ? r1(e.qty) + " × " : "") + esc(e.serving || "serving") + " · " : ""}P ${r1(et.p)} · C ${r1(et.c)} · F ${r1(et.f)}</div>
              </div>
              <span class="kcal">${r0(et.cal)}</span>
              <button class="del" data-act="del" aria-label="Remove">✕</button>
            </li>`;
          }).join("")
        : `<li class="empty">Nothing logged yet</li>`;
      return `<div class="card">
        <div class="card-head"><h2>${m}</h2><span class="muted">${r0(t.cal)} kcal</span></div>
        <ul class="entries">${items}</ul>
        <div class="row" style="justify-content:space-between;flex-wrap:wrap">
          <span><button class="add" data-add="${m}">+ Add food</button><button class="meal-scan" data-scan="${m}" aria-label="Scan barcode">📷</button></span>
          <span>
            <button class="link" data-copy="${m}">Copy from yesterday</button>
            ${list.length ? `<button class="link" data-savemeal="${m}">Save as meal</button>` : ""}
          </span>
        </div>
      </div>`;
    }).join("");

    // Exercise
    $("#exTotal").textContent = r0(ex) + " kcal";
    $("#exerciseList").innerHTML = d.exercise.length
      ? d.exercise.map((x) => `<li data-id="${x.id}">
          <div class="main"><div class="title">${esc(x.name)}</div><div class="sub">${x.min ? r0(x.min) + " min" : ""}</div></div>
          <span class="kcal">${r0(x.cal)}</span>
          <button class="del" data-act="delex" aria-label="Remove">✕</button>
        </li>`).join("")
      : `<li class="empty">No exercise logged</li>`;

    const notes = $("#dayNotes");
    if (document.activeElement !== notes) notes.value = d.notes || "";
  }

  $("#meals").addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.add) return openFoodDialog(t.dataset.add);
    if (t.dataset.scan) return openScanner(t.dataset.scan);
    if (t.dataset.copy) return copyMeal(t.dataset.copy);
    if (t.dataset.savemeal) return saveMeal(t.dataset.savemeal);
    const li = t.closest("li[data-id]");
    if (!li) return;
    const act = t.closest("[data-act]")?.dataset.act;
    const list = day(current, true).meals[li.dataset.meal];
    const idx = list.findIndex((x) => x.id === li.dataset.id);
    if (idx < 0) return;
    if (act === "del") {
      const [removed] = list.splice(idx, 1);
      save(); render();
      toast(`Removed ${removed.name}`);
    } else if (act === "edit") {
      const entry = list[idx];
      const q = prompt(`Servings of “${entry.name}” (${entry.serving || "serving"}):`, entry.qty);
      if (q === null) return;
      const n = num(q);
      if (n <= 0) list.splice(idx, 1); else entry.qty = n;
      save(); render();
    }
  });

  function copyMeal(meal) {
    const src = day(addDays(current, -1)).meals[meal] || [];
    if (!src.length) return toast(`Nothing in yesterday's ${meal.toLowerCase()}`);
    const dst = day(current, true).meals[meal];
    src.forEach((e) => dst.push({ ...e, id: uid() }));
    save(); render();
    toast(`Copied ${src.length} item(s)`);
  }

  function saveMeal(meal) {
    const list = day().meals[meal];
    const name = prompt("Name this meal:", `My ${meal.toLowerCase()}`);
    if (!name) return;
    state.savedMeals.push({ id: uid(), name, items: list.map((e) => ({ ...e })) });
    save(); render();
    toast("Meal saved");
  }

  $("#exerciseList").addEventListener("click", (e) => {
    if (e.target.dataset.act !== "delex") return;
    const id = e.target.closest("li").dataset.id;
    const d = day(current, true);
    d.exercise = d.exercise.filter((x) => x.id !== id);
    save(); render();
  });

  $("#dayNotes").addEventListener("input", (e) => { day(current, true).notes = e.target.value; save(); });

  // ---------- Add food dialog ----------
  const foodDlg = $("#foodDialog");
  let targetMeal = "Breakfast";

  function setFoodTab(tab) {
    $$("#foodTabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    $$("#foodDialog .tab").forEach((t) => (t.hidden = t.dataset.tab !== tab));
    if (tab === "mine") renderMine();
  }
  $$("#foodTabs button").forEach((b) => (b.onclick = () => setFoodTab(b.dataset.tab)));

  function openFoodDialog(meal) {
    targetMeal = meal;
    $("#foodDlgTitle").textContent = `Add to ${meal}`;
    clearManual();
    ["#qCal", "#qP", "#qC", "#qF"].forEach((s) => ($(s).value = ""));
    setFoodTab(state.foods.length || state.savedMeals.length ? "mine" : "search");
    foodDlg.showModal();
  }

  function addEntry(e, meal = targetMeal) {
    day(current, true).meals[meal].push({ id: uid(), name: e.name, serving: e.serving || "", qty: num(e.qty) || 1, cal: num(e.cal), p: num(e.p), c: num(e.c), f: num(e.f) });
    save(); render();
  }

  function rememberFood(f) {
    const key = (f.name + "|" + f.serving).toLowerCase();
    const existing = state.foods.find((x) => (x.name + "|" + x.serving).toLowerCase() === key);
    const data = { name: f.name, serving: f.serving || "", cal: num(f.cal), p: num(f.p), c: num(f.c), f: num(f.f) };
    if (f.barcode) {
      state.foods.forEach((x) => { if (x.barcode === f.barcode && x !== existing) delete x.barcode; });
      data.barcode = f.barcode;
    }
    if (existing) Object.assign(existing, data, { used: Date.now() });
    else state.foods.push({ id: uid(), ...data, used: Date.now() });
  }

  // Manual
  function clearManual() {
    ["#fName", "#fServing", "#fCal", "#fP", "#fC", "#fF"].forEach((s) => ($(s).value = ""));
    $("#fQty").value = 1;
    $("#fSave").checked = true;
    $("#fCalcHint").textContent = "";
    setBarcode(null);
  }
  let pendingBarcode = null;
  function setBarcode(code) {
    pendingBarcode = code || null;
    $("#fBarcode").hidden = !pendingBarcode;
    $("#fBarcode").textContent = pendingBarcode ? `Barcode ${pendingBarcode}. Saved with this food, so the next scan is instant.` : "";
  }
  function fillManual(f) {
    $("#fName").value = f.name || "";
    $("#fServing").value = f.serving || "";
    $("#fCal").value = f.cal != null ? r0(f.cal) : "";
    $("#fP").value = f.p != null ? r1(f.p) : "";
    $("#fC").value = f.c != null ? r1(f.c) : "";
    $("#fF").value = f.f != null ? r1(f.f) : "";
    $("#fQty").value = 1;
    setBarcode(f.barcode);
    updateCalcHint();
    setFoodTab("manual");
  }
  function updateCalcHint() {
    const est = num($("#fP").value) * 4 + num($("#fC").value) * 4 + num($("#fF").value) * 9;
    $("#fCalcHint").textContent = est > 0 ? `Macros add up to ~${r0(est)} kcal per serving${!$("#fCal").value ? " (used if calories left blank)" : ""}.` : "";
  }
  ["#fP", "#fC", "#fF", "#fCal"].forEach((s) => $(s).addEventListener("input", updateCalcHint));

  $("#fAdd").onclick = () => {
    const name = $("#fName").value.trim();
    if (!name) { $("#fName").focus(); return toast("Give it a name"); }
    const p = num($("#fP").value), c = num($("#fC").value), f = num($("#fF").value);
    const cal = $("#fCal").value !== "" ? num($("#fCal").value) : p * 4 + c * 4 + f * 9;
    const food = { name, serving: $("#fServing").value.trim(), cal, p, c, f, qty: num($("#fQty").value) || 1, barcode: pendingBarcode };
    if ($("#fSave").checked || pendingBarcode) rememberFood(food);
    addEntry(food);
    foodDlg.close();
    toast(`Added ${name}`);
  };

  // Quick add
  $("#qAdd").onclick = () => {
    const p = num($("#qP").value), c = num($("#qC").value), f = num($("#qF").value);
    const cal = $("#qCal").value !== "" ? num($("#qCal").value) : p * 4 + c * 4 + f * 9;
    if (!cal && !p && !c && !f) return toast("Enter at least one number");
    addEntry({ name: "Quick add", serving: "", cal, p, c, f, qty: 1 });
    foodDlg.close();
    toast(`Quick added ${r0(cal)} kcal`);
  };

  // My foods (in dialog)
  function renderMine() {
    const q = $("#mineFilter").value.trim().toLowerCase();
    const meals = state.savedMeals.filter((m) => m.name.toLowerCase().includes(q));
    const foods = [...state.foods].filter((f) => f.name.toLowerCase().includes(q)).sort((a, b) => (b.used || 0) - (a.used || 0));
    const mealHtml = meals.map((m) => {
      const t = sum(m.items);
      return `<li data-meal-id="${m.id}">
        <div class="main"><div class="title">🍽️ ${esc(m.name)}</div><div class="sub">${m.items.length} items · P ${r1(t.p)} · C ${r1(t.c)} · F ${r1(t.f)}</div></div>
        <span class="kcal">${r0(t.cal)}</span><button class="pick" type="button" data-act="meal">+</button></li>`;
    }).join("");
    const foodHtml = foods.map((f) => `<li data-food-id="${f.id}">
        <div class="main" data-act="custom"><div class="title">${esc(f.name)}</div><div class="sub">${esc(f.serving || "serving")} · P ${r1(f.p)} · C ${r1(f.c)} · F ${r1(f.f)}</div></div>
        <span class="kcal">${r0(f.cal)}</span><button class="pick" type="button" data-act="add">+</button></li>`).join("");
    $("#mineList").innerHTML = mealHtml + foodHtml || `<li class="empty">No saved foods yet. Search or add one manually.</li>`;
  }
  $("#mineFilter").addEventListener("input", renderMine);
  $("#mineList").addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    const li = e.target.closest("li");
    if (!act || !li) return;
    if (act === "meal") {
      const m = state.savedMeals.find((x) => x.id === li.dataset.mealId);
      m.items.forEach((it) => addEntry(it));
      foodDlg.close();
      return toast(`Added ${m.name}`);
    }
    const f = state.foods.find((x) => x.id === li.dataset.foodId);
    if (!f) return;
    if (act === "add") {
      f.used = Date.now();
      addEntry({ ...f, qty: 1 });
      foodDlg.close();
      toast(`Added ${f.name}`);
    } else {
      fillManual(f); // tweak servings before adding
    }
  });

  // Search (Open Food Facts)
  const OFF = "https://world.openfoodfacts.org";
  function offToFood(p) {
    const n = p.nutriments || {};
    const kcal = (k) => n[`energy-kcal_${k}`] ?? (n[`energy_${k}`] != null ? n[`energy_${k}`] / 4.184 : undefined);
    const name = [p.product_name || p.generic_name || "Unnamed", p.brands ? `(${p.brands.split(",")[0].trim()})` : ""].join(" ").trim();
    if (p.serving_size && kcal("serving") != null) {
      return { name, serving: p.serving_size, cal: kcal("serving"), p: n.proteins_serving || 0, c: n.carbohydrates_serving || 0, f: n.fat_serving || 0 };
    }
    return { name, serving: "100 g", cal: kcal("100g") || 0, p: n.proteins_100g || 0, c: n.carbohydrates_100g || 0, f: n.fat_100g || 0 };
  }
  let lastResults = [];
  async function doSearch() {
    const q = $("#searchInput").value.trim();
    if (!q) return;
    if (/^\d{8,14}$/.test(q)) return lookupBarcode(q, targetMeal);
    const out = $("#searchResults");
    out.innerHTML = `<li class="empty">Searching…</li>`;
    try {
      let products;
      if (/^\d{8,14}$/.test(q)) {
        const r = await fetch(`${OFF}/api/v2/product/${q}.json`);
        const j = await r.json();
        products = j.status === 1 ? [j.product] : [];
      } else {
        const r = await fetch(`${OFF}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=product_name,generic_name,brands,serving_size,nutriments`);
        const j = await r.json();
        products = j.products || [];
      }
      lastResults = products.map(offToFood).filter((f) => f.cal > 0 || f.p || f.c || f.f);
      out.innerHTML = lastResults.length
        ? lastResults.map((f, i) => `<li data-i="${i}">
            <div class="main" data-act="custom"><div class="title">${esc(f.name)}</div><div class="sub">${esc(f.serving)} · P ${r1(f.p)} · C ${r1(f.c)} · F ${r1(f.f)}</div></div>
            <span class="kcal">${r0(f.cal)}</span><button class="pick" type="button" data-act="add">+</button></li>`).join("")
        : `<li class="empty">No results. Try another term, or add it manually.</li>`;
    } catch {
      out.innerHTML = `<li class="empty">Search failed — check your connection, or add it manually.</li>`;
    }
  }
  $("#searchBtn").onclick = doSearch;
  $("#searchInput").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doSearch(); } });
  $("#searchResults").addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]")?.dataset.act;
    const li = e.target.closest("li[data-i]");
    if (!act || !li) return;
    const f = lastResults[li.dataset.i];
    if (act === "add") {
      rememberFood(f);
      addEntry({ ...f, qty: 1 });
      foodDlg.close();
      toast(`Added ${f.name}`);
    } else fillManual(f);
  });

  // Barcode → food. Checks your own saved foods first (works offline), then Open Food Facts.
  async function lookupBarcode(code, meal) {
    code = code.replace(/\D/g, "");
    if (!code) return;
    // UPC-A (12 digits) and EAN-13 with a leading 0 are the same product
    const same = (a, b) => a === b || a.padStart(13, "0") === b.padStart(13, "0");
    if (!foodDlg.open) openFoodDialog(meal);
    const mine = state.foods.find((f) => f.barcode && same(f.barcode, code));
    if (mine) { fillManual(mine); return toast("Found in My Foods"); }
    clearManual();
    setFoodTab("manual");
    setBarcode(code);
    $("#fName").placeholder = "Looking it up…";
    try {
      const r = await fetch(`${OFF}/api/v2/product/${code}.json?fields=product_name,generic_name,brands,serving_size,nutriments`);
      const j = await r.json();
      const food = j.status === 1 ? offToFood(j.product) : null;
      if (food && (food.cal > 0 || food.p || food.c || food.f)) {
        fillManual({ ...food, barcode: code });
        toast("Found it! Check the servings and add");
      } else {
        toast("Not in the database yet. Enter it once and it'll be remembered");
        $("#fName").focus();
      }
    } catch {
      toast("No connection. Enter it manually and it'll be remembered");
    } finally {
      $("#fName").placeholder = "";
    }
  }

  // Barcode scanner. Uses the built-in BarcodeDetector where it exists (Android Chrome),
  // otherwise the bundled ZXing decoder (iPhone Safari has no BarcodeDetector).
  const scanDlg = $("#scanDialog");
  let scanStream = null, scanMeal = "Breakfast", scanSession = 0;
  if (navigator.mediaDevices?.getUserMedia) $("#scanBtn").hidden = false;
  let zxingLoad = null;
  const loadZxing = () =>
    (zxingLoad ||= new Promise((ok, fail) => {
      const sc = document.createElement("script");
      sc.src = "vendor/zxing.min.js";
      sc.onload = () => ok(window.ZXing);
      sc.onerror = () => { zxingLoad = null; fail(new Error("zxing")); };
      document.head.appendChild(sc);
    }));
  async function makeDecoder() {
    if ("BarcodeDetector" in window) {
      try {
        const d = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
        return async (v) => (await d.detect(v))[0]?.rawValue;
      } catch {}
    }
    const Z = await loadZxing();
    const hints = new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]], [Z.DecodeHintType.TRY_HARDER, true]]);
    const reader = new Z.MultiFormatReader();
    reader.setHints(hints);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    return async (v) => {
      if (!v.videoWidth) return;
      // Decode only the middle band of the picture (where the frame is), which is faster and more reliable.
      const sw = v.videoWidth, sh = Math.round(v.videoHeight * 0.5), sy = Math.round(v.videoHeight * 0.25);
      const scale = Math.min(1, 1000 / sw);
      canvas.width = sw * scale; canvas.height = sh * scale;
      ctx.drawImage(v, 0, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      try {
        const bmp = new Z.BinaryBitmap(new Z.HybridBinarizer(new Z.HTMLCanvasElementLuminanceSource(canvas)));
        return reader.decodeWithState(bmp).getText();
      } catch { return undefined; } finally { reader.reset(); }
    };
  }
  async function openScanner(meal) {
    scanMeal = meal || defaultMeal();
    $("#scanCode").value = "";
    $("#scanStatus").textContent = "Starting camera…";
    scanDlg.showModal();
    const session = ++scanSession;
    try {
      const [decode, stream] = await Promise.all([
        makeDecoder(),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false }),
      ]);
      if (session !== scanSession || !scanDlg.open) { stream.getTracks().forEach((t) => t.stop()); return; }
      scanStream = stream;
      const v = $("#scanVideo");
      v.setAttribute("playsinline", ""); // required on iOS or the video goes fullscreen
      v.srcObject = stream; await v.play();
      $("#scanStatus").textContent = "Line up the barcode inside the box";
      const tick = async () => {
        if (session !== scanSession || !scanStream) return;
        const code = await decode(v).catch(() => undefined);
        if (code && session === scanSession) {
          if (navigator.vibrate) navigator.vibrate(60);
          closeScanner();
          return lookupBarcode(code, scanMeal);
        }
        setTimeout(tick, 100);
      };
      tick();
    } catch {
      $("#scanStatus").textContent = "Camera unavailable. Allow camera access in Settings → Safari, or type the number below.";
    }
  }
  function stopScan() {
    scanSession++;
    if (scanStream) scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
    $("#scanVideo").srcObject = null;
  }
  function closeScanner() { stopScan(); if (scanDlg.open) scanDlg.close(); }
  scanDlg.addEventListener("close", stopScan);
  $("#scanCancel").onclick = closeScanner;
  $("#scanBtn").onclick = () => openScanner(targetMeal);
  $("#scanManual").onsubmit = (e) => {
    e.preventDefault();
    const code = $("#scanCode").value.replace(/\D/g, "");
    if (code.length < 6) return toast("That doesn't look like a barcode");
    closeScanner();
    lookupBarcode(code, scanMeal);
  };

  // ---------- Exercise dialog ----------
  // MET values; kcal = MET * kg * hours
  const EX = { Walking: 3.5, "Walking (brisk)": 4.3, Running: 9.8, Cycling: 7.5, Swimming: 7, "Weight lifting": 5, HIIT: 8, Yoga: 2.5, Hiking: 6, Elliptical: 5, Rowing: 7, Dancing: 5, Basketball: 6.5, Soccer: 7 };
  $("#exPresets").innerHTML = Object.keys(EX).map((k) => `<option value="${k}">`).join("");
  const exDlg = $("#exDialog");
  $("#addExercise").onclick = () => { $("#exForm").reset(); exDlg.showModal(); };
  const latestKg = () => {
    const w = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).pop();
    return w ? w.kg : 75;
  };
  function estimateEx() {
    const met = EX[$("#exName").value];
    const min = num($("#exMin").value);
    if (met && min) {
      $("#exCal").value = r0(met * latestKg() * (min / 60));
      $("#exHint").textContent = `Estimated from your latest weight. Edit if your watch says otherwise.`;
    }
  }
  $("#exName").addEventListener("input", estimateEx);
  $("#exMin").addEventListener("input", estimateEx);
  $("#exAdd").onclick = () => {
    const name = $("#exName").value.trim() || "Exercise";
    const cal = num($("#exCal").value);
    if (!cal) return toast("Enter calories burned");
    day(current, true).exercise.push({ id: uid(), name, min: num($("#exMin").value), cal });
    save(); exDlg.close(); render();
  };

  // ---------- Foods view ----------
  $("#newFoodBtn").onclick = () => {
    openFoodDialog(defaultMeal());
    clearManual();
    setFoodTab("manual");
  };
  function defaultMeal() {
    const h = new Date().getHours();
    return h < 11 ? "Breakfast" : h < 15 ? "Lunch" : h < 21 ? "Dinner" : "Snacks";
  }
  function renderFoods() {
    const q = $("#myFoodsFilter").value.trim().toLowerCase();
    const foods = state.foods.filter((f) => f.name.toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    $("#myFoodsList").innerHTML = foods.length
      ? foods.map((f) => `<li data-id="${f.id}">
          <div class="main"><div class="title">${esc(f.name)}</div><div class="sub">${esc(f.serving || "serving")} · P ${r1(f.p)} · C ${r1(f.c)} · F ${r1(f.f)}</div></div>
          <span class="kcal">${r0(f.cal)}</span><button class="del" data-act="delfood" aria-label="Delete">✕</button></li>`).join("")
      : `<li class="empty">Foods you add or search get saved here.</li>`;
    $("#myMealsList").innerHTML = state.savedMeals.length
      ? state.savedMeals.map((m) => {
          const t = sum(m.items);
          return `<li data-id="${m.id}"><div class="main"><div class="title">${esc(m.name)}</div><div class="sub">${m.items.map((i) => esc(i.name)).join(", ")}</div></div>
            <span class="kcal">${r0(t.cal)}</span><button class="del" data-act="delmeal" aria-label="Delete">✕</button></li>`;
        }).join("")
      : `<li class="empty">No saved meals yet.</li>`;
  }
  $("#myFoodsFilter").addEventListener("input", renderFoods);
  $("#myFoodsList").addEventListener("click", (e) => {
    if (e.target.dataset.act !== "delfood") return;
    const id = e.target.closest("li").dataset.id;
    state.foods = state.foods.filter((f) => f.id !== id);
    save(); renderFoods();
  });
  $("#myMealsList").addEventListener("click", (e) => {
    if (e.target.dataset.act !== "delmeal") return;
    const id = e.target.closest("li").dataset.id;
    state.savedMeals = state.savedMeals.filter((m) => m.id !== id);
    save(); renderFoods();
  });

  // ---------- Progress ----------
  const isMetric = () => state.profile.unit === "metric";
  const toDisp = (kg) => (isMetric() ? kg : kg * 2.20462);
  const fromDisp = (v) => (isMetric() ? v : v / 2.20462);
  const wUnit = () => (isMetric() ? "kg" : "lb");

  function barChart(values, labels, goal) {
    const W = 320, H = 160, pad = 22, bw = (W - pad * 2) / values.length;
    const max = Math.max(goal * 1.2, ...values, 1);
    const y = (v) => H - pad - (v / max) * (H - pad * 2);
    const bars = values.map((v, i) => {
      const x = pad + i * bw + bw * 0.18;
      return `<rect class="bar ${v > goal ? "over" : ""}" x="${x}" y="${y(v)}" width="${bw * 0.64}" height="${H - pad - y(v)}" rx="3"><title>${r0(v)} kcal</title></rect>
        <text x="${x + bw * 0.32}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>
        ${v ? `<text x="${x + bw * 0.32}" y="${y(v) - 3}" text-anchor="middle">${r0(v)}</text>` : ""}`;
    }).join("");
    return `<svg viewBox="0 0 ${W} ${H}">${bars}<line class="goal-line" x1="${pad}" x2="${W - pad}" y1="${y(goal)}" y2="${y(goal)}"/><text x="${W - pad}" y="${y(goal) - 3}" text-anchor="end">goal</text></svg>`;
  }

  function lineChart(points) {
    const W = 320, H = 150, pad = 26;
    if (points.length < 2) return `<p class="empty">Log at least two weigh-ins to see a trend.</p>`;
    const vals = points.map((p) => p.v);
    const min = Math.min(...vals), max = Math.max(...vals);
    const span = max - min || 1;
    const t0 = fromIso(points[0].date).getTime(), t1 = fromIso(points[points.length - 1].date).getTime();
    const x = (d) => pad + ((fromIso(d).getTime() - t0) / (t1 - t0 || 1)) * (W - pad * 2);
    const y = (v) => H - pad - ((v - min) / span) * (H - pad * 2);
    const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.date)},${y(p.v)}`).join(" ");
    const dots = points.map((p) => `<circle class="dot" cx="${x(p.date)}" cy="${y(p.v)}" r="3"><title>${p.date}: ${r1(p.v)}</title></circle>`).join("");
    return `<svg viewBox="0 0 ${W} ${H}"><path class="line" d="${path}"/>${dots}
      <text x="4" y="${y(max) + 4}">${r1(max)}</text><text x="4" y="${y(min) + 4}">${r1(min)}</text>
      <text x="${pad}" y="${H - 6}">${fromIso(points[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>
      <text x="${W - pad}" y="${H - 6}" text-anchor="end">${fromIso(points[points.length - 1].date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text></svg>`;
  }

  function renderProgress() {
    const t = today();
    const dates = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));
    const totals = dates.map(dayTotals);
    const cals = totals.map((x) => x.cal);
    const labels = dates.map((d) => fromIso(d).toLocaleDateString(undefined, { weekday: "narrow" }));
    $("#calChart").innerHTML = barChart(cals, labels, state.goals.calories);
    const logged = dates.filter(hasLog);
    const avg = (k) => logged.length ? totals.filter((_, i) => hasLog(dates[i])).reduce((a, x) => a + x[k], 0) / logged.length : 0;
    $("#avgCal").textContent = logged.length ? `avg ${r0(avg("cal"))} kcal` : "";

    const mg = macroGrams();
    $("#macroAvg").innerHTML = logged.length
      ? [["Protein", avg("p"), mg.p, "var(--protein)"], ["Carbs", avg("c"), mg.c, "var(--carbs)"], ["Fat", avg("f"), mg.f, "var(--fat)"]]
          .map(([n, have, want, col]) => `<div class="macro" style="margin-bottom:10px"><div class="name"><span>${n}</span><span>${r0(have)} / ${r0(want)} g</span></div>
            <div class="bar"><i style="width:${want ? Math.min(100, (have / want) * 100) : 0}%;background:${col}"></i></div></div>`).join("")
      : `<p class="empty">Log some food to see averages.</p>`;

    // Weight
    $("#weightUnitLabel").textContent = wUnit();
    const ws = [...state.weights].sort((a, b) => a.date.localeCompare(b.date));
    $("#weightChart").innerHTML = lineChart(ws.map((w) => ({ date: w.date, v: toDisp(w.kg) })));
    if (ws.length >= 2) {
      const d = toDisp(ws[ws.length - 1].kg) - toDisp(ws[0].kg);
      $("#weightDelta").textContent = `${d > 0 ? "+" : ""}${r1(d)} ${wUnit()} total`;
    } else $("#weightDelta").textContent = "";
    $("#weightList").innerHTML = ws.slice(-10).reverse().map((w) => `<li data-date="${w.date}">
      <div class="main"><div class="title">${r1(toDisp(w.kg))} ${wUnit()}</div><div class="sub">${dateLabel(w.date)}</div></div>
      <button class="del" data-act="delw" aria-label="Delete">✕</button></li>`).join("");

    // Streak
    let s = 0, d = hasLog(t) ? t : addDays(t, -1);
    while (hasLog(d)) { s++; d = addDays(d, -1); }
    $("#streak").textContent = s;
  }
  $("#weightForm").onsubmit = (e) => {
    e.preventDefault();
    const v = num($("#weightInput").value);
    if (v <= 0) return;
    const date = today();
    state.weights = state.weights.filter((w) => w.date !== date);
    state.weights.push({ date, kg: fromDisp(v) });
    $("#weightInput").value = "";
    save(); renderProgress();
    toast("Weight logged");
  };
  $("#weightList").addEventListener("click", (e) => {
    if (e.target.dataset.act !== "delw") return;
    const date = e.target.closest("li").dataset.date;
    state.weights = state.weights.filter((w) => w.date !== date);
    save(); renderProgress();
  });

  // ---------- Goals ----------
  function renderGoals() {
    const g = state.goals;
    $("#goalCalories").value = g.calories;
    $("#goalProtein").value = r0(g.protein);
    $("#goalCarbs").value = r0(g.carbs);
    $("#goalFat").value = r0(g.fat);
    $$("#macroMode button").forEach((b) => b.classList.toggle("on", b.dataset.mode === g.macroMode));
    updateGoalHints();
    const u = state.profile.unit;
    $$("#unitSeg button").forEach((b) => b.classList.toggle("on", b.dataset.unit === u));
    $("#cWeightUnit").textContent = u === "metric" ? "kg" : "lb";
    $("#cHeight").placeholder = u === "metric" ? "e.g. 173" : `e.g. 5'8"`;
    $("#cHeight").inputMode = u === "metric" ? "decimal" : "text";
    const pr = state.profile;
    if (pr.sex) $("#cSex").value = pr.sex;
    if (pr.age) $("#cAge").value = pr.age;
    if (pr.activity) $("#cActivity").value = pr.activity;
    if (pr.goal) $("#cGoal").value = pr.goal;
    if (pr.heightCm && document.activeElement !== $("#cHeight")) $("#cHeight").value = u === "metric" ? r0(pr.heightCm) : fmtFtIn(pr.heightCm / 2.54);
    updateHeightHint();
    renderAppearance();
    if (!$("#cWeight").value) {
      const w = [...state.weights].sort((a, b) => a.date.localeCompare(b.date)).pop();
      if (w) $("#cWeight").value = r1(toDisp(w.kg));
    }
  }
  const curMode = () => $("#macroMode button.on").dataset.mode;
  function updateGoalHints() {
    const mode = curMode();
    const cal = num($("#goalCalories").value);
    const P = num($("#goalProtein").value), C = num($("#goalCarbs").value), F = num($("#goalFat").value);
    if (mode === "pct") {
      $("#hintP").textContent = `% · ${r0((cal * P) / 400)}g`;
      $("#hintC").textContent = `% · ${r0((cal * C) / 400)}g`;
      $("#hintF").textContent = `% · ${r0((cal * F) / 900)}g`;
      const tot = P + C + F;
      $("#pctCheck").textContent = tot === 100 ? "✓ Adds up to 100%" : `Adds up to ${r0(tot)}% — should be 100%`;
    } else {
      $("#hintP").textContent = "g";
      $("#hintC").textContent = "g";
      $("#hintF").textContent = "g";
      const kc = P * 4 + C * 4 + F * 9;
      $("#pctCheck").textContent = `Macros = ${r0(kc)} kcal (${cal ? r0((kc / cal) * 100) : 0}% of goal)`;
    }
  }
  ["#goalCalories", "#goalProtein", "#goalCarbs", "#goalFat"].forEach((s) => $(s).addEventListener("input", updateGoalHints));
  $$("#macroMode button").forEach((b) =>
    (b.onclick = () => {
      if (b.classList.contains("on")) return;
      // convert values between % and g so switching doesn't lose the plan
      const cal = num($("#goalCalories").value) || 1;
      const P = num($("#goalProtein").value), C = num($("#goalCarbs").value), F = num($("#goalFat").value);
      if (b.dataset.mode === "g") {
        $("#goalProtein").value = r0((cal * P) / 400); $("#goalCarbs").value = r0((cal * C) / 400); $("#goalFat").value = r0((cal * F) / 900);
      } else {
        $("#goalProtein").value = r0((P * 400) / cal); $("#goalCarbs").value = r0((C * 400) / cal); $("#goalFat").value = r0((F * 900) / cal);
      }
      $$("#macroMode button").forEach((x) => x.classList.toggle("on", x === b));
      updateGoalHints();
    })
  );
  $("#goalsForm").onsubmit = (e) => {
    e.preventDefault();
    const mode = curMode();
    const P = num($("#goalProtein").value), C = num($("#goalCarbs").value), F = num($("#goalFat").value);
    if (mode === "pct" && r0(P + C + F) !== 100) return toast("Macro % must add up to 100");
    state.goals = { calories: num($("#goalCalories").value), protein: P, carbs: C, fat: F, macroMode: mode };
    save(); render();
    toast("Goals saved");
  };

  $$("#unitSeg button").forEach((b) =>
    (b.onclick = () => {
      if (b.dataset.unit === state.profile.unit) return;
      const toMetric = b.dataset.unit === "metric";
      const w = num($("#cWeight").value), cm = heightCm();
      if (w) $("#cWeight").value = r1(toMetric ? w / 2.20462 : w * 2.20462);
      if (cm) $("#cHeight").value = toMetric ? r0(cm) : fmtFtIn(cm / 2.54);
      state.profile.unit = b.dataset.unit;
      save(); renderGoals();
    })
  );
  $("#calcForm").onsubmit = (e) => {
    e.preventDefault();
    const metric = isMetric();
    const kg = metric ? num($("#cWeight").value) : num($("#cWeight").value) / 2.20462;
    const cm = heightCm();
    if (!cm || cm < 90 || cm > 250) { $("#cHeight").focus(); return toast(metric ? "Enter height in cm" : `Enter height like 5'8"`); }
    const age = num($("#cAge").value), sex = $("#cSex").value;
    const act = num($("#cActivity").value), adj = num($("#cGoal").value);
    const bmr = 10 * kg + 6.25 * cm - 5 * age + (sex === "m" ? 5 : -161);
    const tdee = bmr * act;
    const floor = sex === "m" ? 1500 : 1200;
    const target = Math.max(floor, r0((tdee + adj) / 10) * 10);
    Object.assign(state.profile, { sex, age, activity: $("#cActivity").value, goal: $("#cGoal").value, heightCm: cm });
    save();
    const res = $("#calcResult");
    res.hidden = false;
    res.innerHTML = `<div>Maintenance: ~${r0(tdee)} kcal/day</div>
      <div>Your target: <strong>${target}</strong> kcal/day</div>
      ${target === floor && tdee + adj < floor ? `<div class="muted small">Capped at a ${floor} kcal minimum.</div>` : ""}
      <button type="button" class="btn small" id="useCalc" style="margin-top:8px">Use as my goal</button>`;
    $("#useCalc").onclick = () => {
      $("#goalCalories").value = target;
      updateGoalHints();
      $("#goalsForm").requestSubmit();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  };

  // Height: accepts 5'8, 5'8", 5’8”, 5 8, 5ft 8in, 5.8 (as 5'8"), 68 (inches), 5.5ft
  function parseFtIn(str) {
    let s = String(str).trim().toLowerCase()
      .replace(/[’‘′`´]/g, "'").replace(/[”“″]/g, '"').replace(/''/g, '"')
      .replace(/\s+/g, " ");
    if (!s) return null;
    let m;
    if ((m = s.match(/^(\d+(?:\.\d+)?) ?(?:ft|feet|foot|f)$/))) return +m[1] * 12;
    if ((m = s.match(/^(\d+(?:\.\d+)?) ?(?:"|in|inch|inches)$/))) return +m[1];
    if ((m = s.match(/^(\d+) ?(?:'|ft|feet|foot|f)[ ,]?(?:(\d+(?:\.\d+)?) ?(?:"|in|inch|inches)?)?$/))) return +m[1] * 12 + (+m[2] || 0);
    if ((m = s.match(/^(\d) ?[ .,\-/] ?(\d{1,2})$/)) && +m[2] < 12) return +m[1] * 12 + +m[2];
    if ((m = s.match(/^\d+(?:\.\d+)?$/))) { const n = +s; return n < 9 ? n * 12 : n; }
    return null;
  }
  function fmtFtIn(inches) {
    let ft = Math.floor(inches / 12), i = Math.round(inches - ft * 12);
    if (i === 12) { ft++; i = 0; }
    return `${ft}'${i}"`;
  }
  function heightCm() {
    const v = $("#cHeight").value;
    if (isMetric()) return num(v) || null;
    const i = parseFtIn(v);
    return i ? i * 2.54 : null;
  }
  function updateHeightHint() {
    const cm = heightCm();
    $("#cHeightUnit").textContent = !cm ? (isMetric() ? "cm" : "ft / in") : isMetric() ? fmtFtIn(cm / 2.54) : `${fmtFtIn(cm / 2.54)} · ${r0(cm)} cm`;
  }
  $("#cHeight").addEventListener("input", updateHeightHint);
  $("#cHeight").addEventListener("blur", () => {
    const cm = heightCm();
    if (cm && !isMetric()) $("#cHeight").value = fmtFtIn(cm / 2.54);
  });

  // ---------- Appearance ----------
  const ACCENTS = {
    purple: ["#7c3aed", "#a78bfa"],
    indigo: ["#4f46e5", "#818cf8"],
    pink: ["#db2777", "#f472b6"],
    blue: ["#2563eb", "#60a5fa"],
    teal: ["#0f766e", "#2dd4bf"],
    green: ["#15803d", "#4ade80"],
    orange: ["#ea580c", "#fb923c"],
  };
  const hexRgb = (h) => { h = h.replace("#", ""); if (h.length === 3) h = [...h].map((c) => c + c).join(""); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const rgbHex = (a) => "#" + a.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
  const mix = (h, to, t) => { const a = hexRgb(h), b = hexRgb(to); return rgbHex(a.map((x, i) => x + (b[i] - x) * t)); };
  const lum = (h) => { const [r, g, b] = hexRgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Darken a color until white text on it is readable
  const readableOnWhite = (h) => { let c = h; for (let i = 0; i < 12 && contrast(c, "#ffffff") < 4.5; i++) c = mix(c, "#000000", 0.08); return c; };

  function applyTheme() {
    const st = state.settings;
    let [light, dark] = st.accent === "custom" ? [st.custom, mix(st.custom, "#ffffff", 0.35)] : ACCENTS[st.accent] || ACCENTS.purple;
    light = readableOnWhite(light);
    const top = mix(light, "#000000", 0.12), topDark = mix(light, "#000000", 0.62);
    const root = document.documentElement.style;
    root.setProperty("--brand-l", light);
    root.setProperty("--brand-d", dark);
    root.setProperty("--top-l", top);
    root.setProperty("--top-d", topDark);
    root.setProperty("--on-l", "#ffffff");
    root.setProperty("--on-d", contrast(dark, "#ffffff") >= 4.5 ? "#ffffff" : mix(dark, "#000000", 0.82));
    if (st.appearance === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", st.appearance);
    const isDark = st.appearance === "dark" || (st.appearance === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.querySelector('meta[name="theme-color"]').setAttribute("content", isDark ? topDark : top);
  }
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applyTheme);

  function renderAppearance() {
    const st = state.settings;
    $("#swatches").innerHTML =
      Object.entries(ACCENTS).map(([k, [c]]) => `<button type="button" class="swatch ${st.accent === k ? "on" : ""}" data-accent="${k}" style="background:${c}" aria-label="${k}"></button>`).join("") +
      `<label class="swatch custom ${st.accent === "custom" ? "on" : ""}" ${st.accent === "custom" ? `style="background:${st.custom}"` : ""} aria-label="Custom color"><input type="color" id="customColor" value="${st.custom}" /></label>`;
    $$("#appearanceSeg button").forEach((b) => b.classList.toggle("on", b.dataset.appearance === st.appearance));
  }
  $("#swatches").addEventListener("click", (e) => {
    const k = e.target.dataset.accent;
    if (!k) return;
    state.settings.accent = k;
    save(); applyTheme(); renderAppearance();
  });
  $("#swatches").addEventListener("input", (e) => {
    if (e.target.id !== "customColor") return;
    state.settings.accent = "custom";
    state.settings.custom = e.target.value;
    applyTheme();
    e.target.parentElement.style.background = e.target.value;
    $$(".swatch").forEach((s) => s.classList.toggle("on", s.classList.contains("custom")));
  });
  $("#swatches").addEventListener("change", (e) => { if (e.target.id === "customColor") save(); });
  $$("#appearanceSeg button").forEach((b) => (b.onclick = () => { state.settings.appearance = b.dataset.appearance; save(); applyTheme(); renderAppearance(); }));

  // Data
  $("#exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bacon-intake-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $("#importFile").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || typeof data !== "object" || !data.goals || !data.days) throw new Error();
      if (!confirm("Replace all current data with this backup?")) return;
      state = load(data);
      save(); applyTheme(); render();
      toast("Backup restored");
    } catch { toast("That file isn't a valid backup"); }
    e.target.value = "";
  };
  $("#resetBtn").onclick = () => {
    if (!confirm("Erase ALL your data? This can't be undone.")) return;
    state = defaults();
    save(); applyTheme(); render();
    toast("All data erased");
  };

  // Dialogs: ✕ closes, tapping the dark area outside closes, and pressing Enter in a field doesn't close them
  $$("[data-close]").forEach((b) => (b.onclick = () => b.closest("dialog").close()));
  $$("form.dlg").forEach((f) => f.addEventListener("submit", (e) => e.preventDefault()));
  [foodDlg, exDlg].forEach((d) =>
    d.addEventListener("click", (e) => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) d.close();
    })
  );

  // ---------- Render ----------
  function render() {
    const view = $(".view.active").id;
    if (view === "view-diary") renderDiary();
    else if (view === "view-foods") renderFoods();
    else if (view === "view-progress") renderProgress();
    else if (view === "view-goals") renderGoals();
  }

  // Roll over to the new day if the app is left open past midnight
  let lastToday = today();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && today() !== lastToday) {
      if (current === lastToday) current = today();
      lastToday = today();
      render();
    }
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});

  applyTheme();
  render();
})();
