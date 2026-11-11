# Suspect Family Tree

Investigation Camp का "Suspect Family Tree" module: एक independent React app जिसमें investigator किसी भी suspect का पूरा परिवार (पितृ पक्ष, मातृ पक्ष, पति/पत्नी की ससुराल) और दोस्त / सहयोगी network एक जगह बनाता, जोड़ता और export करता है।

यह app अकेले चलता है। बाद में इसे PHP site में `<script>` से जोड़ा जा सकता है और login PHP का ही रहेगा (नीचे देखें)।

## मुख्य features

- **Relation engine:** सिर्फ़ बुनियादी रिश्ते save होते हैं (माता-पिता, पति-पत्नी, भाई-बहन, सहयोगी)। चाचा, ताऊ, मामा, साढ़ू, ननदोई, समधी जैसे नाम app खुद निकालता है। किसी को भी focus बनाइए, सारे labels उसके हिसाब से बदल जाते हैं, इसलिए उल्टे रिश्ते (मामा ↔ भांजा) अपने आप बनते हैं।
- **Ghost nodes:** माँ का नाम पता नहीं और मामा जोड़ना है? बीच में "अज्ञात" माँ अपने आप बनती है। बाद में नाम भरें या असली व्यक्ति से merge करें।
- **4 भाषाओं में रिश्तों के नाम:** हिंदी, English, Urdu (roman), Punjabi (roman)। नई भाषा = `src/engine/labels.ts` में एक column।
- **Layout:** हर पीढ़ी एक row (G+3 … G-3), focus बीच में। Lanes: पितृ पक्ष · मातृ पक्ष · अपना परिवार · ससुराल · मित्र/सहयोगी · जुड़े नहीं। हर lane छोटी की जा सकती है। साथ में Network view।
- **जोड़ना आसान:**
  - Card पर hover → "+" ऊपर (माता/पिता), नीचे (संतान), बाएँ (भाई/बहन), दाएँ (पति/पत्नी), कोने में (दोस्त/सहयोगी)
  - Hinglish search: `mama`, `मामा`, `mother's brother`, `khala`, `sala`, `devar`…
  - एक card के handle से दूसरे card पर drag → "A, B का कौन है?" (या merge)
  - `Ctrl+K`: `Rahul का मामा जोड़ो`, `add sala to Rahul`, `Rahul और Vikas का रिश्ता`
  - Duplicate warning (नाम / mobile)
- **Investigation tools:** रिश्ता खोजें (path finder, canvas पर रास्ता highlight), हर रिश्ते पर confidence (पक्का / संभावित / शक) और source, role filters, अपराधी links लाल रंग में।
- **Export:** PDF / PNG (case header, "CONFIDENTIAL – LAW ENFORCEMENT" watermark, data SHA-256), JSON backup / import।
- **Undo / redo** (100 steps), हर बदलाव का audit log (History tab)।
- **Privacy:** Aadhaar के सिर्फ़ आख़िरी 4 अंक रखे जाते हैं। हर user का data अलग।

## चलाना

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # relation engine के unit tests
npm run build          # dist/ — host करने या PHP में embed करने के लिए
npm run build:single   # dist-single/index.html — एक ही file, offline demo
```

पहली बार खोलने पर एक काल्पनिक demo केस बनता है। सभी नाम काल्पनिक हैं।

## हर user का अलग data

- **बिना server के:** data browser के localStorage में `sft:<userId>:` namespace में रहता है, यानी एक user दूसरे user का data नहीं देखता।
- **Server के साथ:** `apiBase` देने पर सारा data PHP API से load/save होता है। API को हमेशा logged-in user के हिसाब से scope करना है।

कोई role / access-level system नहीं है: हर user अपने केस का पूरा मालिक है।

## PHP site में जोड़ना

1. `npm run build` चलाएँ और `dist/` को PHP site में किसी folder में रखें, जैसे `/family-tree/`।
2. PHP page (login के बाद वाला) में:

```php
<?php // $user = logged-in user (PHP session से) ?>
<div id="root" style="height: 100vh"></div>
<script>
  window.SFT_CONFIG = {
    userId: "<?= htmlspecialchars($user['id']) ?>",
    userName: "<?= htmlspecialchars($user['name']) ?>",
    apiBase: "/api/family-tree",         // optional; न दें तो data browser में रहेगा
    token: "<?= $jwt ?? '' ?>",          // optional; Authorization: Bearer <token>
    onUnauthorized: function () { location.href = '/login.php'; }
  };
</script>
<script type="module" src="/family-tree/assets/index-XXXX.js"></script>
<link rel="stylesheet" href="/family-tree/assets/index-XXXX.css">
```

(`XXXX` = `dist/index.html` में दिए file names।) App किसी दूसरे element में mount करना हो तो उस element पर `data-manual="1"` लगाएँ और `window.SuspectFamilyTree.mount(el, config)` call करें।

### API (PHP को ये 4 endpoints देने हैं)

हर request के साथ PHP session cookie जाती है (`credentials: 'include'`), और `token` दिया हो तो `Authorization: Bearer` header भी।

| Method | Path | Body / Response |
|---|---|---|
| GET | `{apiBase}/cases` | `[{id, title, firNo, updatedAt, personCount}]` (सिर्फ़ इस user के) |
| GET | `{apiBase}/cases/{id}` | पूरा `CaseFile` JSON |
| PUT | `{apiBase}/cases/{id}` | पूरा `CaseFile` JSON save करें |
| DELETE | `{apiBase}/cases/{id}` | 204 |

401 मिलने पर `onUnauthorized()` call होता है। `CaseFile` का format `src/types.ts` में है। सबसे आसान PHP storage: एक table `family_tree_cases (id, user_id, title, fir_no, data JSON, updated_at)`, और हर query में `WHERE user_id = :session_user`।

## Code की बनावट

| File | काम |
|---|---|
| `src/types.ts` | Person, Edge, CaseFile |
| `src/engine/relations.ts` | shortest-path relation engine, labels, हिंदी व्याकरण (का/की/के, साला → साले) |
| `src/engine/labels.ts` | path code → नाम (hi / en / ur / pa) |
| `src/engine/templates.ts` | "मामा = माता → भाई" जैसे 60+ templates, Hinglish search |
| `src/engine/ops.ts` | जोड़ना, ghost nodes, merge, validation (cycle, 2 से ज़्यादा biological parents) |
| `src/engine/layout.ts` | पीढ़ी × पक्ष layout, network layout |
| `src/storage.ts` | per-user local storage और PHP API adapter |
| `src/components/*` | canvas, cards, dialogs, side panel, command palette |
| `src/export.ts` | PDF / PNG / JSON |

Path code: F पिता, M माता, B भाई, Z बहन, S बेटा, D बेटी, H पति, W पत्नी; e/y = बड़ा/छोटा। जैसे `F.eB` = ताऊ, `W.Z.H` = साढ़ू।
