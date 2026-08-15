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
    A.$('meRole').textContent = rev ? '블로그 원고 검수자'
      : blg ? '블로거 화면 보는 중' : '블로그 센터 관리자';

    var sw = A.$('viewSwitch');
    if (sw) sw.classList.toggle('hide', !A.IS_ADMIN);
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
      A.openApp(blg ? 'b-inbox' : 'review');
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
    A.openApp(full ? 'dash' : 'review');
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
    if (full) A.REVIEW_RATE = full.review || { approve: 250, verify: 250 };
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
    A.$('meName').textContent = A.ME.name;
    A.$('meRole').textContent = A.ME.level + '단계 · ' + A.levelOf(A.ME.level).name;
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
