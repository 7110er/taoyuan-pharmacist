/* ---------- v7.5.0 畫面用語整理：只改顯示文字，不動資料與計算 ----------
 * TX_RULES：系統句型（整句），任何位置都套用；TX_WORDS：短詞，只套用在標題、按鈕、說明列，不碰表格儲存格與文字回饋。
 * 各卡的計算說明與限制（.op-pre、.op-cl）集中到頁底「怎麼算、有什麼限制」。 */
var TX_RULES = [
  [/（?條號依 109 年草案，現行版本【未經查證】）?/g, ''], [/【未經查證】/g, ''], [/【分界未經查證】/g, '（分界暫定）'], [/【累積中】/g, '【件數仍少】'],
  [/只提示，不指派、不追蹤；規則與門檻見各卡「判讀前提」。/g, ''], [/只提示，不指派、不追蹤。?/g, ''],
  [/系統只顯示人工紀錄，不追蹤、不結案。?/g, ''], [/依登錄資料推估，是否執行由組長決定。?/g, ''], [/｜?依登錄資料推估，是否執行由組長決定/g, ''],
  [/（只標示，不下結論）/g, ''], [/只標示需要討論的事實，不下結論；/g, ''],
  [/（起始值，無文獻依據）/g, '（暫定）'], [/為建議書起始值，無文獻或院內規定依據/g, '為暫定值'],
  [/所有(門檻|界線)為起始值，無文獻或院內依據。?/g, '門檻為暫定值，將依累積資料調整。'], [/(門檻|界線)為起始值，無文獻或院內依據。?/g, '門檻為暫定值，將依累積資料調整。'],
  [/起始值，無文獻或院內依據/g, '暫定值'], [/起始設計、無院內依據/g, '暫定做法'], [/起始值/g, '暫定值'],
  [/（件數少，暫不算比率）/g, '（件數少，暫不算比率）'], [/（累積中）/g, '（未滿 5 件，暫不算比率）'],
  [/四個維度皆可篩選；列、欄、分面可自由切換（例如分面選「年份」即可跨年比較）。/g, '可依四個條件篩選；要跨年比較，請在「分組」選年份。'],
  [/四個維度皆可篩選；列、欄、分面可自由切換。/g, '可依四個條件篩選，也可切換列、欄與分組。'],
  [/（學生教學成效鏡像）|（組別教學成效鏡像，不含填答者姓名）|（教師教學成效鏡像，不含評量者姓名）/g, ''],
  [/資料：分析_學生成效/g, '資料來源：學生實習評核'], [/資料：分析_組別成效/g, '資料來源：教學單位評核'], [/資料：分析_教師成效/g, '資料來源：教師教學評核'],
  [/來源：後台「([^」]+)」圖/g, '資料來源：$1'], [/後台原始圖表/g, '原始統計圖'],
  [/第二層：完整指標、處理鏈、管制圖與對帳（原 M1–M5）/g, '詳細數字與趨勢圖'],
  [/｜?月報核對碼\s*[0-9a-f]{6,}/g, ''], [/（PcneAgg v[\d.]+）/g, ''], [/需 PcneAgg v[\d.]+ ?重算後顯示/g, '下次資料更新後顯示'], [/PcneAgg v[\d.]+/g, '資料更新'],
  [/處方優化病人比率/g, '處方改善病人比率'], [/改用表格檢視查看全部/g, '改用表格檢視全部'], [/對齊檢查/g, '對照檢查'],
  [/本月訊號與資料可信度/g, '本月要留意的變化與資料完整度'], [/評核進度（三態，依期程）/g, '評核進度：委員會已判定／教師已評、待委員會／尚未評核（依期程）'],
  [/團體 CBME 成效（正式 G01）/g, '本期應達能力的達標比率（委員會判定）'], [/G02 項目層配對轉移（CCC 對 CCC）/g, '同一位學員前後兩期的等級變化（皆為委員會判定）'],
  [/非公版期程/g, '非全國版期程'], [/公版/g, '全國版'], [/資料對帳/g, '數字核對'], [/只顯示彙總；/g, '只顯示統計數字；'],
  [/（僅供參照）/g, '（參考用）'], [/僅供參照/g, '參考用'], [/僅供參考/g, '參考用'], [/僅供解讀分母/g, '解讀分母用'], [/欄位新增於/g, '表單題目新增於'], [/欄位新增前/g, '表單改版前'], [/無此欄位/g, '無此題目'], [/、追蹤欄位/g, '、追蹤題目'], [/單位欄位/g, '單位資料'], [/核對碼與彙總時間/g, '資料更新時間'], [/月報核對碼/g, '資料版本碼'], [/，?不歸因個人/g, '，以流程檢討為主'], [/G05 驗證達標與再評量完成/g, '再評量完成且達標'], [/同期群/g, '同屆'], [/分面/g, '分組'], [/四個維度/g, '四個條件']
];
var TX_WORDS = [[/亮點規則說明/g, '標示規則說明'], [/深度照護亮點/g, '深度照護表現'], [/亮點/g, '表現突出'], [/同期群/g, '同屆'], [/同期參照/g, '同屆參照'], [/分面/g, '分組'], [/維度/g, '條件'], [/可顯示圖表/g, '選擇要看的圖表'], [/彙總/g, '統計'], [/後台/g, '系統'], [/訊號/g, '警示'], [/可信度/g, '完整度'], [/已成熟/g, '已登錄完成'], [/可初讀/g, '可初步判讀'], [/^累積中$/g, '仍在補登']];
var TX_SKIP = /^(TEXTAREA|INPUT|SCRIPT|STYLE|BLOCKQUOTE)$/;
function txSkip(n) { for (var p = n.parentNode; p && p.nodeType === 1; p = p.parentNode) { if (TX_SKIP.test(p.tagName)) return 1; if (p.classList && (p.classList.contains('ax-q') || p.classList.contains('ax-fbbody') || p.classList.contains('ilp-q'))) return 1; if (p.id === 'charts' || p.id === 'dashPanel') break; } return 0; }
function txInCell(n) { for (var p = n.parentNode; p && p.nodeType === 1; p = p.parentNode) { if (p.tagName === 'TD') return 1; if (p.id === 'charts' || p.id === 'dashPanel') break; } return 0; }
function txText(root) {
  root.normalize();
  var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, list = [];
  while ((n = w.nextNode())) if (/[一-鿿]/.test(n.nodeValue)) list.push(n);
  list.forEach(function (t) {
    if (txSkip(t)) return; var v = t.nodeValue, o = v;
    TX_RULES.forEach(function (r) { v = v.replace(r[0], r[1]); });
    if (!txInCell(t)) TX_WORDS.forEach(function (r) { v = v.replace(r[0], r[1]); });
    if (v !== o) t.nodeValue = v;
  });
  [].forEach.call(root.querySelectorAll('h2,h3,h4,.op-q,.ax-title'), function (h) {
    var f = h.firstChild; if (f && f.nodeType === 3) { var v = f.nodeValue.replace(/^\s*[MQ]\d+(-\d+)?\s*[｜|]\s*/, '').replace(/^\s*[MQ]\d+(-\d+)?\s+(?=[一-鿿])/, ''); if (v !== f.nodeValue) f.nodeValue = v; }
    var l = h.lastChild; if (l && l.nodeType === 3) { var u = l.nodeValue.replace(/（[A-Z]\d{1,2}）\s*$/, ''); if (u !== l.nodeValue) l.nodeValue = u; }
  });
  [].forEach.call(root.querySelectorAll('[title]'), function (e) { var v = e.title, o = v; TX_RULES.forEach(function (r) { v = v.replace(r[0], r[1]); }); if (v !== o) e.title = v; });
}
/* 各卡計算說明集中到頁底 */
function txMethod(root) {
  var ps = [].filter.call(root.querySelectorAll('.op-pre,.op-cl'), function (p) { return !p.closest('.tx-method'); });
  var old = root.querySelector('.tx-method');
  if (!ps.length) return;
  var d = old || (function () { var x = document.createElement('details'); x.className = 'chart ax-card tx-method'; x.appendChild(axEl('summary', 'ax-title', '怎麼算、有什麼限制')); var g = axEl('div', 'tx-mb'); x.appendChild(g); x.appendChild(axEl('p', 'tx-foot', '評鑑條號依 109 年評鑑基準草案整理，使用前請以現行基準核對。門檻為暫定值，將依累積資料調整。本頁提供討論參考，工作分派仍由組長決定。')); return x; })();
  var g = d.querySelector('.tx-mb'), seen = {};
  [].forEach.call(g.querySelectorAll('p'), function (p) { seen[p.textContent] = 1; });
  ps.forEach(function (p) {
    var card = p.closest('.op-card,.ax-card,section'), t = card && card.querySelector('.op-q,.ax-title,h3'), ttl = t ? t.textContent.replace(/\s+/g, ' ').trim() : '';
    var txt = p.textContent.replace(/^判讀前提：/, '').trim(); p.parentNode.removeChild(p);
    if (!txt || seen[ttl + txt]) return; seen[ttl + txt] = 1;
    var row = axEl('p', p.classList.contains('op-cl') ? 'tx-cl' : 'tx-pre'); if (ttl) row.appendChild(axEl('b', '', ttl + '：')); row.appendChild(document.createTextNode(txt)); g.appendChild(row);
  });
  root.appendChild(d);
}
var TX = { busy: false, t: 0 };
function txRun() { var root = document.getElementById('charts'), pan = document.getElementById('dashPanel') || root; if (!root || TX.busy) return; TX.busy = true; try { txText(pan); txMethod(root); } catch (e) { if (window.console) console.error(e); } TX.busy = false; }
function txInit() {
  var root = document.getElementById('dashPanel') || document.getElementById('charts'); if (!root || TX.obs) return;
  TX.obs = new MutationObserver(function () { if (TX.busy || TX.t) return; TX.t = setTimeout(function () { TX.t = 0; txRun(); }, 150); });
  TX.obs.observe(root, { childList: true, subtree: true, characterData: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', txInit); else txInit();
