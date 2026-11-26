/* ---------- v7.4.8 臨床藥學服務：共用（病房月彙總、排序、季會決議、佐證卡主責病房） ---------- */
function opMqNotWard(u) { return !u || /^(不適用|未填)/.test(u); }
function opMqW(M, ym) {
if (!OP.mqWC || OP.mqWC.M !== M) OP.mqWC = { M: M, c: {}, j: {} };
var C = OP.mqWC.c; if (C[ym]) return C[ym];
var cur = mqD(M, [ym], 'all:全院', '病房'), st = pcMon(M, ym, '病房×狀態'), L = pcMon(M, ym, '病房×登錄者'), out = {}, who = {}, fte = {}, logged = {};
Object.keys(L).forEach(function (k) { var i = k.indexOf('｜'), u = k.slice(0, i), w = k.slice(i + 1); if (i < 0 || !L[k].n || opMqNotWard(u) || !w || /^（空白）/.test(w)) return; (who[w] = who[w] || {})[u] = (who[w][u] || 0) + L[k].n; });
Object.keys(who).forEach(function (w) { var ws = Object.keys(who[w]); ws.forEach(function (u) { fte[u] = (fte[u] || 0) + 1 / ws.length; logged[u] = (logged[u] || 0) + who[w][u]; }); });
Object.keys(cur).forEach(function (u) {
if (opMqNotWard(u)) return; var o = cur[u], dc = mqD(M, [ym], 'ward:' + u, '藥品類別'), hr = 0;
Object.keys(dc).forEach(function (c) { if (c !== '未涉及字典藥品') hr += dc[c].n; });
out[u] = { n: o.n, fte: fte[u] || 0, blank: Math.max(0, o.n - (logged[u] || 0)), hr: hr, rej: (o.G && o.G.A2) || 0, o3: st[u + '｜O3'] ? st[u + '｜O3'].n : 0 };
});
Object.keys(fte).forEach(function (u) { if (!out[u]) out[u] = { n: 0, fte: fte[u], blank: 0, hr: 0, rej: 0, o3: 0 }; });
return (C[ym] = out);
}
function opMqWards(M, yms) {
var MS = mqMonths(M), set = {};
yms.forEach(function (ym) { mqBack(ym, 12).concat([ym]).forEach(function (y) { if (MS.all.indexOf(y) >= 0) Object.keys(opMqW(M, y)).forEach(function (u) { set[u] = 1; }); }); });
return Object.keys(set).sort(function (a, b) { return a.localeCompare(b, 'en', { numeric: true }); });
}
/* 排序：keys 由大到小；第 1 鍵差距 ≤tol 且其餘鍵相同 → 並列（依病房代碼顯示） */
function opMqSort(list, keys, tol) {
var cmp = function (a, b) { for (var i = 0; i < keys.length; i++) { var d = keys[i](b) - keys[i](a); if (Math.abs(d) > 1e-9) return d; } return a.u.localeCompare(b.u, 'en', { numeric: true }); };
list.sort(cmp);
var same = function (a, b) { if (Math.abs(keys[0](a) - keys[0](b)) > tol + 1e-9) return false; for (var i = 1; i < keys.length; i++) if (Math.abs(keys[i](a) - keys[i](b)) > 1e-9) return false; return true; };
var i = 0; while (i < list.length) { var j = i; while (j + 1 < list.length && same(list[j], list[j + 1])) j++; if (j > i) { var run = list.slice(i, j + 1).sort(function (a, b) { return a.u.localeCompare(b.u, 'en', { numeric: true }); }); run.forEach(function (x, t) { x.tie = true; list[i + t] = x; }); } else list[i].tie = false; i = j + 1; }
list.forEach(function (x, t) { x.rank = t + 1; });
return list;
}
function opMqR1(x) { return Math.round(x * 10) / 10; }
/* 季檢討決議（設定試算表「儀表板檢討紀錄」：病房、照護班次決議兩欄） */
function opQNorm(s) { s = String(s == null ? '' : s).replace(/\s+/g, ''); var m = /^(\d{4})-?Q([1-4])$/i.exec(s); if (m) return m[1] + '-Q' + m[2]; m = /^(\d{3})(?:年)?(?:Q|第)([1-4])/i.exec(s); return m ? (+m[1] + 1911) + '-Q' + m[2] : ''; }
function opMqDecCode(t) { t = String(t || ''); return /增加/.test(t) ? 'inc' : /減少/.test(t) ? 'dec' : /兩週/.test(t) ? 'two' : /維持/.test(t) ? 'keep' : ''; }
function opMqDecs() {
var R = OP.review, out = []; if (!R) return null;
var ci = function (re) { return axCol(R.cols, re); }, iq = ci(/^季別/), ip = ci(/^頁面/), iw = ci(/^病房/), id = ci(/^照護班次決議/), ix = ci(/^決議/);
if (iq < 0 || iw < 0 || id < 0) { if (R.cols.length && R.rows.length) out.noCol = true; return out; }
R.rows.forEach(function (r) {
var q = opQNorm(r[iq]), w = String(r[iw] == null ? '' : r[iw]).trim().toUpperCase(), c = opMqDecCode(r[id]);
if (!q || !w || !c) return; if (ip >= 0 && r[ip] && !/臨床藥學/.test(String(r[ip]))) return;
var nq = +q.slice(-1) === 4 ? (+q.slice(0, 4) + 1) + '-Q1' : q.slice(0, 6) + (+q.slice(-1) + 1);
out.push({ q: q, from: mqQMonths(nq)[0], u: w, c: c, txt: String(r[id]).trim(), note: ix >= 0 ? String(r[ix] == null ? '' : r[ix]) : '' });
});
return out.sort(function (a, b) { return a.q < b.q ? -1 : a.q > b.q ? 1 : 0; });
}
function opMqActive(D, u, ym) { var a = null; (D || []).forEach(function (d) { if (d.u === String(u).toUpperCase() && d.from <= ym) a = d; }); return a; }
function opYmTw(ym) { return (+ym.slice(0, 4) - 1911) + '/' + ym.slice(5, 7); }
/* 佐證卡狀態與主責病房（疾病以主要＋共病計） */
function opMqRoll(q) { var a = [q]; for (var i = 0; i < 3; i++) a.unshift(mqPrevQ(a[0])); return [].concat.apply([], a.map(mqQMonths)); }
function opMqDisList(M) { var MS = mqMonths(M), s = {}; MS.all.forEach(function (y) { Object.keys(pcMon(M, y, '切片')).forEach(function (k) { var m = /^(dis|co):(.+)$/.exec(k); if (m) s[m[2]] = 1; }); }); return Object.keys(s).sort(); }
function opMqSum(M, yms, ks) { var o = { n: 0, a1: 0, ad: 0, o1: 0, ok: 0 }; ks.forEach(function (k) { var K = mqK(M, yms, k); o.n += K.n || 0; o.a1 += K.a1 || 0; o.ad += K.ad || 0; o.o1 += K.o1 || 0; o.ok += K.ok || 0; }); return o; }
function opMqCardSt(M, q, ks) {
var MS = mqMonths(M), inMs = function (ms) { return ms.filter(function (y) { return MS.all.indexOf(y) >= 0; }); };
var K = opMqSum(M, inMs(mqQMonths(q)), ks), p = [], qq = q; for (var i = 0; i < 4; i++) { qq = mqPrevQ(qq); p.push(opMqSum(M, inMs(mqQMonths(qq)), ks).n); }
var med = opMed(p), RK = opMqSum(M, inMs(opMqRoll(q)), ks), st = 'ok', why = '';
if (!K.n) { st = 'gap'; why = '本季 0 件'; }
else if (med !== null && med >= 4 && K.n < med / 2) { st = 'gap'; why = '本季 ' + K.n + ' 件，低於前 4 季中位數 ' + med + ' 的一半'; }
else if (K.n >= 5) {
if (K.ad >= 5 && RK.ad && ccWilson(K.a1, K.ad)[1] < RK.a1 / RK.ad) { st = 'weak'; why = '接受率 95% CI 上限低於自身滾動四季'; }
else if (K.ok >= 5 && RK.ok && ccWilson(K.o1, K.ok)[1] < RK.o1 / RK.ok) { st = 'weak'; why = '解決率 95% CI 上限低於自身滾動四季'; }
}
return { st: st, why: why, n: K.n, med: med };
}
function opMqResp(M, q, c) {
var MS = mqMonths(M), ms = opMqRoll(q).filter(function (y) { return MS.all.indexOf(y) >= 0; }), w = {}, tot = 0;
['dis:', 'co:'].forEach(function (p) { var d = mqD(M, ms, p + c, '病房'); Object.keys(d).forEach(function (u) { if (opMqNotWard(u) || !d[u].n) return; w[u] = (w[u] || 0) + d[u].n; tot += d[u].n; }); });
var ws = Object.keys(w).sort(function (a, b) { return w[b] - w[a] || a.localeCompare(b, 'en', { numeric: true }); });
if (tot < 10) return { st: 'few', tot: tot, wards: [], txt: '件數不足（滾動四季 ' + tot + ' 件），不指派' };
var hit = ws.filter(function (u) { return w[u] / tot >= 0.2 && w[u] >= 3; }).slice(0, 3);
if (!hit.length) return { st: 'spread', tot: tot, wards: [], txt: '分散，全院共同（最高 ' + ws[0] + ' ' + Math.round(w[ws[0]] / tot * 100) + '%）' };
return { st: 'ok', tot: tot, wards: hit, txt: hit.map(function (u) { return u + ' ' + Math.round(w[u] / tot * 100) + '%'; }).join('、') };
}
/* 某季各疾病卡：狀態＋主責病房（快取） */
function opMqDisCards(M, q) {
if (!OP.mqWC || OP.mqWC.M !== M) OP.mqWC = { M: M, c: {}, j: {} };
var C = OP.mqWC.d = OP.mqWC.d || {}; if (C[q]) return C[q];
return (C[q] = opMqDisList(M).map(function (c) { var s = opMqCardSt(M, q, ['dis:' + c, 'co:' + c]), r = opMqResp(M, q, c); return { c: c, name: PC_DIS_NAME[c] || c, st: s.st, why: s.why, n: s.n, resp: r }; }));
}
function opMqWardCards(M, q, u) { return opMqDisCards(M, q).filter(function (d) { return (d.st === 'gap' || d.st === 'weak') && d.resp.wards.indexOf(u) >= 0; }); }
/* ---------- v7.4.8 照護班次調度：滾動 12 個月 × 病房相對排序（2026-11-26 重擬藍圖） ----------
* 藥師投入＝12 個完整月中該病房有紀錄的月數（不靠登錄者欄）；問題密度＝件數 ÷ 有紀錄月數。
* 以 12 個月件數 ≥5 的病房為比較群，兩條軸各以比較群中位數為界（≥中位數＝高）。所有界線為起始值。 */
var MQR = { inc: '增加照護班次', busy: '維持（常去、問題多）', two: '先照護兩週再決定', dec: '可減少照護班次', keep: '維持照護班次', hold: '維持，先補佐證' };
var MQR_S = { inc: '增', busy: '多', two: '兩週', dec: '減', keep: '維', hold: '補', few: '少', nd: '' };
var MQR_COL = { inc: '#dd6b20', busy: '#805ad5', two: '#d69e2e', dec: '#3182ce', keep: '#718096', hold: '#718096' };
function opMqWin(M, ym) { return mqMonths(M).done.filter(function (y) { return y <= ym; }).slice(-12); }
function opMqCardQ(ym) { var m = +ym.slice(5, 7); return m % 3 === 0 ? mqQ(ym) : mqPrevQ(mqQ(ym)); }
function opMqSvcCards(M, q) {
if (!OP.mqWC || OP.mqWC.M !== M) OP.mqWC = { M: M, c: {}, j: {} };
var C = OP.mqWC.s = OP.mqWC.s || {}; if (C[q]) return C[q];
return (C[q] = PCS_SVC.filter(function (s) { return s.svc; }).map(function (s) { var x = opMqCardSt(M, q, ['svc:' + s.svc]); return { c: s.svc, name: s.name, st: x.st, why: x.why, n: x.n, med: x.med, svc: true }; }));
}
/* 服務線缺口指派：藥師最常去（有紀錄月數最多）的前 3 個病房；同分比件數、病房代碼。起始設計，無院內依據 */
function opMqFreq3(el) { return el.slice().sort(function (a, b) { return b.a - a.a || b.n - a.n || a.u.localeCompare(b.u, 'en', { numeric: true }); }).slice(0, 3).map(function (r) { return r.u; }); }
function opMqRoll12(M, ym) {
if (!OP.mqWC || OP.mqWC.M !== M) OP.mqWC = { M: M, c: {}, j: {} };
var RC = OP.mqWC.r = OP.mqWC.r || {}; if (RC[ym] !== undefined) return RC[ym];
var W = opMqWin(M, ym); if (W.length < 6) return (RC[ym] = null);
var o = {};
W.forEach(function (y, i) { var X = opMqW(M, y); Object.keys(X).forEach(function (u) { var a = o[u] = o[u] || { u: u, n: 0, a: 0, hr: 0, rej: 0, o3: 0, li: -1 }; a.n += X[u].n; if (X[u].n) { a.a++; a.li = i; } a.hr += X[u].hr; a.rej += X[u].rej; a.o3 += X[u].o3; }); });
var all = Object.keys(o).map(function (k) { var r = o[k]; r.d = r.a ? r.n / r.a : 0; r.safe = r.hr + r.rej + r.o3; r.sr = r.n ? r.safe / r.n : 0; r.since = r.li < 0 ? W.length : W.length - 1 - r.li; r.el = r.n >= 5; return r; }).filter(function (r) { return r.n > 0; });
var el = all.filter(function (r) { return r.el; }), am = opMed(el.map(function (r) { return r.a; })), dm = opMed(el.map(function (r) { return r.d; })), sm = opMed(el.map(function (r) { return r.sr; })), cq = opMqCardQ(W[W.length - 1]);
var qe = mqQMonths(cq)[2], RQ = qe !== W[W.length - 1] && mqMonths(M).done.indexOf(qe) >= 0 ? opMqRoll12(M, qe) : null, f3 = RQ ? RQ.f3 : opMqFreq3(el), sg = opMqSvcCards(M, cq).filter(function (d) { return d.st === 'gap' || d.st === 'weak'; });
el.forEach(function (r) {
var hiD = r.d >= dm, hiA = r.a >= am; r.c0 = hiD ? (hiA ? 'busy' : 'inc') : (hiA ? 'dec' : 'two'); r.c = r.c0; r.why = '';
r.gapC = opMqWardCards(M, cq, r.u).concat(f3.indexOf(r.u) >= 0 ? sg : []);
if (r.c === 'dec' && r.gapC.some(function (d) { return d.svc; }) && !(r.safe > 0 && r.sr > sm)) { r.c = 'hold'; r.why = '被指派補服務線缺口，班次不減，改做缺口服務線'; }
else if (r.c === 'dec') { if (r.safe > 0 && r.sr > sm) { r.c = 'keep'; r.why = '高警訊＋不接受＋未解決占件數 ' + Math.round(r.sr * 100) + '%，高於病房中位數 ' + Math.round(sm * 100) + '%，不列調出'; } else if (r.gapC.length) { r.c = 'hold'; r.why = '主責疾病佐證卡有缺口，先補再調'; } }
r.fillTxt = r.gapC.length ? r.gapC.map(function (d) { return d.name + (d.st === 'gap' ? '（缺口）' : '（偏弱）'); }).join('、') : '';
});
var g = function (c) { return el.filter(function (r) { return r.c === c; }); };
var R = { W: W, all: all, el: el, am: am, dm: dm, sm: sm, cq: cq, f3: f3, sg: sg,
inc: opMqSort(g('inc'), [function (r) { return r.safe; }, function (r) { return opMqR1(r.d); }, function (r) { return r.gapC.length; }, function (r) { return r.n; }], 1),
busy: opMqSort(g('busy'), [function (r) { return r.safe; }, function (r) { return opMqR1(r.d); }], 1),
two: opMqSort(g('two'), [function (r) { return r.n; }, function (r) { return r.since; }], 0),
dec: opMqSort(g('dec'), [function (r) { return r.a; }, function (r) { return -opMqR1(r.d); }, function (r) { return -r.n; }], 0),
keep: g('keep'), hold: g('hold'),
few: all.filter(function (r) { return !r.el; }).sort(function (a, b) { return b.n - a.n || a.u.localeCompare(b.u, 'en', { numeric: true }); }) };
R.map = {}; el.forEach(function (r) { R.map[r.u] = r; });
return (RC[ym] = R);
}
function opMqWinLab(W) { return opYmTw(W[0]) + '–' + opYmTw(W[W.length - 1]) + '（' + W.length + ' 個完整月）'; }
/* 四格圖：橫軸有紀錄月數，縱軸每個有紀錄月的件數 */
function opMqQuad(host, R) {
var ns = 'http://www.w3.org/2000/svg', w = 600, h = 320, L = 44, T = 14, B = 40, Rr = 16, pw = w - L - Rr, ph = h - T - B, xm = R.W.length, ym = Math.max(2, Math.ceil(Math.max.apply(null, R.el.map(function (r) { return r.d; }).concat([1])) + 0.5));
var X = function (v) { return L + v / xm * pw; }, Y = function (v) { return T + ph - v / ym * ph; };
var s = document.createElementNS(ns, 'svg'); s.setAttribute('viewBox', '0 0 ' + w + ' ' + h); s.setAttribute('class', 'op-quad'); s.setAttribute('role', 'img'); s.setAttribute('aria-label', '病房四格圖：橫軸有紀錄月數，縱軸每個有紀錄月的件數');
var el = function (t, a, txt) { var e = document.createElementNS(ns, t); Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); }); if (txt !== undefined) e.textContent = txt; s.appendChild(e); return e; };
var qx = X(R.am), qy = Y(R.dm);
el('rect', { x: L, y: T, width: qx - L, height: qy - T, fill: '#fffaf0' }); el('rect', { x: qx, y: T, width: L + pw - qx, height: qy - T, fill: '#faf5ff' });
el('rect', { x: L, y: qy, width: qx - L, height: T + ph - qy, fill: '#fffff0' }); el('rect', { x: qx, y: qy, width: L + pw - qx, height: T + ph - qy, fill: '#ebf8ff' });
el('line', { x1: L, y1: T + ph, x2: L + pw, y2: T + ph, stroke: '#a0aec0' }); el('line', { x1: L, y1: T, x2: L, y2: T + ph, stroke: '#a0aec0' });
el('line', { x1: qx, y1: T, x2: qx, y2: T + ph, stroke: '#4a5568', 'stroke-dasharray': '4 3' }); el('line', { x1: L, y1: qy, x2: L + pw, y2: qy, stroke: '#4a5568', 'stroke-dasharray': '4 3' });
for (var i = 0; i <= xm; i += 2) el('text', { x: X(i), y: T + ph + 14, 'font-size': 10, 'text-anchor': 'middle', fill: '#4a5568' }, String(i));
for (var j = 0; j <= ym; j++) el('text', { x: L - 6, y: Y(j) + 3, 'font-size': 10, 'text-anchor': 'end', fill: '#4a5568' }, String(j));
el('text', { x: L + pw / 2, y: h - 6, 'font-size': 11, 'text-anchor': 'middle', fill: '#2d3748' }, '藥師投入：12 個月中有紀錄的月數（右＝常去）');
var yl = el('text', { x: 12, y: T + ph / 2, 'font-size': 11, 'text-anchor': 'middle', fill: '#2d3748', transform: 'rotate(-90 12 ' + (T + ph / 2) + ')' }, '問題密度：有紀錄月平均件數');
var lab = [['增加照護班次', L + 6, T + 14, 'start'], ['維持（常去、問題多）', L + pw - 6, T + 14, 'end'], ['先照護兩週', L + 6, T + ph - 6, 'start'], ['可減少', L + pw - 6, T + ph - 6, 'end']];
lab.forEach(function (t) { el('text', { x: t[1], y: t[2], 'font-size': 11, 'font-weight': 700, 'text-anchor': t[3], fill: '#4a5568' }, t[0]); });
var seen = {};
R.el.forEach(function (r) {
var cx = X(r.a), cy = Y(r.d), k = Math.round(cx / 6) + ',' + Math.round(cy / 6), off = (seen[k] = (seen[k] || 0) + 1) - 1;
el('circle', { cx: cx, cy: cy, r: 5, fill: MQR_COL[r.c] || '#718096', stroke: r.safe ? '#c53030' : '#fff', 'stroke-width': r.safe ? 2 : 1 }).appendChild(document.createElementNS(ns, 'title')).textContent = r.u + '：' + r.n + ' 件／' + r.a + ' 個月（每月 ' + r.d.toFixed(1) + '）→ ' + MQR[r.c];
el('text', { x: cx + 7, y: cy + 3 + off * 11, 'font-size': 10, fill: '#1a202c' }, r.u);
});
var w0 = axEl('div', 'op-quadw'); w0.appendChild(s); host.appendChild(w0); return w0;
}
/* 某季全部佐證卡（服務線＋疾病）與由誰補；R＝季末滾動排序（服務線指派用） */
function opMqGapRows(M, q, R) {
var f3 = R ? R.f3 : [], rows = opMqSvcCards(M, q).map(function (d) { return { kind: '服務線', name: d.name, key: 'svc:' + d.c, keys: ['svc:' + d.c], st: d.st, why: d.why, n: d.n, med: d.med, who: f3.slice(), whoTxt: f3.length ? '最常去的 ' + f3.join('、') + '（班次內補做）' : '—' }; });
opMqDisCards(M, q).forEach(function (d) { var s = opMqCardSt(M, q, ['dis:' + d.c, 'co:' + d.c]); rows.push({ kind: '疾病', name: d.name, keys: ['dis:' + d.c, 'co:' + d.c], st: (d.resp.st === 'few' && d.st !== 'gap') || (!d.n && !s.med) ? 'few' : d.st, why: d.why, n: d.n, med: s.med, who: d.resp.wards.slice(), whoTxt: d.resp.st === 'ok' ? '主責 ' + d.resp.txt : d.resp.st === 'spread' ? '全院共同（' + d.resp.txt.replace(/^分散，全院共同/, '').replace(/^（|）$/g, '') + '）' : '件數不足，不指派' }); });
var o = { gap: 0, weak: 1, ok: 2, few: 3 };
return rows.sort(function (a, b) { return o[a.st] - o[b.st] || (a.who.length ? 0 : 1) - (b.who.length ? 0 : 1) || (a.kind === b.kind ? 0 : a.kind === '服務線' ? -1 : 1) || b.n - a.n; });
}
function opMqMonth(box, M0) {
var M = M0, k = 'all:全院', MS = mqMonths(M0), done = MS.done, ym = MQ.ym, base = mqBack(ym, 12).filter(function (y) { return done.indexOf(y) >= 0; }), hl = [];
var hlHost = axEl('div', 'op-hlhost'); box.appendChild(hlHost);
/* M1 資料到齊 */
var units = ['急診', '一般病房', '門診', '加護病房'], cu = mqD(M, [ym], k, '照護單位'), allN = mqK(M, [ym], k).n, allMed = opMed(base.map(function (y) { return mqK(M, [y], k).n; })), ALL = opMature(allN, allMed, ym);
var rows1 = units.map(function (u) { var n = cu[u] ? cu[u].n : 0, md = opMed(base.map(function (y) { var d = mqD(M, [y], k, '照護單位'); return d[u] ? d[u].n : 0; })), m = md !== null && md >= 10 ? opMature(n, md, ym) : { st: ALL.st + '（依全院）', cls: ALL.cls, r: md ? n / md : null }; return [u, String(n), md === null ? '—' : String(md), m.r === null || m.r === undefined ? '—' : Math.round(m.r * 100) + '%', m.st + (m.low ? '，可能未補齊' : '')]; });
rows1.unshift({ cls: 'op-sum', cells: ['全院', String(allN), allMed === null ? '—' : String(allMed), ALL.r === null ? '—' : Math.round(ALL.r * 100) + '%', ALL.st + (ALL.low ? '，可能未補齊' : '')] });
OP.mqFrozen = ALL.st === '累積中';
var q1 = pcgIndSum(M0, 'full', [ym]), wardNa = (pcMon(M0, ym, '病房')['未填病房碼'] || { n: 0 }).n + (pcMon(M0, ym, '病房')['未填'] || { n: 0 }).n, who0 = 0, dsrc = pcMon(M0, ym, '日期來源'), dbad = 0;
Object.keys(pcMon(M0, ym, '人員×登錄')).forEach(function (x) { if (/^（空白）/.test(x)) who0 += pcMon(M0, ym, '人員×登錄')[x].n; }); Object.keys(dsrc).forEach(function (x) { if (/異常/.test(x)) dbad += dsrc[x].n; });
var c1 = opCard(box, 'opM1', 'M1｜這個月的資料能看了嗎？', { st: ALL.cls === 'ok' ? 'ok' : ALL.cls === 'warn' ? 'warn' : 'bad', stTxt: ALL.st, sub: ccYmLab(ym) + '｜依照會日期歸月；補登照常歸回照會月份' });
c1.body.appendChild(opTable(['場域', '本月已登錄', '前 12 個完整月中位數', '比例', '資料成熟度'], rows1));
c1.body.appendChild(opTable(['資料品質', '本月'], [['紀錄完整率（DQ1）', q1.d ? opSmall(q1.x, q1.d) : '—'], ['病房碼未填（住院）', wardNa + ' 件'], ['登錄者未填', who0 + ' 件'], ['照會日期異常（以時間戳記歸月）', dbad + ' 件']]));
c1.foot(ALL.st === '累積中' ? ['本月訊號凍結：本頁只供補登，不判讀單位負荷'] : ALL.st === '可初讀' ? ['可看件數與單位分布；比率與訊號保留判讀'] : ALL.low ? ['件數低於中位數一半：先確認是否尚未補齊，再判讀'] : ['資料可判讀'],
'已登錄件數 ÷ 自身前 12 個完整月中位數：≥80% 已成熟、50–79% 可初讀、<50% 累積中；月份結束滿 90 天視為已成熟。月中位數 <10 的場域沿用全院狀態。時間戳記因 2026-11 批次寫入已不代表原始登錄時間，故不用登錄延遲。門檻為起始值，無文獻或院內規定依據。');
if (ALL.st === '累積中') hl.push({ what: '本月資料累積中（' + allN + '／中位數 ' + allMed + '）', next: opNx('MQ_M1_IMM', '本頁只供補登，下月再判讀') });
/* M2 照護班次調度（v7.4.8：滾動 12 個月 × 病房相對排序） */
var wr = opMqUnitRows(M, ym, base, '病房', 'ward:').filter(function (r) { return r.n || r.act; }), dr = opMqUnitRows(M, ym, base, '科別', 'dept:').filter(function (r) { return r.n || r.act; });
wr = wr.sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name); }); dr = dr.sort(function (a, b) { return b.n - a.n; });
var RR = opMqRoll12(M, ym), RP = RR ? opMqRoll12(M, mqPrevYm(RR.W[RR.W.length - 1])) : null, DEC = opMqDecs();
var c2 = opCard(box, 'opM2', 'M2｜哪些病房要調整照護班次？', { st: !RR ? 'na' : RR.inc.length || RR.dec.length ? 'warn' : 'ok', stTxt: !RR ? '完整月不足 6 個' : '增加 ' + RR.inc.length + '｜可減少 ' + RR.dec.length, sub: RR ? '滾動 ' + opMqWinLab(RR.W) + '，每月重算｜比較群：12 個月 ≥5 件的 ' + RR.el.length + ' 個病房｜依登錄資料推估，是否執行由組長決定' : '' });
var mv = function (r) { if (!RP) return ''; var p = RP.map[r.u]; return !p ? '（上月未入比較群）' : p.c !== r.c ? '（上月：' + MQR[p.c] + '）' : ''; };
var act = function (r) { var a = opMqActive(DEC, r.u, ym); return a ? '｜執行中：' + a.txt + '（自 ' + opYmTw(a.from) + ' 起）' : ''; };
var nxt = function (r, code, def) { var a = opMqActive(DEC, r.u, ym); return a && opMqDecCode(a.txt) === ({ inc: 'inc', two: 'two', dec: 'dec' }[r.c] || 'keep') ? opNx('MQ_M2_RUN', '已調整，繼續觀察') : opNx(code, def); };
var line = function (r) { return r.n + ' 件／' + r.a + ' 個月（每月 ' + r.d.toFixed(1) + ' 件）｜高警訊 ' + r.hr + '、不接受 ' + r.rej + '、未解決 ' + r.o3 + (r.fillTxt ? '｜主責卡：' + r.fillTxt : '') + (r.why ? '｜' + r.why : '') + mv(r) + act(r) + (r.tie ? '｜並列：順序無意義，由組長決定' : ''); };
if (!RR) c2.body.appendChild(axEl('p', 'ax-muted', '完整月不足 6 個，不排序。'));
else {
opMqQuad(c2.body, RR);
var g2 = axEl('div', 'op-two'); c2.body.appendChild(g2);
var col = function (title, list, code, def, extra) {
var w = axEl('div', 'op-mgrp'); w.appendChild(axEl('h4', '', title + '（' + list.length + '）')); g2.appendChild(w);
if (!list.length) { w.appendChild(axEl('p', 'ax-muted', '無')); return; }
opLoadBars(w, list.map(function (r) { return { name: r.rank + '. ' + r.u + (r.tie ? '＝' : ''), n: r.n, med: null, flag: true, note: line(r) + ' → ' + nxt(r, code, def) + (extra ? extra(r) : '') }; }));
};
col('優先增加照護班次（去了問題多、去得少）', RR.inc, 'MQ_M2_INC', '下月增加照護班次', function (r) { return r.fillTxt ? '；增加的班次優先補做主責卡' : ''; });
col('可減少照護班次（常去、問題少）', RR.dec, 'MQ_M2_DEC', '下月可減少照護班次，移給「增加」的病房');
col('先照護兩週再決定（去得少、問題也少）', RR.two, 'MQ_M2_TWO', '先排兩週照護班次，再看件數決定', function (r) { return r.since ? '；最近 ' + r.since + ' 個月無紀錄' : ''; });
col('維持（常去、問題仍多；前 3 名季會討論醫師端對策）', RR.busy, 'MQ_M2_KEEP', '維持照護班次', function (r) { return (r.rank <= 3 ? '；' + opNx('MQ_M2_BUSY', '季會討論醫師端對策（CDSS 規則、教學、處方集）') : '') + (r.fillTxt ? '；班次內補做主責卡' : ''); });
var kh = RR.keep.concat(RR.hold);
if (kh.length) c2.body.appendChild(opTable(['原可減少、改為維持', '12 個月', '理由'], kh.map(function (r) { return [r.u, r.n + ' 件／' + r.a + ' 個月', MQR[r.c] + '：' + r.why + act(r)]; })));
var tb = opTable(['病房', '12 個月件數', '有紀錄月數', '每月件數', '高警訊', '不接受＋未解決', '最近無紀錄月數', '分類', '上月分類'], RR.el.slice().sort(function (a, b) { return b.n - a.n || a.u.localeCompare(b.u, 'en', { numeric: true }); }).map(function (r) { var p = RP && RP.map[r.u]; return [r.u, r.n, r.a, r.d.toFixed(1), r.hr, r.rej + r.o3, r.since, MQR[r.c], p ? MQR[p.c] : '—']; }));
var few = RR.few.length ? opTable(['12 個月 <5 件（不排序）', '件數', '有紀錄月數'], RR.few.map(function (r) { return [r.u, r.n, r.a]; })) : axEl('p', 'ax-muted', '無');
opFold(c2.body, '全部病房明細（比較群 ' + RR.el.length + '，另 ' + RR.few.length + ' 個件數不足）', [tb, few]);
/* 本季要補（依上一個完整季的 Q1） */
var GQ = opMqGapRows(M, RR.cq, opMqRoll12(M, mqQMonths(RR.cq)[2])).filter(function (g) { return (g.st === 'gap' || g.st === 'weak') && g.who.length; });
var gN = function (g) { var n = 0; g.keys.forEach(function (k) { n += mqK(M, [ym], k).n; }); return n; };
c2.body.appendChild(axEl('h4', 'op-gh', '本季要補（依 ' + mqQLab(RR.cq) + ' 季檢討）'));
c2.body.appendChild(GQ.length ? opTable(['佐證卡', '狀態', '由誰補', '本月全院已有（含門急診）'], GQ.map(function (g) { var n = gN(g); return [g.name + '（' + g.kind + '）', g.st === 'gap' ? '缺口' : '偏弱', g.whoTxt, n ? n + ' 件' : '0 件']; })) : axEl('p', 'ax-muted', '上一季沒有可指派的缺口。'));
/* 本月逐案：有不接受或未解決的病房 */
var cur = opMqW(M, ym), ca = Object.keys(cur).filter(function (u) { return cur[u].rej + cur[u].o3 > 0; }).sort(function (a, b) { return (cur[b].hr - cur[a].hr) || (cur[b].rej + cur[b].o3 - cur[a].rej - cur[a].o3); });
c2.body.appendChild(axEl('h4', 'op-gh', '本月要逐案處理（' + ccYmLab(ym) + '）'));
c2.body.appendChild(ca.length ? opTable(['病房', '不接受', '未解決', '同月高警訊藥品筆數'], ca.map(function (u) { return [u, cur[u].rej, cur[u].o3, cur[u].hr]; })) : axEl('p', 'ax-muted', '本月沒有不接受或未解決的住院案件。'));
}
var pd = axEl('div', ''); opLoadBars(pd, dr.slice(0, 12).map(function (r) { return { name: r.name, n: r.n, med: r.med, note: '高警訊 ' + r.hr + (r.rej ? '｜不接受 ' + r.rej : '') + (r.o3 ? '｜未解決 ' + r.o3 : '') }; }));
opFold(c2.body, '科別（含門急診與住院；本月件數，刻線＝自身 12 個月中位數；不做調度排序）', [pd]);
var nx2 = [];
if (RR) {
RR.inc.slice(0, 3).forEach(function (r) { nx2.push(r.u + '（' + r.n + ' 件／' + r.a + ' 個月）→ ' + nxt(r, 'MQ_M2_INC', '下月增加照護班次')); });
RR.dec.slice(0, 3).forEach(function (r) { nx2.push(r.u + '（' + r.n + ' 件／' + r.a + ' 個月）→ ' + nxt(r, 'MQ_M2_DEC', '下月可減少照護班次，移給「增加」的病房')); });
if (ca.length) nx2.push('本月不接受或未解決：' + ca.slice(0, 4).join('、') + ' → ' + opNx('MQ_M4_REJ', '挑個案於晨會討論（不歸因個人）'));
}
c2.foot(nx2.length ? nx2 : ['各病房維持現行照護班次'],
'藥師投入＝滾動 12 個完整月中該病房有紀錄的月數；問題密度＝件數 ÷ 有紀錄月數（藥師有去的月份平均每月找到幾件）。比較群為 12 個月 ≥5 件的病房，兩軸以比較群中位數為界（有紀錄月數中位數 ' + (RR ? RR.am : '—') + '、每月件數中位數 ' + (RR ? RR.dm.toFixed(1) : '—') + '；等於中位數算高）。可減少的病房若高警訊＋不接受＋未解決占件數高於病房中位數，改為維持；若主責疾病佐證卡有缺口，改為「維持，先補佐證」。排序：增加＝高警訊＋不接受＋未解決 → 每月件數 → 主責卡缺口張數 → 件數；可減少＝有紀錄月數 → 每月件數低者 → 件數低者；先照護兩週＝件數 → 最近無紀錄月數；第 1 鍵差 ≤1 且其餘相同標「並列」。限制：藥師去了但整月沒找到問題會被當成沒去；沒有住院人日，大病房件數天生多；登錄者欄 115/11 起才完整，暫不使用。所有界線為起始值，無文獻或院內依據。');
if (RR) {
if (GQ.length) hl.push({ what: '本季要補：' + GQ.slice(0, 3).map(function (g) { return g.name + '（本月全院 ' + gN(g) + ' 件）'; }).join('、'), next: GQ[0].whoTxt + (GQ.length > 1 ? '；其餘見 M2「本季要補」' : '') });
RR.inc.slice(0, 1).forEach(function (r) { hl.push({ what: r.u + ' 去了每月 ' + r.d.toFixed(1) + ' 件、12 個月只有 ' + r.a + ' 個月有紀錄', next: nxt(r, 'MQ_M2_INC_HL', '下月增加照護班次') }); });
if (hl.length < 3) RR.dec.slice(0, 1).forEach(function (r) { hl.push({ what: r.u + ' 12 個月中 ' + r.a + ' 個月有紀錄、每月 ' + r.d.toFixed(1) + ' 件', next: nxt(r, 'MQ_M2_DEC', '下月可減少照護班次，移給「增加」的病房') }); });
}
/* M3 覆蓋空窗 */
var zr = wr.filter(function (r) { return !r.n && r.act && (r.med || 0) >= 1; }).map(function (r) { return { name: r.name, z: opMqZeroRun(M, ym, base, '病房', r.name), med: r.med }; }).sort(function (a, b) { return b.z - a.z; });
var whoRows = wr.filter(function (r) { return r.n; }).map(function (r) { return { name: r.name, c: opMqWho(M, ym, '病房', r.name) }; });
var one = whoRows.filter(function (r) { return r.c === 1; }), ppl = (pcMon(M0, ym, '填表人數')['人數'] || { n: 0 }).n;
var c3 = opCard(box, 'opM3', 'M3｜哪個單位這個月沒有紀錄？誰在顧？', { st: zr.some(function (r) { return r.z >= 2; }) ? 'warn' : 'ok', stTxt: zr.length ? zr.length + ' 個病房 0 件' : '無空窗', sub: '前 12 個完整月中位數 ≥1 件、本月 0 件的病房；登錄藥師人數不具名' });
c3.body.appendChild(zr.length ? opTable(['病房', '連續 0 件月數', '過去中位數'], zr.map(function (r) { return [r.name, r.z + ' 個月', r.med]; })) : axEl('p', 'ax-muted', '前 12 個月曾有紀錄的病房，本月皆有紀錄。'));
c3.body.appendChild(opTable(['登錄藥師人數（不具名）', '本月'], [['全院填表人數', '至少 ' + ppl + ' 人（登錄者未填 ' + who0 + ' 件，人數為低估）'], ['只有 1 位藥師登錄的病房', one.length ? one.map(function (r) { return r.name; }).join('、') : '無']].concat(whoRows.slice(0, 0))));
c3.foot(zr.length ? zr.slice(0, 3).map(function (r) { return r.name + ' 連續 ' + r.z + ' 個月 0 件 → ' + opNx('MQ_M3_ZERO', '確認當月是否有人照護'); }).concat(one.length ? ['僅 1 人登錄的病房 → ' + opNx('MQ_M3_ONE', '組長評估備援')] : []) : ['維持現行'], '無紀錄不等於無問題：沒有服務分母，資料無法區分處方品質好與無人審查。登錄者未填時無法計入人數。');
zr.filter(function (r) { return r.z >= 2; }).slice(0, 1).forEach(function (r) { hl.push({ what: r.name + ' 連續 ' + r.z + ' 個月無紀錄', next: opNx('MQ_M3_ZERO_HL', '確認是否有人照護') }); });
/* M4 未完成 */
var PD = mqD(M, MS.all, k, '待追蹤鍊期'), pn = function (b) { return PD[b] ? PD[b].n : 0; }, open = pn('≤30 天') + pn('31–90 天') + pn('91–120 天'), unk = pn('>120 天'), K = mqK(M, [ym], k), rejM = mqA2(M, [ym], k), rejN = Object.keys(rejM).reduce(function (s, x) { return s + rejM[x].n; }, 0), noImpl = K.a1 && K.a11 !== undefined && pcHasSub(M0) ? Math.max(0, K.a1 - K.a11) : null;
var c4 = opCard(box, 'opM4', 'M4｜哪些案件還沒結？', { st: open ? 'warn' : 'ok', stTxt: open ? open + ' 件待補結局' : '無待補', sub: '待補結局為全期存量（新表單 O0.1 或未填）；不接受為本月' });
var bars = { '≤30 天': { n: pn('≤30 天'), G: {} }, '31–90 天': { n: pn('31–90 天'), G: {} }, '91–120 天': { n: pn('91–120 天'), G: {} } };
pcxBars(c4.body, bars, { order: ['≤30 天', '31–90 天', '91–120 天'], empty: '無待補結局' });
c4.body.appendChild(opTable(['項目', '件數'], [['待補結局（≤120 天，存量）', open], ['超過 120 天：顯示層標為「結局不明」，移出存量', unk], ['本月不接受（A2）', rejN], ['本月接受但未執行（A1 − A1.1）', noImpl === null ? '—（無 A1.x 細項）' : noImpl]]));
c4.foot([open ? opNx('MQ_M4_OPEN', '藥師以「編輯回覆」補問題狀態（結局）') : '', rejN >= 2 ? '本月不接受 ' + rejN + ' 件 → ' + opNx('MQ_M4_REJ', '挑個案於晨會討論（不歸因個人）') : ''].filter(Boolean).concat(open || rejN >= 2 ? [] : ['維持現行']), '超過 120 天以照會日期起算，只改顯示，不覆寫表單回應；季檢討的解決率只計已知結局者，結局不明另列件數。');
if (open) hl.push({ what: '待補結局 ' + open + ' 件（≤120 天）', next: opNx('MQ_M4_OPEN_HL', '藥師以「編輯回覆」補結局') });
/* 第二層 */
var two = axEl('div', 'op-two-layer'), Y13 = mqBack(ym, 12).concat([ym]);
var t5 = Y13.map(function (y) { var d = mqD(M, [y], k, '照護單位'); return [ccYmLab(y) + (done.indexOf(y) < 0 ? '（進行中）' : '')].concat(units.map(function (u) { return d[u] ? d[u].n : 0; }), [mqK(M, [y], k).n]); });
var s5 = axEl('section', 'mq-sec'); s5.appendChild(axEl('h3', 'mq-h', 'M5｜住院、急診、門診各自的量正常嗎？')); s5.appendChild(opTable(['月份'].concat(units, ['全院']), t5.reverse())); s5.appendChild(axEl('p', 'pcx-pn', '下一步：某場域明顯高於自身過去月份 → ' + opNx('MQ_M5', '回看 M2 是哪些單位') + '。全院管制圖見「完整指標」M2。'));
var s6 = axEl('section', 'mq-sec'); s6.appendChild(axEl('h3', 'mq-h', 'M6｜問題集中在星期幾？')); var r6 = axEl('div', 'pcx-row'); s6.appendChild(r6);
var WD = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'], wd1 = mqD(M, [ym], k, '照會星期'), wd12 = mqD(M, base, k, '照會星期'), o1 = {}, o12 = {}; WD.forEach(function (w) { o1[w] = wd1[w] || { n: 0, G: {} }; o12[w] = wd12[w] || { n: 0, G: {} }; });
mqBars(r6, '本月', '依照會日期', o1, { order: WD }); mqBars(r6, '前 12 個完整月合計', '', o12, { order: WD });
s6.appendChild(axEl('p', 'pcx-pn', '下一步：集中於特定星期 → ' + opNx('MQ_M6', '排班參考') + '。表單只有照會日期、沒有時刻，無法分析時段。'));
var s7 = axEl('section', 'mq-sec'); s7.appendChild(axEl('h3', 'mq-h', 'M7｜這個單位的問題是哪一類服務？'));
var ws = pcMon(M, ym, '病房×服務線'), top = wr.filter(function (r) { return r.n; }).slice(0, 10), svcs = PCS_SVC.filter(function (s) { return s.svc; });
s7.appendChild(opTable(['病房'].concat(svcs.map(function (s) { return s.name; }), ['合計']), top.map(function (r) { return [r.name].concat(svcs.map(function (s) { var o = ws[r.name + '｜' + s.svc]; return o ? o.n : 0; }), [r.n]); })));
s7.appendChild(axEl('p', 'pcx-pn', '下一步：單一服務線集中於同一病房 → ' + opNx('MQ_M7', '留待季檢討選題（MUE、CDSS 規則或教學主題）') + '。'));
opFold(two, '第二層：場域量（M5）、星期分布（M6）、單位 × 服務線（M7）', [s5, s6, s7]);
box.appendChild(two);
opHighlights(hlHost, hl, '本月重點｜' + ccYmLab(ym));
}
function opMqSlice(M, qms, s) { var K = mqK(M, qms, s); return K; }
function opMqCard(host, M, s, label, qms, cms, q8, opts) {
opts = opts || {}; var K = mqK(M, qms, s), C = cms ? mqK(M, cms, s) : null, cl = opts.clause;
var st = !K.n ? 'na' : K.n < 5 ? 'acc' : 'ok';
var wrap = opts.fold ? axEl('details', 'op-dfold') : null; if (wrap) { wrap.appendChild(axEl('summary', '', label + '｜本季 ' + K.n + ' 件')); host.appendChild(wrap); }
var c = opCard(wrap || host, opts.ax || 'opQc', label + (opts.q ? '｜' + opts.q : ''), { st: st === 'ok' ? 'ok' : st === 'acc' ? 'warn' : 'na', stTxt: st === 'na' ? '本季無紀錄' : st === 'acc' ? '樣本 <5' : '本季 ' + K.n + ' 件', cls: 'op-qcard' });
opPrintBtn(c.sec);
var sp = q8.map(function (qq) { return mqK(M, mqQMonths(qq), s).n; }), g = axEl('div', 'op-qgrid'); c.body.appendChild(g);
var v = axEl('div', 'op-qv'); v.appendChild(axEl('b', '', K.n + ' 件')); v.appendChild(axEl('small', '', '對照季 ' + (C ? C.n : '—') + ' 件｜近 8 季')); v.appendChild(pcsSpark(sp, label + ' 近 8 季件數')); g.appendChild(v);
var P = mqD(M, qms, s, '問題面向'), R = mqD(M, qms, s, '原因碼'), top3 = function (m) { return Object.keys(m).filter(function (x) { return !/^(未填|上線前|舊版)/.test(x); }).sort(function (a, b) { return m[b].n - m[a].n; }).slice(0, 3).map(function (x) { return x + ' ' + m[x].n; }).join('、') || '—'; };
var A2 = mqA2(M, qms, s), rejT = Object.keys(A2).filter(function (x) { return A2[x].n; }).map(function (x) { return x + ' ' + A2[x].n; }).join('、') || '無';
var roll = q8.slice(-4), RK = mqK(M, [].concat.apply([], roll.map(mqQMonths)), s);
g.appendChild(opTable(['項目', '本季', '對照季'], [
['問題組成（前 3）', top3(P), cms ? top3(mqD(M, cms, s, '問題面向')) : '—'],
['原因（前 3）', top3(R), cms ? top3(mqD(M, cms, s, '原因碼')) : '—'],
['接受率（A1）', opSmall(K.a1, K.ad), C ? opSmall(C.a1, C.ad) : '—'],
['實際執行率（A1.1）', opSmall(K.a11, K.ad), C ? opSmall(C.a11, C.ad) : '—'],
['問題解決率（已知結局者）', opSmall(K.o1, K.ok), C ? opSmall(C.o1, C.ok) : '—'],
['結局不明或待補（另列，不入分母）', K.pend + ' 件', C ? C.pend + ' 件' : '—'],
['阻礙：不接受理由', rejT, '—'],
['阻礙：未解決（O3）', K.o3 + ' 件', C ? C.o3 + ' 件' : '—'],
{ cls: 'op-roll', cells: ['滾動四季（' + roll.map(function (x) { return x.replace('-', ''); }).join('、') + '）', RK.n + ' 件｜接受 ' + opSmall(RK.a1, RK.ad) + '｜解決 ' + opSmall(RK.o1, RK.ok), ''] }
]));
var next = [];
if (!K.n) next.push('本季無紀錄 → ' + (opts.svc ? opNx('MQ_Q3_ALL', '全院各班次內補做（服務線無法對應單一病房）') + '；' : '') + opNx('MQ_Q_NOREC', '確認是否有服務但未登錄（評鑑上「有服務無紀錄」與「無服務」相同）'));
else {
if (K.ad >= 5 && K.a1 / K.ad < 0.8) next.push('接受率 ' + opSmallV(K.a1, K.ad) + ' → ' + opNx('MQ_Q_ACC', '檢視不接受理由，挑個案於科內討論'));
if (K.o3 >= 2) next.push('未解決 ' + K.o3 + ' 件 → ' + opNx('MQ_Q_O3', '挑個案檢討未解決原因'));
var rc = Object.keys(R).filter(function (x) { return R[x].n >= 3; }); if (rc.length) next.push('原因 ' + rc.slice(0, 2).join('、') + ' 本季 ≥3 件 → ' + opNx('MQ_Q_RC', '評估是否提 MUE、CDSS 規則或教學主題'));
if (K.pend) next.push('結局待補 ' + K.pend + ' 件 → ' + opNx('MQ_Q_PEND', '補結局後再判讀解決率'));
if (!next.length) next.push('維持現行；於季會確認是否列為佐證');
}
c.foot(next, (K.n < 20 ? '本季件數 <20，比率波動大，以滾動四季輔助判讀。' : '') + '比率＝季內分子合計 ÷ 分母合計；分母 <5 只列件數、5–19 附 95% CI。個案組成改變會影響比率，不能只以升降判定改善或惡化。', cl ? opClauseTxt(cl) : '');
opDecision(c.sec);
return c;
}
function opMqQuarter(box, M0) {
var M = M0, MS = mqMonths(M0), q = MQ.q, cq = MQ.cq, qms = mqQMonths(q).filter(function (y) { return MS.all.indexOf(y) >= 0; }), cms = mqQMonths(cq).filter(function (y) { return MS.all.indexOf(y) >= 0; });
var q8 = [q]; for (var i = 0; i < 7; i++) q8.unshift(mqPrevQ(q8[0]));
var svcs = PCS_SVC.filter(function (s) { return s.svc; }), cnt = svcs.map(function (s) { return { s: s, n: mqK(M, qms, 'svc:' + s.svc).n }; }), gap = cnt.filter(function (x) { return !x.n; });
var dis = {}; MS.all.forEach(function (y) { Object.keys(pcMon(M, y, '切片')).forEach(function (kk) { if (/^dis:/.test(kk)) dis[kk] = 1; }); });
var dl = Object.keys(dis).map(function (kk) { return { k: kk, c: kk.slice(4), n: mqK(M, qms, kk).n }; }).sort(function (a, b) { return b.n - a.n || a.c.localeCompare(b.c); });
var qhlHost = axEl('div', 'op-hlhost'); box.appendChild(qhlHost);
/* Q2 下一季照護班次（v7.4.8：季末滾動 12 個月排序定格＋季內 3 個月穩定度） */
var QD = opMqDecs(), pq = mqPrevQ(q), qAll = mqQMonths(q), qDone = qAll.filter(function (y) { return MS.done.indexOf(y) >= 0; }), cards = opMqDisCards(M, q), run = qDone.length < 3;
var pqMs = mqQMonths(pq).filter(function (y) { return MS.done.indexOf(y) >= 0; }), Z0 = { n: 0, fte: 0, hr: 0, rej: 0, o3: 0 };
var qSum = function (ms, u) { var o = { n: 0, a: 0, hr: 0, rej: 0, o3: 0 }; ms.forEach(function (y) { var w = opMqW(M, y)[u] || Z0; o.n += w.n; o.hr += w.hr; o.rej += w.rej; o.o3 += w.o3; if (w.n) o.a++; }); return o; };
var RE = opMqRoll12(M, run ? (qDone.length ? qDone[qDone.length - 1] : mqPrevYm(qAll[0])) : qAll[2]), R3 = qAll.map(function (y) { return MS.done.indexOf(y) >= 0 ? opMqRoll12(M, y) : null; });
var FIN = { inc: MQR.inc, busy: MQR.busy, two: MQR.two, dec: MQR.dec, keep: MQR.keep, hold: MQR.hold, fill: '維持，班次內補做', few: '件數不足，不排序', run: '本季未完' };
var q2rows = !RE ? [] : RE.el.map(function (r) {
var m3 = qAll.map(function (y, i) { var X = R3[i]; if (!X) return { y: y, c: 'nd' }; var z = X.map[r.u]; return { y: y, c: z ? z.c : 'few', rk: z && /^(inc|dec|two)$/.test(z.c) ? z.rank : null }; });
var same = m3.filter(function (x) { return x.c === r.c; }).length, fin = run ? 'run' : r.c, next = '', note = '';
var prevDec = (QD || []).filter(function (d) { return d.q === pq && d.u === r.u.toUpperCase(); }).pop(), pin = !run && !!(prevDec && prevDec.c === 'inc' && r.c === 'inc');
if (!run && (r.c === 'busy' || r.c === 'keep') && r.gapC.length) fin = 'fill';
if (fin === 'inc') { next = pin ? opNx('MQ_Q2_PIN', '季會討論醫師端對策（CDSS 規則、教學、處方集），不再只加班次') : opNx('MQ_Q2_INC', '下一季增加照護班次'); if (r.fillTxt) note = '人力不足且影響評鑑佐證：' + r.fillTxt; }
else if (fin === 'two') { next = opNx('MQ_Q2_TWO', '下一季先排兩週照護班次，再決定'); if (r.fillTxt) note = '兩週內優先做：' + r.fillTxt; }
else if (fin === 'dec') next = opNx('MQ_Q2_DEC', '下一季可減少照護班次，移給「增加」的病房');
else if (fin === 'hold') { next = opNx('MQ_Q2_HOLD', '維持，先補佐證'); note = '待補：' + r.fillTxt; }
else if (fin === 'fill') { next = opNx('MQ_Q2_FILL', '班次不變，班次內補做') + '：' + r.fillTxt; }
else if (fin === 'busy') next = r.rank <= 3 ? opNx('MQ_M2_BUSY', '季會討論醫師端對策（CDSS 規則、教學、處方集）') : opNx('MQ_Q2_KEEP', '維持照護班次');
else if (fin === 'keep') { next = opNx('MQ_Q2_KEEP', '維持照護班次'); note = r.why; }
if (!run && same < 2 && /^(inc|dec|two)$/.test(r.c)) note += (note ? '；' : '') + '季內只有 ' + same + ' 個月同分類，結論不穩定';
var S = qSum(qDone, r.u);
return { u: r.u, r: r, m3: m3, same: same, fin: fin, pin: pin, next: next, note: note, S: S, K: opMqSum(M, qDone, ['ward:' + r.u]), own: cards.filter(function (d) { return d.resp.wards.indexOf(r.u) >= 0; }), safe: S.hr + S.rej + S.o3 };
});
var QS = function (f) { return opMqSort(q2rows.filter(function (x) { return x.fin === f; }), [function (x) { return x.pin ? 1e6 + x.safe : x.safe; }, function (x) { return x.r.gapC.length; }, function (x) { return x.same; }, function (x) { return x.r.n; }], 2); };
var qInc = QS('inc'), qTwo = QS('two'), qDec = opMqSort(q2rows.filter(function (x) { return x.fin === 'dec'; }), [function (x) { return x.r.a; }, function (x) { return -opMqR1(x.r.d); }, function (x) { return x.same; }], 0), qHold = QS('hold'), qFill = QS('fill'), qBusy = QS('busy'), qKeep = QS('keep');
var nQ2 = qInc.length + qDec.length + qTwo.length;
var c2q = opCard(box, 'opQ2', 'Q2｜下一季哪些病房要調整照護班次？', { st: run || !RE ? 'na' : nQ2 ? 'warn' : 'ok', stTxt: !RE ? '完整月不足' : run ? '本季未滿 3 個完整月（暫看）' : '增加 ' + qInc.length + '｜可減少 ' + qDec.length + '｜兩週 ' + qTwo.length, sub: mqQLab(q) + (RE ? '｜季末滾動 ' + opMqWinLab(RE.W) + '｜3 格＝本季各月月底的分類（數字＝當月名次），看結論是否穩定' : '') });
opPrintBtn(c2q.sec);
var blk = function (m3) { var w = axEl('span', 'op-cbs'); m3.forEach(function (x) { var b = axEl('i', 'op-cb op-cb-' + x.c, x.c === 'nd' ? '中' : (MQR_S[x.c] || '') + (x.rk ? x.rk : '')); b.title = ccYmLab(x.y) + '：' + (x.c === 'nd' ? '未結束' : x.c === 'few' ? '件數不足' : MQR[x.c]); w.appendChild(b); }); return w; };
var qTab = function (list) {
return opTable(['病房', '本季各月分類', '12 個月件數／有紀錄月', '每月件數', '本季件數／有紀錄月', '高警訊＋不接受＋未解決（本季）', '接受率（本季）', '解決率（本季）', '主責疾病卡', '季結論'], list.map(function (x) {
return { cls: x.pin ? 'op-hi' : '', cells: [(x.rank ? x.rank + '. ' : '') + x.u + (x.tie ? '＝' : '') + (x.pin ? '（已調整仍偏高）' : ''), blk(x.m3), x.r.n + '／' + x.r.a, x.r.d.toFixed(1), x.S.n + '／' + x.S.a, x.safe, opSmall(x.K.a1, x.K.ad), opSmall(x.K.o1, x.K.ok), x.own.length ? x.own.map(function (d) { return d.name + ({ gap: '（缺口）', weak: '（偏弱）', ok: '' })[d.st]; }).join('、') : '—', FIN[x.fin] + (x.note ? '｜' + x.note : '')] };
}));
};
if (!RE) c2q.body.appendChild(axEl('p', 'ax-muted', '完整月不足 6 個，不排序。'));
else {
opMqQuad(c2q.body, RE);
[['增加照護班次', qInc], ['可減少照護班次', qDec], ['先照護兩週再決定', qTwo], ['維持，先補佐證（原可減少）', qHold], ['維持，班次內補做', qFill], ['維持（常去、問題多；前 3 名季會討論醫師端對策）', qBusy], ['維持照護班次（原可減少，安全訊號高）', qKeep]].forEach(function (g) { if (!g[1].length) return; c2q.body.appendChild(axEl('h4', 'op-gh', g[0] + '（' + g[1].length + '）')); c2q.body.appendChild(qTab(g[1])); });
if (run) c2q.body.appendChild(axEl('p', 'pcs-note', '本季未滿 3 個完整月：上表以最近完整月為準，季會請用季末版本。'));
}
var nxq = [];
if (RE && !run) qInc.concat(qDec, qTwo, qHold, qFill).slice(0, 6).forEach(function (x) { nxq.push(x.u + '：' + FIN[x.fin] + (x.note ? '（' + x.note + '）' : '') + ' → ' + x.next); });
c2q.foot(nxq.length ? nxq.concat(['季會決議請填「儀表板檢討紀錄」：頁面＝臨床藥學服務、卡片＝Q2、病房、照護班次決議；下一季月頁顯示「執行中」，Q5 顯示前後對照']) : [run ? '季末再判讀' : '各病房維持現行照護班次'],
'季結論＝季末月份的滾動 12 個月分類（規則同月頁 M2）。季內 3 個月只有 1 個月同分類者標「不穩定」。主責疾病卡（住院、主要＋共病、滾動四季 ≥10 件，病房占 ≥20% 且 ≥3 件）有缺口或偏弱時：可減少改「維持，先補佐證」；維持改「班次內補做」；增加與先照護兩週附註優先補做。排序：上季已決議增加、本季仍增加者置頂 → 高警訊＋不接受＋未解決（本季）→ 主責卡缺口張數 → 季內同分類月數 → 12 個月件數；可減少＝有紀錄月數 → 每月件數低者；第 1 鍵差 ≤2 且其餘相同標「並列」。同一筆照會的多個共病會計入多張疾病卡。所有界線為起始值，無文獻或院內依據。', opClauseTxt('REV'));
opDecision(c2q.sec);
/* Q1 缺口總表（v7.4.9：服務線＋疾病同表，指派由誰補，接回 Q2） */
var GR = opMqGapRows(M, q, RE), gapR = GR.filter(function (g) { return g.st === 'gap' || g.st === 'weak'; }), asg = gapR.filter(function (g) { return g.who.length; });
var finOf = function (u) { var x = q2rows.filter(function (z) { return z.u === u; })[0]; return x ? FIN[x.fin] : '件數不足，不排序'; };
var c1 = opCard(box, 'opQ1', 'Q1｜本季哪些服務線或疾病沒有紀錄？由誰補？', { st: gapR.length ? 'warn' : 'ok', stTxt: gapR.length ? '缺口或偏弱 ' + gapR.length + ' 張（可指派 ' + asg.length + '）' : '無缺口', sub: mqQLab(q) + '｜服務線 ' + GR.filter(function (g) { return g.kind === '服務線'; }).length + ' 張、疾病 ' + GR.filter(function (g) { return g.kind === '疾病'; }).length + ' 張（疾病以主要＋共病計）' });
box.insertBefore(c1.sec, c2q.sec);
var ST = { gap: '缺口', weak: '偏弱', ok: '正常', few: '件數不足' };
var q1row = function (g) { return { cls: g.st === 'gap' || g.st === 'weak' ? 'op-hi' : '', cells: [g.name, g.kind, g.n, g.med === null ? '—' : g.med, ST[g.st] + (g.why ? '：' + g.why : ''), g.whoTxt, g.who.length ? g.who.map(function (u) { return u + '：' + finOf(u); }).join('；') : '—', g.st === 'gap' || g.st === 'weak' ? (g.who.length ? (g.kind === '服務線' ? opNx('MQ_Q1_SVC', '指派病房班次內補做') : opNx('MQ_Q1_DIS', '主責病房班次內補做')) : opNx('MQ_Q1_NOWHO', '確認有服務未登錄或無服務；全院宣導')) : '—'] }; };
var hd = ['佐證卡', '類型', '本季件數', '前 4 季中位數', '狀態', '由誰補', '該病房季結論', '下一步'];
c1.body.appendChild(opTable(hd, gapR.map(q1row)));
if (!gapR.length) c1.body.appendChild(axEl('p', 'ax-muted', '本季沒有缺口或偏弱的佐證卡。'));
opFold(c1.body, '其餘佐證卡（正常 ' + GR.filter(function (g) { return g.st === 'ok'; }).length + '、件數不足 ' + GR.filter(function (g) { return g.st === 'few'; }).length + '）', [opTable(hd, GR.filter(function (g) { return g.st === 'ok' || g.st === 'few'; }).map(q1row))]);
c1.body.appendChild(axEl('p', 'pcx-pn', 'ICU 與藥師門診：非表單服務線選項，本頁不涵蓋（2.5.10 優良 6、7）。'));
c1.foot(asg.length ? asg.slice(0, 5).map(function (g) { return g.name + '（' + ST[g.st] + '，本季 ' + g.n + ' 件）→ ' + g.whoTxt; }) : gapR.length ? ['缺口皆無法指派病房 → ' + opNx('MQ_Q1_NOWHO', '確認有服務未登錄或無服務；全院宣導')] : ['維持現行'],
'狀態：缺口＝本季 0 件（疾病卡前 4 季中位數為 0 者改列件數不足），或低於前 4 季中位數一半且中位數 ≥4；偏弱＝≥5 件且接受率或解決率 95% CI 上限低於自身滾動四季。由誰補：疾病＝主責病房（住院、主要＋共病、滾動四季 ≥10 件，病房占 ≥20% 且 ≥3 件）；服務線＝季末滾動 12 個月藥師最常去（有紀錄月數最多）的前 3 個病房，為起始設計、無院內依據。被指派補服務線缺口的「可減少」病房改為「維持，先補佐證」。評鑑上「有服務無紀錄」與「無服務」在佐證上相同。', opClauseTxt('REV'));
/* Q3 服務線卡 */
var h3 = axEl('h3', 'op-gh', 'Q3｜服務線佐證卡（每張可單獨列印）'); box.appendChild(h3);
svcs.forEach(function (s) { opMqCard(box, M, 'svc:' + s.svc, s.name, qms, cms, q8, { ax: 'opQs', clause: OP_SVC_CLAUSE[s.svc], q: '做了多少、結果如何、卡在哪裡？', svc: true }); });
/* Q4 疾病卡 */
box.appendChild(axEl('h3', 'op-gh', 'Q4｜疾病佐證卡（全部保留；本季 ≥20 件預設展開）'));
dl.forEach(function (d) {
var cc = opMqCard(box, M, d.k, (PC_DIS_NAME[d.c] || d.c), qms, cms, q8, { ax: 'opQd', fold: d.n < 20 }), dc = cards.filter(function (x) { return x.c === d.c; })[0];
if (!dc) return;
var rw = dc.resp.wards.map(function (u) { var r = q2rows.filter(function (x) { return x.u === u; })[0]; return u + '：' + (r ? FIN[r.fin] : '—'); }).join('；');
cc.body.appendChild(opTable(['主責病房（住院有病房碼，主要＋共病，滾動四季 ' + dc.resp.tot + ' 件）', '佐證狀態（含門急診，主要＋共病，本季 ' + dc.n + ' 件）', '主責病房季結論'], [[dc.resp.txt, ({ gap: '缺口', weak: '偏弱', ok: '正常' })[dc.st] + (dc.why ? '：' + dc.why : ''), rw || '—']]));
});
/* Q5 上一季調整的病房（v7.4.6） */
var dq = (QD || []).filter(function (d) { return d.q === pq; });
var c5 = opCard(box, 'opQ5', 'Q5｜上一季決定調整的病房，這一季有變化嗎？', { st: QD === null ? 'na' : dq.length ? 'ok' : 'na', stTxt: QD === null ? '紀錄分頁未開放' : dq.length ? '上季決議 ' + dq.length + ' 個病房' : '上季無病房決議', sub: '決議季＝' + mqQLab(pq) + '，自 ' + mqQLab(q) + ' 起執行｜資料：設定試算表「儀表板檢討紀錄」病房、照護班次決議兩欄' });
if (QD === null) c5.body.appendChild(axEl('p', 'ax-muted', '「儀表板檢討紀錄」未開放或讀取失敗。'));
else if (QD.noCol) c5.body.appendChild(axEl('p', 'ax-muted', '「儀表板檢討紀錄」尚未加「病房」「照護班次決議」兩欄；管理者執行後台 setupOpMq746 後，本卡與月頁「執行中」才會顯示。'));
else if (!dq.length) c5.body.appendChild(axEl('p', 'ax-muted', '沒有 ' + mqQLab(pq) + '、頁面為臨床藥學服務且填了病房與照護班次決議的紀錄。'));
else {
var pS = function (u) { return qSum(pqMs, u); };
c5.body.appendChild(opTable(['病房', '上季決議', '件數（上季→本季）', '有紀錄月數（上季→本季，滿分 3）', '高警訊＋不接受＋未解決（上季→本季）', '本季結論'], dq.map(function (d) {
var a = pS(d.u), r = q2rows.filter(function (x) { return x.u.toUpperCase() === d.u; })[0], b = qSum(qDone, d.u);
return [d.u, d.txt, a.n + ' → ' + b.n, a.a + ' → ' + b.a, (a.hr + a.rej + a.o3) + ' → ' + (b.hr + b.rej + b.o3), r ? FIN[r.fin] + (r.pin ? '（已調整仍偏高）' : '') : '件數不足，不排序'];
})));
}
c5.foot(dq.length ? ['逐一 → ' + opNx('MQ_Q5', '季會決定延續、再調整或恢復，填入本季「儀表板檢討紀錄」')] : ['本季決議 → ' + opNx('MQ_Q5_NONE', '會後填入「儀表板檢討紀錄」（頁面、卡片 Q2、病房、照護班次決議）')],
'前後對照只是觀察，不是因果：病人組成、季節、登錄習慣都會影響件數。建議一次只調整 1–2 個病房，方便下一季判讀。系統只顯示人工紀錄，不追蹤、不結案。', opClauseTxt('REV'));
/* 本季重點（v7.4.9） */
var qhl = [];
if (asg.length) qhl.push({ what: '佐證缺口：' + asg.slice(0, 3).map(function (g) { return g.name + '（' + ST[g.st] + '）'; }).join('、'), next: asg[0].whoTxt + (asg.length > 1 ? '；其餘見 Q1' : '') });
if (!run && qInc.length) qhl.push({ what: qInc[0].u + ' 列增加照護班次第 1 名（12 個月 ' + qInc[0].r.n + ' 件／' + qInc[0].r.a + ' 個月）', next: qInc[0].next });
if (!run && (qDec.length || qHold.length)) { var x0 = qDec[0] || qHold[0]; qhl.push({ what: x0.u + '：' + FIN[x0.fin] + (x0.note ? '（' + x0.note + '）' : ''), next: x0.next }); }
if (dq.length) qhl.push({ what: '上季決議 ' + dq.length + ' 個病房', next: opNx('MQ_Q5', '季會決定延續、再調整或恢復，填入本季「儀表板檢討紀錄」') });
opHighlights(qhlHost, qhl, '本季重點｜' + mqQLab(q));
/* Q6 高齡 */
box.appendChild(axEl('h3', 'op-gh', 'Q6｜高齡（≥65 歲）'));
opMqCard(box, M, 'ger:65', '高齡（≥65 歲）', qms, cms, q8, { ax: 'opQg', clause: 'GER' });
}
(function(){var c=document.createElement('style');c.textContent='.op-mgrp h4{margin:4px 0}.op-cbs{display:inline-flex;gap:2px}.op-cb{display:inline-block;min-width:30px;padding:1px 3px;border-radius:3px;font-style:normal;font-size:.72rem;text-align:center;background:#edf2f7;color:#4a5568}.op-cb-inc{background:#dd6b20;color:#fff}.op-cb-two{background:#d69e2e;color:#fff}.op-cb-dec{background:#3182ce;color:#fff}.op-cb-keep{background:#a0aec0;color:#fff}.op-cb-na{background:#fff;border:1px dashed #a0aec0}.op-cb-busy{background:#805ad5;color:#fff}.op-cb-hold,.op-cb-fill{background:#a0aec0;color:#fff}.op-cb-few{background:#fff;border:1px dashed #cbd5e0;color:#a0aec0}.op-quadw{max-width:640px;margin:6px 0 10px}.op-quad{width:100%;height:auto}';document.head.appendChild(c)})();