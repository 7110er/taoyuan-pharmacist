/* ---------- v7.4.6 臨床藥學服務：照護班次調度（定案藍圖 2026-11-26，只用現有資料） ----------
* 問題量＝該病房當月件數；藥師投入＝折算人力（每位藥師當月在 n 個病房有登錄，每個病房計 1÷n）。
* 兩者都跟該病房自身前 12 個完整月中位數比。所有門檻為起始值，無文獻或院內依據。 */
var MQC = { inc: '增加照護班次', keep: '維持照護班次', two: '先照護兩週再決定', dec: '減少照護班次', na: '登錄者資料不足', none: '不調整' };
var MQC_S = { inc: '增', keep: '維', two: '兩週', dec: '減', na: '未填', none: '—' };
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
function opMqRaw(M, ym, u) {
var MS = mqMonths(M), base = mqBack(ym, 12).filter(function (y) { return MS.done.indexOf(y) >= 0; }), Z = { n: 0, fte: 0, blank: 0, hr: 0, rej: 0, o3: 0 };
var cur = opMqW(M, ym)[u] || Z, hs = base.map(function (y) { return opMqW(M, y)[u] || Z; });
var hv = hs.filter(function (h) { return !h.n || h.blank / h.n <= 0.2; }), med = opMed(hs.map(function (h) { return h.n; })), fm = hv.length >= 3 ? opMed(hv.map(function (h) { return h.fte; })) : null, hm = opMed(hs.map(function (h) { return h.hr; }));
var r = { u: u, ym: ym, n: cur.n, med: med, fte: cur.fte, fm: fm, hr: cur.hr, hm: hm, rej: cur.rej, o3: cur.o3, blank: cur.blank, nb: base.length, nv: hv.length, act: hs.some(function (h) { return h.n; }) };
r.vol = med === null ? 'na' : cur.n >= 5 && cur.n >= 2 * med ? 'hi' : med >= 2 && cur.n <= med / 2 ? 'lo' : 'flat';
r.inp = fm === null ? 'na' : fm > 0 ? (cur.fte >= 1.5 * fm ? 'up' : cur.fte <= 0.5 * fm ? 'dn' : 'flat') : (cur.fte > 0 ? 'up' : 'flat');
r.bad = cur.n > 0 && cur.blank / cur.n > 0.2;
r.safe = cur.hr + cur.rej + cur.o3;
return r;
}
function opMqJudge(M, ym, u) {
opMqW(M, ym); var J = OP.mqWC.j, key = ym + '|' + u; if (J[key]) return J[key];
var r = opMqRaw(M, ym, u); r.c = 'none'; r.why = '';
if (r.nb < 3) r.why = '歷史不足 3 個完整月，不判定';
else if (r.bad) { r.c = 'na'; r.why = '登錄者未填 ' + r.blank + '／' + r.n + ' 件，投入算不準'; }
else if (!r.n && r.med !== null && r.med >= 1) { r.c = 'two'; r.zero = true; r.why = '本月 0 件（自身中位數 ' + r.med + '）'; }
else if (r.vol === 'hi' && r.inp === 'na') { r.c = 'na'; r.why = '問題變多，但前 12 個月登錄者資料完整的月份不足 3 個，無法判斷藥師投入'; }
else if (r.vol === 'hi') { r.c = r.inp === 'up' ? 'keep' : 'inc'; r.why = r.inp === 'up' ? '問題多，但藥師也去得多，量是看出來的' : '問題變多，藥師投入沒有增加'; }
else if (r.vol === 'lo') {
if (r.inp === 'na') r.why = '問題偏少，但藥師投入基準不足，不判定';
else if (r.inp === 'dn') { r.c = 'two'; r.why = '問題少、藥師也去得少，分不出是處方好還是沒人看'; }
else {
var k = 1, y = ym; while (k < 3) { y = mqPrevYm(y); var p = opMqRaw(M, y, u); if (p.nb < 3 || p.bad || p.vol !== 'lo' || p.inp === 'dn') break; k++; }
r.lowRun = k;
if (k < 3) r.why = '問題偏少第 ' + k + ' 個月（滿 3 個月才列減少）';
else if (r.hm !== null && r.hr > r.hm) { r.c = 'keep'; r.guard = true; r.why = '問題連續 3 個月偏少，但高警訊藥品 ' + r.hr + ' 高於自身中位數 ' + r.hm + '，不列減少'; }
else { r.c = 'dec'; r.why = '藥師有去，問題連續 3 個月偏少'; }
}
}
return (J[key] = r);
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
if (iq < 0 || iw < 0 || id < 0) { out.noCol = true; return out; }
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
/* 某月各病房結論＋分組排序（月頁 M2 與季頁 Q2 共用） */
function opMqMonthGroups(M, ym) {
if (!OP.mqWC || OP.mqWC.M !== M) OP.mqWC = { M: M, c: {}, j: {} };
var G = OP.mqWC.g = OP.mqWC.g || {}; if (G[ym]) return G[ym];
var MS = mqMonths(M), base = mqBack(ym, 12).filter(function (y) { return MS.done.indexOf(y) >= 0; }), q = mqQ(ym), pq = mqPrevQ(q);
var qBefore = mqQMonths(q).filter(function (y) { return y <= ym && MS.all.indexOf(y) >= 0; });
var rows = opMqWards(M, [ym]).map(function (u) {
var r = opMqJudge(M, ym, u);
r.inQ = qBefore.filter(function (y) { return opMqJudge(M, y, u).c === r.c; }).length;
r.gapC = opMqWardCards(M, pq, u);
r.gapN = r.gapC.map(function (d) { var n = 0; ['dis:', 'co:'].forEach(function (p) { var x = mqD(M, [ym], p + d.c, '病房')[u]; n += x ? x.n : 0; }); return { name: d.name, n: n }; });
if (r.c === 'two') r.zr = opMqZeroRun(M, ym, base, '病房', u);
return r;
});
var by = function (c) { return rows.filter(function (r) { return r.c === c; }); };
var out = {
inc: opMqSort(by('inc'), [function (r) { return r.safe; }, function (r) { return opMqR1(r.n / Math.max(r.med || 0, 1)); }, function (r) { return r.gapC.length ? 1 : 0; }, function (r) { return r.inQ; }], 1),
two: opMqSort(by('two'), [function (r) { return r.med || 0; }, function (r) { return r.zr || 0; }], 0),
dec: opMqSort(by('dec'), [function (r) { return opMqR1(r.fte); }, function (r) { return -opMqR1(r.n / Math.max(r.med || 0, 1)); }, function (r) { return r.lowRun || 0; }], 0),
keep: by('keep'), na: by('na'), none: by('none'), all: rows
};
return (G[ym] = out);
}
function opMqArrow(r) { return r.inp === 'up' ? '↑' : r.inp === 'dn' ? '↓' : r.inp === 'na' ? '' : '→'; }
function opMqFteTxt(r) { return '折算人力 ' + r.fte.toFixed(1) + ' ' + opMqArrow(r) + (r.fm !== null ? '（中位數 ' + r.fm.toFixed(1) + '）' : ''); }
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
/* M2 照護班次調度（v7.4.6） */
var wr = opMqUnitRows(M, ym, base, '病房', 'ward:').filter(function (r) { return r.n || r.act; }), dr = opMqUnitRows(M, ym, base, '科別', 'dept:').filter(function (r) { return r.n || r.act; });
wr = wr.sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name); }); dr = dr.sort(function (a, b) { return b.n - a.n; });
var GG = opMqMonthGroups(M, ym), DEC = opMqDecs(), qn = +ym.slice(5, 7) - (Math.ceil(+ym.slice(5, 7) / 3) - 1) * 3, nAct = GG.inc.length + GG.two.length + GG.dec.length;
var c2 = opCard(box, 'opM2', 'M2｜下個月哪些病房要調整照護班次？', { st: OP.mqFrozen ? 'bad' : nAct ? 'warn' : 'ok', stTxt: OP.mqFrozen ? '凍結' : nAct ? nAct + ' 個病房' : '無需調整', sub: ccYmLab(ym) + '（本季第 ' + qn + ' 個月）｜每個病房跟自己前 12 個完整月比：問題量＝件數，藥師投入＝折算人力。依登錄資料推估，是否執行由組長決定。' });
var mNext = function (r, def, code) {
var a = opMqActive(DEC, r.u, ym), t;
if (a && a.c === r.c) t = opNx('MQ_M2_RUN', '已調整，繼續觀察');
else t = opNx(code, def) + (r.inQ >= 2 ? '（本季第 ' + r.inQ + ' 個月）→ ' + opNx('MQ_M2_MEET', '列入本季季會') : '');
return t;
};
var mNote = function (r) {
var a = opMqActive(DEC, r.u, ym), x = [];
x.push('中位數 ' + (r.med === null ? '—' : r.med));
x.push(opMqFteTxt(r));
x.push('高警訊 ' + r.hr + (r.hm !== null ? '（中位數 ' + r.hm + '）' : ''));
if (r.rej || r.o3) x.push('不接受 ' + r.rej + '、未解決 ' + r.o3);
if (r.inQ) x.push('本季第 ' + r.inQ + ' 個月');
if (r.gapN && r.gapN.length) x.push('本季要補：' + r.gapN.map(function (g) { return g.name + (g.n ? '（已有 ' + g.n + ' 件）' : ''); }).join('、'));
if (a) x.push('執行中：' + a.txt + '（自 ' + opYmTw(a.from) + ' 起）');
if (r.tie) x.push('並列：順序無意義，由組長決定');
return x.join('｜');
};
var grp = function (title, list, code, def) {
var w = axEl('div', 'op-mgrp'); w.appendChild(axEl('h4', '', title + '（' + list.length + '）'));
if (!list.length) { w.appendChild(axEl('p', 'ax-muted', '無')); return w; }
opLoadBars(w, list.map(function (r) { return { name: r.rank + '. ' + r.u + (r.tie ? '＝' : ''), n: r.n, med: r.med, flag: true, note: r.why + '｜' + mNote(r) + '→ ' + mNext(r, def, code) }; }));
return w;
};
if (OP.mqFrozen) c2.body.appendChild(axEl('p', 'ax-muted', '本月資料累積中，不下調度結論；請先補登。'));
else {
var g2 = axEl('div', 'op-two'); c2.body.appendChild(g2);
g2.appendChild(grp('增加照護班次', GG.inc, 'MQ_M2_INC', '下月增加照護班次'));
g2.appendChild(grp('先照護兩週再決定', GG.two, 'MQ_M2_TWO', '先排兩週照護班次，再看件數決定'));
g2.appendChild(grp('減少照護班次', GG.dec, 'MQ_M2_DEC', '下月可減少照護班次，移給「增加」的病房'));
var naAll = GG.na, naKey = naAll.filter(function (r) { return r.vol === 'hi' || r.vol === 'lo'; }), bl = 0, tn = 0; GG.all.forEach(function (r) { bl += r.blank; tn += r.n; });
var oth = GG.keep.concat(naKey).concat(GG.all.filter(function (r) { return r.c === 'none' && r.lowRun; }));
if (naAll.length) c2.body.appendChild(axEl('p', 'pcs-note', '登錄者未填：住院 ' + bl + '／' + tn + ' 件；' + naAll.length + ' 個病房未填超過 20%，不下增減結論（' + naAll.map(function (r) { return r.u; }).join('、') + '）。補填後重新整理即更新。'));
if (oth.length) c2.body.appendChild(opTable(['其他需知道的病房', '本月', '說明'], oth.map(function (r) { return [r.u, r.n, (r.c === 'na' ? MQC.na + '：' : r.c === 'keep' ? MQC.keep + '：' : '') + r.why]; })));
}
var allW = GG.all.slice().sort(function (a, b) { return b.n - a.n || a.u.localeCompare(b.u, 'en', { numeric: true }); });
var detail = opTable(['病房', '本月件數', '自身中位數', '問題量', '折算人力（中位數）', '投入', '高警訊（中位數）', '不接受＋未解決', '登錄者未填', '月結論'], allW.map(function (r) {
return [r.u, r.n, r.med === null ? '—' : r.med, { hi: '高', lo: '低', flat: '持平', na: '—' }[r.vol], r.fte.toFixed(2) + (r.fm !== null ? '（' + r.fm.toFixed(2) + '）' : ''), { up: '增', dn: '減', flat: '持平', na: '—' }[r.inp], r.hr + (r.hm !== null ? '（' + r.hm + '）' : ''), r.rej + r.o3, r.blank, OP.mqFrozen ? '凍結' : r.c === 'none' ? '—' : MQC[r.c]];
}));
var pd = axEl('div', ''); opLoadBars(pd, dr.slice(0, 12).map(function (r) { return { name: r.name, n: r.n, med: r.med, note: '高警訊 ' + r.hr + (r.rej ? '｜不接受 ' + r.rej : '') + (r.o3 ? '｜未解決 ' + r.o3 : '') }; }));
if (dr.length > 12) pd.appendChild(opTable(['其餘科別', '本月', '中位數', '高警訊'], dr.slice(12).filter(function (r) { return r.n; }).map(function (r) { return [r.name, r.n, r.med, r.hr]; })));
opFold(c2.body, '全部病房明細（' + allW.length + '）', [detail]);
opFold(c2.body, '科別（含門急診與住院；沒有病房分母，不做調度判定）', [pd]);
var nx2 = [];
if (!OP.mqFrozen) {
GG.inc.slice(0, 3).forEach(function (r) { nx2.push(r.u + '：' + r.why + ' → ' + mNext(r, '下月增加照護班次', 'MQ_M2_INC')); });
GG.two.slice(0, 2).forEach(function (r) { nx2.push(r.u + '：' + r.why + ' → ' + mNext(r, '先排兩週照護班次，再看件數決定', 'MQ_M2_TWO')); });
GG.dec.slice(0, 2).forEach(function (r) { nx2.push(r.u + '：' + r.why + ' → ' + mNext(r, '下月可減少照護班次，移給「增加」的病房', 'MQ_M2_DEC')); });
if (GG.na.length) nx2.push('登錄者資料不足 ' + GG.na.length + ' 個病房（' + GG.na.map(function (r) { return r.u; }).join('、') + '）→ ' + opNx('MQ_M2_NA', '藥師以「編輯回覆」補填登錄者，再判讀'));
}
c2.foot(OP.mqFrozen ? ['資料累積中，不下調度結論'] : nx2.length ? nx2 : ['各病房維持現行照護班次'],
'問題量：高＝≥5 件且 ≥自身中位數 2 倍；低＝中位數 ≥2 且 ≤中位數一半。藥師投入（折算人力，一位藥師當月在 n 個病房有登錄，每病房計 1÷n）：增＝≥中位數 1.5 倍；減＝≤一半。問題高＋投入持平或減→增加；問題高＋投入增→維持；問題低＋投入減→先照護兩週；問題低＋投入持平或增連續 3 個月→減少；中位數 ≥1 且本月 0 件→先照護兩週。高警訊藥品類別筆數高於自身中位數不列減少；登錄者未填 >20% 不下結論。排序：增加＝高警訊＋不接受＋未解決 → 超出中位數倍數 → 本季要補佐證卡 → 本季累計月數；先照護兩週＝自身中位數（過去量）→ 連續 0 件月數；減少＝折算人力 → 問題倍數低者 → 連續月數。第 1 鍵差 ≤1 件且其餘相同標「並列」。沒有住院人日，只能跟自己比：一直忙、一直缺人的病房不會亮燈；藥師去了但沒登錄會被當成沒去。所有門檻為起始值，無文獻或院內依據。');
if (!OP.mqFrozen) {
GG.inc.slice(0, 2).forEach(function (r) { hl.push({ what: r.u + ' 問題 ' + r.n + ' 件（自身中位數 ' + r.med + '）、投入未增', next: mNext(r, '下月增加照護班次', 'MQ_M2_INC_HL') }); });
if (GG.na.length >= 3 && hl.length < 3) hl.push({ what: GG.na.length + ' 個病房登錄者未填超過 20%，無法判斷藥師投入', next: opNx('MQ_M2_NA', '藥師以「編輯回覆」補填登錄者，再判讀') });
if (hl.length < 3) GG.two.slice(0, 1).forEach(function (r) { hl.push({ what: r.u + ' ' + r.why, next: mNext(r, '先排兩週照護班次，再看件數決定', 'MQ_M2_TWO') }); });
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
/* Q1 紀錄空窗 */
var c1 = opCard(box, 'opQ1', 'Q1｜本季哪些服務線或疾病沒有紀錄？', { st: gap.length ? 'warn' : 'ok', stTxt: gap.length ? gap.length + ' 條服務線 0 件' : '各服務線皆有紀錄', sub: mqQLab(q) });
c1.body.appendChild(opTable(['服務線', '本季件數', '評鑑條文'], cnt.map(function (x) { return [x.s.name, x.n, OP_CLAUSE[OP_SVC_CLAUSE[x.s.svc]] ? OP_CLAUSE[OP_SVC_CLAUSE[x.s.svc]].no : '—']; })));
c1.body.appendChild(axEl('p', 'pcx-pn', '疾病：' + dl.filter(function (d) { return d.n; }).length + ' 個有紀錄、' + dl.filter(function (d) { return !d.n; }).length + ' 個本季 0 件。ICU 與藥師門診：非表單服務線選項，本頁不涵蓋（2.5.10 優良 6、7）。'));
c1.foot(gap.length ? gap.map(function (x) { return x.s.name + ' 本季 0 件 → ' + opNx('MQ_Q1_GAP_ALL', '全院各班次內補做（服務線無法對應單一病房）'); }) : ['維持現行'], '評鑑上「有服務無紀錄」與「無服務」在佐證上相同。', opClauseTxt('REV'));
/* Q2 下一季照護班次（v7.4.6）：彙整本季 3 個月的月結論，佐證卡狀態調整 */
var QD = opMqDecs(), pq = mqPrevQ(q), qAll = mqQMonths(q), qDone = qAll.filter(function (y) { return MS.done.indexOf(y) >= 0; }), cards = opMqDisCards(M, q);
var pqMs = mqQMonths(pq).filter(function (y) { return MS.done.indexOf(y) >= 0; }), Z0 = { n: 0, fte: 0, hr: 0, rej: 0, o3: 0 };
var qSum = function (ms, u) { var o = { n: 0, fte: 0, hr: 0, rej: 0, o3: 0 }; ms.forEach(function (y) { var w = opMqW(M, y)[u] || Z0; ['n', 'fte', 'hr', 'rej', 'o3'].forEach(function (k) { o[k] += w[k]; }); }); return o; };
var rollD = opMqRoll(q).filter(function (y) { return MS.done.indexOf(y) >= 0; }), hos = opMqSum(M, rollD, ['all:全院']), hosW = { n: 0, hr: 0 };
rollD.forEach(function (y) { var W = opMqW(M, y); Object.keys(W).forEach(function (u) { hosW.n += W[u].n; hosW.hr += W[u].hr; }); });
var q2rows = opMqWards(M, qDone.length ? qDone : [qAll[0]]).map(function (u) {
var m3 = qAll.map(function (y) { if (qDone.indexOf(y) < 0) return { y: y, c: MS.all.indexOf(y) >= 0 ? 'run' : 'nd' }; opMqMonthGroups(M, y); var j = opMqJudge(M, y, u); return { y: y, c: j.c, rk: /^(inc|two|dec)$/.test(j.c) ? j.rank : null }; });
var cnt = {}; m3.forEach(function (x) { cnt[x.c] = (cnt[x.c] || 0) + 1; });
var S = qSum(qDone, u), p4 = [], qq = q; for (var i = 0; i < 4; i++) { qq = mqPrevQ(qq); p4.push(qSum(mqQMonths(qq).filter(function (y) { return MS.done.indexOf(y) >= 0; }), u).n); }
var med4 = opMed(p4), RK = opMqSum(M, opMqRoll(q).filter(function (y) { return MS.all.indexOf(y) >= 0; }), ['ward:' + u]), K = opMqSum(M, qDone, ['ward:' + u]);
var pInc = pqMs.filter(function (y) { return opMqJudge(M, y, u).c === 'inc'; }).length >= 2;
var c = cnt.inc >= 2 ? 'inc' : cnt.dec === 3 && !pInc ? 'dec' : (cnt.two >= 2 || (!S.n && med4 !== null && med4 > 0 && qDone.length === 3)) ? 'two' : cnt.keep >= 2 ? 'keep' : cnt.na >= 2 ? 'na' : 'none';
if (qDone.length < 3) c = 'run';
var gc = cards.filter(function (d) { return (d.st === 'gap' || d.st === 'weak') && d.resp.wards.indexOf(u) >= 0; }), gtx = gc.map(function (d) { return d.name + (d.st === 'gap' ? '（缺口）' : '（偏弱）'); }).join('、');
var own = cards.filter(function (d) { return d.resp.wards.indexOf(u) >= 0; });
var fin = c, next = '', note = '';
var prevDec = (QD || []).filter(function (d) { return d.q === pq && d.u === u.toUpperCase(); }).pop(), pin = !!(prevDec && prevDec.c === 'inc' && c === 'inc');
if (c === 'inc') { next = pin ? opNx('MQ_Q2_PIN', '季會討論醫師端對策（CDSS 規則、教學、處方集），不再只加班次') : opNx('MQ_Q2_INC', '下一季增加照護班次'); if (gc.length) note = '人力不足且影響評鑑佐證：' + gtx; var S4 = qSum(rollD, u); if (RK.ad >= 5 && hos.ad && RK.a1 / RK.ad < hos.a1 / hos.ad && S4.n >= 5 && hosW.n && S4.hr / S4.n < hosW.hr / hosW.n) note += (note ? '；' : '') + '滾動四季接受率與高警訊占比皆低於全院：先確認是處方問題還是登錄習慣'; }
else if (c === 'two') { next = opNx('MQ_Q2_TWO', '下一季先排兩週照護班次，再決定'); if (gc.length) note = '兩週內優先做：' + gtx; }
else if (c === 'dec') { if (gc.length) { fin = 'hold'; next = opNx('MQ_Q2_HOLD', '維持，先補佐證'); note = '主責佐證卡有缺口：' + gtx; } else next = opNx('MQ_Q2_DEC', '下一季可減少照護班次，移給「增加」的病房'); }
else if ((c === 'keep' || c === 'none') && gc.length) { fin = 'fill'; next = opNx('MQ_Q2_FILL', '班次不變，班次內補做') + '：' + gtx; }
else if (c === 'na') next = opNx('MQ_M2_NA', '藥師以「編輯回覆」補填登錄者，再判讀');
return { u: u, m3: m3, cnt: cnt, c: c, fin: fin, pin: pin, next: next, note: note, S: S, med4: med4, K: K, gc: gc, own: own, safe: S.hr + S.rej + S.o3, same: c === 'run' || c === 'none' ? 0 : (cnt[c] || 0), roll: RK.n };
});
var QG = function (f) { return opMqSort(q2rows.filter(function (r) { return r.fin === f; }), [function (r) { return r.pin ? 1e6 + r.safe : r.safe; }, function (r) { return r.gc.length; }, function (r) { return r.same; }, function (r) { return r.roll; }], 2); };
var qInc = QG('inc'), qTwo = QG('two'), qDec = opMqSort(q2rows.filter(function (r) { return r.fin === 'dec'; }), [function (r) { return opMqR1(r.S.fte); }, function (r) { return -opMqR1(r.S.n / Math.max(r.med4 || 0, 1)); }, function (r) { return r.same; }], 0), qHold = QG('hold'), qFill = QG('fill');
var nQ2 = qInc.length + qTwo.length + qDec.length + qHold.length + qFill.length, run = qDone.length < 3;
var c2q = opCard(box, 'opQ2', 'Q2｜下一季哪些病房要調整照護班次？', { st: run ? 'na' : nQ2 ? 'warn' : 'ok', stTxt: run ? '本季未滿 3 個完整月' : nQ2 ? nQ2 + ' 個病房' : '各病房維持', sub: mqQLab(q) + '｜每列 3 格＝本季 3 個月的月頁結論（數字＝當月名次）；季結論由 3 格得出，再依主責疾病佐證卡調整' });
opPrintBtn(c2q.sec);
var blk = function (m3) { var w = axEl('span', 'op-cbs'); m3.forEach(function (x) { var b = axEl('i', 'op-cb op-cb-' + x.c, x.c === 'run' ? '中' : x.c === 'nd' ? '' : MQC_S[x.c] + (x.rk ? x.rk : '')); b.title = ccYmLab(x.y) + '：' + (x.c === 'run' ? '進行中' : x.c === 'nd' ? '無資料' : MQC[x.c]); w.appendChild(b); }); return w; };
var FIN = { inc: MQC.inc, two: MQC.two, dec: MQC.dec, hold: '維持，先補佐證', fill: '維持，班次內補做', keep: MQC.keep, na: MQC.na, none: MQC.none, run: '本季未完' };
var qTab = function (list) {
return opTable(['病房', '本季 3 個月', '本季件數（前 4 季中位數）', '折算人力（季合計）', '每折算人力件數', '高警訊占比', '接受率', '解決率', '主責疾病卡', '季結論'], list.map(function (r) {
return { cls: r.pin ? 'op-hi' : '', cells: [r.rank ? r.rank + '. ' + r.u + (r.tie ? '＝' : '') + (r.pin ? '（已調整仍偏高）' : '') : r.u, blk(r.m3), r.S.n + '（' + (r.med4 === null ? '—' : r.med4) + '）', r.S.fte.toFixed(2), r.S.fte ? (r.S.n / r.S.fte).toFixed(1) : '—', r.S.n ? Math.round(r.S.hr / r.S.n * 100) + '%' : '—', opSmall(r.K.a1, r.K.ad), opSmall(r.K.o1, r.K.ok), r.own.length ? r.own.map(function (d) { return d.name + ({ gap: '（缺口）', weak: '（偏弱）', ok: '' })[d.st]; }).join('、') : '—', FIN[r.fin] + (r.note ? '｜' + r.note : '')] };
}));
};
[['增加照護班次', qInc], ['先照護兩週再決定', qTwo], ['減少照護班次', qDec], ['維持，先補佐證（原為減少）', qHold], ['維持，班次內補做', qFill]].forEach(function (g) { if (!g[1].length) return; c2q.body.appendChild(axEl('h4', 'op-gh', g[0] + '（' + g[1].length + '）')); c2q.body.appendChild(qTab(g[1])); });
var qRest = q2rows.filter(function (r) { return !/^(inc|two|dec|hold|fill)$/.test(r.fin); }).sort(function (a, b) { return b.S.n - a.S.n || a.u.localeCompare(b.u, 'en', { numeric: true }); });
if (!nQ2 && !run) c2q.body.appendChild(axEl('p', 'ax-muted', '本季沒有病房需要調整照護班次。'));
opFold(c2q.body, '其餘病房（' + qRest.length + '）', [qTab(qRest)]);
var nxq = [];
if (run) nxq.push('本季月份未滿 3 個完整月，季結論待季末');
else qInc.concat(qTwo, qDec, qHold, qFill).slice(0, 6).forEach(function (r) { nxq.push(r.u + '：' + FIN[r.fin] + (r.note ? '（' + r.note + '）' : '') + ' → ' + r.next); });
c2q.foot(nxq.length ? nxq.concat(['季會決議請填「儀表板檢討紀錄」：頁面＝臨床藥學服務、卡片＝Q2、病房、照護班次決議；下一季月頁顯示「執行中」，Q5 顯示前後對照']) : ['各病房維持現行照護班次'],
'季結論：本季 ≥2 個月「增加」→增加；3 個月都「減少」且上季不是增加→減少；≥2 個月「先照護兩週」或整季 0 件（前 4 季中位數 >0）→先照護兩週；≥2 個月「維持」→維持。主責疾病卡（主要＋共病，滾動四季 ≥10 件、病房占 ≥20% 且 ≥3 件）有缺口（本季 0 件，或低於前 4 季中位數一半且中位數 ≥4）或偏弱（≥5 件且接受率或解決率 95% CI 上限低於自身滾動四季）時：減少改為「維持，先補佐證」；維持改為「班次內補做」；增加與先照護兩週排序提前。排序：上季已決議增加、本季仍增加者置頂 → 高警訊＋不接受＋未解決（本季合計）→ 主責卡缺口或偏弱張數 → 同一結論月數 → 滾動四季件數；第 1 鍵差 ≤2 件且其餘相同標「並列」。同一筆照會的多個共病會計入多張疾病卡。所有門檻為起始值，無文獻或院內依據。', opClauseTxt('REV'));
opDecision(c2q.sec);
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
c5.body.appendChild(opTable(['病房', '上季決議', '上季件數', '本季件數', '上季折算人力', '本季折算人力', '上季高警訊', '本季高警訊', '本季結論'], dq.map(function (d) {
var a = pS(d.u), r = q2rows.filter(function (x) { return x.u.toUpperCase() === d.u; })[0], b = r ? r.S : qSum(qDone, d.u);
return [d.u, d.txt, a.n, b.n, a.fte.toFixed(2), b.fte.toFixed(2), a.hr, b.hr, r ? FIN[r.fin] + (r.pin ? '（已調整仍偏高）' : '') : '—'];
})));
}
c5.foot(dq.length ? ['逐一 → ' + opNx('MQ_Q5', '季會決定延續、再調整或恢復，填入本季「儀表板檢討紀錄」')] : ['本季決議 → ' + opNx('MQ_Q5_NONE', '會後填入「儀表板檢討紀錄」（頁面、卡片 Q2、病房、照護班次決議）')],
'前後對照只是觀察，不是因果：病人組成、季節、登錄習慣都會影響件數。建議一次只調整 1–2 個病房，方便下一季判讀。系統只顯示人工紀錄，不追蹤、不結案。', opClauseTxt('REV'));
/* Q6 高齡 */
box.appendChild(axEl('h3', 'op-gh', 'Q6｜高齡（≥65 歲）'));
opMqCard(box, M, 'ger:65', '高齡（≥65 歲）', qms, cms, q8, { ax: 'opQg', clause: 'GER' });
}
(function(){var c=document.createElement('style');c.textContent='.op-mgrp h4{margin:4px 0}.op-cbs{display:inline-flex;gap:2px}.op-cb{display:inline-block;min-width:30px;padding:1px 3px;border-radius:3px;font-style:normal;font-size:.72rem;text-align:center;background:#edf2f7;color:#4a5568}.op-cb-inc{background:#dd6b20;color:#fff}.op-cb-two{background:#d69e2e;color:#fff}.op-cb-dec{background:#3182ce;color:#fff}.op-cb-keep{background:#a0aec0;color:#fff}.op-cb-na{background:#fff;border:1px dashed #a0aec0}';document.head.appendChild(c)})();