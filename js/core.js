/* ESC 블로그 센터 — 공통
   화면은 편의일 뿐이고, 실제 차단은 전부 Supabase(RLS·함수)가 서버에서 합니다. */
window.ESC = (function () {
  'use strict';

  var SB_URL = 'https://qkvebwxewttqtcryfycy.supabase.co';
  var SB_KEY = 'sb_publishable_Me_R6M540Fg60nmEVqByTg_p-zD8pxa';

  var A = {
    sb: (window.supabase && window.supabase.createClient)
      ? window.supabase.createClient(SB_URL, SB_KEY) : null,
    ME: null, IS_ADMIN: false, SESSION: null,
    LEVELS: [], COMMS: [], PEOPLE: [], ORDERS: []
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
    rework: ['수정 요청', 'c-bad'], approved: ['원고 통과', 'c-info'],
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
    ['g-loading', 'g-login', 'g-signup', 'g-pending', 'g-rejected', 'g-paused']
      .forEach(function (g) { A.$(g).classList.toggle('hide', g !== id); });
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

    var n = e.target.closest('.nav[data-go]');
    if (n) { A.show(n.dataset.go); return; }

    var f = e.target.closest('.fstep[data-go]');
    if (f) { A.show(f.dataset.go); return; }

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

  /* ── 시작 ── */
  A.boot = async function () {
    A.gate('g-loading');
    if (!A.sb) { A.gate('g-login'); A.msg('loginMsg', '연결에 실패했습니다. 새로고침해 주세요.'); return; }

    var s = await A.sb.from('settings').select('value').eq('key', 'blog').maybeSingle();
    A.LEVELS = (s.data && s.data.value && s.data.value.levels) || [];

    await A.loadCommsPublic();

    var ses = await A.sb.auth.getSession();
    A.SESSION = ses.data ? ses.data.session : null;
    var wantSignup = location.hash === '#signup';

    if (!A.SESSION) { A.gate(wantSignup ? 'g-signup' : 'g-login'); return; }

    var a = await A.sb.rpc('blog_admin');
    A.IS_ADMIN = a.data === true;

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
      A.$('navAdmin').classList.remove('hide');
      A.$('navBlogger').classList.add('hide');
      A.$('meName').textContent = A.SESSION.user.email;
      A.$('meRole').textContent = '블로그 센터 관리자';
      A.openApp('dash');
      await A.loadAdmin();
      A.applyHash();
      return;
    }

    if (!A.ME) {
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
