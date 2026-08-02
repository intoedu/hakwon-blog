/* ESC 블로그 센터
   화면은 편의일 뿐이고, 실제 차단은 전부 Supabase(RLS·함수)가 서버에서 합니다. */
(function () {
  'use strict';

  var SB_URL = 'https://qkvebwxewttqtcryfycy.supabase.co';
  var SB_KEY = 'sb_publishable_Me_R6M540Fg60nmEVqByTg_p-zD8pxa';
  var sb = (window.supabase && window.supabase.createClient)
    ? window.supabase.createClient(SB_URL, SB_KEY) : null;

  var ME = null;          // 로그인한 사람의 blogger 행
  var IS_ADMIN = false;   // 블로그 센터 관리자인가
  var LEVELS = [];        // 단계별 이름·단가
  var COMMS = [];         // 공동체 (관리자용 전체)
  var PEOPLE = [];        // 블로거 전체 (관리자용)
  var SUBTAB = 'pending';

  /* ── 유틸 ────────────────────────────────────────── */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : ('' + s))
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function won(n) { return (Number(n) || 0).toLocaleString('ko-KR'); }
  function fdate(s) {
    if (!s) return '-';
    var d = new Date(s);
    return d.getFullYear() + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + ('0' + d.getDate()).slice(-2);
  }
  var tTimer;
  function toast(m) {
    var t = $('toast'); t.textContent = m; t.classList.add('on');
    clearTimeout(tTimer); tTimer = setTimeout(function () { t.classList.remove('on'); }, 2600);
  }
  function msg(boxId, text, kind) {
    var b = $(boxId);
    if (!text) { b.innerHTML = ''; return; }
    b.innerHTML = '<div class="msg ' + (kind || 'err') + '">' + esc(text) + '</div>';
  }
  function levelOf(lv) {
    var f = LEVELS.filter(function (x) { return x.lv === lv; })[0];
    return f || { lv: lv, name: lv + '단계', rate: 0 };
  }
  function lvBadge(lv) {
    return '<span class="lv' + (lv >= 5 ? ' l5' : lv === 4 ? ' l4' : '') + '">' + lv + '</span>';
  }

  /* ── 게이트 전환 ─────────────────────────────────── */
  function gate(id) {
    $('app').classList.add('hide');
    $('gate').classList.remove('hide');
    ['g-loading', 'g-login', 'g-signup', 'g-pending', 'g-rejected', 'g-paused']
      .forEach(function (g) { $(g).classList.toggle('hide', g !== id); });
  }
  function openApp(screen) {
    $('gate').classList.add('hide');
    $('app').classList.remove('hide');
    show(screen || 'dash');
  }
  function show(name) {
    document.querySelectorAll('.screen').forEach(function (s) {
      s.classList.toggle('on', s.dataset.screen === name);
    });
    document.querySelectorAll('.nav[data-go]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.go === name);
    });
    window.scrollTo(0, 0);
  }

  /* ── 시작 ────────────────────────────────────────── */
  async function boot() {
    gate('g-loading');
    if (!sb) { gate('g-login'); msg('loginMsg', '연결에 실패했습니다. 새로고침해 주세요.'); return; }

    await loadSettings();
    await loadCommsPublic();

    var s = await sb.auth.getSession();
    var session = s.data ? s.data.session : null;
    // 모집 링크(#signup)로 들어오면 바로 신청 화면
    if (!session) { gate(location.hash === '#signup' ? 'g-signup' : 'g-login'); return; }

    var a = await sb.rpc('blog_admin');
    IS_ADMIN = a.data === true;

    var r = await sb.from('bloggers').select('*').eq('id', session.user.id).maybeSingle();
    ME = r.data || null;

    if (IS_ADMIN) {
      $('meName').textContent = session.user.email;
      $('meRole').textContent = '블로그 센터 관리자';
      openApp('dash');
      await loadAdmin();
      return;
    }
    if (!ME) { // 로그인은 했는데 블로거로 등록이 안 된 계정
      gate('g-signup');
      $('su_email').value = session.user.email;
      $('su_email').disabled = true;
      $('su_pw').closest('.grid').classList.add('hide');
      $('su_email').closest('.fld').previousElementSibling.textContent = '로그인 정보 (이미 로그인되어 있습니다)';
      msg('suMsg', '이 계정은 아직 블로거로 등록되지 않았습니다. 아래 정보를 채워 신청해 주세요.', 'ok');
      return;
    }
    if (ME.status === 'approved') {
      $('meName').textContent = ME.name;
      $('meRole').textContent = levelOf(ME.level).name + ' · ' + ME.level + '단계';
      openApp('bhome');
      renderBloggerHome();
      return;
    }
    if (ME.status === 'rejected') {
      $('rejReason').innerHTML = ME.reject_reason
        ? '<b>사유</b> · ' + esc(ME.reject_reason) + '<br><br>블로그를 더 키우신 뒤 다시 신청하실 수 있습니다.'
        : '자세한 사유는 담당자에게 문의해 주세요.';
      gate('g-rejected'); return;
    }
    if (ME.status === 'paused') { gate('g-paused'); return; }
    $('pendWho').textContent = ME.name + ' · ' + ME.email;
    gate('g-pending');
  }

  async function loadSettings() {
    var r = await sb.from('settings').select('value').eq('key', 'blog').maybeSingle();
    LEVELS = (r.data && r.data.value && r.data.value.levels) || [
      { lv: 1, name: '1단계', rate: 1000 }, { lv: 2, name: '2단계', rate: 1200 },
      { lv: 3, name: '3단계', rate: 1400 }, { lv: 4, name: '4단계', rate: 1700 },
      { lv: 5, name: '5단계', rate: 2000 }];
  }

  async function loadCommsPublic() {
    var r = await sb.from('communities_public').select('*');
    var list = r.data || [];
    var sel = $('su_comm');
    sel.innerHTML = '<option value="">고르세요</option>' + list.map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.name) + '</option>';
    }).join('');
  }

  /* ── 로그인 · 가입 ───────────────────────────────── */
  $('btnLogin').onclick = async function () {
    var email = $('li_email').value.trim(), pw = $('li_pw').value;
    if (!email || !pw) { msg('loginMsg', '이메일과 비밀번호를 입력해 주세요.'); return; }
    this.disabled = true; msg('loginMsg', '');
    var r = await sb.auth.signInWithPassword({ email: email, password: pw });
    this.disabled = false;
    if (r.error) { msg('loginMsg', '이메일이나 비밀번호가 맞지 않습니다.'); return; }
    boot();
  };

  $('btnSignup').onclick = async function () {
    var name = $('su_name').value.trim();
    var phone = $('su_phone').value.trim();
    var comm = $('su_comm').value;
    var blog = $('su_blog').value.trim();
    var nb = $('su_nb').value;
    var open = $('su_open').value;      // "2026-03"
    var email = $('su_email').value.trim();
    var pw = $('su_pw').value, pw2 = $('su_pw2').value;

    if (!name || !phone) { msg('suMsg', '이름과 연락처를 입력해 주세요.'); return; }
    if (!comm) { msg('suMsg', '소속 공동체를 골라 주세요.'); return; }
    if (!/^https?:\/\//.test(blog)) { msg('suMsg', '블로그 주소를 http로 시작하게 넣어 주세요.'); return; }

    this.disabled = true; msg('suMsg', '');
    var uid = null;
    var alreadyIn = $('su_email').disabled;

    if (alreadyIn) {
      var s0 = await sb.auth.getSession();
      uid = s0.data.session.user.id;
    } else {
      if (!email) { msg('suMsg', '이메일을 입력해 주세요.'); this.disabled = false; return; }
      if (pw.length < 6) { msg('suMsg', '비밀번호는 6자 이상으로 해 주세요.'); this.disabled = false; return; }
      if (pw !== pw2) { msg('suMsg', '비밀번호 확인이 다릅니다.'); this.disabled = false; return; }
      var up = await sb.auth.signUp({ email: email, password: pw });
      if (up.error) {
        msg('suMsg', /already/i.test(up.error.message)
          ? '이미 가입된 이메일입니다. 로그인해 주세요.' : '가입에 실패했습니다: ' + up.error.message);
        this.disabled = false; return;
      }
      uid = up.data.user.id;
      if (!up.data.session) await sb.auth.signInWithPassword({ email: email, password: pw });
    }

    var ins = await sb.from('bloggers').insert({
      id: uid, email: email, name: name, phone: phone,
      community_id: comm, blog_url: blog,
      neighbors: nb ? Number(nb) : null,
      blog_opened: open ? open + '-01' : null
    }).select();

    this.disabled = false;
    if (ins.error) { msg('suMsg', '신청 저장에 실패했습니다: ' + ins.error.message); return; }
    toast('신청이 접수되었습니다');
    boot();
  };

  ['btnOut1', 'btnOut2', 'btnOut3', 'btnOut4'].forEach(function (id) {
    var b = $(id); if (b) b.onclick = async function () { await sb.auth.signOut(); location.reload(); };
  });
  $('btnReload').onclick = function () { boot(); };

  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-gate]');
    if (g) gate(g.dataset.gate);
    var n = e.target.closest('.nav[data-go]');
    if (n) show(n.dataset.go);
  });

  /* ── 관리자: 데이터 읽기 ─────────────────────────── */
  async function loadAdmin() {
    var c = await sb.from('communities').select('*').order('name');
    COMMS = c.data || [];
    var p = await sb.from('bloggers').select('*').order('created_at', { ascending: false });
    PEOPLE = p.data || [];

    var cnt = function (st) { return PEOPLE.filter(function (x) { return x.status === st; }).length; };
    var wait = cnt('pending');
    $('sWait').textContent = wait;
    $('sActive').textContent = cnt('approved');
    $('sHold').textContent = cnt('hold');
    $('sComm').textContent = COMMS.length;
    $('tcWait').textContent = wait;
    $('tcList').textContent = cnt('approved') + cnt('paused');
    $('acWait').textContent = wait;
    $('acHold').textContent = cnt('hold');
    $('acNo').textContent = cnt('rejected');
    var badge = $('cWait');
    badge.textContent = wait;
    badge.classList.toggle('hide', wait === 0);

    var sel = $('fComm');
    sel.innerHTML = '<option value="">전체 공동체</option>' + COMMS.map(function (x) {
      return '<option value="' + x.id + '">' + esc(x.name) + '</option>';
    }).join('');

    renderApply(); renderList(); renderComms();
  }
  function commName(id) {
    var f = COMMS.filter(function (c) { return c.id === id; })[0];
    return f ? f.name : '-';
  }

  /* ── 관리자: 신청 받기 ───────────────────────────── */
  function renderApply() {
    var rows = PEOPLE.filter(function (p) { return p.status === SUBTAB; });
    var box = $('applyList');
    if (!rows.length) {
      box.innerHTML = '<div class="empty">'
        + (SUBTAB === 'pending' ? '기다리는 신청이 없습니다.'
          : SUBTAB === 'hold' ? '보류함이 비어 있습니다.' : '거절한 신청이 없습니다.') + '</div>';
      return;
    }
    box.innerHTML = '<div class="people">' + rows.map(cardHTML).join('') + '</div>';
  }

  function cardHTML(p) {
    var st = p.status;
    var chip = st === 'pending' ? '<span class="chip c-wait">기다리는 중</span>'
      : st === 'hold' ? '<span class="chip c-off">보류</span>'
        : '<span class="chip c-bad">거절함</span>';
    var opened = p.blog_opened ? fdate(p.blog_opened).slice(0, 7).replace('.', '년 ') + '월' : '-';
    var btns = st === 'rejected'
      ? '<button class="btn btn-s" data-act="pending" data-id="' + p.id + '">다시 대기로</button>'
      : '<button class="btn btn-a btn-s" data-act="approved" data-id="' + p.id + '">승인</button>'
      + (st === 'hold' ? '' : '<button class="btn btn-s" data-act="hold" data-id="' + p.id + '">보류</button>')
      + '<button class="btn btn-s" data-act="rejected" data-id="' + p.id + '">거절</button>'
      + '<button class="btn btn-s" data-act="low" data-id="' + p.id + '">저품질로 표시</button>';

    return '<div class="person">'
      + '<div class="row" style="justify-content:space-between"><div>'
      + '<h4>' + esc(p.name) + '</h4>'
      + '<div class="meta">' + esc(commName(p.community_id)) + ' · ' + fdate(p.created_at) + ' 신청</div>'
      + '</div>' + chip + '</div>'
      + '<dl class="kv">'
      + '<dt>블로그</dt><dd><a class="mono" href="' + esc(p.blog_url) + '" target="_blank" rel="noopener">'
      + esc(p.blog_url.replace(/^https?:\/\//, '')) + ' ↗</a></dd>'
      + '<dt>이웃 수</dt><dd><b>' + (p.neighbors == null ? '-' : won(p.neighbors) + '명')
      + '</b> <span class="mono">(본인이 적은 숫자)</span></dd>'
      + '<dt>블로그 시작</dt><dd>' + opened + '</dd>'
      + '<dt>연락처</dt><dd class="mono">' + esc(p.phone || '-') + '</dd>'
      + '<dt>이메일</dt><dd class="mono">' + esc(p.email) + '</dd>'
      + (p.reject_reason ? '<dt>거절 사유</dt><dd>' + esc(p.reject_reason) + '</dd>' : '')
      + '</dl>'
      + (st === 'rejected' ? '' :
        '<div class="checks"><p>1분 확인 — 세 개 다 되면 승인</p>'
        + '<label><input type="checkbox" data-chk="1" data-id="' + p.id + '"' + (p.chk_posts30 ? ' checked' : '') + '> 글이 30개 이상 있다</label>'
        + '<label><input type="checkbox" data-chk="2" data-id="' + p.id + '"' + (p.chk_recent3m ? ' checked' : '') + '> 최근 3개월 안에 글을 썼다</label>'
        + '<label><input type="checkbox" data-chk="3" data-id="' + p.id + '"' + (p.chk_searchable ? ' checked' : '') + '> 블로그 이름을 네이버에 검색하면 나온다</label>'
        + '</div>')
      + '<div class="row">' + btns + '</div></div>';
  }

  /* ── 관리자: 직원 목록 ───────────────────────────── */
  function renderList() {
    var q = ($('fName').value || '').trim();
    var cid = $('fComm').value;
    var rows = PEOPLE.filter(function (p) {
      if (p.status !== 'approved' && p.status !== 'paused') return false;
      if (cid && p.community_id !== cid) return false;
      if (q && p.name.indexOf(q) < 0) return false;
      return true;
    });
    if (!rows.length) { $('listBox').innerHTML = '<div class="empty">아직 일하는 직원이 없습니다.</div>'; return; }

    $('listBox').innerHTML = '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>이름</th><th>공동체</th><th>단계</th><th>편당</th><th>이웃</th>'
      + '<th>블로그</th><th>상태</th><th></th></tr></thead><tbody>'
      + rows.map(function (p) {
        var lv = levelOf(p.level);
        var opts = LEVELS.map(function (l) {
          return '<option value="' + l.lv + '"' + (l.lv === p.level ? ' selected' : '') + '>'
            + l.lv + '단계 · ' + esc(l.name) + '</option>';
        }).join('');
        return '<tr><td><b>' + esc(p.name) + '</b><div class="mono">' + esc(p.phone || '') + '</div></td>'
          + '<td>' + esc(commName(p.community_id)) + '</td>'
          + '<td>' + lvBadge(p.level) + '</td>'
          + '<td class="num">' + won(lv.rate) + '</td>'
          + '<td class="num">' + (p.neighbors == null ? '-' : won(p.neighbors)) + '</td>'
          + '<td><a class="mono" href="' + esc(p.blog_url) + '" target="_blank" rel="noopener">열기 ↗</a></td>'
          + '<td>' + (p.status === 'approved'
            ? (p.quality === 'low' ? '<span class="chip c-bad">저품질</span>' : '<span class="chip c-ok">활동</span>')
            : '<span class="chip c-off">쉬는 중</span>') + '</td>'
          + '<td><div class="row">'
          + '<select class="inp" style="width:auto;padding:4px 8px;font-size:12px" data-lv="' + p.id + '">' + opts + '</select>'
          + '<button class="btn btn-s" data-act="' + (p.status === 'approved' ? 'paused' : 'approved')
          + '" data-id="' + p.id + '">' + (p.status === 'approved' ? '쉬게 하기' : '다시 활동') + '</button>'
          + '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ── 관리자: 공동체 ──────────────────────────────── */
  function renderComms() {
    if (!COMMS.length) { $('commBox').innerHTML = '<div class="empty">공동체가 없습니다.</div>'; return; }
    $('commBox').innerHTML = '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>이름</th><th>리더</th><th>연락처</th><th>은행</th><th>계좌번호</th><th>예금주</th><th>인원</th><th></th></tr></thead><tbody>'
      + COMMS.map(function (c) {
        var n = PEOPLE.filter(function (p) {
          return p.community_id === c.id && (p.status === 'approved' || p.status === 'paused');
        }).length;
        function cell(f, ph) {
          return '<td><input class="inp" style="padding:5px 8px;font-size:13px;min-width:100px" '
            + 'data-cf="' + f + '" data-cid="' + c.id + '" value="' + esc(c[f] || '') + '" placeholder="' + ph + '"></td>';
        }
        return '<tr>' + cell('name', '이름') + cell('leader_name', '리더') + cell('leader_phone', '연락처')
          + cell('bank_name', '국민') + cell('bank_no', '000-00-0000') + cell('bank_holder', '예금주')
          + '<td class="num">' + n + '명</td>'
          + '<td><button class="btn btn-s" data-savec="' + c.id + '">저장</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ── 관리자: 동작 ────────────────────────────────── */
  document.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-tab]');
    if (t) {
      $('staffTabs').querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); });
      t.classList.add('on');
      ['t-apply', 't-list', 't-comm'].forEach(function (id) {
        $(id).classList.toggle('hide', id !== t.dataset.tab);
      });
    }
    var s = e.target.closest('[data-sub]');
    if (s) {
      $('applyTabs').querySelectorAll('button').forEach(function (b) { b.classList.remove('on'); });
      s.classList.add('on'); SUBTAB = s.dataset.sub; renderApply();
    }

    var a = e.target.closest('[data-act]');
    if (a) {
      var id = a.dataset.id, act = a.dataset.act;
      a.disabled = true;
      try {
        if (act === 'low') {
          var note = prompt('저품질로 표시합니다. 이유를 적어두시겠어요? (안 적으셔도 됩니다)') || null;
          await rpc('blogger_decide', { p_id: id, p_status: 'rejected', p_reason: note || '블로그가 검색에 노출되지 않습니다', p_quality: 'low' });
          toast('저품질로 표시하고 거절했습니다');
        } else if (act === 'rejected') {
          var why = prompt('거절 사유를 적어 주세요.\n신청한 분 화면에 그대로 보입니다.', '블로그를 시작한 지 얼마 되지 않았습니다. 3개월 뒤 다시 신청하실 수 있습니다.');
          if (why === null) { a.disabled = false; return; }
          await rpc('blogger_decide', { p_id: id, p_status: 'rejected', p_reason: why });
          toast('거절했습니다');
        } else {
          var el = document.querySelectorAll('[data-id="' + id + '"][data-chk]');
          var c1 = null, c2 = null, c3 = null;
          el.forEach(function (x) {
            if (x.dataset.chk === '1') c1 = x.checked;
            if (x.dataset.chk === '2') c2 = x.checked;
            if (x.dataset.chk === '3') c3 = x.checked;
          });
          await rpc('blogger_decide', {
            p_id: id, p_status: act, p_reason: null,
            p_c1: c1, p_c2: c2, p_c3: c3
          });
          toast(act === 'approved' ? '승인했습니다' : act === 'hold' ? '보류함으로 옮겼습니다'
            : act === 'paused' ? '쉬는 중으로 바꿨습니다' : '대기로 되돌렸습니다');
        }
        await loadAdmin();
      } catch (err) { toast('실패: ' + err.message); }
      a.disabled = false;
    }

    var sc = e.target.closest('[data-savec]');
    if (sc) {
      var cid = sc.dataset.savec, patch = {};
      document.querySelectorAll('[data-cid="' + cid + '"]').forEach(function (i) {
        patch[i.dataset.cf] = i.value.trim() || null;
      });
      if (!patch.name) { toast('공동체 이름은 비울 수 없습니다'); return; }
      sc.disabled = true;
      var r = await sb.from('communities').update(patch).eq('id', cid).select();
      sc.disabled = false;
      if (r.error) { toast('저장 실패: ' + r.error.message); return; }
      if (!r.data || !r.data.length) { toast('저장되지 않았습니다 (권한 확인 필요)'); return; }
      toast('저장했습니다'); await loadAdmin();
    }
  });

  $('btnAddComm').onclick = async function () {
    var name = $('newComm').value.trim();
    if (!name) { toast('이름을 적어 주세요'); return; }
    this.disabled = true;
    var r = await sb.from('communities').insert({ name: name }).select();
    this.disabled = false;
    if (r.error) { toast('추가 실패: ' + r.error.message); return; }
    $('newComm').value = ''; toast('추가했습니다'); await loadAdmin();
  };

  document.addEventListener('change', async function (e) {
    if (e.target.dataset && e.target.dataset.lv) {
      try {
        await rpc('blogger_set_level', { p_id: e.target.dataset.lv, p_level: Number(e.target.value) });
        toast('단계를 바꿨습니다'); await loadAdmin();
      } catch (err) { toast('실패: ' + err.message); }
    }
  });
  $('fName').oninput = renderList;
  $('fComm').onchange = renderList;

  $('btnCopyLink').onclick = function () {
    var url = location.href.split('#')[0] + '#signup';
    navigator.clipboard.writeText(url).then(function () {
      toast('모집 링크를 복사했습니다 — 누르면 바로 신청 화면이 열립니다');
    }, function () { prompt('이 주소를 복사해 주세요', url); });
  };

  /* RPC 호출 — 서버가 막으면 예외가 올라옵니다 */
  async function rpc(fn, args) {
    var r = await sb.rpc(fn, args);
    if (r.error) throw new Error(r.error.message);
    return r.data;
  }

  /* ── 블로거 홈 ───────────────────────────────────── */
  function renderBloggerHome() {
    var lv = levelOf(ME.level);
    $('bhWho').textContent = ME.name + ' 님, 반갑습니다.';
    $('bhLv').textContent = ME.level;
    $('bhRate').textContent = won(lv.rate);
    $('bhInfo').innerHTML =
      '<dt>이름</dt><dd>' + esc(ME.name) + '</dd>'
      + '<dt>연락처</dt><dd class="mono">' + esc(ME.phone || '-') + '</dd>'
      + '<dt>내 블로그</dt><dd><a class="mono" href="' + esc(ME.blog_url) + '" target="_blank" rel="noopener">'
      + esc(ME.blog_url.replace(/^https?:\/\//, '')) + ' ↗</a></dd>'
      + '<dt>단계</dt><dd>' + ME.level + '단계 · ' + esc(lv.name) + ' (편당 ' + won(lv.rate) + '원)</dd>';
  }

  boot();
})();
