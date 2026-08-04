/* 관리자 화면 1~8 */
(function (A) {
  'use strict';
  var $ = A.$, esc = A.esc, won = A.won;

  var STATS = [], PROG = [], POSTS = [], SESSIONS = [], MATS = [], ATT = [], TPROG = [];
  var CPAY = [], BPAY = [];
  var SUBTAB = 'pending', RV_ORDER = null, RJ_POST = null, KWDRAFT = [];

  /* ═══ 데이터 ═══ */
  A.loadAdmin = async function () {
    A.COMMS = await A.sel('communities', { order: 'name' });
    A.PEOPLE = await A.sel('bloggers', { order: 'created_at', asc: false });
    STATS = await A.sel('blogger_stats');
    A.ORDERS = await A.sel('blog_orders', { order: 'created_at', asc: false });
    PROG = await A.sel('order_progress');
    POSTS = await A.sel('blog_posts', { order: 'seq' });

    fillSelects();
    renderDash(); renderStaffAll();
    renderOrders(); renderAssign(); renderReview(); renderProgress();
    loadNoti(false);          /* 사이드바 배지용 — 훑기는 화면에 들어갈 때만 */
  };

  function stat(id) { return STATS.filter(function (s) { return s.id === id; })[0] || {}; }
  function prog(id) { return PROG.filter(function (p) { return p.id === id; })[0] || {}; }
  function orderName(id) {
    var o = A.ORDERS.filter(function (x) { return x.id === id; })[0];
    return o ? o.academy_name : '-';
  }
  function cnt(st) { return A.PEOPLE.filter(function (x) { return x.status === st; }).length; }

  /* 학원에 보내는 진행현황 주소 — 같은 학원 이름이면 주소도 같습니다 */
  function statusUrl(o) {
    return location.origin + location.pathname.replace(/[^/]*$/, '') + 'status.html?k=' + (o.share_key || '');
  }

  function fillSelects() {
    var opts = A.ORDERS.map(function (o) {
      return '<option value="' + o.id + '">' + esc(o.academy_name) + ' (' + o.total_qty + '편)</option>';
    }).join('');
    var el0 = $('kwOrder');
    if (el0) { var k0 = el0.value; el0.innerHTML = opts || '<option value="">주문이 없습니다</option>'; if (k0) el0.value = k0; }

    /* 5번은 "맡길 글이 남은 주문"을 먼저 보여줍니다 */
    var left = function (id) {
      return POSTS.filter(function (p) { return p.order_id === id && p.status === 'pending'; }).length;
    };
    var sorted = A.ORDERS.slice().sort(function (a, b) { return left(b.id) - left(a.id); });
    var el1 = $('asOrder');
    if (el1) {
      var k1 = el1.value;
      el1.innerHTML = sorted.map(function (o) {
        var n = left(o.id);
        return '<option value="' + o.id + '">' + esc(o.academy_name)
          + (n ? ' — 맡길 글 ' + n + '편' : ' — 다 맡김') + '</option>';
      }).join('') || '<option value="">주문이 없습니다</option>';
      if (k1 && A.ORDERS.some(function (o) { return o.id === k1; })) el1.value = k1;
    }
    $('pgOrder').innerHTML = '<option value="">전체 주문</option>' + opts;
    $('fComm').innerHTML = '<option value="">전체 공동체</option>' + A.COMMS.map(function (c) {
      return '<option value="' + c.id + '">' + esc(c.name) + '</option>';
    }).join('');
  }

  /* ═══ 오늘 할 일 ═══ */
  function renderDash() {
    $('flowMap').innerHTML =
      '<h4>전체 흐름 — 왼쪽 메뉴가 이 순서입니다</h4>'
      + '<div class="fsub">누르면 그 화면으로 갑니다. 처음이시면 1번부터 차례로 보세요.</div>'
      + '<div class="flowrow">'
      + fgroup('사람을 모읍니다', [[1, '블로거 관리', 'staff'], [2, '블로거 교육', 'edu']])
      + '<div class="fdiv"></div>'
      + fgroup('주문이 들어오면', [[3, '주문 · 입금', 'orders'], [4, '키워드 만들기', 'kw'], [5, '글 나눠주기', 'assign']])
      + '<div class="fdiv"></div>'
      + fgroup('일이 돌아가면', [[6, '검수하기', 'review'], [7, '진행 현황', 'posts'], [8, '정산하기', 'pay']])
      + '</div>';

    var toReview = POSTS.filter(function (p) { return p.status === 'submitted'; }).length;
    var toVerify = POSTS.filter(function (p) { return p.status === 'published'; }).length;
    var unass = POSTS.filter(function (p) { return p.status === 'pending'; }).length;
    var late = POSTS.filter(function (p) {
      return p.due_date && A.dday(p.due_date) < 0 &&
        ['pending', 'assigned', 'writing', 'rework'].indexOf(p.status) >= 0;
    }).length;
    var wait = cnt('pending');

    $('dashStats').innerHTML =
      st(toReview + toVerify, '검수해야 할 글', toReview + toVerify > 0)
      + st(unass, '담당자 미정') + st(late, '마감 지난 글', late > 0)
      + st(wait, '승인 기다리는 사람', wait > 0);

    var badge = function (id, n, hot) {
      var b = $(id); if (!b) return;
      b.textContent = n; b.classList.toggle('hide', !n);
      if (hot) b.classList.add('hot');
    };
    badge('cWait', wait, true); badge('cUnassigned', unass); badge('cReview', toReview + toVerify, true);
    badge('cReview2', toReview + toVerify, true);   /* 검수자 사이드바 */

    var todo = [];
    if (toReview + toVerify) todo.push(job('검수해야 할 글 ' + (toReview + toVerify) + '편',
      '원고 ' + toReview + '편 · 올라간 글 확인 ' + toVerify + '편', 'review', '6 검수하기 →', true));
    if (unass) todo.push(job('담당자 미정 ' + unass + '편',
      '한 번에 맡길 수 있습니다', 'assign', '5 글 나눠주기 →'));
    if (wait) todo.push(job('승인 기다리는 사람 ' + wait + '명',
      '블로그를 열어보고 판단하세요 · 1명당 1분', 'staff', '1 블로거 관리 →'));
    var cand = candidates();
    if (cand.length) todo.push(job('승급 후보 ' + cand.length + '명',
      '기준을 넘었습니다. 확인하고 올려주세요', 'staff', '단계 관리 →'));
    $('dashTodo').innerHTML = todo.length ? todo.join('')
      : '<div class="empty">지금 급한 일은 없습니다. 잘 돌아가고 있습니다.</div>';

    $('dashOrders').innerHTML = A.ORDERS.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>학원</th><th>주문</th><th>올라간 글</th><th>검수 대기</th><th>입금</th><th>마감일</th></tr></thead><tbody>'
      + A.ORDERS.map(function (o) {
        var p = prog(o.id), done = Number(p.done || 0), pct = o.total_qty ? Math.round(done / o.total_qty * 100) : 0;
        var d = A.dday(o.deadline);
        return '<tr><td><b>' + esc(o.academy_name) + '</b><div class="mono">' + esc(o.region || '') + '</div></td>'
          + '<td class="num">' + o.total_qty + '편</td>'
          + '<td><div class="row"><div class="bar' + (pct < 50 ? ' mid' : '') + '" style="width:80px"><i style="width:'
          + pct + '%"></i></div><span class="num">' + done + '</span></div></td>'
          + '<td class="num">' + ((p.to_review || 0) + (p.to_verify || 0)) + '</td>'
          + '<td>' + (o.paid_at ? '<span class="chip c-ok">입금됨</span>' : '<span class="chip c-wait">입금 대기</span>') + '</td>'
          + '<td class="mono">' + (o.deadline || '-') + (d != null && d >= 0 ? ' (' + d + '일)' : d != null ? ' <b style="color:var(--bad)">지남</b>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : A.empty('아직 주문이 없습니다. 3번에서 만드시면 됩니다.');
  }
  function fgroup(title, steps) {
    return '<div class="fgroup"><span>' + title + '</span><div class="fsteps">'
      + steps.map(function (s, i) {
        return (i ? '<span class="farrow">→</span>' : '')
          + '<button class="fstep" data-go="' + s[2] + '"><b>' + s[0] + '</b>' + s[1] + '</button>';
      }).join('') + '</div></div>';
  }
  function st(n, label, alert) {
    return '<div class="stat' + (alert ? ' alert' : '') + '"><b'
      + (alert ? ' style="color:var(--bad)"' : '') + '>' + won(n) + '</b><span>' + label + '</span></div>';
  }
  function job(title, meta, go, btn, due) {
    return '<div class="job' + (due ? ' due' : '') + '"><div><h4>' + esc(title) + '</h4>'
      + '<div class="meta">' + esc(meta) + '</div></div>'
      + '<div class="right"><button class="btn btn-p btn-s" data-go="' + go + '">' + esc(btn) + '</button></div></div>';
  }

  /* ═══ 1 블로거 관리 ═══ */
  function renderStaffAll() { renderApply(); renderList(); renderLevels(); renderComms(); }

  A.onSubTab = function (s) { SUBTAB = s; renderApply(); };

  function renderApply() {
    $('tcWait').textContent = cnt('pending');
    $('tcList').textContent = cnt('approved') + cnt('paused');
    $('acWait').textContent = cnt('pending');
    $('acHold').textContent = cnt('hold');
    $('acNo').textContent = cnt('rejected');

    var rows = A.PEOPLE.filter(function (p) { return p.status === SUBTAB; });
    if (!rows.length) {
      $('applyList').innerHTML = A.empty(SUBTAB === 'pending' ? '기다리는 신청이 없습니다.'
        : SUBTAB === 'hold' ? '보류함이 비어 있습니다.' : '거절한 신청이 없습니다.');
      return;
    }
    $('applyList').innerHTML = '<div class="people">' + rows.map(applyCard).join('') + '</div>';
  }

  function applyCard(p) {
    var chip = p.status === 'pending' ? '<span class="chip c-wait">기다리는 중</span>'
      : p.status === 'hold' ? '<span class="chip c-off">보류</span>'
        : '<span class="chip c-bad">거절함</span>';
    var btns = p.status === 'rejected'
      ? '<button class="btn btn-s" data-act="pending" data-id="' + p.id + '">다시 대기로</button>'
      : '<button class="btn btn-a btn-s" data-act="approved" data-id="' + p.id + '">승인 (1단계로 시작)</button>'
      + (p.status === 'hold' ? '' : '<button class="btn btn-s" data-act="hold" data-id="' + p.id + '">보류</button>')
      + '<button class="btn btn-s" data-act="rejected" data-id="' + p.id + '">거절</button>'
      + '<button class="btn btn-s" data-act="low" data-id="' + p.id + '">저품질로 표시</button>';

    return '<div class="person">'
      + '<div class="row" style="justify-content:space-between"><div><h4>' + esc(p.name)
      + (p.age ? ' <span class="mono">' + p.age + '세</span>' : '') + '</h4>'
      + '<div class="meta">' + esc(A.commName(p.community_id)) + ' · ' + A.fdate(p.created_at) + ' 신청</div></div>'
      + chip + '</div>'
      + '<dl class="kv">'
      + '<dt>블로그</dt><dd><a class="mono" href="' + esc(p.blog_url) + '" target="_blank" rel="noopener">'
      + esc((p.blog_url || '').replace(/^https?:\/\//, '')) + ' ↗</a>'
      + (p.blog_alias ? ' <span class="mono">' + esc(p.blog_alias) + '</span>' : '') + '</dd>'
      + '<dt>이웃 수</dt><dd>' + neighborCell(p) + '</dd>'
      + '<dt>연락처</dt><dd class="mono">' + esc(p.phone || '-') + '</dd>'
      + '<dt>이메일</dt><dd class="mono">' + esc(p.email) + '</dd>'
      + (p.reject_reason ? '<dt>거절 사유</dt><dd>' + esc(p.reject_reason) + '</dd>' : '')
      + '</dl>'
      + (p.status === 'rejected' ? '' :
        '<div class="checks"><p>1분 확인 — 세 개 다 되면 승인</p>'
        + chk(p, 1, p.chk_posts30, '글이 30개 이상 있다')
        + chk(p, 2, p.chk_recent3m, '최근 3개월 안에 글을 썼다')
        + chk(p, 3, p.chk_searchable, '블로그 이름을 네이버에 검색하면 나온다')
        + '</div>')
      + '<div class="row">' + btns + '</div></div>';
  }
  function chk(p, n, v, label) {
    return '<label><input type="checkbox" data-chk="' + n + '" data-id="' + p.id + '"'
      + (v ? ' checked' : '') + '> ' + label + '</label>';
  }
  function neighborCell(p) {
    return '<span class="mono">본인 신고 ' + esc(p.neighbors_band || '-') + '</span> '
      + '<input class="inp" style="width:110px;display:inline-block;padding:4px 8px;font-size:13px" '
      + 'data-nb="' + p.id + '" type="number" placeholder="실제 숫자" value="' + (p.neighbors == null ? '' : p.neighbors) + '">'
      + ' <button class="btn btn-s" data-savenb="' + p.id + '">확인 저장</button>'
      + (p.neighbors_checked_at ? '<div class="mono">' + A.fdate(p.neighbors_checked_at) + ' 확인</div>' : '');
  }

  function renderList() {
    var q = ($('fName').value || '').trim(), cid = $('fComm').value;
    var rows = A.PEOPLE.filter(function (p) {
      if (p.status !== 'approved' && p.status !== 'paused') return false;
      if (cid && p.community_id !== cid) return false;
      if (q && p.name.indexOf(q) < 0) return false;
      return true;
    });
    if (!rows.length) { $('listBox').innerHTML = A.empty('아직 일하는 블로거이 없습니다.'); return; }

    $('listBox').innerHTML = '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>이름</th><th>공동체</th><th>단계</th><th>편당</th><th>이웃</th>'
      + '<th>통과율</th><th>평균 노출</th><th>이번 달</th><th>누적</th><th>교육</th><th></th></tr></thead><tbody>'
      + rows.map(function (p) {
        var s = stat(p.id), lv = A.levelOf(p.level);
        var pass = s.judged ? Math.round(s.pass_first / s.judged * 100) + '%' : '-';
        var opts = A.LEVELS.map(function (l) {
          return '<option value="' + l.lv + '"' + (l.lv === p.level ? ' selected' : '') + '>' + l.lv + '단계</option>';
        }).join('');
        return '<tr><td><b>' + esc(p.name) + '</b><div class="mono">' + esc(p.phone || '') + '</div></td>'
          + '<td>' + esc(A.commName(p.community_id)) + '</td>'
          + '<td>' + A.lvBadge(p.level) + '</td><td class="num">' + won(lv.rate) + '</td>'
          + '<td class="num">' + (p.neighbors == null ? '<span class="mono">' + esc(p.neighbors_band || '-') + '</span>' : won(p.neighbors)) + '</td>'
          + '<td class="num">' + pass + '</td>'
          + '<td class="num">' + (s.avg_rank == null ? '-' : s.avg_rank + '위') + '</td>'
          + '<td class="num">' + (s.done_month || 0) + '</td><td class="num">' + (s.done_total || 0) + '</td>'
          + '<td>' + (s.ready ? '<span class="chip c-ok">완료</span>' : '<span class="chip c-wait">미완</span>') + '</td>'
          + '<td><div class="row">'
          + '<select class="inp" style="width:auto;padding:4px 8px;font-size:12px" data-lv="' + p.id + '">' + opts + '</select>'
          + '<button class="btn btn-s" data-act="' + (p.status === 'approved' ? 'paused' : 'approved')
          + '" data-id="' + p.id + '">' + (p.status === 'approved' ? '쉬게 하기' : '다시 활동') + '</button>'
          + '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* 승급 후보 — 이웃 수보다 우리가 직접 잰 값(통과율·노출 순위)을 먼저 봅니다 */
  /* 실력은 우리가 직접 잰 값(누적·통과율·검색 노출)으로 보고,
     이웃 수는 "최소 이만큼은 되어야 한다"는 문턱으로만 씁니다. */
  var RULES = [
    { lv: 2, done: 5, pass: 70, rank: null, nb: 100 },
    { lv: 3, done: 20, pass: 80, rank: 20, nb: 300 },
    { lv: 4, done: 60, pass: 90, rank: 10, nb: 800 },
    { lv: 5, done: 150, pass: 95, rank: 7, nb: 1500 }
  ];
  function nbOf(p) {
    if (p.neighbors != null) return p.neighbors;          /* 관리자가 확인한 숫자가 우선 */
    var m = { '0-100': 50, '100-500': 300, '500-1000': 750, '1000+': 1200 };
    return m[p.neighbors_band] != null ? m[p.neighbors_band] : null;  /* 없으면 본인 신고 구간의 중간값 */
  }
  function candidates() {
    var out = [];
    A.PEOPLE.forEach(function (p) {
      if (p.status !== 'approved' || p.level >= 5) return;
      var s = stat(p.id);
      var r = RULES.filter(function (x) { return x.lv === p.level + 1; })[0];
      if (!r || !s.judged) return;
      var pass = Math.round(s.pass_first / s.judged * 100);
      if ((s.done_total || 0) < r.done) return;
      if (pass < r.pass) return;
      if (r.rank && (s.avg_rank == null || s.avg_rank > r.rank)) return;
      var nb = nbOf(p);
      if (nb == null || nb < r.nb) return;                /* 이웃 수 문턱 */
      out.push({ p: p, s: s, pass: pass, next: r.lv, nb: nb });
    });
    return out;
  }

  function renderLevels() {
    $('levelBox').innerHTML = '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>단계</th><th>이름</th><th>편당 지급</th><th>올라가는 기준 (후보 추천용)</th><th>인원</th></tr></thead><tbody>'
      + A.LEVELS.map(function (l) {
        var n = A.PEOPLE.filter(function (p) { return p.level === l.lv && p.status === 'approved'; }).length;
        var r = RULES.filter(function (x) { return x.lv === l.lv; })[0];
        return '<tr><td>' + A.lvBadge(l.lv) + '</td>'
          + '<td><input class="inp" style="width:110px;padding:5px 8px" data-lf="name" data-llv="' + l.lv + '" value="' + esc(l.name) + '"></td>'
          + '<td><input class="inp" style="width:95px;padding:5px 8px" type="number" data-lf="rate" data-llv="' + l.lv + '" value="' + l.rate + '"></td>'
          + '<td class="mono">' + (r ? '누적 ' + r.done + '편 · 통과율 ' + r.pass + '%'
            + (r.rank ? ' · 평균 노출 ' + r.rank + '위 안' : '')
            + ' · 이웃 ' + won(r.nb) + '명 이상' : '모두 여기서 시작') + '</td>'
          + '<td class="num">' + n + '명</td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<div class="row" style="margin-top:12px"><button class="btn btn-p" id="btnSaveLevels">단계 설정 저장</button>'
      + '<span class="mono">기준은 자동 승급이 아니라 후보를 골라내는 용도입니다</span></div>';
    $('btnSaveLevels').onclick = saveLevels;

    var cand = candidates();
    $('tcCand').textContent = cand.length;
    $('candBox').innerHTML = cand.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>이름</th><th>공동체</th><th>지금</th><th>후보</th><th>누적</th><th>통과율</th>'
      + '<th>평균 노출</th><th>이웃</th><th>지급액 변화</th><th></th></tr></thead><tbody>'
      + cand.map(function (c) {
        return '<tr><td><b>' + esc(c.p.name) + '</b></td><td>' + esc(A.commName(c.p.community_id)) + '</td>'
          + '<td>' + A.lvBadge(c.p.level) + '</td><td>' + A.lvBadge(c.next) + '</td>'
          + '<td class="num">' + c.s.done_total + '편</td><td class="num">' + c.pass + '%</td>'
          + '<td class="num">' + (c.s.avg_rank == null ? '-' : c.s.avg_rank + '위') + '</td>'
          + '<td class="num">' + (c.p.neighbors == null ? '-' : won(c.p.neighbors)) + '</td>'
          + '<td class="mono">' + won(A.levelOf(c.p.level).rate) + ' → ' + won(A.levelOf(c.next).rate) + '</td>'
          + '<td><button class="btn btn-a btn-s" data-up="' + c.p.id + '" data-tolv="' + c.next + '">'
          + c.next + '단계로 올리기</button></td></tr>';
      }).join('') + '</tbody></table></div>'
      : A.empty('아직 기준을 넘은 사람이 없습니다. 글이 쌓이면 여기에 뜹니다.');
  }

  async function saveLevels() {
    var levels = A.LEVELS.map(function (l) {
      var nm = document.querySelector('[data-lf="name"][data-llv="' + l.lv + '"]');
      var rt = document.querySelector('[data-lf="rate"][data-llv="' + l.lv + '"]');
      return { lv: l.lv, name: nm ? nm.value.trim() : l.name, rate: rt ? Number(rt.value) : l.rate };
    });
    var cur = await A.sb.from('settings').select('value').eq('key', 'blog').maybeSingle();
    var v = (cur.data && cur.data.value) || {};
    v.levels = levels;
    var r = await A.sb.from('settings').update({ value: v }).eq('key', 'blog').select();
    if (r.error || !r.data || !r.data.length) { A.toast('저장 실패 (권한 확인 필요)'); return; }
    A.LEVELS = levels; A.toast('저장했습니다'); renderLevels(); renderList();
  }

  function renderComms() {
    $('commBox').innerHTML = A.COMMS.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>이름</th><th>리더</th><th>연락처</th><th>은행</th><th>계좌번호</th><th>예금주</th><th>인원</th><th></th></tr></thead><tbody>'
      + A.COMMS.map(function (c) {
        var n = A.PEOPLE.filter(function (p) {
          return p.community_id === c.id && (p.status === 'approved' || p.status === 'paused');
        }).length;
        function cell(f, ph) {
          return '<td><input class="inp" style="padding:5px 8px;font-size:13px;min-width:100px" '
            + 'data-cf="' + f + '" data-cid="' + c.id + '" value="' + esc(c[f] || '') + '" placeholder="' + ph + '"></td>';
        }
        var mem = A.PEOPLE.filter(function (p) {
          return p.community_id === c.id && ['approved', 'paused', 'pending', 'hold'].indexOf(p.status) >= 0;
        });
        return '<tr>' + cell('name', '이름') + cell('leader_name', '리더') + cell('leader_phone', '연락처')
          + cell('bank_name', '국민') + cell('bank_no', '000-00-0000') + cell('bank_holder', '예금주')
          + '<td class="num">' + n + '명</td>'
          + '<td><div class="row"><button class="btn btn-s" data-savec="' + c.id + '">저장</button>'
          + (mem.length ? '<button class="btn btn-s" data-mem="' + c.id + '">멤버 보기</button>' : '') + '</div></td></tr>'
          + (mem.length ? '<tr class="hide" data-memrow="' + c.id + '"><td colspan="8"><div class="memlist">'
            + mem.map(function (p) {
              var s2 = stat(p.id);
              return '<span class="m">' + A.lvBadge(p.level) + ' <b>' + esc(p.name) + '</b>'
                + (p.status === 'approved'
                  ? ' <span class="mono">이번 달 ' + (s2.done_month || 0) + '편 · 누적 ' + (s2.done_total || 0) + '편</span>'
                  : ' ' + { pending: '<span class="chip c-wait">대기</span>', hold: '<span class="chip c-off">보류</span>',
                    paused: '<span class="chip c-off">쉬는 중</span>' }[p.status])
                + '</span>';
            }).join('') + '</div></td></tr>' : '');
      }).join('') + '</tbody></table></div>' : A.empty('공동체가 없습니다.');
  }

  /* ═══ 2 블로거 교육 ═══ */
  async function loadEdu() {
    SESSIONS = await A.sel('training_sessions', { order: 'held_at', asc: false });
    MATS = await A.sel('training_materials', { order: 'sort' });
    ATT = await A.sel('training_attendance');
    TPROG = await A.sel('training_progress');
    renderEdu();
  }
  function renderEdu() {
    $('eduSessions').innerHTML = SESSIONS.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>교육</th><th>날짜</th><th>실시간</th><th>녹화본</th><th>줌 링크</th><th></th></tr></thead><tbody>'
      + SESSIONS.map(function (s) {
        var live = ATT.filter(function (a) { return a.session_id === s.id && a.mode === 'live'; }).length;
        var vid = ATT.filter(function (a) { return a.session_id === s.id && a.mode === 'video'; }).length;
        return '<tr><td><b>' + (s.kind === 't1' ? '1차 교육' : '2차 교육') + '</b></td>'
          + '<td class="mono">' + A.fdt(s.held_at) + '</td>'
          + '<td class="num">' + live + '명</td><td class="num">' + vid + '명</td>'
          + '<td class="mono">' + esc((s.zoom_url || '').slice(0, 30)) + '</td>'
          + '<td><button class="btn btn-s" data-att="' + s.id + '">참석 체크</button></td></tr>';
      }).join('') + '</tbody></table></div>' : A.empty('줌 일정이 없습니다. 아래에서 추가하세요.');

    $('eduMaterials').innerHTML = MATS.length ? '<div class="matlist">' + MATS.map(function (m) {
      var done = TPROG.filter(function (g) { return g.material_id === m.id; }).length;
      return '<div class="mat"><div class="thumb">▶</div><div style="flex:1;min-width:140px">'
        + '<h4>' + esc(m.title) + (m.required ? ' <span class="chip c-bad">필수</span>' : '') + '</h4>'
        + '<div class="meta">' + (m.minutes ? m.minutes + '분 · ' : '')
        + (m.pass_code ? '이수 코드 <b>' + esc(m.pass_code) + '</b> · ' : '코드 없음 · ')
        + done + '명 완료</div></div>'
        + '<a class="btn btn-s" href="' + esc(m.url) + '" target="_blank" rel="noopener">열기 ↗</a>'
        + '<button class="btn btn-s" data-delmat="' + m.id + '">삭제</button></div>';
    }).join('') + '</div>' : A.empty('영상 자료가 없습니다.');

    var appr = A.PEOPLE.filter(function (p) { return p.status === 'approved'; });
    var t1 = SESSIONS.filter(function (s) { return s.kind === 't1'; }).map(function (s) { return s.id; });
    var t2 = SESSIONS.filter(function (s) { return s.kind === 't2'; }).map(function (s) { return s.id; });
    var req = MATS.filter(function (m) { return m.required; });

    $('eduProgress').innerHTML = appr.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>이름</th><th>공동체</th><th>1차 교육</th><th>영상</th><th>2차 교육</th><th>글 받을 수 있나</th></tr></thead><tbody>'
      + appr.map(function (p) {
        var a1 = ATT.filter(function (a) { return a.blogger_id === p.id && t1.indexOf(a.session_id) >= 0; })[0];
        var a2 = ATT.filter(function (a) { return a.blogger_id === p.id && t2.indexOf(a.session_id) >= 0; })[0];
        var mine = TPROG.filter(function (g) { return g.blogger_id === p.id; }).length;
        var need = req.length;
        var s = stat(p.id);
        return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(A.commName(p.community_id)) + '</td>'
          + '<td>' + (a1 ? (a1.mode === 'live' ? '<span class="chip c-ok">참석</span>'
            : '<span class="chip c-wait">녹화본</span>') : '<span class="chip c-bad">아직</span>') + '</td>'
          + '<td>' + (need === 0 ? '<span class="chip c-off">없음</span>'
            : mine >= need ? '<span class="chip c-ok">' + mine + '/' + need + '</span>'
              : '<span class="chip c-bad">' + mine + '/' + need + '</span>') + '</td>'
          + '<td>' + (a2 ? '<span class="chip c-ok">참석</span>' : '<span class="chip c-off">—</span>') + '</td>'
          + '<td>' + (s.ready ? '<span class="chip c-ok">가능</span>' : '<span class="chip c-bad">아직</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : A.empty('승인된 블로거이 없습니다.');
  }

  /* ═══ 3 주문 · 입금 ═══ */
  function renderOrders() {
    $('orderList').innerHTML = A.ORDERS.length ? A.ORDERS.map(function (o) {
      var p = prog(o.id);
      return '<div class="card" style="margin-bottom:12px" data-ordercard="' + o.id + '">'
        + '<div class="row" style="justify-content:space-between"><div>'
        + '<h3 style="font-size:16.5px">' + esc(o.academy_name)
        + (o.request_id ? ' <span class="chip c-ok">홈페이지 의뢰에서 넘어옴</span>' : '') + '</h3>'
        + '<div class="mono" style="margin-top:3px">' + esc(o.region || '지역 미입력') + ' · '
        + (o.is_premium ? '프리미엄 회원' : '일반 회원') + '</div></div>'
        + (o.paid_at ? '<span class="chip c-ok">입금 확인됨</span>' : '<span class="chip c-wait">입금 기다리는 중</span>')
        + '</div>'
        + '<div class="grid g5" style="margin-top:15px;gap:10px">'
        + kv('주문 편수', o.total_qty + '편') + kv('편당', won(o.sale_price) + '원')
        + kv('총액', won(o.amount_total) + '원')
        + kv('입금일', o.paid_at || '아직')
        + kv('마감일', o.deadline || '-')
        + '</div>'
        + (o.paid_at ? '<div class="row" style="margin-top:14px">'
          + '<div class="bar" style="flex:1"><i style="width:' + (o.total_qty ? Math.round((p.done || 0) / o.total_qty * 100) : 0) + '%"></i></div>'
          + '<span class="mono">' + o.total_qty + '편 중 ' + (p.done || 0) + '편 올라감 · 만든 글 ' + (p.made || 0) + '편</span></div>'
          : '<div class="row" style="margin-top:14px">'
          + '<input class="inp" style="max-width:150px" data-payamt="' + o.id + '" type="number" placeholder="들어온 금액" value="' + o.amount_total + '">'
          + '<button class="btn btn-a btn-s" data-paid="' + o.id + '">입금 확인</button>'
          + '<span class="mono">확인 전에는 글을 만들 수 없습니다</span></div>')
        + '<div class="sec" style="margin-top:16px">글감 <small>4번 키워드 만들기에 그대로 쓰입니다</small></div>'
        + '<div class="grid g2" style="gap:12px">'
        + fld(o, 'target_regions', '지역 (쉼표로 구분)') + fld(o, 'target_subjects', '과목')
        + fld(o, 'target_grades', '학년 · 대상') + fld(o, 'target_purposes', '목적')
        + '</div>'
        + '<div style="margin-top:12px"><label class="f">정보팩 — 모든 글에 똑같이 들어갑니다</label>'
        + '<textarea class="inp" data-of="info_pack" data-oid="' + o.id + '">' + esc(o.info_pack || '') + '</textarea></div>'
        + '<div class="row" style="margin-top:10px">'
        + ((o.photo_paths || []).length
          ? '<span class="chip c-ok">신청서 사진 ' + o.photo_paths.length + '장 들어옴</span>'
            + '<span class="mono">글마다 다른 조합으로 5~8장씩 나눠 줍니다</span>'
          : o.photo_note
            ? '<span class="chip c-wait">사진을 링크로 받음</span><a class="mono" href="' + esc(o.photo_note)
              + '" target="_blank" rel="noopener">' + esc(o.photo_note.slice(0, 40)) + ' ↗</a>'
            : '<span class="chip c-bad">사진 없음</span><span class="mono">학원에 요청하세요</span>') + '</div>'
        + '<div class="sec" style="margin-top:16px">학원에 보낼 진행현황 주소 '
        + '<small>로그인 없이 열립니다 · 이 학원 것만 보입니다 · 블로거 이름·단가는 안 보입니다</small></div>'
        + '<div class="row">'
        + '<input class="inp" style="flex:1;min-width:240px;font-family:var(--mono);font-size:12px" readonly '
        + 'value="' + esc(statusUrl(o)) + '" onclick="this.select()">'
        + '<button class="btn btn-p btn-s" data-copystatus="' + esc(statusUrl(o)) + '">📋 주소 복사</button>'
        + '<a class="btn btn-s" href="' + esc(statusUrl(o)) + '" target="_blank" rel="noopener">열어보기 ↗</a>'
        + '</div>'
        + '<div class="row" style="margin-top:12px"><button class="btn btn-p btn-s" data-saveo="' + o.id + '">글감 저장</button>'
        + '<button class="btn btn-s" data-gokw="' + o.id + '">4 키워드 만들기 →</button>'
        + '<span style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">'
        + '<select class="inp" style="width:auto;padding:4px 8px;font-size:12px" data-ostatus="' + o.id + '">'
        + ['active', 'paused', 'done', 'ended'].map(function (s) {
          var ko = { active: '진행 중', paused: '잠시 멈춤', done: '다 끝냄', ended: '종료' }[s];
          return '<option value="' + s + '"' + (o.status === s ? ' selected' : '') + '>' + ko + '</option>';
        }).join('') + '</select>'
        + '<button class="btn btn-s" data-delorder="' + o.id + '" '
        + 'title="최고관리자만 지울 수 있습니다">🗑 주문 삭제</button>'
        + '</span></div>'
        + '</div>';
    }).join('') : A.empty('아직 주문이 없습니다. 위에서 만드시면 됩니다.');
  }
  function kv(k, v) {
    return '<div><label class="f">' + k + '</label><div style="font-size:16px;font-weight:700">' + esc(v) + '</div></div>';
  }
  function fld(o, f, label) {
    return '<div><label class="f">' + label + '</label><input class="inp" data-of="' + f
      + '" data-oid="' + o.id + '" value="' + esc((o[f] || []).join(', ')) + '"></div>';
  }

  /* ═══ 4 키워드 ═══ */
  function splitv(id) {
    return ($(id).value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  $('kwOrder').onchange = function () {
    var o = A.ORDERS.filter(function (x) { return x.id === this.value; }.bind(this))[0];
    if (!o) return;
    $('k1').value = (o.target_regions || []).join(', ');
    $('k2').value = (o.target_subjects || []).join(', ');
    $('k3').value = (o.target_grades || []).join(', ');
    $('k4').value = (o.target_purposes || []).join(', ');
    $('kwN').value = o.total_qty;
  };
  $('kwGo').onclick = function () {
    var a = splitv('k1'), b = splitv('k2'), c = splitv('k3'), d = splitv('k4');
    if (!a.length || !b.length) { A.toast('지역과 과목은 채워 주세요'); return; }
    var all = [];
    a.forEach(function (x) {
      b.forEach(function (y) {
        c.forEach(function (z) {
          d.forEach(function (w) { all.push({ kw: x + ' ' + z + ' ' + y + ' ' + w, brief: z + ' · ' + w }); });
        });
      });
    });
    var want = Math.max(1, Number($('kwN').value) || 100);
    var weeks = Math.max(1, Number($('kwW').value) || 4);
    var picked = [];
    if (want >= all.length) picked = all.slice();
    else { var step = all.length / want; for (var i = 0; i < want; i++) picked.push(all[Math.floor(i * step)]); }

    var per = Math.ceil(picked.length / weeks);
    KWDRAFT = picked.map(function (p, i) {
      return { keyword: p.kw, brief: p.brief, week: Math.floor(i / per) + 1 };
    });
    $('kwInfo').textContent = '만들 수 있는 조합 ' + all.length + '개 중 ' + picked.length
      + '개를 뽑아 ' + weeks + '주로 나눴습니다 (주당 약 ' + per + '편)';
    $('kwOut').className = 'tblbox tblscroll';
    $('kwOut').innerHTML = '<table><thead><tr><th>#</th><th>주차</th>'
      + '<th>이 글이 노릴 검색어 — 제목에 그대로 들어갑니다</th><th>다룰 내용</th></tr></thead><tbody>'
      + KWDRAFT.map(function (p, i) {
        return '<tr><td class="mono">' + (i + 1) + '</td><td class="mono">' + p.week + '주차</td>'
          + '<td><b>' + esc(p.keyword) + '</b></td><td class="mono">' + esc(p.brief) + '</td></tr>';
      }).join('') + '</tbody></table>';
    $('kwSave').disabled = false;
    A.toast(picked.length + '개를 만들었습니다');
  };
  $('kwSave').onclick = async function () {
    var oid = $('kwOrder').value;
    if (!oid || !KWDRAFT.length) { A.toast('주문과 키워드를 확인해 주세요'); return; }
    this.disabled = true;
    try {
      var n = await A.rpc('posts_generate', { p_order: oid, p_items: KWDRAFT });
      A.toast(n + '편을 만들었습니다');
      await A.loadAdmin(); A.show('assign');
    } catch (e) { A.toast('실패: ' + e.message); }
    this.disabled = false;
  };

  /* ═══ 5 글 나눠주기 ═══ */
  function renderAssign() {
    var oid = $('asOrder').value || (A.ORDERS[0] && A.ORDERS[0].id);
    var wk = $('asWeek').value;
    var mine = POSTS.filter(function (p) {
      return p.order_id === oid && p.status === 'pending' && (!wk || String(p.week) === wk);
    });
    var weeks = {};
    POSTS.filter(function (p) { return p.order_id === oid && p.week; }).forEach(function (p) { weeks[p.week] = 1; });
    $('asWeek').innerHTML = '<option value="">전체 주차</option>'
      + Object.keys(weeks).sort(function (a, b) { return a - b; }).map(function (w) {
        return '<option value="' + w + '"' + (wk === w ? ' selected' : '') + '>' + w + '주차</option>';
      }).join('');

    $('postList').innerHTML = mine.length ? mine.map(function (p, i) {
      return '<label class="pickrow" draggable="true" data-post="' + p.id + '">'
        + '<span class="grip" title="끌어서 오른쪽 블로거에게 놓으세요">⠿</span>'
        + '<input type="checkbox" class="pk-post" value="' + p.id + '">'
        + '<span><b>' + esc(p.keyword || '(제목 없음)') + '</b></span>'
        + '<span class="sub">#' + p.seq + (p.week ? ' · ' + p.week + '주차' : '') + '</span></label>';
    }).join('') : '<div class="empty">맡길 글이 없습니다.</div>';

    var ppl = A.PEOPLE.filter(function (p) { return p.status === 'approved'; });
    $('peopleList').innerHTML = ppl.length ? ppl.map(function (p) {
      var s = stat(p.id);
      var here = POSTS.filter(function (x) { return x.order_id === oid && x.blogger_id === p.id; }).length;
      if (!s.ready) {
        return '<label class="pickrow" style="opacity:.45;cursor:not-allowed"><input type="checkbox" disabled>'
          + '<span><b>' + esc(p.name) + '</b> <span class="mono">' + esc(A.commName(p.community_id)) + '</span></span>'
          + '<span class="sub" style="color:var(--bad)">' + (p.quality === 'low' ? '저품질' : '교육 미완') + '</span></label>';
      }
      return '<label class="pickrow drop" data-drop="' + p.id + '">'
        + '<input type="checkbox" class="pk-ppl" value="' + p.id + '">'
        + '<span><b>' + esc(p.name) + '</b> <span class="mono">' + esc(A.commName(p.community_id))
        + ' · ' + p.level + '단계</span></span>'
        + '<span class="sub">이번 달 ' + (s.done_month || 0) + '편 · 이 학원 ' + here + '편</span></label>';
    }).join('') : '<div class="empty">승인된 블로거이 없습니다.</div>';

    $('allPosts').checked = false; $('allPeople').checked = false;
    refreshPick();
  }
  function picked(cls) {
    return [].map.call(document.querySelectorAll('.' + cls + ':checked'), function (c) { return c.value; });
  }
  function refreshPick() {
    var a = picked('pk-post').length, b = picked('pk-ppl').length;
    $('cPosts').textContent = a; $('cPeople').textContent = b;
    $('doAssign').disabled = !(a && b);
    $('assignHint').textContent = (!a || !b) ? '왼쪽에서 글, 오른쪽에서 블로거를 골라 주세요'
      : a === b ? a + '편을 ' + b + '명에게 한 편씩 줍니다'
        : a > b ? a + '편을 ' + b + '명에게 골고루 나눕니다 (한 명당 최대 ' + Math.ceil(a / b) + '편)'
          : a + '편을 ' + b + '명 중 앞에서 ' + a + '명에게 한 편씩 줍니다';
  }
  /* 끌어서 맡기기 — 체크한 글이 있으면 그것들을, 없으면 끌고 온 글 하나를 맡깁니다 */
  var DRAG = [];
  document.addEventListener('dragstart', function (e) {
    var row = e.target.closest('[data-post]'); if (!row) return;
    var checked = picked('pk-post');
    DRAG = checked.indexOf(row.dataset.post) >= 0 ? checked : [row.dataset.post];
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', DRAG.join(',')); } catch (x) { }
    document.querySelectorAll('.drop').forEach(function (d) { d.classList.add('canhit'); });
  });
  document.addEventListener('dragend', function () {
    document.querySelectorAll('.drop').forEach(function (d) { d.classList.remove('canhit', 'over'); });
  });
  document.addEventListener('dragover', function (e) {
    var d = e.target.closest('.drop'); if (!d || !DRAG.length) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; d.classList.add('over');
  });
  document.addEventListener('dragleave', function (e) {
    var d = e.target.closest('.drop'); if (d) d.classList.remove('over');
  });
  document.addEventListener('drop', async function (e) {
    var d = e.target.closest('.drop'); if (!d || !DRAG.length) return;
    e.preventDefault(); d.classList.remove('over');
    var posts = DRAG.slice(); DRAG = [];
    try {
      var n = await A.rpc('posts_assign', { p_posts: posts, p_bloggers: [d.dataset.drop] });
      A.toast(n + '편을 맡겼습니다');
      await A.loadAdmin();
    } catch (err) { A.toast('실패: ' + err.message); }
  });

  $('asOrder').onchange = function () { $('asWeek').value = ''; renderAssign(); };
  $('asWeek').onchange = renderAssign;
  $('doAssign').onclick = async function () {
    this.disabled = true;
    try {
      var n = await A.rpc('posts_assign', { p_posts: picked('pk-post'), p_bloggers: picked('pk-ppl') });
      A.toast(n + '편을 나눠줬습니다. 마감은 배정일 + 7일입니다');
      await A.loadAdmin();
    } catch (e) { A.toast('실패: ' + e.message); }
    this.disabled = false;
  };

  /* ═══ 6 검수 ═══ */
  function renderReview() {
    var draft = POSTS.filter(function (p) { return p.status === 'submitted'; });
    var live = POSTS.filter(function (p) { return p.status === 'published'; });
    $('rcDraft').textContent = draft.length; $('rcLive').textContent = live.length;

    $('rvAcadList').innerHTML = A.ORDERS.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>학원</th><th>주문한 글</th><th>원고 상황</th><th>올라간 글</th><th>마감일</th><th>남은 기간</th></tr></thead><tbody>'
      + A.ORDERS.map(function (o) {
        var todo = draft.filter(function (p) { return p.order_id === o.id; }).length;
        var doneR = POSTS.filter(function (p) {
          return p.order_id === o.id && ['approved', 'published', 'verified', 'paid'].indexOf(p.status) >= 0;
        }).length;
        var d = A.dday(o.deadline);
        return '<tr' + (todo ? ' class="clickme" data-openacad="' + o.id + '"' : '') + '>'
          + '<td><b>' + esc(o.academy_name) + '</b><div class="mono">' + esc(o.region || '') + '</div></td>'
          + '<td class="num">' + o.total_qty + '편</td>'
          + '<td><div class="mixcell">'
          + (todo ? '<span class="pill todo">봐야 할 원고 ' + todo + '</span>' : '<span class="pill off">볼 원고 없음</span>')
          + '<span class="pill done">끝낸 원고 ' + doneR + '</span></div></td>'
          + '<td class="num">' + POSTS.filter(function (p) {
            return p.order_id === o.id && ['published', 'verified', 'paid'].indexOf(p.status) >= 0;
          }).length + '편</td>'
          + '<td class="mono">' + (o.deadline || '-') + '</td>'
          + '<td class="mono">' + (d == null ? '-' : d >= 0 ? d + '일' : '지남') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : A.empty('주문이 없습니다.');

    renderLive();
  }

  function openAcad(oid) {
    RV_ORDER = oid;
    var o = A.ORDERS.filter(function (x) { return x.id === oid; })[0] || {};
    var all = POSTS.filter(function (p) { return p.order_id === oid && p.status !== 'cancelled'; });
    var todo = all.filter(function (p) { return p.status === 'submitted'; });
    var rest = all.filter(function (p) { return p.status !== 'submitted'; });
    var d = A.dday(o.deadline);

    $('rvAcadName').textContent = o.academy_name || '';
    $('rvAcadMeta').innerHTML = o.total_qty + '편 주문 · <b style="color:var(--amber)">마감 '
      + (o.deadline || '-') + (d == null ? '' : d >= 0 ? ' (' + d + '일 남음)' : ' (지났습니다)')
      + '</b> · 봐야 할 원고 ' + todo.length + '편 · 만든 글 ' + all.length + '편';

    function row(p, dim) {
      var b = A.PEOPLE.filter(function (x) { return x.id === p.blogger_id; })[0] || {};
      var again = p.rework_count > 0;
      var cls = dim ? ' style="opacity:.5"' : (again ? ' class="sent"' : '');
      return '<tr' + cls + '>'
        + '<td>' + (b.name ? esc(A.commName(b.community_id)) : '<span class="mono">—</span>') + '</td>'
        + '<td>' + (b.name ? '<b>' + esc(b.name) + '</b> ' + A.lvBadge(b.level || 1)
          : '<span class="mono">담당자 미정</span>') + '</td>'
        + '<td><b>' + esc(p.keyword || '') + '</b></td>'
        + '<td class="mono">' + (p.submitted_at ? A.fdate(p.submitted_at) : '아직') + '</td>'
        + '<td>' + (dim ? A.stChip(p.status)
          : again ? '<b style="color:var(--bad)">' + p.rework_count + '번 · '
            + esc((p.reject_reasons || []).join(', ') || p.review_note || '') + '</b>'
            : '<span class="chip c-off">처음</span>') + '</td>'
        + '<td><div class="row">'
        + (p.content_url ? '<a class="btn btn-s" href="' + esc(p.content_url) + '" target="_blank" rel="noopener">원고 열기 ↗</a>' : '')
        + (dim ? '' : '<button class="btn btn-a btn-s" data-approve="' + p.id + '">승인</button>'
          + '<button class="btn btn-s" data-openrj="' + p.id + '">수정 요청</button>')
        + '</div></td></tr>';
    }
    var head = '<thead><tr><th>공동체</th><th>누가</th><th>블로그 제목</th><th>원고 낸 날</th>'
      + '<th>수정 요청했던 글</th><th>처리</th></tr></thead>';

    $('rvPosts').innerHTML =
      (todo.length ? '<div class="tblbox tblscroll"><table>' + head + '<tbody>'
        + todo.map(function (p) { return row(p, false); }).join('') + '</tbody></table></div>'
        : A.empty('지금 볼 원고가 없습니다.'))
      + (rest.length ? '<div class="sec">아직 원고가 안 온 글 · 이미 끝난 글 <small>'
        + rest.length + '편 — 회색은 아직 손댈 게 없다는 뜻입니다</small></div>'
        + '<div class="tblbox tblscroll"><table>' + head + '<tbody>'
        + rest.map(function (p) { return row(p, true); }).join('') + '</tbody></table></div>' : '');
    A.view('acad-posts');
  }

  /* 올라간 글 확인 — 학원별로 묶고, 블로거 실명·공동체는 빼둡니다 */
  function renderLive() {
    var live = POSTS.filter(function (p) { return p.status === 'published'; });
    if (!live.length) { $('rvLive').innerHTML = A.empty('확인할 글이 없습니다.'); return; }
    var byOrder = {};
    live.forEach(function (p) { (byOrder[p.order_id] = byOrder[p.order_id] || []).push(p); });

    $('rvLive').innerHTML = Object.keys(byOrder).map(function (oid) {
      var o = A.ORDERS.filter(function (x) { return x.id === oid; })[0] || {};
      var d = A.dday(o.deadline);
      return '<div class="sec">' + esc(o.academy_name) + ' <small>'
        + byOrder[oid].length + '편 확인 대기 · 마감 ' + (o.deadline || '-')
        + (d == null ? '' : d >= 0 ? ' (' + d + '일 남음)' : ' (지났습니다)') + '</small></div>'
        + byOrder[oid].map(function (p) {
          return '<div class="card" style="margin-bottom:10px"><div class="row" style="gap:14px;align-items:flex-start">'
            + '<div style="flex:1;min-width:200px"><h4 style="font-size:14.5px">' + esc(p.keyword || '') + '</h4>'
            + '<div class="mono" style="margin:5px 0 10px">' + esc((p.published_url || '').slice(0, 52)) + '</div>'
            + '<div class="row"><a class="btn btn-s" href="' + esc(p.published_url) + '" target="_blank" rel="noopener">글 열어보기 ↗</a>'
            + '<a class="btn btn-s" href="https://search.naver.com/search.naver?query=' + encodeURIComponent(p.keyword || '')
            + '" target="_blank" rel="noopener">이 검색어로 검색해보기 ↗</a></div></div>'
            + '<div style="min-width:180px"><label class="f">몇 번째에 나왔나요</label>'
            + '<input class="inp" type="number" data-rank="' + p.id + '" placeholder="예: 4">'
            + '<div class="mono" style="margin-top:5px">위 [검색해보기] 로 나온 순서<br>안 적으셔도 됩니다</div></div>'
            + '<button class="btn btn-a" data-verify="' + p.id + '">확인 완료</button>'
            + '<button class="btn btn-s" data-unverify="' + p.id + '">문제 있음</button>'
            + '</div></div>';
        }).join('');
    }).join('');
  }

  $('btnReject').onclick = async function () {
    var reasons = [].map.call(document.querySelectorAll('.rj:checked'), function (c) { return c.value; });
    if (!reasons.length) { A.toast('고쳐야 할 것을 하나 이상 골라 주세요'); return; }
    this.disabled = true;
    try {
      await A.rpc('post_review', {
        p_post: RJ_POST, p_ok: false, p_reasons: reasons, p_note: $('rjNote').value.trim() || null
      });
      A.toast('수정 요청을 보냈습니다');
      document.querySelectorAll('.rj').forEach(function (c) { c.checked = false; });
      $('rjNote').value = '';
      await A.loadAdmin(); openAcad(RV_ORDER);
    } catch (e) { A.toast('실패: ' + e.message); }
    this.disabled = false;
  };

  /* ═══ 7 진행 현황 ═══ */
  function pgPicked() {
    return [].map.call(document.querySelectorAll('#pgStatus input:checked'), function (c) { return c.value; });
  }
  var PG_ROWS = [];
  function renderProgress() {
    var oid = $('pgOrder').value, sel = pgPicked(), q = ($('pgQ').value || '').trim();
    var rows = POSTS.filter(function (p) {
      if (oid && p.order_id !== oid) return false;
      if (sel.length && sel.indexOf(p.status) < 0) return false;
      if (q) {
        var b = A.PEOPLE.filter(function (x) { return x.id === p.blogger_id; })[0];
        if ((p.keyword || '').indexOf(q) < 0 && (!b || b.name.indexOf(q) < 0)) return false;
      }
      return true;
    });
    PG_ROWS = rows;
    var c = function (s) { return POSTS.filter(function (p) { return (!oid || p.order_id === oid) && p.status === s; }).length; };
    $('pgStats').innerHTML = st(c('pending'), '담당자 미정')
      + st(c('writing') + c('assigned'), '쓰는 중') + st(c('rework'), '수정 요청', c('rework') > 0)
      + st(c('submitted') + c('published'), '검수 대기')
      + st(c('verified') + c('paid'), '확인 끝');

    $('pgList').innerHTML = rows.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>#</th><th>노리는 검색어</th><th>학원</th><th>공동체</th><th>누가</th>'
      + '<th>어디까지</th><th>마감</th><th></th></tr></thead><tbody>'
      + rows.slice(0, 300).map(function (p) {
        var b = A.PEOPLE.filter(function (x) { return x.id === p.blogger_id; })[0];
        var d = A.dday(p.due_date);
        var late = d != null && d < 0 && ['pending', 'assigned', 'writing', 'rework'].indexOf(p.status) >= 0;
        return '<tr' + (p.status === 'rework' ? ' class="sent"' : '') + '>'
          + '<td class="mono">' + (p.seq || '') + '</td>'
          + '<td>' + esc(p.keyword || '') + '</td>'
          + '<td class="mono">' + esc(orderName(p.order_id)) + '</td>'
          + '<td class="mono">' + (b ? esc(A.commName(b.community_id)) : '-') + '</td>'
          + '<td>' + (b ? esc(b.name) : '<span style="color:var(--muted)">아직 없음</span>') + '</td>'
          + '<td>' + A.stChip(p.status) + '</td>'
          + '<td class="mono' + (late ? '" style="color:var(--bad)' : '') + '">' + (p.due_date || '-') + '</td>'
          + '<td>' + (p.published_url ? '<a class="mono" href="' + esc(p.published_url) + '" target="_blank" rel="noopener">글 보기 ↗</a>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      + (rows.length > 300 ? '<div class="mono" style="margin-top:8px">앞의 300개만 보여드립니다. 필터를 좁혀 주세요.</div>' : '')
      : A.empty('해당하는 글이 없습니다.');
  }
  $('pgOrder').onchange = renderProgress;
  $('pgStatus').addEventListener('change', renderProgress);
  $('pgClear').onclick = function () {
    document.querySelectorAll('#pgStatus input').forEach(function (c) { c.checked = false; });
    renderProgress();
  };
  $('pgQ').oninput = renderProgress;

  /* 표를 파일로 — 구글 시트·넘버스·엑셀에서 바로 열립니다 */
  function saveCsv(name, head, body) {
    var q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
    var csv = [head].concat(body).map(function (r) { return r.map(q).join(','); }).join('\r\n');
    var url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    var a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* 지금 보이는 목록을 파일로 */
  $('btnExport').onclick = function () {
    if (!PG_ROWS.length) { A.toast('내보낼 글이 없습니다'); return; }
    var head = ['학원', '번호', '노리는 검색어', '주차', '공동체', '담당', '상태',
      '마감일', '올린 날', '올린 글 주소', '검색 노출'];
    var body = PG_ROWS.map(function (p) {
      var b = A.PEOPLE.filter(function (x) { return x.id === p.blogger_id; })[0];
      return [orderName(p.order_id), p.seq || '', p.keyword || '', p.week ? p.week + '주차' : '',
        b ? A.commName(b.community_id) : '', b ? b.name : '',
        (A.ST[p.status] || [p.status])[0], p.due_date || '',
        p.published_at ? A.fdate(p.published_at) : '', p.published_url || '',
        p.keyword_rank ? p.keyword_rank + '위' : ''];
    });
    var oid = $('pgOrder').value;
    saveCsv('ESC 블로그 진행현황 ' + (oid ? orderName(oid) + ' ' : '') + A.today() + '.csv', head, body);
    A.toast(PG_ROWS.length + '편을 파일로 저장했습니다');
  };

  /* ═══ 8 정산 ═══ */
  async function loadPay() {
    if (!$('payMonth').value) $('payMonth').value = A.thisMonth();
    var m = $('payMonth').value + '-01';
    CPAY = await A.sel('community_payouts', { eq: { month: m } });
    BPAY = await A.sel('blog_payouts', { eq: { month: m } });
    renderPay();
  }
  function renderPay() {
    var m = $('payMonth').value + '-01';
    var verified = POSTS.filter(function (p) { return p.status === 'verified' && p.cycle_month === m; });
    var total = CPAY.reduce(function (a, c) { return a + c.amount; }, 0);
    var sale = POSTS.filter(function (p) {
      return ['verified', 'paid'].indexOf(p.status) >= 0 && p.cycle_month === m;
    }).reduce(function (a, p) { return a + (p.sale_rate || 0); }, 0);

    $('payStats').innerHTML = st(verified.length, '아직 마감 안 한 글')
      + st(CPAY.length, '보낼 공동체') + st(total, '나갈 돈 (원)') + st(Math.max(0, sale - total), '남는 돈 (원)');

    $('payList').innerHTML = CPAY.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>공동체</th><th>인원</th><th>편수</th><th>보낼 돈</th><th>계좌</th><th>상태</th><th></th></tr></thead><tbody>'
      + CPAY.map(function (c) {
        var cm = A.COMMS.filter(function (x) { return x.id === c.community_id; })[0] || {};
        return '<tr class="clickme" data-opencp="' + c.id + '">'
          + '<td><b>' + esc(cm.name || '-') + '</b> <span class="mono">▸ 펼치기</span></td>'
          + '<td class="num">' + c.people_count + '명</td><td class="num">' + c.post_count + '</td>'
          + '<td class="num"><b>' + won(c.amount) + '</b></td>'
          + '<td class="mono">' + esc([cm.bank_name, cm.bank_no].filter(Boolean).join(' ') || '계좌 미입력') + '</td>'
          + '<td>' + (c.status === 'sent' ? '<span class="chip c-ok">보냈음 ' + A.fdate(c.sent_at) + '</span>'
            : '<span class="chip c-wait">아직 안 보냄</span>') + '</td>'
          + '<td>' + (c.status === 'sent' ? '' : '<button class="btn btn-s" data-send="' + c.id + '">보냄</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      : A.empty('아직 마감하지 않았습니다. 위에서 [이 달 마감하기]를 눌러 주세요.');
    $('payDetail').innerHTML = '';
  }
  function openCP(id) {
    var c = CPAY.filter(function (x) { return x.id === id; })[0]; if (!c) return;
    var cm = A.COMMS.filter(function (x) { return x.id === c.community_id; })[0] || {};
    var mine = BPAY.filter(function (b) {
      var p = A.PEOPLE.filter(function (x) { return x.id === b.blogger_id; })[0];
      return p && p.community_id === c.community_id;
    });
    $('payDetail').innerHTML = '<div class="crumb"><b style="color:var(--ink)">' + esc(cm.name) + '</b>'
      + '<span class="mono">이 명세를 공동체 리더에게 함께 보내시면 됩니다</span></div>'
      + '<div class="tblbox tblscroll"><table><thead><tr><th>이름</th><th>단계</th><th>편수</th><th>편당</th><th>금액</th></tr></thead><tbody>'
      + mine.map(function (b) {
        var p = A.PEOPLE.filter(function (x) { return x.id === b.blogger_id; })[0] || {};
        return '<tr><td><b>' + esc(p.name || '-') + '</b></td><td>' + A.lvBadge(p.level || 1) + '</td>'
          + '<td class="num">' + b.post_count + '</td>'
          + '<td class="num">' + won(b.post_count ? Math.round(b.amount / b.post_count) : 0) + '</td>'
          + '<td class="num"><b>' + won(b.amount) + '</b></td></tr>';
      }).join('')
      + '<tr><td colspan="4" style="text-align:right"><b>합계</b></td><td class="num"><b>' + won(c.amount) + '</b></td></tr>'
      + '</tbody></table></div>';
  }
  /* ── 정산 내보내기 ──
     주민등록번호·개인 계좌는 블로그 센터에 저장하지 않습니다.
     여기서 뽑은 파일에 시트에서 직접 채워 넣어 세무사에게 넘기는 방식입니다. */
  function payRow(b) {                       /* blog_payouts 한 줄 → 사람 정보 붙이기 */
    var p = A.PEOPLE.filter(function (x) { return x.id === b.blogger_id; })[0] || {};
    var cm = A.COMMS.filter(function (x) { return x.id === p.community_id; })[0] || {};
    var cp = CPAY.filter(function (x) { return x.community_id === p.community_id; })[0] || {};
    return { p: p, cm: cm, cp: cp };
  }
  var PAY_TAIL = ['주민등록번호 (직접 입력)', '원천징수 (직접 입력)', '실지급액 (직접 입력)', '비고'];

  /* ① 개인별 지급대장 — 이 달. 세무사에게 넘기는 표 */
  $('btnPayPeople').onclick = function () {
    if (!BPAY.length) { A.toast('이 달은 아직 마감하지 않았습니다'); return; }
    var m = $('payMonth').value;
    var head = ['정산월', '공동체', '이름', '전화번호', '이메일(로그인 아이디)',
      '단계', '단계 이름', '편수', '편당 평균', '지급액',
      '지급 상태', '보낸 날', '받는 계좌 (공동체)', '예금주'].concat(PAY_TAIL);
    var body = BPAY.map(function (b) {
      var r = payRow(b);
      return [m, r.cm.name || '', r.p.name || '', r.p.phone || '', r.p.email || '',
        r.p.level || '', A.levelOf(r.p.level || 1).name,
        b.post_count, b.post_count ? Math.round(b.amount / b.post_count) : 0, b.amount,
        r.cp.status === 'sent' ? '보냄' : '아직 안 보냄',
        r.cp.sent_at ? A.fdate(r.cp.sent_at) : '',
        [r.cm.bank_name, r.cm.bank_no].filter(Boolean).join(' '), r.cm.bank_holder || '',
        '', '', '', ''];
    });
    saveCsv('ESC 블로그 지급대장 ' + m + '.csv', head, body);
    A.toast(BPAY.length + '명의 지급대장을 저장했습니다');
  };

  /* ② 공동체 이체 목록 — 이 달. 은행에서 보고 이체하는 표 */
  $('btnPayComm').onclick = function () {
    if (!CPAY.length) { A.toast('이 달은 아직 마감하지 않았습니다'); return; }
    var m = $('payMonth').value;
    var head = ['정산월', '공동체', '인원', '편수', '보낼 금액',
      '은행', '계좌번호', '예금주', '리더 이름', '리더 연락처', '상태', '보낸 날', '메모'];
    var body = CPAY.map(function (c) {
      var cm = A.COMMS.filter(function (x) { return x.id === c.community_id; })[0] || {};
      return [m, cm.name || '', c.people_count, c.post_count, c.amount,
        cm.bank_name || '', cm.bank_no || '', cm.bank_holder || '',
        cm.leader_name || '', cm.leader_phone || '',
        c.status === 'sent' ? '보냄' : '아직 안 보냄',
        c.sent_at ? A.fdate(c.sent_at) : '', c.memo || ''];
    });
    saveCsv('ESC 블로그 공동체 이체목록 ' + m + '.csv', head, body);
    A.toast(CPAY.length + '개 공동체를 저장했습니다');
  };

  /* ③ 전체 기간 개인별 누계 — 연말 지급명세서용 */
  $('btnPayYear').onclick = async function () {
    this.disabled = true;
    try {
      var all = await A.sel('blog_payouts', { order: 'month' });
      if (!all.length) { A.toast('정산 기록이 없습니다'); return; }
      var byId = {};
      all.forEach(function (b) {
        var k = b.blogger_id;
        if (!byId[k]) byId[k] = { cnt: 0, amt: 0, months: [] };
        byId[k].cnt += b.post_count; byId[k].amt += b.amount;
        byId[k].months.push(b.month.slice(0, 7) + '(' + b.post_count + '편 ' + won(b.amount) + '원)');
      });
      var head = ['이름', '전화번호', '이메일(로그인 아이디)', '공동체', '현재 단계',
        '첫 정산월', '마지막 정산월', '정산 개월 수', '누적 편수', '누적 지급액', '월별 내역'].concat(PAY_TAIL);
      var body = Object.keys(byId).map(function (k) {
        var v = byId[k];
        var p = A.PEOPLE.filter(function (x) { return x.id === k; })[0] || {};
        var mine = all.filter(function (b) { return b.blogger_id === k; });
        return [p.name || '', p.phone || '', p.email || '', A.commName(p.community_id),
          (p.level || '') + '단계',
          mine[0].month.slice(0, 7), mine[mine.length - 1].month.slice(0, 7), mine.length,
          v.cnt, v.amt, v.months.join(' / '), '', '', '', ''];
      }).sort(function (a, b) { return b[9] - a[9]; });
      saveCsv('ESC 블로그 개인별 누계 ' + A.today() + '.csv', head, body);
      A.toast(body.length + '명의 누계를 저장했습니다');
    } catch (e) { A.toast('실패: ' + e.message); }
    this.disabled = false;
  };

  $('payMonth').onchange = loadPay;
  $('btnClose').onclick = async function () {
    this.disabled = true;
    try {
      var n = await A.rpc('payout_close', { p_month: $('payMonth').value + '-01' });
      A.toast(n + '개 공동체로 마감했습니다');
      await loadPay();
    } catch (e) { A.toast('실패: ' + e.message); }
    this.disabled = false;
  };

  /* ═══ 🔔 알림 보내기 ═══ */
  var NOTI = [], NOTI_TAB = 'blogger', NOTI_KIND = '', NOTI_SET = {};

  /* 알림 종류 이름 — 화면에 보이는 말 */
  var KIND_KO = {
    assigned: '글 배정', due1: '마감 임박', overdue: '마감 지남', rework: '수정 요청',
    payout: '정산 확정', approved: '신청 승인', rejected: '신청 거절', edu_wait: '교육 미이수',
    submitted: '검수할 원고', overdue_admin: '마감 지난 글', unpaid_order: '입금 지연',
    unassigned: '미배정 남음',
    order_paid: '입금 확인', first_post: '첫 글 올라감', half: '절반 진행', order_done: '전부 완료'
  };
  var KIND_OF = {
    blogger: ['assigned', 'due1', 'overdue', 'rework', 'payout', 'approved', 'rejected', 'edu_wait'],
    staff: ['submitted', 'overdue_admin', 'unpaid_order', 'unassigned'],
    academy: ['order_paid', 'first_post', 'half', 'order_done']
  };
  function kindKo(k) { return KIND_KO[k] || k; }

  async function loadNoti(scan) {
    if (scan && A.IS_ADMIN) {        /* 훑기·보냄표시는 관리자만 (서버에서도 막혀 있습니다) */
      try {
        var made = await A.rpc('notify_scan');
        A.toast(made ? made + '건을 새로 찾았습니다' : '새로 챙길 것은 없습니다');
      } catch (e) { A.toast('실패: ' + e.message); }
    }
    NOTI = await A.sel('notifications', { order: 'created_at', asc: false });
    if (A.IS_ADMIN) {
      var s = await A.sb.from('settings').select('value').eq('key', 'blog').maybeSingle();
      NOTI_SET = (s.data && s.data.value) || {};
      renderNotiSet();
    }
    renderNoti();
    var un = NOTI.filter(function (n) { return !n.sent_at; }).length;
    var b = $('cNoti');
    if (b) { b.textContent = un; b.classList.toggle('hide', !un); }
  }

  /* 누구에게 보내는지 — 이름과 연락처를 같이 보여줘야 카톡에서 찾습니다 */
  function notiWho(n) {
    if (n.audience === 'blogger') {
      var p = A.PEOPLE.filter(function (x) { return x.id === n.blogger_id; })[0];
      return p ? { name: p.name, sub: [A.commName(p.community_id), p.phone].filter(Boolean).join(' · ') }
        : { name: '(지워진 블로거)', sub: '' };
    }
    if (n.audience === 'academy') {
      var o = A.ORDERS.filter(function (x) { return x.id === n.order_id; })[0];
      return o ? { name: o.academy_name, sub: [o.contact_name, o.contact_phone].filter(Boolean).join(' · ') }
        : { name: '(지워진 주문)', sub: '' };
    }
    return { name: '우리 팀', sub: '보낼 곳 없음 — 확인만 하시면 됩니다' };
  }

  function notiRows() {
    var showSent = $('notiShowSent').checked;
    return NOTI.filter(function (n) {
      return n.audience === NOTI_TAB && (showSent || !n.sent_at)
        && (!NOTI_KIND || n.kind === NOTI_KIND);
    });
  }

  /* 종류 고르기 — 「마감 지남만 보기」 처럼 좁혀서 한 번에 보냅니다 */
  function renderKinds() {
    var showSent = $('notiShowSent').checked;
    var pool = NOTI.filter(function (n) {
      return n.audience === NOTI_TAB && (showSent || !n.sent_at);
    });
    var counts = {};
    pool.forEach(function (n) { counts[n.kind] = (counts[n.kind] || 0) + 1; });
    var kinds = (KIND_OF[NOTI_TAB] || []).filter(function (k) { return counts[k]; });
    if (!kinds.length) { $('notiKinds').innerHTML = ''; return; }
    $('notiKinds').innerHTML = '<div class="row" style="gap:6px">'
      + '<button class="btn btn-s' + (NOTI_KIND ? '' : ' btn-p') + '" data-notikind="">전체 '
      + pool.length + '</button>'
      + kinds.map(function (k) {
        return '<button class="btn btn-s' + (NOTI_KIND === k ? ' btn-p' : '') + '" data-notikind="'
          + k + '">' + esc(kindKo(k)) + ' ' + counts[k] + '</button>';
      }).join('') + '</div>';
  }

  function renderNoti() {
    /* 검수자는 '우리끼리 챙길 것'만 보고, 보내는 일은 하지 않습니다 */
    var rev = !A.IS_ADMIN;
    if (rev) NOTI_TAB = 'staff';
    ['notiScan', 'notiCopyAll', 'notiSentAll', 'notiTabs'].forEach(function (id) {
      var el = $(id); if (el) el.classList.toggle('hide', rev);
    });
    renderKinds();
    var rows = notiRows();
    if (!rows.length) {
      $('notiList').innerHTML = A.empty(NOTI_TAB === 'staff'
        ? '지금 챙길 것이 없습니다.'
        : '보낼 것이 없습니다. 위 [지금 챙길 것 찾기]를 눌러보세요.');
      return;
    }
    $('notiList').innerHTML = rows.map(function (n) {
      var w = notiWho(n);
      return '<div class="card" style="margin-bottom:10px"'
        + (n.sent_at ? ' data-sentcard="1"' : '') + '>'
        + '<div class="row" style="justify-content:space-between;align-items:flex-start">'
        + '<div><b style="font-size:14.5px">' + esc(w.name) + '</b> '
        + '<span class="chip c-info">' + esc(n.title) + '</span>'
        + (n.sent_at ? ' <span class="chip c-ok">보냄 ' + A.fdate(n.sent_at) + '</span>' : '')
        + '<div class="mono" style="margin-top:3px">' + esc(w.sub || '') + '</div></div>'
        + '<span style="display:flex;gap:6px;flex-wrap:wrap">'
        + (n.audience === 'staff' || rev ? '' : '<button class="btn btn-p btn-s" data-noticopy="' + n.id + '">📋 복사</button>')
        + (n.sent_at || rev ? '' : '<button class="btn btn-s" data-notisent="' + n.id + '">'
          + (n.audience === 'staff' ? '확인함' : '보냄') + '</button>')
        + '</span></div>'
        + '<pre style="white-space:pre-wrap;font:inherit;margin:11px 0 0;padding:11px 13px;'
        + 'background:var(--surface-2);border:1px solid var(--line);border-radius:8px;'
        + 'font-size:13px;line-height:1.65">' + esc(n.body) + '</pre>'
        + '</div>';
    }).join('');
  }

  $('notiShowSent').onchange = renderNoti;
  $('notiScan').onclick = function () { loadNoti(true); };

  /* 설정 — 서명과 '어떤 알림을 만들지' */
  function renderNotiSet() {
    if (!A.IS_ADMIN) return;
    $('notiSign').value = NOTI_SET.sign || '';
    var on = NOTI_SET.noti || {};
    $('notiToggles').innerHTML = Object.keys(KIND_OF).map(function (aud) {
      var label = aud === 'blogger' ? '블로거에게' : aud === 'academy' ? '학원에게' : '우리끼리';
      return '<div><label class="f">' + label + '</label>'
        + KIND_OF[aud].map(function (k) {
          return '<label style="display:flex;align-items:center;gap:7px;font-size:13px;padding:3px 0">'
            + '<input type="checkbox" data-notikindset="' + k + '"'
            + (on[k] === false ? '' : ' checked') + '>' + esc(kindKo(k)) + '</label>';
        }).join('') + '</div>';
    }).join('');
  }
  $('notiSetSave').onclick = async function () {
    this.disabled = true;
    var on = {};
    document.querySelectorAll('[data-notikindset]').forEach(function (c) {
      on[c.dataset.notikindset] = c.checked;
    });
    var v = Object.assign({}, NOTI_SET, { sign: $('notiSign').value.trim(), noti: on });
    var r = await A.sb.from('settings').update({ value: v }).eq('key', 'blog').select();
    this.disabled = false;
    if (r.error || !r.data || !r.data.length) { A.toast('저장 실패'); return; }
    NOTI_SET = v; A.toast('저장했습니다');
  };

  $('notiCopyAll').onclick = async function () {
    var rows = notiRows();
    if (!rows.length) { A.toast('복사할 것이 없습니다'); return; }
    var text = rows.map(function (n) {
      var w = notiWho(n);
      return '── ' + w.name + (w.sub ? ' (' + w.sub + ')' : '') + ' ──\n' + n.body;
    }).join('\n\n');
    try { await navigator.clipboard.writeText(text); A.toast(rows.length + '건을 복사했습니다'); }
    catch (e) { A.toast('복사에 실패했습니다'); }
  };

  $('notiSentAll').onclick = async function () {
    var rows = notiRows().filter(function (n) { return !n.sent_at; });
    if (!rows.length) { A.toast('표시할 것이 없습니다'); return; }
    if (!confirm(rows.length + '건을 모두 보낸 것으로 표시할까요?')) return;
    try {
      await A.rpc('notify_sent', { p_ids: rows.map(function (n) { return n.id; }) });
      A.toast(rows.length + '건을 보냄으로 표시했습니다');
      await loadNoti(false);
    } catch (e) { A.toast('실패: ' + e.message); }
  };

  /* ═══ 화면 진입 시 ═══ */
  A.onShow = function (name) {
    if (!A.IS_REVIEWER) return;      /* 관리자·검수자 둘 다 true */
    if (name === 'noti') loadNoti(true);
    if (name === 'edu') loadEdu();
    if (name === 'pay') loadPay();
    if (name === 'review') A.view('acad-list');
    if (name === 'kw' && $('kwOrder').value) $('kwOrder').onchange();  /* 주문 글감을 자동으로 채웁니다 */
  };

  /* ═══ 동작 ═══ */
  document.addEventListener('click', async function (e) {
    var t;

    if ((t = e.target.closest('[data-openacad]'))) { openAcad(t.dataset.openacad); return; }
    if ((t = e.target.closest('[data-opencp]'))) { openCP(t.dataset.opencp); return; }
    if ((t = e.target.closest('[data-mem]'))) {
      var mr = document.querySelector('[data-memrow="' + t.dataset.mem + '"]');
      if (mr) { mr.classList.toggle('hide'); t.textContent = mr.classList.contains('hide') ? '멤버 보기' : '접기'; }
      return;
    }
    if ((t = e.target.closest('[data-gokw]'))) {
      $('kwOrder').value = t.dataset.gokw; $('kwOrder').onchange(); A.show('kw'); return;
    }
    if ((t = e.target.closest('[data-openrj]'))) {
      RJ_POST = t.dataset.openrj;
      var p = POSTS.filter(function (x) { return x.id === RJ_POST; })[0] || {};
      var b = A.PEOPLE.filter(function (x) { return x.id === p.blogger_id; })[0] || {};
      $('rjWho').innerHTML = '<b>' + esc(b.name || '') + ' · ' + esc(p.keyword || '') + '</b>'
        + '<div class="mono" style="margin-top:3px">' + esc(A.commName(b.community_id)) + ' · '
        + (b.level || 1) + '단계 · ' + A.fdate(p.submitted_at) + '에 냄</div>';
      A.view('reject'); return;
    }

    if ((t = e.target.closest('[data-approve]'))) {
      t.disabled = true;
      try { await A.rpc('post_review', { p_post: t.dataset.approve, p_ok: true, p_reasons: [], p_note: null });
        A.toast('승인했습니다'); await A.loadAdmin(); openAcad(RV_ORDER); }
      catch (err) { A.toast('실패: ' + err.message); t.disabled = false; }
      return;
    }
    if ((t = e.target.closest('[data-verify]')) || (t = e.target.closest('[data-unverify]'))) {
      var pid = t.dataset.verify || t.dataset.unverify, ok = !!t.dataset.verify;
      var rk = document.querySelector('[data-rank="' + pid + '"]');
      t.disabled = true;
      try {
        await A.rpc('post_verify', {
          p_post: pid, p_ok: ok, p_rank: rk && rk.value ? Number(rk.value) : null,
          p_note: ok ? null : '올라간 글에 문제가 있습니다'
        });
        A.toast(ok ? '확인 완료. 이제 정산 대상입니다' : '수정 요청으로 되돌렸습니다');
        await A.loadAdmin();
      } catch (err) { A.toast('실패: ' + err.message); t.disabled = false; }
      return;
    }

    if ((t = e.target.closest('[data-act]'))) {
      var id = t.dataset.id, act = t.dataset.act;
      t.disabled = true;
      try {
        if (act === 'low') {
          var note = prompt('저품질로 표시하고 거절합니다. 사유를 적어 주세요.',
            '블로그가 검색에 노출되지 않습니다.');
          if (note === null) { t.disabled = false; return; }
          await A.rpc('blogger_decide', { p_id: id, p_status: 'rejected', p_reason: note, p_quality: 'low' });
          A.toast('저품질로 표시하고 거절했습니다');
        } else if (act === 'rejected') {
          var why = prompt('거절 사유를 적어 주세요.\n신청한 분 화면에 그대로 보입니다.',
            '블로그를 시작한 지 얼마 되지 않았습니다. 3개월 뒤 다시 신청하실 수 있습니다.');
          if (why === null) { t.disabled = false; return; }
          await A.rpc('blogger_decide', { p_id: id, p_status: 'rejected', p_reason: why });
          A.toast('거절했습니다');
        } else {
          var c1 = null, c2 = null, c3 = null;
          document.querySelectorAll('[data-id="' + id + '"][data-chk]').forEach(function (x) {
            if (x.dataset.chk === '1') c1 = x.checked;
            if (x.dataset.chk === '2') c2 = x.checked;
            if (x.dataset.chk === '3') c3 = x.checked;
          });
          await A.rpc('blogger_decide', { p_id: id, p_status: act, p_reason: null, p_c1: c1, p_c2: c2, p_c3: c3 });
          A.toast(act === 'approved' ? '승인했습니다' : act === 'hold' ? '보류함으로 옮겼습니다'
            : act === 'paused' ? '쉬는 중으로 바꿨습니다' : '대기로 되돌렸습니다');
        }
        await A.loadAdmin();
      } catch (err) { A.toast('실패: ' + err.message); }
      t.disabled = false; return;
    }

    if ((t = e.target.closest('[data-savenb]'))) {
      var el = document.querySelector('[data-nb="' + t.dataset.savenb + '"]');
      if (!el || el.value === '') { A.toast('숫자를 넣어 주세요'); return; }
      t.disabled = true;
      try { await A.rpc('blogger_set_neighbors', { p_id: t.dataset.savenb, p_n: Number(el.value) });
        A.toast('이웃 수를 저장했습니다'); await A.loadAdmin(); }
      catch (err) { A.toast('실패: ' + err.message); }
      t.disabled = false; return;
    }

    if ((t = e.target.closest('[data-up]'))) {
      t.disabled = true;
      try { await A.rpc('blogger_set_level', { p_id: t.dataset.up, p_level: Number(t.dataset.tolv) });
        A.toast('단계를 올렸습니다'); await A.loadAdmin(); }
      catch (err) { A.toast('실패: ' + err.message); t.disabled = false; }
      return;
    }

    if ((t = e.target.closest('[data-savec]'))) {
      var cid = t.dataset.savec, patch = {};
      document.querySelectorAll('[data-cid="' + cid + '"]').forEach(function (i) {
        patch[i.dataset.cf] = i.value.trim() || null;
      });
      if (!patch.name) { A.toast('공동체 이름은 비울 수 없습니다'); return; }
      t.disabled = true;
      var r = await A.sb.from('communities').update(patch).eq('id', cid).select();
      t.disabled = false;
      if (r.error || !r.data || !r.data.length) { A.toast('저장 실패 (권한 확인 필요)'); return; }
      A.toast('저장했습니다'); await A.loadAdmin(); await A.loadCommsPublic(); return;
    }

    if ((t = e.target.closest('[data-paid]'))) {
      var amt = document.querySelector('[data-payamt="' + t.dataset.paid + '"]');
      t.disabled = true;
      try {
        await A.rpc('order_set_paid', {
          p_order: t.dataset.paid, p_amount: amt ? Number(amt.value) : null, p_when: A.today()
        });
        A.toast('입금을 확인했습니다. 이제 4번 키워드 만들기로 가시면 됩니다');
        await A.loadAdmin();
      } catch (err) { A.toast('실패: ' + err.message); }
      t.disabled = false; return;
    }

    if ((t = e.target.closest('[data-saveo]'))) {
      var oid2 = t.dataset.saveo, up = {};
      document.querySelectorAll('[data-oid="' + oid2 + '"]').forEach(function (i) {
        var f = i.dataset.of;
        up[f] = f === 'info_pack' ? (i.value.trim() || null)
          : i.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      });
      t.disabled = true;
      var r2 = await A.sb.from('blog_orders').update(up).eq('id', oid2).select();
      t.disabled = false;
      if (r2.error || !r2.data || !r2.data.length) { A.toast('저장 실패'); return; }
      A.toast('글감을 저장했습니다'); await A.loadAdmin(); return;
    }

    if ((t = e.target.closest('[data-noti]'))) {
      NOTI_TAB = t.dataset.noti; NOTI_KIND = ''; renderNoti(); return;
    }
    if ((t = e.target.closest('[data-notikind]'))) {
      NOTI_KIND = t.dataset.notikind; renderNoti(); return;
    }

    if ((t = e.target.closest('[data-noticopy]'))) {
      var nn = NOTI.filter(function (x) { return x.id === t.dataset.noticopy; })[0];
      if (!nn) return;
      try { await navigator.clipboard.writeText(nn.body); A.toast('문구를 복사했습니다'); }
      catch (err) { window.prompt('아래 내용을 복사해 보내주세요', nn.body); }
      return;
    }

    if ((t = e.target.closest('[data-notisent]'))) {
      t.disabled = true;
      try { await A.rpc('notify_sent', { p_ids: [t.dataset.notisent] }); await loadNoti(false); }
      catch (err) { A.toast('실패: ' + err.message); t.disabled = false; }
      return;
    }

    if ((t = e.target.closest('[data-copystatus]'))) {
      var url0 = t.dataset.copystatus;
      try { await navigator.clipboard.writeText(url0); A.toast('주소를 복사했습니다. 학원에 보내주세요'); }
      catch (err) { window.prompt('아래 주소를 복사해 학원에 보내주세요', url0); }
      return;
    }

    if ((t = e.target.closest('[data-delorder]'))) {
      var o0 = A.ORDERS.filter(function (x) { return x.id === t.dataset.delorder; })[0] || {};
      var made = (prog(o0.id).made || 0);
      if (!confirm('「' + (o0.academy_name || '') + '」 주문을 지울까요?\n\n'
        + '만들어둔 글 ' + made + '편도 같이 지워집니다. 되돌릴 수 없습니다.\n'
        + '기록을 남기고 싶으시면 취소하고 상태를 「종료」로 바꿔 주세요.')) return;
      t.disabled = true;
      try {
        var res = await A.rpc('order_delete', { p_order: t.dataset.delorder });
        A.toast((res.academy || '') + ' 주문과 글 ' + (res.posts || 0) + '편을 지웠습니다');
        await A.loadAdmin();
      } catch (err) { A.toast(err.message); t.disabled = false; }
      return;
    }

    if ((t = e.target.closest('[data-send]'))) {
      if (!confirm('이 공동체에 돈을 보낸 것으로 표시할까요?\n표시하면 해당 글들이 정산 완료로 바뀝니다.')) return;
      t.disabled = true;
      try { await A.rpc('payout_send', { p_id: t.dataset.send }); A.toast('보낸 것으로 표시했습니다');
        await A.loadAdmin(); await loadPay(); }
      catch (err) { A.toast('실패: ' + err.message); t.disabled = false; }
      return;
    }

    if ((t = e.target.closest('[data-att]'))) { await openAttend(t.dataset.att); return; }
    if ((t = e.target.closest('[data-delmat]'))) {
      if (!confirm('이 자료를 지울까요?')) return;
      await A.sb.from('training_materials').delete().eq('id', t.dataset.delmat);
      A.toast('지웠습니다'); await loadEdu(); return;
    }
    if ((t = e.target.closest('[data-mark]'))) {
      var parts = t.dataset.mark.split('|');
      try { await A.rpc('training_attend', { p_session: parts[0], p_blogger: parts[1], p_mode: parts[2] });
        await loadEdu(); await openAttend(parts[0]); A.toast('저장했습니다'); }
      catch (err) { A.toast('실패: ' + err.message); }
      return;
    }
  });

  async function openAttend(sid) {
    var s = SESSIONS.filter(function (x) { return x.id === sid; })[0]; if (!s) return;
    var appr = A.PEOPLE.filter(function (p) { return p.status === 'approved'; });
    $('eduProgress').innerHTML = '<div class="crumb"><b style="color:var(--ink)">'
      + (s.kind === 't1' ? '1차 교육' : '2차 교육') + ' · ' + A.fdt(s.held_at) + '</b>'
      + '<span class="mono">참석을 체크하세요. 못 온 사람은 녹화본을 봐야 이수됩니다</span></div>'
      + '<div class="tblbox tblscroll"><table><thead><tr><th>이름</th><th>공동체</th><th>지금</th><th></th></tr></thead><tbody>'
      + appr.map(function (p) {
        var a = ATT.filter(function (x) { return x.session_id === sid && x.blogger_id === p.id; })[0];
        var now = a ? (a.mode === 'live' ? '실시간 참석' : a.mode === 'video' ? '녹화본으로 이수' : '결석') : '체크 안 함';
        return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(A.commName(p.community_id)) + '</td>'
          + '<td>' + esc(now) + '</td><td><div class="row">'
          + '<button class="btn btn-s" data-mark="' + sid + '|' + p.id + '|live">실시간</button>'
          + '<button class="btn btn-s" data-mark="' + sid + '|' + p.id + '|video">녹화본</button>'
          + '<button class="btn btn-s" data-mark="' + sid + '|' + p.id + '|absent">결석</button>'
          + '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
    window.scrollTo(0, document.body.scrollHeight);
  }

  /* 추가 폼 */
  $('btnAddComm').onclick = async function () {
    var name = $('newComm').value.trim(); if (!name) { A.toast('이름을 적어 주세요'); return; }
    this.disabled = true;
    var r = await A.sb.from('communities').insert({ name: name }).select();
    this.disabled = false;
    if (r.error) { A.toast('추가 실패: ' + r.error.message); return; }
    $('newComm').value = ''; A.toast('추가했습니다');
    await A.loadAdmin(); await A.loadCommsPublic();
  };
  $('btnAddOrder').onclick = async function () {
    var name = $('no_name').value.trim(), qty = Number($('no_qty').value);
    if (!name || !qty) { A.toast('학원 이름과 편수를 넣어 주세요'); return; }
    this.disabled = true;
    try {
      await A.rpc('order_create', {
        p_academy: name, p_qty: qty, p_sale: Number($('no_price').value) || 6000,
        p_deadline: $('no_deadline').value || null, p_region: $('no_region').value.trim() || null
      });
      A.toast('주문을 만들었습니다');
      $('no_name').value = ''; $('no_qty').value = '';
      await A.loadAdmin();
    } catch (e) { A.toast('실패: ' + e.message); }
    this.disabled = false;
  };
  $('btnAddSession').onclick = async function () {
    if (!$('ns_at').value) { A.toast('날짜를 넣어 주세요'); return; }
    this.disabled = true;
    var r = await A.sb.from('training_sessions').insert({
      kind: $('ns_kind').value, held_at: new Date($('ns_at').value).toISOString(),
      zoom_url: $('ns_url').value.trim() || null
    }).select();
    this.disabled = false;
    if (r.error) { A.toast('추가 실패: ' + r.error.message); return; }
    $('ns_url').value = ''; A.toast('일정을 추가했습니다'); await loadEdu();
  };
  $('btnAddMat').onclick = async function () {
    var title = $('nm_title').value.trim(), url = $('nm_url').value.trim();
    if (!title || !url) { A.toast('제목과 주소를 넣어 주세요'); return; }
    this.disabled = true;
    var r = await A.sb.from('training_materials').insert({
      title: title, url: url, minutes: Number($('nm_min').value) || null,
      pass_code: $('nm_code').value.trim() || null, required: $('nm_req').checked,
      sort: MATS.length
    }).select();
    this.disabled = false;
    if (r.error) { A.toast('추가 실패: ' + r.error.message); return; }
    $('nm_title').value = ''; $('nm_url').value = ''; $('nm_code').value = '';
    A.toast('자료를 올렸습니다'); await loadEdu();
  };

  document.addEventListener('change', async function (e) {
    if (e.target.id === 'allPosts')
      document.querySelectorAll('.pk-post').forEach(function (c) { c.checked = e.target.checked; });
    if (e.target.id === 'allPeople')
      document.querySelectorAll('.pk-ppl').forEach(function (c) { c.checked = e.target.checked; });
    if (e.target.classList.contains('pk-post') || e.target.classList.contains('pk-ppl')
      || e.target.id === 'allPosts' || e.target.id === 'allPeople') refreshPick();

    if (e.target.dataset && e.target.dataset.ostatus) {
      try { await A.rpc('order_close', { p_order: e.target.dataset.ostatus, p_status: e.target.value });
        A.toast('주문 상태를 바꿨습니다'); await A.loadAdmin(); }
      catch (err) { A.toast('실패: ' + err.message); }
    }

    if (e.target.dataset && e.target.dataset.lv) {
      try { await A.rpc('blogger_set_level', { p_id: e.target.dataset.lv, p_level: Number(e.target.value) });
        A.toast('단계를 바꿨습니다'); await A.loadAdmin(); }
      catch (err) { A.toast('실패: ' + err.message); }
    }
  });
  $('fName').oninput = renderList;
  $('fComm').onchange = renderList;
})(window.ESC);
