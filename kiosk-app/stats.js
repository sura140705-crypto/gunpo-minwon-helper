'use strict';
/* =====================================================================
   stats.js — 운영 통계 (2026.09.01)

   서식별 접속수·인쇄수, 유휴 접근·중도 이탈, 가동시간을 센다.

   ⛔ **개인정보는 한 글자도 담지 않는다.** 담는 것은 셋뿐이다 —
      화면 이름(`birth` 같은 서식 이름) · 날짜와 시(시간대) · 세어진 횟수.
      ⛔ 입력값·인쇄 내용·사람에 관한 것을 여기에 넣지 마라. 이 앱의 전제
         (「적으신 내용은 저장·전송되지 않습니다」)가 무너진다.
   📌 시각은 **시간대(시)까지만** 남긴다(2026.09.01 결정). 초 단위로 남기면
      CCTV 같은 다른 기록과 맞춰 「누가 언제 썼는지」가 드러날 수 있다.

   ⚠️ **하드보안관이 걸린 PC에서 보존 드라이브 폴더가 없으면 통계가 재부팅마다
      사라진다.** 설정과 같은 곳에 쌓기 때문이다. 통계는 없어도 인쇄는 되므로
      **몇 달 뒤에야 눈치챈다** — 그래서 `--selfcheck` 가 매번 그 사실을 알린다.

   파일: <설정폴더>\stats\YYYY.MM.csv    (엑셀에서 바로 열린다)
     날짜,시,가동분,접근,이탈,인쇄성공,인쇄실패,접속_여권,인쇄_여권,…
   ===================================================================== */
const fs = require('fs');
const path = require('path');

/* 서식 이름 — 파일 이름에서 뽑는다(`birth-helper-v1.html` → `birth`).
   ⛔ 여기 없는 이름은 `기타` 로 뭉친다. 새 서식이 늘면 이 목록에 더해야 열이 생긴다. */
const FORMS = ['passport', 'birth', 'marriage', 'divorce', 'death', 'naming', 'cert', 'realestate'];
const LABEL = {
  passport: '여권', birth: '출생', marriage: '혼인', divorce: '이혼',
  death: '사망', naming: '개명', cert: '증명서', realestate: '부동산',
};
const BASE = ['가동분', '접근', '이탈', '인쇄성공', '인쇄실패'];

function columns() {
  const c = ['날짜', '시'].concat(BASE);
  FORMS.forEach((f) => { c.push('접속_' + LABEL[f], '인쇄_' + LABEL[f]); });
  return c;
}

/* 화면 주소에서 서식 이름을 뽑는다. 허브(`index.html`)와 관리자 화면은 세지 않는다. */
function formOf(url) {
  const m = String(url || '').match(/([a-z]+)-helper-v1\.html/i);
  if (!m) return null;
  const n = m[1].toLowerCase();
  return FORMS.indexOf(n) >= 0 ? n : null;
}

function pad(n) { return (n < 10 ? '0' : '') + n; }
function stampOf(d) {
  return { day: d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()),
           hour: pad(d.getHours()),
           file: d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.csv' };
}

class Stats {
  /* `dirOf` 는 **함수**로 받는다 — 설정 폴더가 실행 중에 정해지고, 통계는 늘 설정과
     같은 곳에 있어야 한다(보존 드라이브를 쓰면 통계도 함께 살아남는다). */
  constructor(dirOf) {
    this.dirOf = dirOf;
    this.buf = new Map();          // "YYYY.MM.csv|날짜|시" → {항목:수}
    this.timer = null;
    this.lastMinute = null;
  }

  dir() { return path.join(this.dirOf(), 'stats'); }

  /* 한 칸 올린다. ⛔ 값(개인정보)을 인자로 받지 않는다 — 세는 이름과 1 뿐이다. */
  bump(key, by) {
    const s = stampOf(new Date());
    const id = s.file + '|' + s.day + '|' + s.hour;
    if (!this.buf.has(id)) this.buf.set(id, {});
    const row = this.buf.get(id);
    row[key] = (row[key] || 0) + (by || 1);
  }

  visit(url) { const f = formOf(url); if (f) this.bump('접속_' + LABEL[f]); }
  printed(url, ok) {
    this.bump(ok ? '인쇄성공' : '인쇄실패');
    const f = formOf(url);
    if (f && ok) this.bump('인쇄_' + LABEL[f]);
  }
  /* 유휴 시연이 사람 손에 멈춘 것(접근) · 무동작으로 초기화된 것(중도 이탈) */
  wake() { this.bump('접근'); }
  idleReset() { this.bump('이탈'); }

