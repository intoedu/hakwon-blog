/* ESC 블로그 센터 — 공통
   화면은 편의일 뿐이고, 실제 차단은 전부 Supabase(RLS·함수)가 서버에서 합니다. */
window.ESC = (function () {
  'use strict';

  var SB_URL = 'https://qkvebwxewttqtcryfycy.supabase.co';
  var SB_KEY = 'sb_publishable_Me_R6M540Fg60nmEVqByTg_p-zD8pxa';

  var A = {
    sb: (window.supabase && window.supabase.createClient)
      ? window.supabase.createClient(SB_URL, SB_KEY) : null,
    ME: null, IS_ADMIN: false, IS_REVIEWER: false, IS_OWNER: false, VIEW_AS: 'admin', SESSION: null,
    PREVIEW_STAFF: null, SELF_NAME: '', SELF_COMMS: [], MY_COMMS: [],
    LEVELS: [], COMMS: [], PEOPLE: [], ORDERS: [], BLOGSTAFF: []
  };

  /* ── 유틸 ── */
  A.$ = function (id) { return document.getElementById(id); };
  A.esc = function (s) {
    return (s == null ? '' : ('' + s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
  A.won = function (n) { return (Number(n) || 0).toLocaleString('ko-KR'); };
  A.fdate = function (s) {
    if (!s) return '-';
    var d = new Date(s);
    return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2);
  };
  A.fdt = function (s) {
    if (!s) return '-';
    var d = new Date(s);
    return A.fdate(s) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  };
  A.today = function () { return new Date().toISOString().slice(0, 10); };
  A.thisMonth = function () { return new Date().toISOString().slice(0, 7); };
  A.dday = function (d) {
    if (!d) return null;
    return Math.round((new Date(d + 'T00:00:00') - new Date(A.today() + 'T00:00:00')) / 86400000);
  };

  var tTimer;
  A.toast = function (m) {
    var t = A.$('toast'); t.textContent = m; t.classList.add('on');
    clearTimeout(tTimer); tTimer = setTimeout(function () { t.classList.remove('on'); }, 2800);
  };
  A.msg = function (boxId, text, kind) {
    var b = A.$(boxId); if (!b) return;
    b.innerHTML = text ? '<div class="msg ' + (kind || 'err') + '">' + A.esc(text) + '</div>' : '';
  };
  A.levelOf = function (lv) {
    return A.LEVELS.filter(function (x) { return x.lv === lv; })[0] || { lv: lv, name: lv + '단계', rate: 0 };
  };
  A.lvBadge = function (lv) {
    return '<span class="lv' + (lv >= 5 ? ' l5' : lv === 4 ? ' l4' : '') + '">' + lv + '</span>';
  };
  A.commName = function (id) {
    if (!id) return 'ESC';        /* 공동체가 비어 있으면 ESC 소속입니다 */
    var f = A.COMMS.filter(function (c) { return c.id === id; })[0];
    return f ? f.name : '-';
  };
  A.empty = function (t) { return '<div class="empty">' + A.esc(t) + '</div>'; };

  /* ── 광고 표시 문구 고르기 ──
     ⚠️ 예전에는 글 순번(seq)으로 골랐습니다. 그런데 글은 순번대로 돌아가며 배정되기 때문에,
     블로거 수가 문구 수의 약수가 되면(문구 20개에 블로거 10명·5명·4명…) 한 사람이
     늘 같은 문구만 받게 됩니다. 그러면 그 블로그의 글이 전부 같은 꼬리표를 달게 되고,
     블로그 자체가 광고 채널로 분류될 위험이 커집니다 — 문구를 여러 개 둔 이유가 사라집니다.
     그래서 글 id를 섞은 값으로 고릅니다. 사람 수와 무관하고, 같은 글은 언제 봐도 같은 문구입니다.

     ⚠️ 곱셈은 Math.imul 로 합니다. 그냥 `h * 16777619` 로 하면 32비트를 넘어가면서
     아래 자릿수가 뭉개져, 20으로 나눈 나머지가 몇몇 값에만 몰립니다(실측 10~160배 편차).
     마지막 섞기(avalanche) 세 줄도 같은 이유로 필요합니다. */
  A.adIndex = function (id, n) {
    var h = 2166136261, s = String(id || ''), i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    h ^= h >>> 16; h = Math.imul(h, 2246822507);
    h ^= h >>> 13; h = Math.imul(h, 3266489909);
    h = (h ^ (h >>> 16)) >>> 0;
    return n > 0 ? h % n : 0;
  };
  A.adLine = function (p) {
    var L = A.AD_LINES || [];
    if (!L.length) return '';
    return L[A.adIndex(p && p.id, L.length)];
  };

  /* ── 사진 여러 장을 ZIP 하나로 묶어 내려받기 ──
     한 장씩 우클릭해서 받으면 72장이면 72번입니다. 관리자(꼬리표용 전체)와
     블로거(자기 글 몫 5~8장) 양쪽에서 씁니다.
     바깥 라이브러리를 안 쓰려고 압축 없이(store) 담습니다 — 어차피 JPEG 라 더 안 줄어듭니다.
     ⚠️ 한글 파일 이름이 깨지지 않으려면 general purpose flag 에 0x0800(UTF-8) 을 켜야 합니다. */
  var CRCT = null;
  function crc32(buf) {
    if (!CRCT) {
      CRCT = new Int32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        CRCT[n] = c;
      }
    }
    var crc = -1;
    for (var i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRCT[(crc ^ buf[i]) & 0xFF];
    return (crc ^ -1) >>> 0;
  }
  function zipStore(files) {                 /* [{name, data:Uint8Array}] → Blob */
    var enc = new TextEncoder(), parts = [], central = [], offset = 0;
    files.forEach(function (f) {
      var nameBuf = enc.encode(f.name), c = crc32(f.data), len = f.data.length;
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, 0, true); lh.setUint16(12, 0, true);
      lh.setUint32(14, c, true); lh.setUint32(18, len, true); lh.setUint32(22, len, true);
      lh.setUint16(26, nameBuf.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nameBuf, f.data);

      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0, true);
      ch.setUint32(16, c, true); ch.setUint32(20, len, true); ch.setUint32(24, len, true);
      ch.setUint16(28, nameBuf.length, true); ch.setUint16(30, 0, true); ch.setUint16(32, 0, true);
      ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameBuf);
      offset += 30 + nameBuf.length + len;
    });
    var cSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
    end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }
  /* ── 누운 사진 바로 세우기 ──
     학원이 보낸 사진 중에는 방향 정보가 없어 90도 누운 것이 섞여 있습니다.
     화면에서만 돌려 보여주면 블로거가 받는 파일은 그대로 누워 있으므로,
     내려받을 때 **파일 자체를 다시 그려서** 바로 선 채로 내보냅니다. */
  A.rotateBlob = async function (blob, deg) {
    deg = ((Number(deg) || 0) % 360 + 360) % 360;
    if (!deg) return blob;
    var bmp;
    try { bmp = await createImageBitmap(blob); } catch (e) { return blob; }
    var swap = (deg === 90 || deg === 270);
    var w = swap ? bmp.height : bmp.width, h = swap ? bmp.width : bmp.height;
    var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    var cx = cv.getContext('2d');
    cx.translate(w / 2, h / 2);
    cx.rotate(deg * Math.PI / 180);
    cx.drawImage(bmp, -bmp.width / 2, -bmp.height / 2);
    if (bmp.close) bmp.close();
    return await new Promise(function (res) {
      cv.toBlob(function (b) { res(b || blob); }, 'image/jpeg', 0.92);
    });
  };

  /* items = [{url, name, rotate}] · onStep(현재, 전체) 로 진행 상황을 알려줍니다 */
  A.zipDownload = async function (items, zipName, onStep) {
    var files = [];
    for (var i = 0; i < items.length; i++) {
      if (onStep) onStep(i + 1, items.length);
      var res = await fetch(items[i].url);
      if (!res.ok) continue;
      var name = items[i].name, body = await res.blob();
      if (items[i].rotate) {
        body = await A.rotateBlob(body, items[i].rotate);
        name = name.replace(/\.(png|webp|heic)$/i, '.jpg');   /* 다시 그리면 JPEG 입니다 */
      }
      files.push({ name: name, data: new Uint8Array(await body.arrayBuffer()) });
    }
    if (!files.length) throw new Error('한 장도 받지 못했습니다');
    var url = URL.createObjectURL(zipStore(files));
    var a = document.createElement('a');
    a.href = url; a.download = zipName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    return files.length;
  };

  /* ── 이 글에 달 태그 고르기 ──
     예전엔 「7~10개」라고만 적어 두고 블로거가 알아서 달았습니다. 그러면
     ①학원이 강조하는 말이 태그에 안 들어가고 ②50편이 전부 같은 태그를 달아
     한 학원 글끼리 묶여 버립니다. 그래서 세 갈래로 만들어 내려 줍니다.
       ① 고정 태그 — 학원명·지역처럼 모든 글에 들어가야 하는 것
       ② 그 글 검색어 — 제목에 쓰는 말을 붙여서 하나
       ③ 소재 태그 — 그 글이 다루는 이야기에만 붙는 것
       ④ 돌려쓰는 태그 — 글 순번으로 밀어가며 뽑아, 글마다 조합이 달라지게
     ⚠️ 순번을 한 칸씩 밀면 옆 글과 거의 같아지므로 뽑는 개수만큼 건너뜁니다
     (사진 고르기와 같은 이유입니다). */
  A.tagsFor = function (p, max) {
    max = max || 10;
    var cfg = (p && p.tags) || {}, out = [], seen = {};
    function add(t) {
      t = String(t == null ? '' : t).trim().replace(/^#+/, '').replace(/\s+/g, ' ');
      if (!t || seen[t] || out.length >= max) return;
      seen[t] = 1; out.push(t);
    }
    (cfg.fixed || []).forEach(add);
    if (p && p.keyword) add(String(p.keyword).replace(/\s+/g, ''));
    (p && p.topic_tags || []).forEach(add);

    var pool = (cfg.pool || []).filter(function (t) {
      return t && !seen[String(t).trim().replace(/^#+/, '')];
    });
    if (pool.length) {
      var want = Math.max(0, max - out.length);
      var step = Math.max(1, want);
      var start = (((p && p.seq || 1) - 1) * step) % pool.length;
      for (var i = 0; i < pool.length && out.length < max; i++) add(pool[(start + i) % pool.length]);
    }
    return out;
  };

  /* 유튜브 주소에서 영상 id 뽑기 (youtu.be · watch?v= · embed · shorts · live) */
  A.ytId = function (url) {
    var m = String(url || '')
      .match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{6,})/);
    return m ? m[1] : '';
  };
  /* 자료 목록의 썸네일 — 유튜브가 주는 그림을 그대로 씁니다.
     못 불러오면(주소가 유튜브가 아니거나 그림이 막히면) 원래 ▶ 네모로 돌아갑니다. */
  A.ytThumb = function (url) {
    var id = A.ytId(url);
    if (!id) return '<div class="thumb">▶</div>';
    return '<div class="thumb"><img src="https://i.ytimg.com/vi/' + A.esc(id) + '/mqdefault.jpg"'
      + ' alt="" referrerpolicy="no-referrer" onerror="this.remove()"><span class="pl">▶</span></div>';
  };

  /* 서버가 막으면 예외가 올라옵니다 */
  A.rpc = async function (fn, args) {
    var r = await A.sb.rpc(fn, args);
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };
  A.sel = async function (table, q) {
    var b = A.sb.from(table).select(q && q.select ? q.select : '*');
    if (q && q.eq) Object.keys(q.eq).forEach(function (k) { b = b.eq(k, q.eq[k]); });
    if (q && q.order) b = b.order(q.order, { ascending: q.asc !== false });
    var r = await b;
    if (r.error) { console.warn(table, r.error.message); return []; }
    return r.data || [];
  };

  /* 상태 이름 */
  A.ST = {
    pending: ['기다리는 중', 'c-off'], assigned: ['배정됨', 'c-info'],
    writing: ['쓰는 중', 'c-wait'], submitted: ['원고 냄', 'c-info'],
    rework: ['다시 쓰기', 'c-bad'], approved: ['원고 통과', 'c-info'],
    published: ['올림 · 확인 전', 'c-info'], verified: ['확인 끝', 'c-ok'],
    paid: ['정산 완료', 'c-ok'], cancelled: ['취소', 'c-off']
  };
  A.stChip = function (s) {
    var x = A.ST[s] || [s, 'c-off'];
    return '<span class="chip ' + x[1] + '">' + x[0] + '</span>';
  };

  /* ── 화면 전환 ── */
  A.gate = function (id) {
    A.$('app').classList.add('hide');
    A.$('gate').classList.remove('hide');
    ['g-loading', 'g-login', 'g-signup', 'g-pending', 'g-rejected', 'g-paused', 'g-nostaff']
      .forEach(function (g) { A.$(g).classList.toggle('hide', g !== id); });
  };
  /* 어느 얼굴로 들어갈지 — 'admin' 이면 전체, 'reviewer' 면 검수만.
     관리자는 위쪽 전환 버튼으로 검수자 화면을 미리 볼 수 있습니다(서버 권한은 그대로). */
  A.applyView = function (mode) {
    A.VIEW_AS = mode;
    var rev = mode === 'reviewer', blg = mode === 'blogger';
    A.$('navAdmin').classList.toggle('hide', rev || blg);
    A.$('navReviewer').classList.toggle('hide', !rev);
    A.$('navBlogger').classList.toggle('hide', !blg);
    var W = A.WORDS();
    A.$('meRole').textContent = rev ? (A.isRv() ? '리뷰 확인 담당' : '블로그 원고 검수자')
      : blg ? W.who + ' 화면 보는 중'
      : (A.isRv() ? '리뷰 센터 관리자' : '블로그 센터 관리자');

    var sw = A.$('viewSwitch');
    if (sw) sw.classList.toggle('hide', !A.IS_ADMIN);
    /* ⚠️ 갈래 고르는 칸은 검수자·블로거 화면을 볼 때도 남겨 둡니다.
       안 그러면 「리뷰어 화면을 보려고 블로거로 바꾸는 순간 갈래를 못 바꾸는」 막다른 길이 됩니다. */
    var tsw = A.$('trackSw');
    if (tsw) tsw.classList.toggle('hide', !A.IS_ADMIN);
    A.paintTrackWords();
    document.querySelectorAll('[data-view-btn]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.viewBtn === mode);
    });
    /* 검수자에게는 관리자 전용 조각을 숨깁니다 (서버에서도 막혀 있습니다) */
    document.querySelectorAll('[data-adminonly]').forEach(function (el) {
      el.classList.toggle('hide', rev || blg);
    });

    var pw = A.$('previewWho');
    if (pw) pw.classList.toggle('hide', !(rev || blg));
    A.$('previewBar').classList.toggle('hide', !(rev || blg));

    if (rev || blg) { A.fillPreviewWho(mode); return; }  /* 화면 열기는 미리보기 쪽에서 */

    /* 관리자로 돌아올 때는 남의 흔적을 반드시 지웁니다.
       (안 지우면 이름·담당 공동체가 아까 보던 사람 것으로 남습니다) */
    A.PREVIEW_STAFF = null;
    A.MY_COMMS = A.SELF_COMMS || [];
    A.$('meName').textContent = A.SELF_NAME
      || (A.SESSION && A.SESSION.user ? A.SESSION.user.email : '-');
    if (A.refreshReview) A.refreshReview();
    A.openApp('dash');
  };

  /* 누구 눈으로 볼지 고르기 — 블로거면 블로거 목록, 검수자면 블로그 스태프 목록 */
  A.fillPreviewWho = function (mode) {
    var pw = A.$('previewWho'); if (!pw) return;
    var blg = mode === 'blogger';
    var list = blg
      ? A.PEOPLE.filter(function (p) { return p.status === 'approved'; })
        .map(function (p) { return { id: p.id, name: p.name, sub: '' }; })
      : A.BLOGSTAFF.map(function (s) {
        return { id: s.id, name: s.name || s.email, sub: s.blogRole };
      });

    if (!list.length) {
      pw.innerHTML = '<option value="">' + (blg ? '승인된 블로거가 없습니다' : '검수자·관리자가 없습니다') + '</option>';
      pw.dataset.filled = '';
      A.$('previewBar').classList.add('hide');
      A.openApp(blg ? 'b-inbox' : A.reviewScreen());
      return;
    }

    var cur = pw.value;                       /* 다시 채우기 전에 기억해 둡니다 */
    var key = mode + ':' + list.map(function (p) { return p.id; }).join(',');
    if (pw.dataset.filled !== key) {
      pw.innerHTML = list.map(function (p) {
        return '<option value="' + p.id + '">' + A.esc(p.name)
          + (p.sub ? ' · ' + A.esc(p.sub) : '') + '</option>';
      }).join('');
      pw.dataset.filled = key;
      pw.onchange = function () { A.pickPreview(A.VIEW_AS, this.value); };
    }
    /* 「이 사람 화면으로 가기」로 들어온 경우 그 사람을 먼저 봅니다.
       (안 그러면 첫 사람을 한 번 열고 나서 다시 여는 헛걸음이 생깁니다) */
    if (A.PREVIEW_WANT && list.some(function (p) { return p.id === A.PREVIEW_WANT; })) {
      var want = A.PREVIEW_WANT; A.PREVIEW_WANT = null;
      A.pickPreview(mode, want); return;
    }
    A.PREVIEW_WANT = null;

    /* 아까 고른 사람이 목록에 아직 있으면 그 사람을 그대로 봅니다.
       (예전엔 무조건 첫 사람을 열어서, 고른 이름과 화면이 어긋났습니다) */
    var keep = list.some(function (p) { return p.id === cur; });
    A.pickPreview(mode, keep ? cur : list[0].id);
  };

  A.pickPreview = function (mode, id) {
    var pw = A.$('previewWho');
    if (pw && pw.value !== id) pw.value = id;   /* 고른 칸과 화면을 항상 맞춥니다 */
    if (mode === 'blogger') { A.loadBloggerPreview(id); return; }

    /* 검수자·관리자 — 그 사람 직분에 맞는 사이드바를 보여줍니다 */
    var s = A.BLOGSTAFF.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    A.PREVIEW_STAFF = id;
    A.MY_COMMS = s.comms || [];                   /* 검수 화면 형광펜이 이 사람 기준이 됩니다 */
    if (A.refreshReview) A.refreshReview();
    var full = s.blogRole !== '검수자';           /* 관리자·최고관리자면 전체 화면 */
    A.$('navAdmin').classList.toggle('hide', !full);
    A.$('navReviewer').classList.toggle('hide', full);
    A.$('meName').textContent = s.name || s.email;
    A.$('meRole').textContent = s.blogRole + ' 화면 보는 중';
    A.$('previewName').textContent = (s.name || s.email) + ' (' + s.blogRole + ')';
    document.querySelectorAll('[data-adminonly]').forEach(function (el) {
      el.classList.toggle('hide', !full);
    });
    A.openApp(full ? 'dash' : A.reviewScreen());
  };

  A.openApp = function (screen) {
    A.$('gate').classList.add('hide');
    A.$('app').classList.remove('hide');
    A.show(screen);
  };
  A.show = function (name) {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.toggle('on', s.dataset.screen === name);
    });
    document.querySelectorAll('.nav[data-go]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.go === name);
    });
    window.scrollTo(0, 0);
    if (A.onShow) A.onShow(name);
  };
  A.view = function (name) {
    document.querySelectorAll('.dv').forEach(function (d) {
      d.classList.toggle('on', d.dataset.view === name);
    });
    window.scrollTo(0, 0);
  };

  /* ── 공통 클릭 ── */
  document.addEventListener('click', async function (e) {
    var g = e.target.closest('[data-gate]');
    if (g) { A.gate(g.dataset.gate); return; }

    var out = e.target.closest('[data-out]');
    if (out) { await A.sb.auth.signOut(); location.hash = ''; location.reload(); return; }

    var vb = e.target.closest('[data-view-btn]');
    if (vb) { A.applyView(vb.dataset.viewBtn); return; }

    /* 사이드바 메뉴뿐 아니라 화면 안의 「6 검수하기 →」 같은 바로가기 버튼도 여기서 받습니다
       (예전엔 .nav / .fstep 만 받아서 오늘 할 일·알림의 바로가기가 안 눌렸습니다) */
    var n = e.target.closest('[data-go]');
    if (n) { A.show(n.dataset.go); return; }

    var bk = e.target.closest('[data-back]');
    if (bk) { A.view(bk.dataset.back); return; }

    var tab = e.target.closest('.tabs button');
    if (tab) {
      var box = tab.parentNode;
      box.querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); });
      tab.classList.add('on');
      if (tab.dataset.pane) {
        var scope = box.parentNode;
        scope.querySelectorAll(':scope > .pane').forEach(function (p) {
          p.classList.toggle('hide', p.dataset.pane !== tab.dataset.pane);
        });
      }
      if (tab.dataset.sub && A.onSubTab) A.onSubTab(tab.dataset.sub);
      if (tab.dataset.pane && A.onPane) A.onPane(tab.dataset.pane);
    }
  });

  /* ── 갈래 전환 (블로그 / 리뷰) ──
     메뉴 맨 위에서 고르면 아래 메뉴가 통째로 바뀌고, 화면 색도 같이 바뀝니다.
     지금 어느 일을 하고 있는지 헷갈리면 엉뚱한 주문에 손대게 되므로 색으로 갈라 둡니다.
     사람 관리(1번)·알림·주소 모음은 두 갈래가 같이 씁니다. */
  A.TRACK = 'blog';
  A.isRv = function () { return A.TRACK === 'review'; };
  /* 검수자가 먼저 여는 화면 — 블로그는 원고 검수, 리뷰는 올라왔는지 확인입니다 */
  A.reviewScreen = function () { return A.isRv() ? 'r-check' : 'review'; };
  /* 갈래에 따라 부르는 말이 달라집니다 — 블로그는 「블로거가 글을 쓴다」,
     리뷰는 「리뷰어가 올린다」입니다. 화면 곳곳에서 같은 말을 쓰려고 한 곳에 모았습니다. */
  A.WORDS = function () {
    return A.isRv()
      ? { who: '리뷰어', what: '리뷰', edu: '리뷰어 교육', work: '리뷰 올리기',
          workP: '우리가 써 드린 본문을 그대로 올리시면 됩니다. 리뷰어는 글을 쓰지 않습니다.',
          eduP: '리뷰 교육을 마치셔야 리뷰가 배정됩니다.',
          payP: '확인까지 끝난 리뷰만 돈이 됩니다. 공동체를 통해 들어옵니다.' }
      : { who: '블로거', what: '글', edu: '교육 받기', work: '글 쓰기',
          workP: '아래 폼대로 구글 문서에 쓰고 원고를 냅니다. 원고가 통과되면 블로그에 올리고, '
               + '<b>올린 글 주소</b>를 이 화면 맨 위에 넣어 주시면 끝입니다.',
          eduP: '줌 두 번을 들으시면 됩니다. 되도록 실시간으로 들어와 주세요.',
          payP: '확인까지 끝난 글만 돈이 됩니다. 공동체를 통해 들어옵니다.' };
  };
  /* 조사 붙이기 — 「글이 / 리뷰가」처럼 받침에 따라 달라집니다.
     갈래에 따라 말이 바뀌는 문장이 많아서 한 곳에 두었습니다. */
  A.josa = function (w, pair) {
    var t = { '이': ['이', '가'], '을': ['을', '를'], '은': ['은', '는'], '과': ['과', '와'] }[pair]
      || ['이', '가'];
    var c = (w || '').charCodeAt((w || '').length - 1);
    var hasJong = c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28 !== 0;
    return w + (hasJong ? t[0] : t[1]);
  };
  function setText(id, v) { var el = A.$(id); if (el) el.textContent = v; }
  function setHtml(id, v) { var el = A.$(id); if (el) el.innerHTML = v; }

  /* 블로거·리뷰어 쪽 이름표를 갈래에 맞게 바꿉니다 (사이드바 메뉴 · 화면 머리말) */
  A.paintTrackWords = function () {
    var w = A.WORDS();
    setText('bnEdu', w.edu); setText('bnWork', w.work); setText('bnPay', '내 정산');
    setText('bhEdu', w.edu); setText('bhEduP', w.eduP);
    setText('bhWork', w.work); setHtml('bhWorkP', w.workP);
    setText('bhPayP', w.payP);
    /* 아래쪽 [관리자 / 검수자 / 블로거] 에서 셋째 칸 이름도 갈래를 따릅니다 */
    var vb = document.querySelector('[data-view-btn="blogger"]');
    if (vb) vb.textContent = w.who;
    /* 내 이름 아래 직분도 같이.
       ⚠️ 「…화면 보는 중」은 관리자가 남의 화면을 들여다볼 때만 쓰는 말입니다.
       진짜 블로거에게는 자기 단계가 그대로 보여야 합니다. */
    if (!A.IS_ADMIN && !A.IS_REVIEWER) {
      if (A.ME) A.$('meRole').textContent = A.ME.level + '단계 · ' + A.levelOf(A.ME.level).name;
    } else if (A.VIEW_AS === 'blogger') A.$('meRole').textContent = w.who + ' 화면 보는 중';
    else if (A.VIEW_AS === 'reviewer') {
      if (!A.PREVIEW_STAFF) A.$('meRole').textContent = A.isRv() ? '리뷰 확인 담당' : '블로그 원고 검수자';
    } else if (A.IS_ADMIN) {
      A.$('meRole').textContent = A.isRv() ? '리뷰 센터 관리자' : '블로그 센터 관리자';
    }
  };

  A.setTrack = function (tk, jump) {
    A.TRACK = (tk === 'review') ? 'review' : 'blog';
    document.body.classList.toggle('tk-review', A.TRACK === 'review');
    document.querySelectorAll('[data-track]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.track === A.TRACK);
    });
    /* 그 갈래 것만 메뉴에 남깁니다 (data-tk 가 없으면 둘 다 씁니다) */
    document.querySelectorAll('[data-tk]').forEach(function (el) {
      el.classList.toggle('hide', el.dataset.tk !== A.TRACK);
    });
    try { localStorage.setItem('esc_track', A.TRACK); } catch (e) {}
    A.paintTrackWords();

    /* 블로거·리뷰어 화면을 보고 있으면 그 갈래 것으로 다시 그립니다
       (할 일 · 교육 · 정산이 전부 그 갈래 것만 남습니다) */
    if (A.VIEW_AS === 'blogger') { if (A.afterBloggerTrack) A.afterBloggerTrack(); return; }

    /* 지금 보고 있는 화면이 다른 갈래 것이면 그 갈래의 같은 자리로 옮겨 줍니다 */
    var pair = { edu: 'r-edu', kw: 'r-make', assign: 'r-assign', review: 'r-check' };
    var back = { 'r-edu': 'edu', 'r-make': 'kw', 'r-assign': 'assign', 'r-check': 'review' };
    var cur = document.querySelector('.screen.on');
    var now = cur ? cur.dataset.screen : '';
    var to = A.TRACK === 'review' ? pair[now] : back[now];
    if (jump !== false && to) A.show(to);
    else if (A.afterTrack) A.afterTrack();
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-track]');
    if (b) A.setTrack(b.dataset.track);
  });

  /* ── 설정 읽기 ──
     ⚠️ `settings` 테이블은 RLS 가 is_staff() 만 열어 줍니다. staff 행이 없는 순수 블로거는
     한 줄도 못 읽어서, 광고 표시 문구·단계 이름·글 규칙이 화면에서 통째로 빠졌습니다.
     (블로거 셋 중 둘이 staff 겸직이라 오래 눈에 안 띄었습니다.)
     그래서 블로거에게 필요한 셋만 돌려주는 blog_settings_public() 으로 받고,
     판매가·검수 수당 같은 나머지는 직원일 때만 테이블에서 따로 읽습니다. */
  A.loadSettings = async function () {
    var p = await A.sb.rpc('blog_settings_public');
    var v = p.data || {};
    A.LEVELS = v.levels || [];
    A.AD_LINES = v.ad_lines || [];
    A.FORM = v.form || {};

    var s = await A.sb.from('settings').select('value').eq('key', 'blog').maybeSingle();
    var full = (s.data && s.data.value) || null;
    if (full) {
      A.REVIEW_RATE = full.review || { approve: 250, verify: 250 };
      A.MONTH_CAP = Number(full.month_cap) || 30;   /* posts_auto_assign 이 쓰는 한 사람 월 상한 */
      A.SALE = full.sale || { normal: 6000, premium: 3000 };   /* 학원에게 받는 편당 금액 */
      A.SPLIT = full.split || { esc: 2, blogger: 2, community: 1, reviewer: 1 };
      /* 리뷰를 만들 때 AI 에게 주는 규칙 — 비어 있으면 admin.js 의 기본 규칙을 씁니다 */
      A.RV_RULES = full.rv_rules || '';
    }
  };

  /* 일반 회원 학원은 편당 판매가가 프리미엄의 몇 배인가 — 지급액도 그만큼 커집니다.
     서버의 blog_pay_mult() 와 같은 계산입니다 (화면에 미리 보여주려고 여기도 둡니다). */
  A.payMult = function () {
    var s = A.SALE || {};
    var p = Number(s.premium) || 0, n = Number(s.normal) || 0;
    return p > 0 && n > 0 ? n / p : 2;
  };

  /* ── 시작 ── */
  A.boot = async function () {
    A.gate('g-loading');
    if (!A.sb) { A.gate('g-login'); A.msg('loginMsg', '연결에 실패했습니다. 새로고침해 주세요.'); return; }

    A.LEVELS = []; A.AD_LINES = []; A.FORM = {};
    A.REVIEW_RATE = { approve: 250, verify: 250 };

    await A.loadCommsPublic();

    var ses = await A.sb.auth.getSession();
    A.SESSION = ses.data ? ses.data.session : null;
    var wantSignup = location.hash === '#signup';

    if (!A.SESSION) { A.gate(wantSignup ? 'g-signup' : 'g-login'); return; }

    await A.loadSettings();

    var a = await A.sb.rpc('blog_admin');
    A.IS_ADMIN = a.data === true;
    var rv = await A.sb.rpc('blog_reviewer');
    A.IS_REVIEWER = rv.data === true;      /* 관리자도 true 입니다 */
    var ow = await A.sb.rpc('is_owner');
    A.IS_OWNER = ow.data === true;         /* 주문 삭제는 최고관리자만 */

    var r = await A.sb.from('bloggers').select('*').eq('id', A.SESSION.user.id).maybeSingle();
    A.ME = r.data || null;

    // 모집 링크로 들어왔는데 아직 블로거가 아니면 신청서를 보여줍니다
    if (wantSignup && !A.ME) {
      A.gate('g-signup');
      A.prefillLoggedIn();
      if (A.IS_ADMIN) {
        A.msg('suMsg', '관리자 계정으로 로그인되어 있습니다. 지금 보시는 것이 신청자에게 보이는 화면입니다.', 'ok');
        A.$('btnBackAdmin').classList.remove('hide');
      }
      return;
    }

    if (A.IS_ADMIN) {
      A.$('meName').textContent = A.SESSION.user.email;
      A.applyView('admin');
      await A.loadAdmin();
      var saved = 'blog';
      try { saved = localStorage.getItem('esc_track') || 'blog'; } catch (e) {}
      A.setTrack(saved, false);
      A.applyHash();
      return;
    }

    /* ESC 직원 중 '검수만' 권한을 가진 분 */
    if (A.IS_REVIEWER) {
      A.$('meName').textContent = A.SESSION.user.email;
      A.applyView('reviewer');
      await A.loadAdmin();
      return;
    }

    /* 블로거도 아니고 블로그 권한도 없는 ESC 직원 */
    if (!A.ME) {
      var st = await A.sb.from('staff').select('name,email,role,status').eq('id', A.SESSION.user.id).maybeSingle();
      if (st.data && st.data.status === 'approved') {
        A.$('nostaffWho').textContent = (st.data.name || '') + ' · ' + (st.data.email || '');
        A.gate('g-nostaff');
        return;
      }
      A.gate('g-signup'); A.prefillLoggedIn();
      A.msg('suMsg', '이 계정은 아직 블로거로 등록되지 않았습니다. 아래를 채워 신청해 주세요.', 'ok');
      return;
    }
    if (A.ME.status === 'rejected') {
      A.$('rejReason').innerHTML = A.ME.reject_reason
        ? '<b>사유</b> · ' + A.esc(A.ME.reject_reason) + '<br><br>블로그를 더 키우신 뒤 다시 신청하실 수 있습니다.'
        : '자세한 사유는 담당자에게 문의해 주세요.';
      A.gate('g-rejected'); return;
    }
    if (A.ME.status === 'paused') { A.gate('g-paused'); return; }
    if (A.ME.status !== 'approved') {
      A.$('pendWho').textContent = A.ME.name + ' · ' + A.ME.email;
      A.gate('g-pending'); return;
    }

    A.$('navBlogger').classList.remove('hide');
    A.$('navAdmin').classList.add('hide');
    /* ⚠️ 여기서 VIEW_AS 를 반드시 'blogger' 로 둬야 합니다.
       처음 값이 'admin' 이라 그냥 두면, 갈래를 바꿔도 setTrack 이 관리자 쪽으로 빠져서
       **블로거 화면이 다시 안 그려집니다**(메뉴 이름만 바뀌고 할 일은 그대로였습니다). */
    A.VIEW_AS = 'blogger';
    /* 공동체 이름을 쓰려면 목록이 있어야 합니다 — 없으면 정산 화면에 「돈은 -로 갑니다」가 떴습니다 */
    A.COMMS = await A.sel('communities_public');
    A.$('meName').textContent = A.ME.name;
    A.$('meRole').textContent = A.ME.level + '단계 · ' + A.levelOf(A.ME.level).name;
    var savedB = 'blog';
    try { savedB = localStorage.getItem('esc_track') || 'blog'; } catch (e) {}
    A.setTrack(savedB, false);
    A.openApp('b-inbox');
    await A.loadBlogger();
  };

  /* 기존 관리자페이지에서 #order=<id> 로 바로 들어올 수 있게 */
  A.applyHash = function () {
    var h = location.hash.replace(/^#/, '');
    if (!h) return;
    var m = h.match(/^order=(.+)$/);
    if (m) {
      A.show('orders');
      setTimeout(function () {
        var el = document.querySelector('[data-ordercard="' + m[1] + '"]');
        if (el) {
          el.scrollIntoView({ block: 'center' });
          el.style.outline = '2px solid var(--amber)';
          el.style.outlineOffset = '3px';
        }
      }, 300);
      return;
    }
    if (document.querySelector('.screen[data-screen="' + h + '"]')) A.show(h);
  };
  window.addEventListener('hashchange', function () { if (A.IS_ADMIN) A.applyHash(); });

  A.loadCommsPublic = async function () {
    var list = await A.sel('communities_public');
    var sel = A.$('su_comm');
    if (sel) sel.innerHTML = '<option value="">고르세요</option>' + list.map(function (c) {
      return '<option value="' + c.id + '">' + A.esc(c.name) + '</option>';
    }).join('');
  };

  A.$('btnReload').onclick = function () { A.boot(); };

  return A;
})();