  /* 가동시간 — 1분마다 그 시간대에 1분씩 더한다.
     ⚠️ 시작·종료 시각을 빼는 방식이 아니다. 전원이 갑자기 끊겨도 **직전 1분까지는**
        남아 있어야 하기 때문이다(키오스크는 정상 종료를 못 하는 경우가 흔하다). */
  start() {
    if (this.timer) return;
    this.timer = setInterval(() => { this.bump('가동분'); this.flush(); }, 60 * 1000);
    if (this.timer.unref) this.timer.unref();
  }
  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    this.flush();
  }

  /* 모아 둔 것을 CSV 에 반영한다. 같은 (날짜,시) 줄이 있으면 더하고, 없으면 새 줄. */
  flush() {
    if (!this.buf.size) return;
    const byFile = new Map();
    this.buf.forEach((row, id) => {
      const p = id.split('|');
      if (!byFile.has(p[0])) byFile.set(p[0], []);
      byFile.get(p[0]).push({ day: p[1], hour: p[2], row: row });
    });
    this.buf.clear();
    byFile.forEach((items, file) => {
      try { this.merge(file, items); }
      catch (e) { console.error('[통계] 기록 실패:', e.message); }
    });
  }

  merge(file, items) {
    const dir = this.dir();
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, file);
    const cols = columns();
    const table = new Map();                       // "날짜|시" → 숫자 배열
    if (fs.existsSync(p)) {
      /* ⚠️ **BOM 을 떼고 읽는다.** 우리가 붙여 둔 그 BOM 이 그대로 첫 열 이름에 붙어
         `날짜` 가 `﻿날짜` 가 되면, 있는 줄을 못 찾아 **같은 시간대가 줄로 갈린다**
         (2026.09.01 시험에서 실제로 그랬다). 쌓기만 하고 합쳐지지 않는다. */
      const lines = fs.readFileSync(p, 'utf8').replace(/^﻿/, '')
        .split(/\r?\n/).filter(Boolean);
      const head = (lines.shift() || '').split(',');
      lines.forEach((ln) => {
        const v = ln.split(',');
        const o = {};
        head.forEach((h, i) => { o[h] = v[i]; });
        const arr = cols.map((c) => (c === '날짜' || c === '시') ? o[c] : (+o[c] || 0));
        table.set(o['날짜'] + '|' + o['시'], arr);
      });
    }
    items.forEach((it) => {
      const key = it.day + '|' + it.hour;
      if (!table.has(key)) {
        table.set(key, cols.map((c) => (c === '날짜' ? it.day : c === '시' ? it.hour : 0)));
      }
      const arr = table.get(key);
      Object.keys(it.row).forEach((k) => {
        const i = cols.indexOf(k);
        if (i > 1) arr[i] += it.row[k];            // ⛔ 모르는 이름은 조용히 버린다
      });
    });
    const keys = Array.from(table.keys()).sort();
    /* ⚠️ BOM 을 붙인다 — 없으면 엑셀이 UTF-8 CSV 의 한글을 깨뜨린다. */
    const out = '﻿' + cols.join(',') + '\r\n'
      + keys.map((k) => table.get(k).join(',')).join('\r\n') + '\r\n';
    fs.writeFileSync(p, out, 'utf8');
  }

  /* ── 사람이 읽는 요약 (`--stats`) ──────────────────────────────────── */
  summary(months) {
    const dir = this.dir();
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => /^\d{4}\.\d{2}\.csv$/.test(f)).sort(); }
    catch (e) { return ['통계가 아직 없습니다: ' + dir]; }
    if (!files.length) return ['통계가 아직 없습니다: ' + dir];
    if (months > 0) files = files.slice(-months);

    const L = ['군포시 민원 서식 작성 도우미 — 운영 통계', ''];
    L.push('폴더: ' + dir);
    L.push('⛔ 이 파일에는 개인정보가 없습니다 — 화면 이름·시간대·횟수뿐입니다.');
    L.push('');
    const cols = columns();
    files.forEach((f) => {
      const lines = fs.readFileSync(path.join(dir, f), 'utf8')
        .replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
      const head = lines.shift().split(',');
      const sum = {}; const days = new Set(); const byHour = {};
      lines.forEach((ln) => {
        const v = ln.split(',');
        const o = {}; head.forEach((h, i) => { o[h] = v[i]; });
        days.add(o['날짜']);
        cols.slice(2).forEach((c) => { sum[c] = (sum[c] || 0) + (+o[c] || 0); });
        byHour[o['시']] = (byHour[o['시']] || 0) + (+o['인쇄성공'] || 0);
      });
      const visit = FORMS.reduce((a, k) => a + (sum['접속_' + LABEL[k]] || 0), 0);
      const print = FORMS.reduce((a, k) => a + (sum['인쇄_' + LABEL[k]] || 0), 0);
      const hh = Math.floor((sum['가동분'] || 0) / 60);
      L.push('── ' + f.replace('.csv', '') + '  (기록된 날 ' + days.size + '일) ──');
      L.push('  가동 ' + hh + '시간 ' + ((sum['가동분'] || 0) % 60) + '분'
             + ' · 접근 ' + (sum['접근'] || 0)
             + ' · 작성 시작 ' + visit
             + ' · 인쇄 ' + print
             + (visit ? '  (완주율 ' + Math.round(100 * print / visit) + '%)' : ''));
      if (sum['인쇄실패']) L.push('  ⚠️ 인쇄 실패 ' + sum['인쇄실패'] + '건 — 프린터를 확인하세요');
      if (sum['이탈']) L.push('  중도 이탈(무동작 초기화) ' + sum['이탈'] + '건');
      L.push('');
      FORMS.forEach((k) => {
        const v = sum['접속_' + LABEL[k]] || 0, pr = sum['인쇄_' + LABEL[k]] || 0;
        if (v || pr) {
          L.push('    ' + (LABEL[k] + '      ').slice(0, 5)
                 + ' 작성 ' + String(v).padStart(4) + ' · 인쇄 ' + String(pr).padStart(4)
                 + (v ? '  (' + Math.round(100 * pr / v) + '%)' : ''));
        }
      });
      const busy = Object.keys(byHour).sort((a, b) => byHour[b] - byHour[a]).slice(0, 3)
        .filter((h) => byHour[h] > 0);
      if (busy.length) {
        L.push('');
        L.push('    많이 인쇄한 시간대: ' + busy.map((h) => h + '시(' + byHour[h] + ')').join(' · '));
      }
      L.push('');
    });
    return L;
  }
}

module.exports = { Stats: Stats, formOf: formOf, columns: columns, FORMS: FORMS, LABEL: LABEL };
