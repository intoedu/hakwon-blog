/* 관리자 화면 1~8 */
(function (A) {
  'use strict';
  var $ = A.$, esc = A.esc, won = A.won;

  var STATS = [], PROG = [], POSTS = [], SESSIONS = [], MATS = [], ATT = [], TPROG = [];
  var ALLTOPICS = [], NOTES = [], RVSPECS = [];   /* 소재 전체 · 학원이 보낸 전달사항 전체 (주문 카드에서 씁니다) */
  var CPAY = [], BPAY = [];
  var SUBTAB = 'pending', RV_ORDER = null, RV_COMM = null, RJ_POST = null, KWDRAFT = [];
  var REQ_DONE = {};    /* 의뢰 id → ESC 관리자에서 '완료'로 표시됐는지 */
  var REWORKS = {};     /* 글 id → 돌려보낸 이력 (사유가 지워져도 여기 남습니다) */
  var RPAY = [];        /* 이번 달 검수 수당 명세 */
  function revRate() { return A.REVIEW_RATE || { approve: 250, verify: 250 }; }
  function sale() { return A.SALE || { normal: 6000, premium: 3000 }; }
  function split() { return A.SPLIT || { esc: 2, blogger: 2, community: 1, reviewer: 1 }; }
  function payMult() { return A.payMult(); }

  /* 학원이 낸 돈이 어떻게 나뉘는지 —
     기준은 「블로거가 받는 돈 × 3 = 학원이 내는 돈」입니다. 그래서 어느 단계든 비율이 그대로입니다.
     ⚠️ 단, 판매가는 주문을 만들 때 정해져 굳습니다. 지금은 주문 화면에 1단계 값만 있어서,
     2단계 이상 블로거에게 맡기려면 「몇 단계 몇 편」으로 값을 매기는 화면이 먼저 필요합니다. */
  function splitBox() {
    var sp = split(), tot = sp.esc + sp.blogger + sp.community + sp.reviewer;
    var rows = A.LEVELS.map(function (l) {
      return ['premium', 'normal'].map(function (k) {
        var pay = Math.round(l.rate * (k === 'premium' ? 1 : payMult()));
        var price = pay * tot / sp.blogger;             /* 블로거 몫 × 3 = 학원이 내는 돈 */
        var one = price / tot;
        return '<tr><td>' + A.lvBadge(l.lv) + ' <span class="mono">' + esc(l.name) + '</span></td>'
          + '<td>' + (k === 'premium' ? '프리미엄' : '일반') + '</td>'
          + '<td class="num"><b>' + won(price) + '</b></td>'
          + '<td class="num">' + won(one * sp.esc) + '</td>'
          + '<td class="num"><b>' + won(pay) + '</b></td>'
          + '<td class="num">' + won(one * sp.community) + '</td>'
          + '<td class="num">' + won(one * sp.reviewer) + '</td></tr>';
      }).join('');
    }).join('');

    return '<details class="outbox" style="margin-top:18px"><summary>💰 학원이 낸 돈이 어떻게 나뉘는지'
      + '<span class="mono">— ESC ' + sp.esc + ' : 블로거 ' + sp.blogger
      + ' : 공동체 ' + sp.community + ' : 검수자 ' + sp.reviewer + '</span></summary>'
      + '<div class="obody">'
      + '<div class="note"><b>블로거가 받는 돈 × 3 = 학원이 내는 돈.</b> '
      + '단계가 올라가면 학원 값도 같이 올라가므로 비율은 어느 단계에서나 그대로입니다.</div>'
      + '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>단계</th><th>회원</th><th>학원이 냄</th>'
      + '<th>ESC</th><th>블로거</th><th>공동체</th><th>검수자</th></tr></thead><tbody>'
      + rows + '</tbody></table></div>'
      + '<div class="note warn" style="margin-top:12px">'
      + '<b>아직 못 하는 것 — 주문에 단계를 섞어 담기.</b> 지금 주문 화면은 편당 값이 하나뿐이라 '
      + '<b>1단계 값(' + won(sale().premium) + ' / ' + won(sale().normal) + ')으로만 주문이 만들어집니다.</b> '
      + '「50편 = 1단계 40편 + 2단계 10편」처럼 담으시려면 그 화면을 먼저 만들어야 합니다.<br>'
      + '그전까지는 <b>2단계 이상 블로거에게 맡기면 학원에게는 1단계 값만 받은 상태</b>가 되니, '
      + '승급하신 분께 글을 맡기기 전에 말씀해 주세요.</div>'
      + '<div class="note" style="margin-top:10px"><b>공동체 몫과 검수자 수당은 아직 이 표대로 안 나갑니다.</b> '
      + '공동체는 지금 돈을 모아 보내주는 창구일 뿐 자기 몫(' + sp.community + '/' + tot + ')을 안 떼고, '
      + '검수 수당은 단계와 무관하게 ' + won(revRate().approve + revRate().verify) + '원 고정입니다. '
      + '등급별 값을 만들 때 같이 맞추면 됩니다.</div>'
      + '</div></details>';
  }

  /* ═══ 데이터 ═══ */
  A.afterTrack = function () {
    if (!A.ORDERS || !A.ORDERS.length) return;
    renderOrders(); fillSelects(); renderProgress(); renderPay && renderPay();
  };

  A.loadAdmin = async function () {
    A.COMMS = await A.sel('communities', { order: 'name' });
    A.PEOPLE = await A.sel('bloggers', { order: 'created_at', asc: false });
    STATS = await A.sel('blogger_stats');
    A.ORDERS = await A.sel('blog_orders', { order: 'created_at', asc: false });
    PROG = await A.sel('order_progress');
    POSTS = await A.sel('blog_posts', { order: 'seq' });
    ALLTOPICS = await A.sel('blog_topics', { order: 'sort' });   /* 주문 카드 「나가는 정보」용 */
    NOTES = await A.sel('order_notes', { order: 'created_at' });
    RVSPECS = await A.sel('review_specs', { order: 'sort' });

    await loadBlogStaff();
    await A.loadTraining();     /* 배정 화면이 「왜 못 받는지」를 적으려면 이게 있어야 합니다 */

    /* 돌려보낸 이력 — 다시 제출되면 글에서는 사유가 지워지므로 기록에서 가져옵니다 */
    REWORKS = {};
    try {
      var rh = await A.rpc('post_rework_history', { p_posts: null });
      (rh || []).forEach(function (h) {
        (REWORKS[h.post_id] = REWORKS[h.post_id] || []).push(h);
      });
    } catch (e) { console.warn('반려 이력', e.message); }

    /* ESC 관리자에서 의뢰를 '완료'로 바꾸면 여기서도 끝난 것으로 봅니다 */
    REQ_DONE = {};
    var rids = A.ORDERS.map(function (o) { return o.request_id; }).filter(Boolean);
    if (rids.length) {
      var rr = await A.sb.from('requests').select('id,status').in('id', rids);
      (rr.data || []).forEach(function (x) { REQ_DONE[x.id] = (x.status === '완료'); });
    }

    /* ⚠️ 하나가 터져도 나머지 화면은 그려지게 합니다.
       예전엔 한 줄로 이어 붙여 놔서, 주소 모음 하나가 터지자 그 뒤의
       리뷰 만들기·나눠주기·확인이 통째로 안 그려졌습니다(업체 칸이 텅 빈 원인). */
    [fillSelects, renderDash, renderStaffAll, renderBlogStaff,
     renderOrders, renderAssign, renderReview, renderProgress, renderLinks, renderRules,
     tgFill, tgLoad,
     function () { rvFill('rmOrder'); }, rmPaint, renderRvAssign, renderRvCheck
    ].forEach(function (fn) {
      try { fn(); } catch (e) { console.error('화면 그리기 실패:', fn.name || '(익명)', e); }
    });
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
    /* 4번 주문 고르는 칸에는 「이미 만들었음」을 붙여 둡니다 —
       같은 학원 키워드를 또 만들어 글이 두 배로 늘어나는 사고를 막습니다 */
    var el0 = $('kwOrder');
    if (el0) {
      var k0 = el0.value;
      el0.innerHTML = A.ORDERS.map(function (o) {
        var s = kwMade(o.id);
        return '<option value="' + o.id + '">' + esc(o.academy_name) + ' (' + o.total_qty + '편)'
          + (s.made ? ' — 이미 ' + s.made + '편 만듦' : ' — 아직 안 만듦') + '</option>';
      }).join('') || '<option value="">주문이 없습니다</option>';
      if (k0) el0.value = k0;
    }

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
    $('pgOrder').innerHTML = '<option value="">전체 주문</option>'
      + A.ORDERS.filter(function (o) {
          return (o.track || 'blog') === (A.TRACK || 'blog');
        }).map(function (o) {
          return '<option value="' + o.id + '">' + esc(o.academy_name)
            + ' (' + o.total_qty + '편)</option>';
        }).join('');
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

    /* 끝난 주문(다 끝냄·종료, 또는 ESC 관리자에서 의뢰를 '완료'로 바꾼 것)은 맨 아래로 */
    function closed(o) {
      return o.status === 'done' || o.status === 'ended'
        || REQ_DONE[o.request_id] === true;
    }
    var ords = A.ORDERS.slice().sort(function (a, b) {
      var ca = closed(a) ? 1 : 0, cb = closed(b) ? 1 : 0;
      if (ca !== cb) return ca - cb;
      return (b.ordered_at || '').localeCompare(a.ordered_at || '');
    });

    $('dashOrders').innerHTML = ords.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>학원</th><th>주문</th><th>올라간 글</th><th>검수 대기</th><th>입금</th><th>마감일</th>'
      + (A.IS_OWNER ? '<th></th>' : '') + '</tr></thead><tbody>'
      + ords.map(function (o) {
        var p = prog(o.id), done = Number(p.done || 0), pct = o.total_qty ? Math.round(done / o.total_qty * 100) : 0;
        var d = A.dday(o.deadline);
        var fin = closed(o);
        return '<tr' + (fin ? ' style="opacity:.5"' : '') + '>'
          + '<td><b>' + esc(o.academy_name) + '</b>'
          + (fin ? ' <span class="chip c-off">끝난 주문</span>' : '')
          + '<div class="mono">' + esc(o.region || '') + '</div></td>'
          + '<td class="num">' + o.total_qty + '편</td>'
          + '<td><div class="row"><div class="bar' + (pct < 50 ? ' mid' : '') + '" style="width:80px"><i style="width:'
          + pct + '%"></i></div><span class="num">' + done + '</span></div></td>'
          + '<td class="num">' + ((p.to_review || 0) + (p.to_verify || 0)) + '</td>'
          + '<td>' + (o.paid_at ? '<span class="chip c-ok">입금됨</span>' : '<span class="chip c-wait">입금 대기</span>') + '</td>'
          + '<td class="mono">' + (o.deadline || '-') + (d != null && d >= 0 ? ' (' + d + '일)' : d != null ? ' <b style="color:var(--bad)">지남</b>' : '') + '</td>'
          + (A.IS_OWNER ? '<td><button class="btn btn-s" data-delorder="' + o.id + '">🗑</button></td>' : '')
          + '</tr>';
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
    /* 검수자·관리자로 올라간 사람은 빼고 셉니다 (병행 표시한 사람은 포함) */
    $('tcList').textContent = A.PEOPLE.filter(function (p) {
      return ['approved', 'paused'].indexOf(p.status) >= 0
        && (!blogRoleOf(p.id) || p.also_blogging);
    }).length;
    $('acWait').textContent = cnt('pending');
    $('acHold').textContent = cnt('hold');
    $('acNo').textContent = cnt('rejected');

    var rows = A.PEOPLE.filter(function (p) { return p.status === SUBTAB; });
    if (!rows.length) {
      $('applyList').innerHTML = A.empty(SUBTAB === 'pending' ? '기다리는 신청이 없습니다.'
        : SUBTAB === 'hold' ? '보류함이 비어 있습니다.' : '거절한 신청이 없습니다.');
      return;
    }
    /* 한꺼번에 많이 들어올 때 한 명씩 누르면 끝이 없어서, 체크해서 한 번에 처리합니다 */
    $('applyList').innerHTML = bulkBar(rows.length)
      + '<div class="people">' + rows.map(applyCard).join('') + '</div>';
    refreshBulk();
  }

  function bulkBar(total) {
    var reject = SUBTAB === 'rejected';
    return '<div class="bulkbar" id="bulkBar">'
      + '<label class="row" style="gap:8px;cursor:pointer;margin:0">'
      + '<input type="checkbox" id="bulkAll"> <b>전체 선택</b>'
      + '<span class="mono">(' + total + '명)</span></label>'
      + '<span class="mono" id="bulkCnt" style="margin-left:auto">아직 안 고르셨습니다</span>'
      + (reject
        ? '<button class="btn btn-s" data-bulk="pending" disabled>다시 대기로</button>'
        : '<button class="btn btn-a btn-s" data-bulk="approved" disabled>선택한 사람 승인</button>'
        + '<button class="btn btn-s" data-bulk="hold" disabled>보류</button>'
        + '<button class="btn btn-s" data-bulk="rejected" disabled>거절</button>')
      + '</div>';
  }
  /* ⚠️ 이름을 pickedApply 로 둡니다 — 아래 5번 화면에 picked(cls) 가 따로 있어서
        같은 이름을 쓰면 나중 것이 이겨 조용히 안 먹습니다 */
  function pickedApply() {
    return [].map.call(document.querySelectorAll('.pk-apply:checked'), function (c) { return c.value; });
  }
  function refreshBulk() {
    var n = pickedApply().length, box = $('bulkBar');
    if (!box) return;
    var all = document.querySelectorAll('.pk-apply').length;
    $('bulkCnt').innerHTML = n ? '<b>' + n + '명</b> 골랐습니다' : '아직 안 고르셨습니다';
    box.querySelectorAll('[data-bulk]').forEach(function (b) { b.disabled = !n; });
    var a = $('bulkAll');
    if (a) { a.checked = n > 0 && n === all; a.indeterminate = n > 0 && n < all; }
  }
  A.refreshBulkApply = refreshBulk;

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
      + '<div class="row" style="justify-content:space-between">'
      + '<label class="row" style="gap:10px;margin:0;cursor:pointer;align-items:flex-start">'
      + '<input type="checkbox" class="pk-apply" value="' + p.id + '" style="margin-top:5px">'
      + '<span><h4>' + esc(p.name)
      + (p.age ? ' <span class="mono">' + p.age + '세</span>' : '') + '</h4>'
      + '<span class="meta">' + esc(A.commName(p.community_id)) + ' · ' + A.fdate(p.created_at) + ' 신청</span>'
      + '</span></label>'
      + chip + '</div>'
      + '<dl class="kv">'
      + '<dt>블로그</dt><dd>' + nidCell(p) + '</dd>'
      + '<dt>이웃 수</dt><dd>' + neighborCell(p) + '</dd>'
      + '<dt>연락처</dt><dd class="mono">' + esc(p.phone || '-')
      /* ⚠️ 우리는 문자·카톡을 자동으로 못 보냅니다(사업자 발신프로필이 있어야 합니다).
         그래서 **보낼 문구를 만들어 드리고 복사만** 하시게 합니다. 알림 화면과 같은 방식입니다. */
      + '<div class="row" style="margin-top:6px">'
      + '<button class="btn btn-s" data-askmsg="url:' + p.id + '">📋 주소 물어보기</button>'
      + '<button class="btn btn-s" data-askmsg="nb:' + p.id + '">📋 이웃 수 물어보기</button>'
      + '</div></dd>'
      + '<dt>이메일</dt><dd class="mono">' + esc(p.email) + '</dd>'
      + (p.reject_reason ? '<dt>거절 사유</dt><dd>' + esc(p.reject_reason) + '</dd>' : '')
      + '</dl>'
      + '<div class="row">' + btns + '</div></div>';
  }
  /* ── 블로그 주소 칸 ──
     ⚠️ 네이버 아이디는 소문자만 씁니다. 대문자로 적어 내신 분들 주소가 안 열렸는데
     (blog.naver.com/Haeun_726 → 없는 아이디), 그동안 고칠 데가 없어서
     「거절 → 재신청」밖에 방법이 없었습니다. 잘못 쓴 것뿐인데 너무 큰 벌입니다.
     여기서 그 자리에서 고칩니다. 정리는 서버 blogger_norm_nid() 가 한 번 더 합니다. */
  var NID_EDIT = {};
  function nidCell(p) {
    if (NID_EDIT[p.id]) {
      return '<span data-nidbox="' + p.id + '">'
        + '<input class="inp" style="width:230px;display:inline-block" data-nidin="' + p.id + '" '
        + 'value="' + esc(p.naver_id || '') + '" placeholder="myblogid" autocapitalize="off" '
        + 'autocorrect="off" spellcheck="false"> '
        + '<button class="btn btn-p btn-s" data-nidsave="' + p.id + '">저장</button> '
        + '<button class="btn btn-s" data-nidcancel="' + p.id + '">취소</button>'
        + '<div class="mono" style="margin-top:4px">blog.naver.com/<b>아이디</b> · '
        + '주소를 통째로 붙여넣으셔도 됩니다 · <b>대문자는 소문자로 바꿔 저장됩니다</b></div></span>';
    }
    return '<span data-nidbox="' + p.id + '">'
      + '<a class="mono" href="' + esc(p.blog_url) + '" target="_blank" rel="noopener">'
      + esc((p.blog_url || '').replace(/^https?:\/\//, '')) + ' ↗</a>'
      + (p.blog_alias ? ' <span class="mono">' + esc(p.blog_alias) + '</span>' : '')
      + ' <button class="btn btn-s" data-nidedit="' + p.id + '" '
      + 'title="눌러 보고 안 열리면 여기서 고치세요">✏️ 고치기</button></span>';
  }

  /* ── 블로거 목록의 이웃 수 칸 ──
     ⚠️ 예전엔 승인 대기 카드에서만 고칠 수 있어서, 승인하고 나면 고칠 데가 없었습니다.
     시간이 지나 이웃이 늘거나 승인할 때 안 적어 두었으면 손댈 방법이 없었습니다.
     숫자를 누르면 그 자리에서 고쳐집니다. */
  function nbCell(p) {
    var has = p.neighbors != null, hid = !has && p.neighbors_checked_at;
    return '<button class="nbbtn' + (has ? '' : ' none') + '" data-nbopen="' + p.id + '" '
      + 'title="눌러서 고치기">' + esc(A.nbText(p)) + '</button>'
      + (p.neighbors_checked_at
        ? '<div class="mono" style="font-size:10.5px">'
          + (hid ? '열어봄 · ' : '') + A.fdate(p.neighbors_checked_at) + '</div>'
        : has ? '' : '<div class="mono" style="font-size:10.5px">본인 신고</div>');
  }
  /* 숫자를 누르면 그 칸이 입력칸으로 바뀝니다 */
  function nbEdit(td, p) {
    td.innerHTML = '<div class="row" style="gap:4px;justify-content:flex-end">'
      + '<input class="inp" style="width:78px;padding:4px 6px;font-size:12px;text-align:right" '
      + 'data-nb="' + p.id + '" type="number" placeholder="숫자" '
      + 'value="' + (p.neighbors == null ? '' : p.neighbors) + '">'
      + '<button class="btn btn-a btn-s" data-savenb="' + p.id + '" style="padding:4px 8px">저장</button>'
      + '<button class="btn btn-s" data-nbhide="' + p.id + '" style="padding:4px 8px" '
      + 'title="블로그에 이웃 수가 안 보일 때">비공개</button>'
      + '</div>'
      + '<div class="mono" style="font-size:10.5px">본인 신고 ' + esc(p.neighbors_band || '-') + '</div>';
    var i = td.querySelector('input'); if (i) { i.focus(); i.select(); }
  }

  function neighborCell(p) {
    var hid = p.neighbors == null && p.neighbors_checked_at;
    return '<span class="mono">본인 신고 ' + esc(p.neighbors_band || '-') + '</span> '
      + '<input class="inp" style="width:110px;display:inline-block;padding:4px 8px;font-size:13px" '
      + 'data-nb="' + p.id + '" type="number" placeholder="실제 숫자" value="' + (p.neighbors == null ? '' : p.neighbors) + '">'
      + ' <button class="btn btn-s" data-savenb="' + p.id + '">확인 저장</button>'
      /* 이웃 수를 감춰 둔 블로그가 많습니다 — 못 봤다는 것을 기록해 둬야
         「아직 안 열어봤다」와 구분됩니다 */
      + ' <button class="btn btn-s" data-nbhide="' + p.id + '" '
      + 'title="블로그에 이웃 수가 안 보일 때">비공개</button>'
      + (p.neighbors_checked_at
        ? '<div class="mono">' + (hid ? '<b>비공개</b> — ' : '') + A.fdate(p.neighbors_checked_at) + ' 확인</div>'
        : '');
  }

  function renderList() {
    var q = ($('fName').value || '').trim(), cid = $('fComm').value;
    var lvf = $('fLevel') ? $('fLevel').value : '';
    var rows = A.PEOPLE.filter(function (p) {
      if (p.status !== 'approved' && p.status !== 'paused') return false;
      if (cid && p.community_id !== cid) return false;
      if (lvf && String(p.level) !== lvf) return false;
      if (q && p.name.indexOf(q) < 0) return false;
      /* 검수자·관리자로 올라간 사람은 「검수자 / 관리자」 탭으로 갑니다.
         병행에 체크한 사람만 여기 남습니다 */
      if (blogRoleOf(p.id) && !p.also_blogging) return false;
      return true;
    });
    if (!rows.length) { $('listBox').innerHTML = A.empty('해당하는 블로거가 없습니다.'); return; }

    $('listBox').innerHTML = '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>이름</th><th>공동체</th><th>단계</th><th>편당</th><th>이웃</th>'
      + '<th>통과율</th><th>평균 노출</th><th>이번 달</th><th>누적</th><th>교육</th><th></th></tr></thead><tbody>'
      + rows.map(function (p) {
        var s = stat(p.id), lv = A.levelOf(p.level);
        var pass = s.judged ? Math.round(s.pass_first / s.judged * 100) + '%' : '-';
        var opts = A.LEVELS.map(function (l) {
          return '<option value="' + l.lv + '"' + (l.lv === p.level ? ' selected' : '') + '>' + l.lv + '단계</option>';
        }).join('');
        return '<tr data-brow="' + p.id + '"><td>'
          + '<button class="nmbtn" data-bopen="' + p.id + '" title="눌러서 신청 내용 보기">'
          + esc(p.name) + '</button>'
          + (p.wants_more ? ' <span class="chip c-ok">★ 많이 원함</span>' : '')
          + '<div class="mono">' + esc(p.phone || '') + '</div></td>'
          + '<td>' + esc(A.commName(p.community_id)) + '</td>'
          + '<td>' + A.lvBadge(p.level) + '</td><td class="num">' + won(lv.rate) + '</td>'
          + '<td class="num">' + nbCell(p) + '</td>'
          + '<td class="num">' + pass + '</td>'
          + '<td class="num">' + (s.avg_rank == null ? '-' : s.avg_rank + '위') + '</td>'
          + '<td class="num">' + (s.done_month || 0) + '</td><td class="num">' + (s.done_total || 0) + '</td>'
          + '<td>' + (s.ready ? '<span class="chip c-ok">완료</span>' : '<span class="chip c-wait">미완</span>') + '</td>'
          + '<td><div class="row">'
          + '<select class="inp" style="width:auto;padding:4px 8px;font-size:12px" data-lv="' + p.id + '">' + opts + '</select>'
          + '<button class="btn btn-s" data-openpm="' + p.id + '">검수자·관리자로 ↑</button>'
          + '<button class="btn btn-s" data-wants="' + p.id + '" data-on="' + (p.wants_more ? 1 : 0)
          + '" title="글을 많이 받고 싶다는 표시. 켜면 배정에서 먼저 갑니다">'
          + (p.wants_more ? '★ 많이' : '☆ 많이') + '</button>'
          + '<button class="btn btn-s" data-act="' + (p.status === 'approved' ? 'paused' : 'approved')
          + '" data-id="' + p.id + '">' + (p.status === 'approved' ? '쉬게 하기' : '다시 활동') + '</button>'
          + '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ── 블로거 신청 내용 펼쳐 보기 ──
     ⚠️ 승인하고 나면 신청서에 적은 것(나이·네이버 아이디·별명·이웃 구간·이메일)을
     볼 데가 없었습니다. 블로그 주소조차 목록에 없어서 확인하러 갈 수가 없었습니다.
     승인 대기 카드에서 보이던 것을 승인 뒤에도 그대로 볼 수 있게 합니다. */
  function bDetailRow(p) {
    var role = blogRoleOf(p.id);
    function kvrow(k, v) {
      return '<dt>' + k + '</dt><dd>' + (v || '<span class="mono">-</span>') + '</dd>';
    }
    return '<tr class="bdetail" data-bdet="' + p.id + '"><td colspan="11">'
      + '<div class="bdbox">'
      + '<div class="sec" style="margin-top:0">신청서에 적은 것</div>'
      + '<dl class="kv">'
      + kvrow('공동체', esc(A.commName(p.community_id)))
      + kvrow('이름 · 나이', esc(p.name) + (p.age ? ' · ' + p.age + '세' : ''))
      + kvrow('네이버 아이디', p.naver_id ? '<span class="mono">' + esc(p.naver_id) + '</span>' : '')
      + kvrow('블로그 별명', esc(p.blog_alias || ''))
      + kvrow('블로그 주소', nidCell(p))
      + kvrow('이웃 수', '<span class="mono">본인 신고 ' + esc(p.neighbors_band || '-') + '</span>'
        + (p.neighbors != null ? ' · 확인 <b>' + won(p.neighbors) + '명</b>'
          + (p.neighbors_checked_at ? ' <span class="mono">(' + A.fdate(p.neighbors_checked_at) + ')</span>' : '')
          : ' <span class="mono">· 아직 확인 안 함</span>'))
      + kvrow('전화번호', '<span class="mono">' + esc(p.phone || '-') + '</span>')
      + kvrow('이메일 (로그인 아이디)', '<span class="mono">' + esc(p.email || '-') + '</span>')
      + '</dl>'
      + '<div class="sec">우리가 기록한 것</div>'
      + '<dl class="kv">'
      + kvrow('신청 · 승인', A.fdate(p.created_at)
        + (p.approved_at ? ' 신청 → ' + A.fdate(p.approved_at) + ' 승인' : ' 신청'))
      + kvrow('단계 · 단가', p.level + '단계 · 편당 ' + won(A.levelOf(p.level).rate) + '원'
        + (p.rate_override ? ' <b>(개인 단가 ' + won(p.rate_override) + '원)</b>' : ''))
      + kvrow('블로그 품질', p.quality === 'low'
        ? '<span class="chip c-bad">저품질로 표시함</span> ' + esc(p.quality_note || '')
        : '<span class="chip c-ok">이상 없음</span>')
      + (role ? kvrow('ESC 직분', '<b>' + esc(ROLE_KO[role] || role) + '</b>'
        + (p.also_blogging ? ' · 블로거 병행' : ' · 글은 안 받음')) : '')
      + (p.reject_reason ? kvrow('거절 사유', esc(p.reject_reason)) : '')
      + (p.note ? kvrow('메모', esc(p.note)) : '')
      + '</dl>'
      + '<div class="row" style="margin-top:14px">'
      + (p.blog_url
        ? '<a class="btn btn-a btn-s" href="' + esc(p.blog_url) + '" target="_blank" rel="noopener">'
          + '📝 블로그 열어보기 ↗</a>' : '')
      + '<button class="btn btn-s" data-seeblog="' + p.id + '">👤 이 사람 화면으로 가기</button>'
      + '<span class="mono">이 사람이 보는 화면 그대로 열립니다 (보기 전용)</span>'
      + '</div></div></td></tr>';
  }

  /* ── 검수자 / 관리자 ── */
  function blogRoleOf(id) {
    var s = A.BLOGSTAFF.filter(function (x) { return x.id === id; })[0];
    return s ? s.role : null;             /* 'admin' | 'review' | 'owner' | null */
  }
  var ROLE_KO = { owner: '최고관리자', admin: '관리자', review: '검수자' };
  var STAFF_FILTER = [];                  /* 비어 있으면 전부 */

  /* 한 사람의 '상태' — 거르기와 표시에 같이 씁니다 */
  function staffKind(s) {
    if (s.role === 'owner') return 'owner';
    var p = A.PEOPLE.filter(function (x) { return x.id === s.id; })[0];
    var also = p && p.also_blogging;
    return (also ? 'both_' : '') + s.role;   /* admin / review / both_admin / both_review */
  }
  var KIND_KO2 = {
    owner: '최고관리자', admin: '관리자', review: '검수자',
    both_admin: '블로거 병행 관리자', both_review: '블로거 병행 검수자'
  };

  async function loadBlogStaff() {
    var rows = await A.sel('staff');
    A.ALLSTAFF = rows;                    /* 검수 기록에서 이름을 찾을 때 씁니다 */
    A.BLOGSTAFF = rows.filter(function (s) {
      return s.status === 'approved' &&
        (s.role === 'owner' || (s.perms && (s.perms.blog_admin || s.perms.blog_review)));
    }).map(function (s) {
      var role = s.role === 'owner' ? 'owner' : (s.perms && s.perms.blog_admin) ? 'admin' : 'review';
      return { id: s.id, name: s.name, email: s.email, phone: s.phone,
               role: role, blogRole: ROLE_KO[role], escRole: s.role, perms: s.perms || {},
               home: s.community_id || null,        /* 소속 — null 이면 ESC 본부 */
               comms: (s.perms && s.perms.blog_comms) || [] };
    });
    var b = $('tcStaff'); if (b) b.textContent = A.BLOGSTAFF.length;

    /* 로그인한 본인 — 미리보기에서 돌아올 때 여기로 되돌립니다 */
    var myId = A.SESSION && A.SESSION.user ? A.SESSION.user.id : null;
    var self = A.BLOGSTAFF.filter(function (s) { return s.id === myId; })[0];
    A.SELF_NAME = (self && self.name) || (A.SESSION && A.SESSION.user ? A.SESSION.user.email : '');
    A.SELF_COMMS = self ? self.comms : [];

    /* 지금 보고 있는 사람이 맡은 공동체 (검수 화면 형광펜에 씁니다) */
    var seen = A.BLOGSTAFF.filter(function (s) { return s.id === A.PREVIEW_STAFF; })[0];
    A.MY_COMMS = A.PREVIEW_STAFF ? (seen ? seen.comms : []) : A.SELF_COMMS;
  }

  function staffName(id) {
    if (!id) return null;
    var s = (A.ALLSTAFF || []).filter(function (x) { return x.id === id; })[0];
    return s ? (s.name || s.email) : '(지워진 계정)';
  }

  function renderStaffFilter() {
    var counts = {};
    A.BLOGSTAFF.forEach(function (s) { var k = staffKind(s); counts[k] = (counts[k] || 0) + 1; });
    $('staffFilter').innerHTML = Object.keys(KIND_KO2).filter(function (k) { return counts[k]; })
      .map(function (k) {
        return '<button data-staffk="' + k + '"' + (STAFF_FILTER.indexOf(k) >= 0 ? ' class="on"' : '') + '>'
          + KIND_KO2[k] + ' ' + counts[k] + '</button>';
      }).join('')
      + (STAFF_FILTER.length ? '<button data-staffk="">거르기 지우기</button>' : '');
  }

  function renderBlogStaff() {
    renderStaffFilter();
    var rows = A.BLOGSTAFF.filter(function (s) {
      return !STAFF_FILTER.length || STAFF_FILTER.indexOf(staffKind(s)) >= 0;
    });
    if (!rows.length) {
      $('blogStaffBox').innerHTML = A.empty(A.BLOGSTAFF.length
        ? '고르신 조건에 맞는 사람이 없습니다.'
        : '아직 검수자·관리자가 없습니다. 블로거 목록에서 올려 주세요.');
      return;
    }
    $('blogStaffBox').innerHTML = '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>이름</th><th>소속</th><th>직분</th><th>연락처</th><th>블로거 병행</th>'
      + '<th style="min-width:220px">담당 공동체</th><th>이번 달 쓴 글</th><th></th></tr></thead><tbody>'
      + rows.map(function (s) {
        var p = A.PEOPLE.filter(function (x) { return x.id === s.id; })[0];
        var st = p ? stat(p.id) : {};
        var locked = s.role === 'owner' || !p;   /* 최고관리자·블로거가 아닌 ESC 직원은 여기서 못 바꿈 */
        return '<tr><td><b>' + esc(s.name || s.email) + '</b>'
          + '<div class="mono">' + esc(s.email || '') + '</div></td>'
          /* 소속은 ESC 관리자 페이지에서 정합니다 (직원 정보라 거기가 원본) */
          + '<td>' + (s.home
            ? '<span class="chip">' + esc(A.commName(s.home)) + '</span>'
            : '<span class="mono">ESC</span>') + '</td>'
          + '<td><span class="chip ' + (s.role === 'owner' ? 'c-ok' : s.role === 'admin' ? 'c-info' : 'c-wait')
          + '">' + s.blogRole + '</span></td>'
          + '<td class="mono">' + esc(s.phone || '-') + '</td>'
          + '<td>' + (!p ? '<span class="mono">블로거 아님</span>'
            : '<label class="row" style="gap:6px;cursor:pointer"><input type="checkbox" data-also="' + s.id + '"'
              + (p.also_blogging ? ' checked' : '') + '> <span>블로거 병행</span></label>') + '</td>'
          + '<td>' + (s.role === 'admin' || s.role === 'owner'
            ? '<span class="mono">관리자는 전부 봅니다</span>'
            : '<div class="chips" data-commsfor="' + s.id + '">'
              + A.COMMS.map(function (c) {
                return '<button data-setcomm="' + c.id + '"'
                  + (s.comms.indexOf(c.id) >= 0 ? ' class="on"' : '') + '>' + esc(c.name) + '</button>';
              }).join('') + '</div>') + '</td>'
          + '<td class="num">' + (st.done_month || 0) + '</td>'
          + '<td><div class="row">'
          + '<button class="btn btn-s" data-seeas="' + s.id + '">이 사람 화면 보기</button>'
          + (locked ? '' : '<button class="btn btn-s" data-openpm="' + s.id + '">직분 바꾸기</button>')
          + '</div></td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /* ── 검수자·관리자로 올릴 때 뜨는 확인 창 ── */
  var PM = { id: null, role: null };
  function openPromote(id) {
    var p = A.PEOPLE.filter(function (x) { return x.id === id; })[0] || {};
    PM = { id: id, role: blogRoleOf(id) === 'admin' ? 'admin' : blogRoleOf(id) === 'review' ? 'review' : 'review' };
    $('pmTitle').textContent = (p.name || '') + ' 님';
    $('pmAlso').checked = !!p.also_blogging;
    $('promoteBox').classList.remove('hide');
    pmPaint();
  }
  function pmPaint() {
    document.querySelectorAll('[data-pmrole]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.pmrole === PM.role);
    });
    $('pmLead').innerHTML = PM.role === 'none'
      ? '검수·관리 권한이 사라지고 <b>글을 다시 받게</b> 됩니다.'
      : PM.role === 'admin'
        ? '주문·배정·정산까지 <b>전부</b> 하실 수 있게 됩니다.'
        : '원고를 보고 <b>통과·수정요청</b>을 하실 수 있게 됩니다. 담당 공동체는 올린 뒤에 정하시면 됩니다.';
    $('pmAlsoRow').classList.toggle('hide', PM.role === 'none');
  }
  $('pmCancel').onclick = function () { $('promoteBox').classList.add('hide'); };
  $('promoteBox').onclick = function (e) { if (e.target === this) this.classList.add('hide'); };
  $('pmOk').onclick = async function () {
    this.disabled = true;
    try {
      await A.rpc('blogger_promote', {
        p_id: PM.id, p_role: PM.role,
        p_also: PM.role === 'none' ? false : $('pmAlso').checked
      });
      $('promoteBox').classList.add('hide');
      A.toast(PM.role === 'none' ? '블로거로 되돌렸습니다' : '올렸습니다');
      await A.loadAdmin();
    } catch (e) { A.toast('실패: ' + e.message); }
    this.disabled = false;
  };

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
      + '<thead><tr><th>단계</th><th>이름</th><th>프리미엄 회원 글</th><th>일반 회원 글</th>'
      + '<th>올라가는 기준 (후보 추천용)</th><th>인원</th></tr></thead><tbody>'
      + A.LEVELS.map(function (l) {
        var n = A.PEOPLE.filter(function (p) { return p.level === l.lv && p.status === 'approved'; }).length;
        var r = RULES.filter(function (x) { return x.lv === l.lv; })[0];
        return '<tr><td>' + A.lvBadge(l.lv) + '</td>'
          + '<td><input class="inp" style="width:110px;padding:5px 8px" data-lf="name" data-llv="' + l.lv + '" value="' + esc(l.name) + '"></td>'
          + '<td><input class="inp" style="width:95px;padding:5px 8px" type="number" data-lf="rate" data-llv="' + l.lv + '" value="' + l.rate + '"></td>'
          + '<td class="num"><b>' + won(Math.round(l.rate * payMult())) + '</b>원'
          + '<div class="mono">자동 계산</div></td>'
          + '<td class="mono">' + (r ? '누적 ' + r.done + '편 · 통과율 ' + r.pass + '%'
            + (r.rank ? ' · 평균 노출 ' + r.rank + '위 안' : '')
            + ' · 이웃 ' + won(r.nb) + '명 이상' : '모두 여기서 시작') + '</td>'
          + '<td class="num">' + n + '명</td></tr>';
      }).join('') + '</tbody></table></div>'
      + '<div class="note" style="margin-top:12px">'
      + '<b>적는 값은 프리미엄 회원 글 기준입니다.</b> 일반 회원 학원은 편당 값이 '
      + payMult() + '배라(' + won(sale().normal) + ' / ' + won(sale().premium) + ') '
      + '블로거도 그만큼 더 받습니다. 오른쪽 칸은 저희가 곱해서 보여드리는 것이라 '
      + '따로 적으실 것이 없습니다.</div>'
      + splitBox()
      + '<div class="row" style="margin-top:12px"><button class="btn btn-p" id="btnSaveLevels">단계 설정 저장</button>'
      + '<span class="mono">기준은 자동 승급이 아니라 후보를 골라내는 용도입니다</span></div>'

      /* 검수자 수당 */
      + '<div class="sec" style="margin-top:26px">검수자 수당 '
      + '<small>검수도 일이라 돈이 나갑니다. 글 한 편에 두 번 나뉘어 붙습니다</small></div>'
      + '<div class="card"><div class="grid g2" style="gap:14px">'
      + '<div><label class="f">원고를 통과시키면</label>'
      + '<input class="inp" type="number" id="rvApprove" style="max-width:130px" value="'
      + (revRate().approve != null ? revRate().approve : 250) + '">'
      + '<div class="mono" style="margin-top:5px">돌려보낸 것은 안 칩니다. 최종 통과시킨 사람이 받습니다</div></div>'
      + '<div><label class="f">올라간 글을 확인하면</label>'
      + '<input class="inp" type="number" id="rvVerify" style="max-width:130px" value="'
      + (revRate().verify  != null ? revRate().verify  : 250) + '">'
      + '<div class="mono" style="margin-top:5px">검색 순위까지 적고 [확인 완료]를 누른 사람이 받습니다</div></div>'
      + '</div>'
      + '<div class="row" style="margin-top:14px">'
      + '<button class="btn btn-p" id="btnSaveReview">검수 수당 저장</button>'
      + '<span class="mono">글 한 편당 합계 <b>'
      + won((Number(revRate().approve) || 0) + (Number(revRate().verify) || 0)) + '원</b>'
      + ' · 바꿔도 <b>이미 검수한 글의 금액은 안 변합니다</b></span></div></div>';

    $('btnSaveLevels').onclick = saveLevels;
    $('btnSaveReview').onclick = saveReviewRate;

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

  async function saveReviewRate() {
    var a = Number($('rvApprove').value), v2 = Number($('rvVerify').value);
    if (!(a >= 0) || !(v2 >= 0)) { A.toast('숫자를 넣어 주세요'); return; }
    this.disabled = true;
    var cur = await A.sb.from('settings').select('value').eq('key', 'blog').maybeSingle();
    var v = (cur.data && cur.data.value) || {};
    v.review = { approve: a, verify: v2 };
    var r = await A.sb.from('settings').update({ value: v }).eq('key', 'blog').select();
    this.disabled = false;
    if (r.error || !r.data || !r.data.length) { A.toast('저장 실패 (권한 확인 필요)'); return; }
    A.REVIEW_RATE = v.review;
    A.toast('검수 수당을 저장했습니다 (편당 ' + won(a + v2) + '원)');
    renderLevels();
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
  var ALLSESS = [], ALLMATS = [], ALLPROG = [], READY = {};

  /* ⭐ 교육 기록은 「5 글 나눠주기」에서도 씁니다 — 누가 왜 못 받는지 적어 주려고.
     그래서 읽는 부분만 따로 떼어 loadAdmin 에서도 부릅니다.
     (예전엔 교육 화면에 들어가야만 읽어서, 배정 화면은 이유를 알 수가 없었습니다.) */
  A.loadTraining = async function () {
    ALLSESS = await A.sel('training_sessions', { order: 'held_at', asc: false });
    ALLMATS = await A.sel('training_materials', { order: 'sort' });
    ATT = await A.sel('training_attendance');
    ALLPROG = await A.sel('training_progress');
    SESSIONS = ALLSESS; MATS = ALLMATS; TPROG = ALLPROG;   /* 예전 코드가 쓰는 이름 */
  };

  async function loadEdu() {
    await A.loadTraining();

    /* 갈래마다 「지금 일을 받을 수 있나」가 다릅니다 (교육이 다르니까).
       한 명씩 물으면 왕복이 사람 수 × 2 번이라 한 번에 받아 옵니다. */
    READY = { blog: {}, review: {} };
    try {
      var rm = await A.rpc('bloggers_ready_map');
      (rm || []).forEach(function (r) { READY[r.track][r.blogger_id] = r.ok; });
    } catch (e) { console.warn('준비 여부', e.message); }
    renderEdu();
  }
  /* 갈래(블로그/리뷰)마다 같은 모양으로 두 번 그립니다.
     교육 내용은 다르지만 화면이 같아야 관리자가 헷갈리지 않습니다. */
  function renderEdu() {
    paintEdu('blog',   { sess: 'eduSessions',   mats: 'eduMaterials',   sum: 'eduSummaries',   prog: 'eduProgress' });
    paintEdu('review', { sess: 'rvEduSessions', mats: 'rvEduMaterials', sum: 'rvEduSummaries', prog: 'rvEduProgress' });
  }
  function paintEdu(TK, ID) {
    if (!$(ID.sess)) return;
    var SESSIONS = ALLSESS.filter(function (x) { return (x.track || 'blog') === TK; });
    var MATS = ALLMATS.filter(function (x) { return (x.track || 'blog') === TK; });
    $(ID.sess).innerHTML = SESSIONS.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>교육</th><th>날짜</th><th>실시간</th><th>녹화본</th><th>줌 링크</th><th>녹화본 주소</th><th></th></tr></thead><tbody>'
      + SESSIONS.map(function (s) {
        var live = ATT.filter(function (a) { return a.session_id === s.id && a.mode === 'live'; }).length;
        var vid = ATT.filter(function (a) { return a.session_id === s.id && a.mode === 'video'; }).length;
        /* 녹화본으로 봤다고 낸 사람 중 아직 확인 안 한 건 — 이게 관리자가 할 일입니다 */
        var wait = ATT.filter(function (a) {
          return a.session_id === s.id && a.mode === 'video' && !a.confirmed_at;
        }).length;
        return '<tr><td><b>' + (s.kind === 't1' ? '1차 교육' : '2차 교육') + '</b></td>'
          + '<td class="mono">' + A.fdt(s.held_at) + '</td>'
          + '<td class="num">' + live + '명</td>'
          + '<td class="num">' + vid + '명'
          + (wait ? ' <span class="chip c-wait">확인 ' + wait + '</span>' : '') + '</td>'
          + '<td class="mono">' + esc((s.zoom_url || '').slice(0, 24)) + '</td>'
          + '<td><div class="row" style="gap:4px">'
          + '<input class="inp" style="width:150px;padding:4px 7px;font-size:12px" '
          + 'data-rp="' + s.id + '" placeholder="유튜브 일부공개 주소" '
          + 'value="' + esc(s.replay_url || '') + '">'
          + '<button class="btn btn-s" data-saverp="' + s.id + '" style="padding:4px 8px">저장</button>'
          + '</div></td>'
          + '<td><button class="btn btn-s' + (wait ? ' btn-a' : '') + '" data-att="' + s.id + '">'
          + (wait ? '확인할 것 ' + wait + '건' : '참석 체크') + '</button></td></tr>';
      }).join('') + '</tbody></table></div>' : A.empty('줌 일정이 없습니다. 아래에서 추가하세요.');

    $(ID.mats).innerHTML = MATS.length ? '<div class="matlist">' + MATS.map(function (m) {
      var done = TPROG.filter(function (g) { return g.material_id === m.id && g.status === 'approved'; }).length;
      var wait = TPROG.filter(function (g) { return g.material_id === m.id && g.status === 'submitted'; }).length;
      return '<div class="mat">' + A.ytThumb(m.url) + '<div style="flex:1;min-width:140px">'
        + '<h4>' + esc(m.title) + (m.required ? ' <span class="chip c-bad">필수</span>' : '') + '</h4>'
        + '<div class="meta">' + (m.minutes ? m.minutes + '분 · 최소 ' + Math.round(m.minutes * 0.7) + '분 시청 · ' : '')
        + '요약 ' + (m.min_chars || 150) + '자 · ' + done + '명 이수'
        + (wait ? ' · <b style="color:var(--wait)">' + wait + '명 확인 대기</b>' : '')
        + (m.check_question ? '<br>확인 질문 · ' + esc(m.check_question) : '') + '</div></div>'
        + '<a class="btn btn-s" href="' + esc(m.url) + '" target="_blank" rel="noopener">열기 ↗</a>'
        + '<button class="btn btn-s" data-delmat="' + m.id + '">삭제</button></div>';
    }).join('') + '</div>' : A.empty('영상 자료가 없습니다.');

    renderSummaries(TK, ID.sum, MATS);

    var appr = A.PEOPLE.filter(function (p) { return p.status === 'approved'; });
    var t1 = SESSIONS.filter(function (s) { return s.kind === 't1'; }).map(function (s) { return s.id; });
    var t2 = SESSIONS.filter(function (s) { return s.kind === 't2'; }).map(function (s) { return s.id; });
    var req = MATS.filter(function (m) { return m.required; });

    $(ID.prog).innerHTML = appr.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>이름</th><th>공동체</th><th>1차 교육</th><th>영상</th><th>2차 교육</th><th>글 받을 수 있나</th></tr></thead><tbody>'
      + appr.map(function (p) {
        var a1 = ATT.filter(function (a) { return a.blogger_id === p.id && t1.indexOf(a.session_id) >= 0; })[0];
        var a2 = ATT.filter(function (a) { return a.blogger_id === p.id && t2.indexOf(a.session_id) >= 0; })[0];
        var mine = TPROG.filter(function (g) { return g.blogger_id === p.id && g.status === 'approved'; }).length;
        var wt = TPROG.filter(function (g) { return g.blogger_id === p.id && g.status === 'submitted'; }).length;
        var need = req.length;
        var okNow = READY[TK] && READY[TK][p.id];
        return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(A.commName(p.community_id)) + '</td>'
          + '<td>' + (a1 ? (a1.mode === 'live' ? '<span class="chip c-ok">참석</span>'
            : '<span class="chip c-wait">녹화본</span>') : '<span class="chip c-bad">아직</span>') + '</td>'
          + '<td>' + (need === 0 ? '<span class="chip c-off">없음</span>'
            : mine >= need ? '<span class="chip c-ok">' + mine + '/' + need + '</span>'
              : '<span class="chip c-bad">' + mine + '/' + need + '</span>')
          + (wt ? ' <span class="chip c-wait">요약 ' + wt + '건 확인 대기</span>' : '') + '</td>'
          + '<td>' + (a2 ? '<span class="chip c-ok">참석</span>' : '<span class="chip c-off">—</span>') + '</td>'
          + '<td>' + (okNow ? '<span class="chip c-ok">가능</span>' : '<span class="chip c-bad">아직</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : A.empty('승인된 사람이 없습니다.');
  }

  /* 낸 요약 확인 — 영상을 정말 봤는지는 요약을 읽어보면 압니다.
     본 시간·붙여넣기 여부를 같이 보여 주니 의심스러운 것만 골라 보시면 됩니다. */
  function renderSummaries(TK, boxId, MATS) {
    var box = $(boxId); if (!box) return;
    var mine = {}; MATS.forEach(function (m) { mine[m.id] = 1; });
    var TPROG = ALLPROG.filter(function (g) { return mine[g.material_id]; });
    var wait = TPROG.filter(function (g) { return g.status === 'submitted'; })
      .sort(function (a, b) { return (a.submitted_at || '') < (b.submitted_at || '') ? -1 : 1; });
    var judged = TPROG.filter(function (g) { return g.status !== 'submitted' && g.summary; })
      .sort(function (a, b) { return (a.reviewed_at || '') > (b.reviewed_at || '') ? -1 : 1; }).slice(0, 10);

    if (!wait.length && !judged.length) {
      box.innerHTML = A.empty('아직 올라온 요약이 없습니다. 블로거가 영상을 보고 요약을 내면 여기에 뜹니다.');
      return;
    }
    box.innerHTML = (wait.length ? wait.map(sumCard).join('')
      : '<div class="note ok">확인을 기다리는 요약이 없습니다.</div>')
      + (judged.length ? '<div class="sec">이미 본 것</div>'
        + '<div class="tblbox tblscroll"><table><thead><tr><th>이름</th><th>영상</th>'
        + '<th>결과</th><th>누가 · 언제</th></tr></thead><tbody>'
        + judged.map(function (g) {
          return '<tr><td><b>' + esc(nameOf(g.blogger_id)) + '</b></td>'
            + '<td>' + esc(matTitle(g.material_id)) + '</td>'
            + '<td>' + (g.status === 'approved'
              ? '<span class="chip c-ok">이수</span>' : '<span class="chip c-bad">다시쓰기</span>') + '</td>'
            + '<td class="mono">' + esc(staffName(g.reviewed_by) || '-') + ' · ' + A.fdate(g.reviewed_at) + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '');
  }
  function nameOf(id) {
    var p = A.PEOPLE.filter(function (x) { return x.id === id; })[0];
    return p ? p.name : '(지워진 블로거)';
  }
  function matTitle(id) {
    var m = MATS.filter(function (x) { return x.id === id; })[0];
    return m ? m.title : '(지워진 자료)';
  }
  function sumCard(g) {
    var m = MATS.filter(function (x) { return x.id === g.material_id; })[0] || {};
    var need = m.minutes ? Math.round(m.minutes * 60 * 0.7) : 0;
    var short = need && g.watched_sec < need;
    var key = g.material_id + '|' + g.blogger_id;
    return '<div class="card" style="margin-bottom:12px">'
      + '<div class="row" style="justify-content:space-between;margin-bottom:10px"><div>'
      + '<b style="font-size:15px">' + esc(nameOf(g.blogger_id)) + '</b> '
      + '<span class="mono">' + esc(m.title || '') + ' · ' + A.fdt(g.submitted_at) + '</span></div>'
      + '<div class="row" style="gap:6px">'
      + '<span class="chip ' + (short ? 'c-bad' : 'c-ok') + '">본 시간 '
      + Math.floor((g.watched_sec || 0) / 60) + '분'
      + (need ? ' / 최소 ' + Math.round(need / 60) + '분' : '') + '</span>'
      + (g.pasted ? '<span class="chip c-bad">붙여넣기</span>' : '<span class="chip c-ok">직접 씀</span>')
      + '<span class="chip c-off">' + (g.summary || '').length + '자</span></div></div>'
      + (m.check_question
        ? '<div class="note" style="margin-bottom:10px"><b>확인 질문</b> · ' + esc(m.check_question)
        + '<br><b>답</b> · ' + esc(g.answer || '(빈칸)') + '</div>' : '')
      + '<pre class="sumtext">' + esc(g.summary || '') + '</pre>'
      + '<div class="row" style="margin-top:12px">'
      + '<input class="inp" style="flex:1;min-width:180px" data-sumnote="' + key + '" '
      + 'placeholder="한마디 (통과에도 다시쓰기에도 같이 갑니다)">'
      + '<button class="btn btn-a" data-sumok="' + key + '">이수 처리</button>'
      + '<button class="btn" data-sumno="' + key + '">다시 써 달라기</button></div></div>';
  }

  /* ═══ 3 주문 · 입금 ═══ */
  function renderOrders() {
    /* 지금 보고 있는 갈래 주문만 보여줍니다 — 블로그 주문과 리뷰 주문이 섞이면 헷갈립니다 */
    var TK = A.TRACK || 'blog';
    var list = A.ORDERS.filter(function (o) { return (o.track || 'blog') === TK; });
    var RV = (TK === 'review');
    var oh = $('ordHead');
    if (oh) oh.innerHTML = RV
      ? '<h1>주문 · 입금</h1><p>업체가 어떤 리뷰를 몇 편 원하는지, 돈이 들어왔는지를 봅니다.</p>'
      : '<h1>주문 · 입금</h1><p>학원이 몇 편을 언제까지 원하는지, 돈이 들어왔는지를 봅니다.</p>';

    var oi = $('ordIntro');
    if (oi) oi.innerHTML = RV
      ? '<div class="note ok" style="margin-bottom:18px">'
        + '<b>리뷰 주문은 아래에서 직접 만드시면 됩니다.</b> '
        + '업체 이름·편수·마감일만 넣고 만든 뒤, 주문 카드에서 '
        + '<b>네이버 지도 주소</b>와 <b>리뷰 구성</b>(어떤 리뷰를 몇 편, 무엇을 짚을지)을 채워 주세요. '
        + '사진은 업체에서 받아 넣어 주시면 됩니다.</div>'
      : '<div class="note ok" style="margin-bottom:18px">'
        + '<b>주문은 보통 홈페이지에서 저절로 들어옵니다.</b> '
        + '학원이 신청하면 관리자페이지 의뢰 상세에 <b>[🖊 블로그 주문 만들기]</b> 버튼이 생기고, '
        + '그걸 누르면 지역·과목·대상·목적·정보팩·사진까지 여기로 그대로 넘어옵니다. '
        + '<b>손으로 만드실 일은 거의 없습니다.</b></div>';

    var om = $('ordManual');
    if (om) om.innerHTML = RV
      ? '<b>리뷰 주문은 여기서 만듭니다.</b> 업체 이름·편수·마감일을 넣고 만드시면 '
        + '아래 목록에 뜹니다. 만든 뒤 그 카드에서 <b>지도 주소·리뷰 구성·사진</b>을 채워 주세요.'
      : '<b>이럴 때만 쓰세요.</b> 학원이 전화·카톡으로 바로 주문했을 때, '
        + '이미 거래하던 학원이 신청서 없이 재주문할 때, 우리가 먼저 제안해서 성사됐을 때.<br>'
        + '<b>손으로 만들면 글감(지역·과목·대상·목적)과 사진이 비어 있습니다.</b> '
        + '아래 주문 카드에서 직접 채워 넣으셔야 합니다.';
    $('orderList').innerHTML = list.length ? list.map(function (o) {
      var p = prog(o.id);
      return '<div class="card" style="margin-bottom:12px" data-ordercard="' + o.id + '">'
        + '<div class="row" style="justify-content:space-between"><div>'
        + '<h3 style="font-size:16.5px">' + esc(o.academy_name) + ' ' + memBadge(o)
        + (!RV && o.request_id ? ' <span class="chip c-ok">홈페이지 의뢰에서 넘어옴</span>' : '')
        + (RV && o.visit_type === 'material' ? ' <span class="chip">자료형</span>'
           : RV ? ' <span class="chip c-ok">방문형</span>' : '') + '</h3>'
        + '<div class="mono" style="margin-top:3px">' + esc(o.region || '지역 미입력')
        + ' · 편당 ' + won(o.sale_price) + '원 받고 <b>' + won(basePay(o)) + '원</b> 지급'
        + '</div></div>'
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
        /* ⚠️ 리뷰에는 검색어를 안 씁니다. 글감(지역·과목·학년·목적)도 정보팩도 필요 없습니다.
           리뷰가 필요로 하는 것은 아래 rvOrderBox 에 다 들어 있습니다. */
        + (RV ? '' :
          '<div class="sec" style="margin-top:16px">글감 <small>4번 키워드 만들기에 그대로 쓰입니다</small></div>'
          + '<div class="grid g2" style="gap:12px">'
          + fld(o, 'target_regions', '지역 (쉼표로 구분)') + fld(o, 'target_subjects', '과목')
          + fld(o, 'target_grades', '학년 · 대상') + fld(o, 'target_purposes', '목적')
          + '</div>'
          + '<div style="margin-top:12px"><label class="f">정보팩 — 모든 글에 똑같이 들어갑니다</label>'
          + '<textarea class="inp" data-of="info_pack" data-oid="' + o.id + '">' + esc(o.info_pack || '') + '</textarea></div>')
        + (RV ? '' : '<div class="row" style="margin-top:10px">'
        + ((o.photo_paths || []).length
          ? '<span class="chip c-ok">사진 ' + o.photo_paths.length + '장 들어옴</span>'
            + '<button class="btn btn-s" data-seepics="' + o.id + '">🖼 사진 보기</button>'
            + '<span class="mono">글마다 다른 조합으로 5~8장씩 나눠 줍니다</span>'
          : o.photo_note
            ? '<span class="chip c-wait">사진을 링크로 받음</span><a class="mono" href="' + esc(o.photo_note)
              + '" target="_blank" rel="noopener">' + esc(o.photo_note.slice(0, 40)) + ' ↗</a>'
            : '<span class="chip c-bad">사진 없음</span><span class="mono">학원에 요청하세요</span>') + '</div>')
        + (RV ? rvOrderBox(o) : outBox(o))
        + '<div class="sec" style="margin-top:16px">' + (RV ? '업체' : '학원') + '에 보낼 진행현황 주소 '
        + '<small>로그인 없이 열립니다 · 이 ' + (RV ? '업체' : '학원') + ' 것만 보입니다 · '
        + (RV ? '리뷰어' : '블로거') + ' 이름·단가는 안 보입니다</small></div>'
        + '<div class="row">'
        + '<input class="inp" style="flex:1;min-width:240px;font-family:var(--mono);font-size:12px" readonly '
        + 'value="' + esc(statusUrl(o)) + '" onclick="this.select()">'
        + '<button class="btn btn-p btn-s" data-copystatus="' + esc(statusUrl(o)) + '">📋 주소 복사</button>'
        + '<a class="btn btn-s" href="' + esc(statusUrl(o)) + '" target="_blank" rel="noopener">열어보기 ↗</a>'
        + '</div>'
        + '<div class="row" style="margin-top:12px">'
        + (RV ? '' : '<button class="btn btn-p btn-s" data-saveo="' + o.id + '">글감 저장</button>')
        + '<button class="btn btn-s" data-gokw="' + o.id + '">'
        + (RV ? '4 리뷰 만들기 →' : '4 키워드 만들기 →') + '</button>'
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
    }).join('') : A.empty(TK === 'review'
      ? '아직 리뷰 주문이 없습니다. 아래에서 만드시면 됩니다.'
      : '아직 블로그 주문이 없습니다. 위에서 만드시면 됩니다.');
  }
  function kv(k, v) {
    return '<div><label class="f">' + k + '</label><div style="font-size:16px;font-weight:700">' + esc(v) + '</div></div>';
  }

  /* 이 학원이 일반이냐 프리미엄이냐 — 블로거가 받는 돈이 여기서 갈립니다 */
  function memBadge(o) {
    return o && o.is_premium
      ? '<span class="mem pre">프리미엄 회원</span>'
      : '<span class="mem nor">일반 회원 · 지급 ' + A.payMult() + '배</span>';
  }
  /* 1단계 블로거가 이 주문 글 한 편을 쓰면 받는 돈 (등급이 오르면 그만큼 커집니다) */
  function basePay(o) {
    var base = (A.LEVELS[0] && A.LEVELS[0].rate) || 1000;
    return Math.round(base * (o && o.is_premium ? 1 : A.payMult()));
  }

  /* ── 리뷰 주문 ──
     블로그와 크게 다른 점: 리뷰는 **우리가 본문까지 다 써 줍니다.**
     그래서 여기서 받아야 하는 것은 검색어가 아니라
     ①어떤 갈래 리뷰를 몇 편 ②그 갈래에서 짚을 세부 항목 ③네이버 지도 주소 입니다. */
  function rvOrderBox(o) {
    var specs = RVSPECS.filter(function (x) { return x.order_id === o.id; });
    var made = POSTS.filter(function (p) { return p.order_id === o.id; }).length;
    var want = specs.reduce(function (a, x) { return a + (x.qty || 0); }, 0);

    return '<details class="outbox" open>'
      + '<summary>⭐ 리뷰 구성 <span class="mono">— 어떤 리뷰를 몇 편 · 무엇을 짚을지</span></summary>'
      + '<div class="obody">'

      + '<div class="osec" style="margin-top:0">1 · 네이버 지도 주소</div>'
      + '<div class="row">'
      + '<input class="inp" style="flex:1;min-width:220px;font-size:12.5px" data-mapu="' + o.id + '" '
      + 'placeholder="https://naver.me/… 또는 map.naver.com 주소" value="' + esc(o.map_url || '') + '">'
      + '<button class="btn btn-p btn-s" data-savemap="' + o.id + '">저장</button>'
      + (o.map_url ? '<a class="btn btn-s" href="' + esc(o.map_url) + '" target="_blank" rel="noopener">열어보기 ↗</a>' : '')
      + '</div>'
      + '<div class="mono" style="margin-top:6px">'
      + '<b>6번 「올라왔는지 확인」에서 이 주소로 바로 들어갑니다.</b> 꼭 넣어 주세요.</div>'

      + '<div class="osec">2 · 리뷰어가 직접 가나요</div>'
      + '<div class="row">'
      + '<select class="inp" style="width:auto" data-visit="' + o.id + '">'
      + '<option value="visit"' + (o.visit_type !== 'material' ? ' selected' : '') + '>방문형 — 직접 가서 결제하고 씁니다</option>'
      + '<option value="material"' + (o.visit_type === 'material' ? ' selected' : '') + '>자료형 — 업체가 사진·내용을 주고 방문 안 합니다</option>'
      + '</select>'
      + '<button class="btn btn-s" data-savevisit="' + o.id + '">저장</button></div>'
      + '<div class="mono" style="margin-top:6px">'
      + (o.visit_type === 'material'
        ? '업체가 준 사진과 내용으로 씁니다.'
        : '방문·결제 후 영수증으로 인증합니다. 방문비·식대 정산이 따로 필요하면 메모에 적어 두세요.')
      + '</div>'

      + '<div class="osec">3 · 어떤 리뷰를 몇 편 <small>합계 ' + want + '편'
      + (o.total_qty && want !== o.total_qty ? ' · 주문은 ' + o.total_qty + '편' : '') + '</small></div>'
      + '<div data-rvspec="' + o.id + '">' + rvSpecRows(o.id, specs) + '</div>'
      + '<div class="row" style="margin-top:10px">'
      + '<button class="btn btn-s" data-rvadd="' + o.id + '">+ 갈래 한 줄 추가</button>'
      + '<button class="btn btn-a btn-s" data-rvsave="' + o.id + '">리뷰 구성 저장</button>'
      + (want && want !== o.total_qty
        ? '<span class="mono" style="color:var(--bad)">합계(' + want + ')와 주문 편수('
          + o.total_qty + ')가 다릅니다</span>' : '')
      + '</div>'
      + '<div class="note" style="margin-top:12px">'
      + '<b>예)</b> 시설 5편 — 테이블, 화장실, 주방 / 직원 친절 10편 / 음식 30편 — 짜장면, 짬뽕, 탕수육, 짬짜면<br>'
      + '세부 항목은 <b>쉼표로</b> 나눠 적어 주세요. 리뷰 문장을 만들 때 하나씩 돌아가며 들어갑니다.</div>'

      + '<div class="osec">4 · 사진</div>'
      + ((o.photo_paths || []).length
        ? '<div class="row"><span class="chip c-ok">' + o.photo_paths.length + '장</span>'
          + '<button class="btn btn-s" data-seepics="' + o.id + '">🖼 사진 보기 · 꼬리표 · 내려받기</button></div>'
        : '<div class="note warn">사진이 없습니다. 리뷰는 사진이 생명이라 업체에 꼭 받으셔야 합니다.</div>')

      + '<div class="osec">5 · 만들어진 리뷰</div>'
      + (made
        ? '<div class="mono">리뷰 <b>' + made + '편</b>이 만들어져 있습니다. '
          + '<b>4 리뷰 만들기</b>에서 내용을 넣고 <b>5 리뷰 나눠주기</b>에서 배정하세요.</div>'
        : '<div class="mono">아직 리뷰를 안 만들었습니다. 위 구성을 저장한 뒤 '
          + '<b>4 리뷰 만들기</b>로 가세요.</div>')
      + '</div></details>';
  }
  /* 화면에 있는 줄을 그대로 읽어 옵니다 (저장 전 상태를 잃지 않으려고) */
  function rvCollect(oid) {
    var out = [], i = 0;
    while (true) {
      var c = document.querySelector('[data-rvc="' + oid + '_' + i + '"]');
      if (!c) break;
      var q = document.querySelector('[data-rvq="' + oid + '_' + i + '"]');
      var pt = document.querySelector('[data-rvp="' + oid + '_' + i + '"]');
      out.push({
        category: c.value.trim(),
        qty: Number(q ? q.value : 0) || 0,
        points: (pt ? pt.value : '').split(',').map(function (x) { return x.trim(); }).filter(Boolean)
      });
      i++;
    }
    return out;
  }
  function rvSpecRows(oid, specs) {
    if (!specs.length) specs = [{ category: '', qty: 0, points: [] }];
    return specs.map(function (x, i) {
      return '<div class="rvrow">'
        + '<input class="inp" data-rvc="' + oid + '_' + i + '" style="width:130px" '
        + 'placeholder="갈래 (예: 음식)" value="' + esc(x.category || '') + '">'
        + '<input class="inp" data-rvq="' + oid + '_' + i + '" type="number" min="0" style="width:80px" '
        + 'placeholder="편수" value="' + (x.qty || '') + '">'
        + '<input class="inp" data-rvp="' + oid + '_' + i + '" style="flex:1;min-width:180px" '
        + 'placeholder="세부 항목 — 쉼표로 (예: 짜장면, 짬뽕, 탕수육)" '
        + 'value="' + esc((x.points || []).join(', ')) + '">'
        + '<button class="xdel" data-rvdel="' + oid + '_' + i + '" title="지우기">×</button></div>';
    }).join('');
  }

  /* ── 「블로거에게 나가는 정보」 한눈에 보기 ──
     블로거 화면에 실제로 뜨는 것이 넷(소재·정보팩·사진·광고문구)으로 늘어나서,
     만드는 곳은 여기저기여도 확인은 이 주문 카드 한 곳에서 되도록 모았습니다.
     학원이 보낸 원문까지 같이 둔 이유 — 잘라 넣은 소재가 원문을 제대로 담았는지
     여기서 바로 비교할 수 있어야 해서입니다. */
  function outBox(o) {
    var mine = POSTS.filter(function (p) { return p.order_id === o.id; });
    var tps = ALLTOPICS.filter(function (t) { return t.order_id === o.id; });
    var notes = NOTES.filter(function (n) { return n.order_id === o.id; });
    var ads = A.AD_LINES || [];
    var used = {};
    mine.forEach(function (p) { if (p.topic_id) used[p.topic_id] = (used[p.topic_id] || 0) + 1; });
    var got = mine.filter(function (p) { return p.topic_id; }).length;

    var sum = [
      tps.length ? '소재 ' + tps.length + '개' : '소재 없음',
      notes.length ? '학원이 보낸 글 ' + notes.length + '건' : null,
      (o.photo_paths || []).length ? '사진 ' + o.photo_paths.length + '장' : null,
      o.info_pack ? '정보팩 있음' : '정보팩 비어 있음'
    ].filter(Boolean).join(' · ');

    /* 소재 한 조각씩 — 몇 편에 붙었는지까지 보여줍니다 */
    var tlist = tps.length
      ? tps.map(function (t, i) {
        var c = used[t.id] || 0;
        return '<details class="obit' + (c ? '' : ' none') + '">'
          + '<summary><span class="n">' + (i + 1) + '</span><b>' + esc(t.title) + '</b>'
          + (c ? '<span class="chip c-ok">' + c + '편</span>'
               : '<span class="chip c-wait">아직 안 붙음</span>') + '</summary>'
          + '<pre>' + esc(t.body) + '</pre></details>';
      }).join('')
      : '<div class="note warn">아직 소재를 안 잘랐습니다. 학원이 보낸 글을 통째로 주면 '
        + '같은 학원 글끼리 비슷해져 <b>유사문서로 통째로 검색에서 빠집니다.</b> '
        + '<b>[4 키워드 만들기]</b> 아래 「학원이 보낸 글감 나누기」에서 잘라 주세요.</div>';

    var tinfo = !tps.length ? ''
      : mine.length
        ? '<div class="mono" style="margin-top:8px">이 주문 글 ' + mine.length + '편 중 <b>'
          + got + '편</b>에 소재가 붙어 있습니다'
          + (got < mine.length ? ' — 4번 화면에서 <b>[글에 나눠 배정하기]</b>를 눌러 주세요' : '')
          + '</div>'
        : '<div class="mono" style="margin-top:8px">아직 글이 없습니다. '
          + '키워드로 글을 먼저 만든 다음 <b>[글에 나눠 배정하기]</b>를 누르시면 붙습니다</div>';

    return '<details class="outbox">'
      + '<summary>📦 블로거에게 나가는 정보 한눈에 보기'
      + '<span class="mono">— ' + esc(sum) + '</span></summary>'
      + '<div class="obody">'
      + '<div class="note">블로거 한 사람이 글쓰기 화면에서 보는 것은 <b>자기 글 몫 하나뿐</b>입니다. '
      + '소재는 글마다 하나씩 돌아가고, 광고 문구도 글마다 다른 것이 뜹니다. '
      + '정보팩과 사진은 모든 글에 같이 들어갑니다.</div>'

      + '<div class="osec">1 · 학원이 보낸 원문 <small>이걸 잘라서 아래 소재를 만듭니다</small></div>'
      + (notes.length
        ? notes.map(function (n) {
          return '<details class="obit"><summary><b>' + (n.created_at || '').slice(0, 10)
            + ' 에 보낸 글</b><span class="mono">' + (n.body || '').length + '자</span></summary>'
            + '<pre>' + esc(n.body) + '</pre></details>';
        }).join('')
        : '<div class="mono">학원이 진행현황 페이지에서 보낸 글이 아직 없습니다.</div>')

      + '<div class="osec">2 · 소재 <small>글마다 하나씩 돌아갑니다</small></div>'
      + tlist + tinfo
      + '<div class="row" style="margin-top:10px">'
      + '<button class="btn btn-s" data-gokw="' + o.id + '">소재 고치러 가기 (4번) →</button></div>'

      + '<div class="osec">3 · 정보팩 <small>모든 글에 똑같이 들어갑니다 · 위에서 고칩니다</small></div>'
      + (o.info_pack
        ? '<pre class="tpnote" style="margin-top:0">' + esc(o.info_pack) + '</pre>'
        : '<div class="note warn">정보팩이 비어 있습니다. 주소·전화번호가 글에 안 들어갑니다.</div>')

      + '<div class="osec">4 · 사진 <small>글마다 다른 조합으로 5~8장씩</small></div>'
      + ((o.photo_paths || []).length
        ? (function () {
          var tg = o.photo_tags || {}, n = Object.keys(tg).length;
          var sign = Object.keys(tg).filter(function (k) { return tg[k].t === '간판·외부'; }).length;
          return '<div class="row"><span class="chip c-ok">' + o.photo_paths.length + '장</span>'
            + (n ? '<span class="chip c-info">꼬리표 ' + n + '장</span>'
                 : '<span class="chip c-bad">꼬리표 없음</span>')
            + '<button class="btn btn-s" data-seepics="' + o.id + '">🖼 사진 보기 · 꼬리표 · 내려받기</button></div>'
            + (n
              ? '<div class="mono" style="margin-top:7px">'
                + (sign ? '간판·외부 ' + sign + '장이 글마다 맨 앞에 한 장씩 들어갑니다. '
                        : '⚠️ 간판·외부로 표시한 사진이 없습니다. ')
                + '나머지는 그 글 소재의 과목에 맞춰 골라 나갑니다.</div>'
              : '<div class="note warn" style="margin-top:9px">'
                + '<b>꼬리표가 없으면 사진이 내용과 상관없이 순서대로 나눠집니다.</b> '
                + '영어 이야기를 쓰는 글에 수학 사진이 가고, 간판 사진이 한 장도 없는 글이 생깁니다. '
                + '<b>[🖼 사진 보기]</b> → <b>[🏷 꼬리표 달기]</b> 에서 달아 주세요.</div>');
        })()
        : '<div class="mono">받은 사진이 없습니다.</div>')

      + '<div class="osec">5 · 광고 표시 문구 <small>법으로 정해진 표시 · 글마다 다른 문장이 뜹니다</small></div>'
      + (ads.length
        ? '<div class="adlist">' + ads.map(function (l) {
            return '<div>' + esc(l) + '</div>';
          }).join('') + '</div>'
          + '<div class="mono" style="margin-top:7px">' + ads.length + '개를 글 단위로 섞어 나눠 줍니다. '
          + '한 블로그의 글이 전부 같은 문구를 달면 그 블로그가 광고 채널로 분류될 수 있어 흩뜨립니다. '
          + '고치시려면 <b>4 키워드 만들기</b> 맨 아래 <b>⚙️ 글에 같이 나가는 규칙</b>에서요.</div>'
        : '<div class="note warn">광고 표시 문구가 하나도 없습니다. 대가성 광고 표기는 '
          + '표시광고법상 의무입니다.</div>')

      /* 학원이 뒤늦게 보낸 것을 이미 쓰고 있는 사람에게 알리는 곳 */
      + '<div class="osec">6 · 바뀐 내용 알리기 <small>이미 글을 맡고 있는 분들에게</small></div>'
      + '<div class="note">위의 정보팩·소재·사진을 고치면 <b>블로거 화면에는 이미 바뀐 것이 보입니다.</b> '
      + '따로 다시 보낼 필요가 없습니다. 다만 <b>바뀐 줄 모르고 예전 내용으로 쓰고 있을 수</b> 있어, '
      + '아래로 한 번 알려 주세요. 아직 안 올린 글을 맡은 분들에게만 갑니다.</div>'
      + '<textarea class="inp" data-chgwhat="' + o.id + '" style="min-height:70px"'
      + ' placeholder="예) 학원에서 수학 담당 원장님 성함과 3.14 학원 MOU 내용을 새로 보내주셨습니다. '
      + '소재 6번을 확인해 주세요."></textarea>'
      + '<div class="row" style="margin-top:9px">'
      + '<button class="btn btn-a btn-s" data-chgnoti="' + o.id + '">바뀐 내용 알리기</button>'
      + '<span class="mono">알림만 만듭니다 — 카톡으로 보내시려면 🔔 알림 보내기에서 복사하세요</span></div>'
      + '</div></details>';
  }

  /* 학원이 보낸 사진을 크게 봅니다.
     한 장에 1~5MB라 한꺼번에 받으면 멈춥니다 — 12장씩 끊어서 보여줍니다 */
  var PICS = [], PSHOWN = 0, PICORDER = null, PICTAGS = {}, PICTAG_ON = false;

  /* 사진 꼬리표 — 무엇을 찍었나 / 어느 과목인가.
     이걸 달아 두면 블로거에게 글 내용에 맞는 사진이 갑니다 (blogger.js myPhotos) */
  var PT_KIND = ['간판·외부', '강의실', '수업 장면', '교재·자료', '판서·화이트보드',
                 '상담실·로비', '학생 결과물', '기타'];
  var PT_SUBJ = ['공통', '영어', '수학', '국어', '학습코칭'];

  /* ⭐ 리뷰는 크게 둘로만 나눕니다 — 나누는 규칙이 블로그와 다르기 때문입니다.
     **영수증은 한 사람당 한 장**(같은 가게에서는 늘 같은 것),
     **실제 사진은 리뷰마다 안 겹치게** 돌아갑니다 (blogger.js rvPhotos).
     리뷰에는 과목이 없으므로 과목 칸은 숨깁니다. */
  var PT_KIND_RV = ['영수증', '실제 사진'];
  var PICRV = false;

  async function showPics(o) {
    var paths = o.photo_paths || [];
    if (!paths.length) { A.toast('받은 사진이 없습니다'); return; }
    var r = await A.sb.storage.from('request-photos').createSignedUrls(paths, 3600);
    if (r.error) throw new Error(r.error.message);
    PICS = (r.data || []).map(function (x, i) {
      return { url: x.signedUrl, path: paths[i] };
    }).filter(function (x) { return x.url; });
    PICORDER = o;
    PICRV = (o.track || 'blog') === 'review';
    PICTAGS = Object.assign({}, o.photo_tags || {});
    PSHOWN = 0;
    $('picTitle').textContent = o.academy_name + ' — '
      + (PICRV ? '업체' : '학원') + '가 보낸 사진 ' + PICS.length + '장';
    $('picBody').innerHTML = '';
    morePics();
    paintTagBar();
    $('picModal').classList.add('on');
  }
  function morePics() {
    var next = PICS.slice(PSHOWN, PSHOWN + 12);
    $('picBody').insertAdjacentHTML('beforeend', next.map(function (x, i) {
      var n = PSHOWN + i + 1;
      return '<div class="piccell" data-pcell="' + esc(x.path) + '">'
        + '<a href="' + esc(x.url) + '" target="_blank" rel="noopener" class="picitem">'
        + '<img src="' + esc(x.url) + '" alt="사진 ' + n + '" style="' + rotStyle(x.path) + '">'
        + '<span>' + n + '</span></a>'
        + tagRow(x.path) + '</div>';
    }).join(''));
    PSHOWN += next.length;
    var m = $('picMore');
    m.innerHTML = PSHOWN < PICS.length
      ? '<button class="btn" id="picMoreBtn">더 보기 (남은 ' + (PICS.length - PSHOWN) + '장)</button>'
      : '<span class="mono">' + PICS.length + '장을 모두 보셨습니다</span>';
    if ($('picMoreBtn')) $('picMoreBtn').onclick = morePics;
    applyTagMode();
  }
  /* 화면에서 미리 돌려 보여줍니다. 실제 파일은 내려받을 때 돌아갑니다 (core.js rotateBlob) */
  function rotStyle(path) {
    var r = (PICTAGS[path] || {}).r || 0;
    return r ? 'transform:rotate(' + r + 'deg)' : '';
  }
  function tagRow(path) {
    var t = PICTAGS[path] || {};
    var kinds = PICRV ? PT_KIND_RV : PT_KIND;
    return '<div class="pictag">'
      + '<select data-ptk="' + esc(path) + '"><option value="">종류…</option>'
      + kinds.map(function (k) {
        return '<option value="' + esc(k) + '"' + (t.t === k ? ' selected' : '') + '>' + esc(k) + '</option>';
      }).join('') + '</select>'
      + (PICRV ? '' : '<select data-pts="' + esc(path) + '"><option value="">과목…</option>'
      + PT_SUBJ.map(function (s) {
        return '<option value="' + esc(s) + '"' + (t.s === s ? ' selected' : '') + '>' + esc(s) + '</option>';
      }).join('') + '</select>') + '</div>'
      + '<div class="pictag">'
      + '<button class="btn btn-s" data-ptrot="' + esc(path) + '" title="90도씩 돌립니다">↻ '
      + (t.r ? t.r + '°' : '돌리기') + '</button>'
      + '<label class="pcx' + (t.x ? ' on' : '') + '">'
      + '<input type="checkbox" data-ptx="' + esc(path) + '"' + (t.x ? ' checked' : '') + '>'
      + '쓰지 않음</label></div>';
  }
  function applyTagMode() {
    document.querySelectorAll('.pictag').forEach(function (el) {
      el.classList.toggle('hide', !PICTAG_ON);
    });
  }
  function paintTagBar() {
    var bar = $('picTagBar'); if (!bar) return;
    bar.classList.toggle('hide', !PICTAG_ON);
    if (!PICTAG_ON) return;
    var done = PICS.filter(function (x) { return (PICTAGS[x.path] || {}).t; }).length;
    var out = PICS.filter(function (x) { return (PICTAGS[x.path] || {}).x; }).length;
    var rot = PICS.filter(function (x) { return (PICTAGS[x.path] || {}).r; }).length;
    var tail = (out ? ' <b>' + out + '장은 빼 뒀습니다</b>(안 나갑니다).' : '')
      + (rot ? ' <b>' + rot + '장은 돌려 뒀습니다</b> — 받을 때 바로 선 파일로 나갑니다.' : '');

    if (PICRV) {
      /* 리뷰 — 영수증이 리뷰어 수보다 모자라면 같은 영수증이 여러 사람에게 갑니다.
         그러면 지도에서 나란히 보였을 때 바로 티가 나므로 미리 알려 드립니다. */
      var rec = PICS.filter(function (x) { return (PICTAGS[x.path] || {}).t === '영수증'; }).length;
      var real = PICS.filter(function (x) {
        var t = PICTAGS[x.path] || {}; return t.t === '실제 사진' && !t.x;
      }).length;
      var people = {};
      POSTS.forEach(function (q) {
        if (q.order_id === PICORDER.id && q.blogger_id) people[q.blogger_id] = 1;
      });
      var nP = Object.keys(people).length;
      var shortRec = rec && nP && rec < nP;
      bar.innerHTML = '<div class="note' + (rec && !shortRec ? '' : ' warn') + '">'
        + '<b>' + done + ' / ' + PICS.length + '장</b>에 꼬리표를 다셨습니다. '
        + '<b>영수증 ' + rec + '장 · 실제 사진 ' + real + '장</b>'
        + (rec ? ' — 영수증은 <b>한 사람당 한 장</b>씩 갑니다.'
               : ' — <b>영수증이 아직 없습니다.</b> 영수증 리뷰를 쓰시려면 필요합니다.')
        + (shortRec ? '<br><b style="color:var(--bad)">지금 이 업체를 맡은 리뷰어가 ' + nP + '명인데 '
            + '영수증은 ' + rec + '장뿐입니다.</b> 같은 영수증이 여러 분께 가니 '
            + (nP - rec) + '장을 더 받으시는 편이 좋습니다.' : '')
        + (real ? '<br>실제 사진은 <b>리뷰마다 안 겹치게</b> 3장씩 돌아갑니다.'
                + (real < 3 ? ' <b style="color:var(--bad)">3장이 안 되어 리뷰끼리 사진이 겹칩니다.</b>' : '')
          : '')
        + tail
        + '<div class="row" style="margin-top:10px">'
        + '<button class="btn btn-p btn-s" id="picTagSave">꼬리표 저장</button>'
        + '<span class="mono">영수증인지 아닌지만 골라 주시면 됩니다</span></div></div>';
    } else {
      var sign = PICS.filter(function (x) { return (PICTAGS[x.path] || {}).t === '간판·외부'; }).length;
      bar.innerHTML = '<div class="note' + (sign ? '' : ' warn') + '">'
        + '<b>' + done + ' / ' + PICS.length + '장</b>에 꼬리표를 다셨습니다. '
        + (sign ? '간판·외부 사진 ' + sign + '장 — 글마다 맨 앞에 한 장씩 들어갑니다.'
                : '<b>간판·외부 사진이 아직 없습니다.</b> 글의 첫 사진은 간판이 좋습니다.')
        + tail
        + '<div class="row" style="margin-top:10px">'
        + '<button class="btn btn-p btn-s" id="picTagSave">꼬리표 저장</button>'
        + '<span class="mono">종류만 달아도 됩니다. 과목을 비우면 「공통」으로 봅니다</span></div></div>';
    }
    $('picTagSave').onclick = async function () {
      this.disabled = true;
      try {
        var n = await A.rpc('order_set_photo_tags', { p_order: PICORDER.id, p_tags: PICTAGS });
        PICORDER.photo_tags = Object.assign({}, PICTAGS);
        A.toast('사진 ' + n + '장에 꼬리표를 저장했습니다');
        renderOrders();
        if (RV_ORDER && RV_ORDER === PICORDER.id) openAcad(RV_ORDER);   /* 검수 화면도 새로 그립니다 */
      } catch (e) { A.toast('실패: ' + e.message); }
      this.disabled = false;
    };
  }

  /* 사진 전부를 ZIP 하나로 (꼬리표 달 때 눈으로 보려면 받아 놓는 편이 빠릅니다).
     묶는 일 자체는 core.js A.zipDownload 가 합니다 — 블로거 화면에서도 같은 것을 씁니다. */
  async function downloadAllPics() {
    if (!PICS.length) { A.toast('받을 사진이 없습니다'); return; }
    var btn = $('picZip'); btn.disabled = true;
    var nm = (PICORDER && PICORDER.academy_name) || '사진';
    var items = PICS.map(function (x, i) {
      var tag = PICTAGS[x.path] || {};
      /* 꼬리표를 달아 두셨으면 파일 이름에 넣어 드립니다 — 폴더에서 바로 구분됩니다 */
      var pre = ('00' + (i + 1)).slice(-3)
        + (tag.x ? '_쓰지않음' : '')
        + (tag.t ? '_' + tag.t : '') + (tag.s && tag.s !== '공통' ? '_' + tag.s : '');
      return { url: x.url, rotate: tag.r || 0,
               name: nm + '/' + pre + '_' + x.path.split('/').pop() };
    });
    try {
      var n = await A.zipDownload(items, nm + ' 사진 ' + items.length + '장.zip', function (i, t) {
        btn.textContent = '받는 중… ' + i + '/' + t;
      });
      A.toast(n + '장을 ZIP 으로 받았습니다');
    } catch (e) { A.toast('실패: ' + e.message); }
    btn.textContent = '⬇ 전부 받기 (ZIP)'; btn.disabled = false;
  }
  if ($('picZip')) $('picZip').onclick = downloadAllPics;
  if ($('picTagMode')) $('picTagMode').onclick = function () {
    PICTAG_ON = !PICTAG_ON;
    this.classList.toggle('btn-a', PICTAG_ON);
    applyTagMode(); paintTagBar();
  };
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset && (t.dataset.ptk || t.dataset.pts || t.dataset.ptx)) {
      var path = t.dataset.ptk || t.dataset.pts || t.dataset.ptx;
      var cur = PICTAGS[path] || {};
      if (t.dataset.ptk) cur.t = t.value || undefined;
      else if (t.dataset.pts) cur.s = t.value || undefined;
      else {
        cur.x = t.checked ? true : undefined;
        var lb = t.closest('label'); if (lb) lb.classList.toggle('on', t.checked);
      }
      if (!cur.t && !cur.s && !cur.r && !cur.x) delete PICTAGS[path]; else PICTAGS[path] = cur;
      paintTagBar();
    }
  });
  /* ↻ 누를 때마다 90도씩. 저장을 눌러야 실제로 반영됩니다 */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ptrot]'); if (!b) return;
    e.preventDefault();
    var path = b.dataset.ptrot, cur = PICTAGS[path] || {};
    cur.r = (((cur.r || 0) + 90) % 360) || undefined;
    if (!cur.t && !cur.s && !cur.r && !cur.x) delete PICTAGS[path]; else PICTAGS[path] = cur;
    b.textContent = '↻ ' + (cur.r ? cur.r + '°' : '돌리기');
    var cell = document.querySelector('[data-pcell="' + path.replace(/"/g, '\\"') + '"] img');
    if (cell) cell.style.transform = cur.r ? 'rotate(' + cur.r + 'deg)' : '';
    paintTagBar();
  });
  function fld(o, f, label) {
    return '<div><label class="f">' + label + '</label><input class="inp" data-of="' + f
      + '" data-oid="' + o.id + '" value="' + esc((o[f] || []).join(', ')) + '"></div>';
  }

  /* ═══ 4 키워드 ═══ */
  function splitv(id) {
    return ($(id).value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  }
  /* 이 주문에 키워드를 이미 만들었는지 — 만든 편수·맡긴 편수·올린 편수 */
  function kwMade(oid) {
    var mine = POSTS.filter(function (p) { return p.order_id === oid; });
    return {
      made: mine.length,
      idle: mine.filter(function (p) { return p.status === 'pending' && !p.blogger_id; }).length,
      given: mine.filter(function (p) { return p.blogger_id; }).length,
      up: mine.filter(function (p) {
        return ['published', 'verified', 'paid'].indexOf(p.status) >= 0;
      }).length
    };
  }

  /* 「이미 만들었습니다」를 주문을 고르는 순간 크게 알려줍니다.
     여기서 안 보여주면 또 만들고, 5번에서 「맡길 글 있음」으로 뜨니까
     그대로 또 나눠주게 됩니다. */
  function kwMadeBox() {
    var box = $('kwMade'); if (!box) return;
    var o = A.ORDERS.filter(function (x) { return x.id === $('kwOrder').value; })[0];
    if (!o) { box.innerHTML = ''; return; }
    var s = kwMade(o.id);
    if (!s.made) {
      box.innerHTML = '<div class="msg ok" style="margin:0 0 12px">'
        + '<b>이 학원은 아직 키워드를 안 만들었습니다.</b> 처음 만드시는 것이 맞습니다.</div>';
      return;
    }
    var done = s.up >= s.made && s.made > 0;
    box.innerHTML = '<div class="msg ' + (done ? 'err' : 'warn') + '" style="margin:0 0 12px">'
      + '<b>⚠️ 이 학원은 이미 키워드를 ' + s.made + '편 만들었습니다.</b> '
      + '(주문 ' + o.total_qty + '편 · 맡긴 글 ' + s.given + '편 · 올라간 글 ' + s.up + '편'
      + (s.idle ? ' · <b>아직 안 맡긴 글 ' + s.idle + '편</b>' : '') + ')<br>'
      + (done
        ? '<b>이 주문은 이미 다 썼습니다.</b> 여기서 또 만들면 학원이 시킨 것보다 많이 쓰게 됩니다. '
        + '정말 더 만드시는 것이 맞습니까?'
        : s.idle
          ? '<b>먼저 「5 글 나눠주기」에서 남은 ' + s.idle + '편을 맡기세요.</b> '
          + '여기서 또 만들면 같은 학원 글이 두 배로 늘어납니다.'
          : '더 만들면 주문 편수를 넘길 수 있습니다. 정말 더 만드시는 것이 맞습니까?')
      + ' <button class="link" data-goassign="' + o.id + '">5번으로 가기 →</button></div>';
  }

  /* 입금 전이면 글을 만들 수 없습니다 — 다 만들고 나서 알면 늦으니 미리 알려줍니다 */
  function kwPaidCheck() {
    var o = A.ORDERS.filter(function (x) { return x.id === $('kwOrder').value; })[0];
    var box = $('kwPaid'); if (!box) return true;
    if (!o) { box.innerHTML = ''; return true; }
    if (o.paid_at) {
      box.innerHTML = '<div class="msg ok" style="margin:0 0 12px">입금 확인됨 ('
        + esc(o.paid_at) + ') · 글을 만드실 수 있습니다</div>';
      return true;
    }
    box.innerHTML = '<div class="msg err" style="margin:0 0 12px">'
      + '<b>아직 입금 확인이 안 된 주문입니다.</b> 키워드는 만들 수 있지만 '
      + '<b>글은 만들어지지 않습니다.</b><br>'
      + '「3 주문 · 입금」에서 <b>' + esc(o.academy_name) + '</b> 카드의 [입금 확인]을 먼저 눌러 주세요.'
      + ' <button class="link" data-gopay="' + o.id + '">3번으로 가기 →</button></div>';
    return false;
  }

  $('kwOrder').onchange = function () {
    var o = A.ORDERS.filter(function (x) { return x.id === this.value; }.bind(this))[0];
    if (!o) return;
    $('k1').value = (o.target_regions || []).join(', ');
    $('k2').value = (o.target_subjects || []).join(', ');
    $('k3').value = (o.target_grades || []).join(', ');
    $('k4').value = (o.target_purposes || []).join(', ');
    $('kwN').value = o.total_qty;
    kwPaidCheck();
    kwMadeBox();
  };
  /* ── 말이 안 되는 조합 걸러내기 ──
     네 축을 그냥 곱하면 "영어내신 수학학원", "송림고 예비중" 같은 게 나옵니다.
     학부모가 그렇게 검색하지 않으니 글을 써도 헛일입니다. */
  /* 학교급을 1~5로 봅니다 — 1 초등 · 2 예비중 · 3 중등 · 4 예비고 · 5 고등/수능.
     긴 말부터 찾아야 '예비중'이 '중등'보다 먼저 잡힙니다. */
  var LV_WORDS = [
    ['예비고', 4], ['예비중', 2], ['초등', 1], ['중등', 3], ['고등', 5],
    ['수능', 5], ['재수', 5], ['정시', 5], ['모의고사', 5],
    ['초1', 1], ['초2', 1], ['초3', 1], ['초4', 1], ['초5', 1], ['초6', 1],
    ['중1', 3], ['중2', 3], ['중3', 3], ['고1', 5], ['고2', 5], ['고3', 5]
  ];
  function lvOf(text) {
    var t = String(text || ''), lv = 0;
    for (var i = 0; i < LV_WORDS.length; i++) {
      if (t.indexOf(LV_WORDS[i][0]) >= 0) { lv = LV_WORDS[i][1]; break; }
    }
    return lv;
  }
  /* 지역 자리에 학교 이름이 들어오면(영일초·매원중·태장고) 그 학교급을 봅니다 */
  function schoolLv(region) {
    var t = String(region || '').trim();
    if (t.length < 2) return 0;
    var last = t.slice(-1);
    if (last === '초') return 1;
    if (last === '중') return 3;
    if (last === '고') return 5;
    if (/초등학교$/.test(t)) return 1;
    if (/중학교$/.test(t)) return 3;
    if (/고등학교$/.test(t)) return 5;
    return 0;
  }
  /* 두 학교급이 같이 쓰일 수 있나 — 한 칸 차이(예비중↔중등)까지는 봐줍니다 */
  function lvClash(a, b) {
    if (!a || !b) return false;
    return Math.abs(a - b) >= 2;
  }

  function badCombo(region, grade, subject, purpose) {
    var whole = [region, grade, subject, purpose];

    /* ① 같은 말이 두 번 (중등수학내신 + 내신 / 전과목학습코칭 + 학습코칭) */
    for (var i = 0; i < whole.length; i++) {
      for (var j = i + 1; j < whole.length; j++) {
        var x = whole[i], y = whole[j];
        if (!x || !y) continue;
        if (x === y) return '같은 말이 두 번';
        if (x.length >= 2 && y.length >= 2 && (x.indexOf(y) >= 0 || y.indexOf(x) >= 0))
          return '같은 말이 겹침';
      }
    }

    /* ①-2 서로를 품지는 않지만 같은 낱말이 두 번 나오는 것
           (「수능영어」 + 「수능 대비」 → 제목에 수능이 두 번) */
    var DUP = ['수능', '내신', '정시', '재수', '레벨테스트'];
    for (var k = 0; k < DUP.length; k++) {
      var hit = whole.filter(function (t) { return String(t || '').indexOf(DUP[k]) >= 0; });
      if (hit.length >= 2) return '「' + DUP[k] + '」이 두 번';
    }

    var sLv = lvOf(subject), gLv = lvOf(grade), pLv = lvOf(purpose), rLv = schoolLv(region);

    /* ② 과목이 품은 학년 vs 고른 학년 (중등국어논술 + 고등 / 수능영어 + 초등) */
    if (lvClash(sLv, gLv)) return '과목과 학년이 안 맞음';

    /* ③ 학교 이름 vs 학년 (송림고 + 예비중 / 이매초 + 고등) */
    if (lvClash(rLv, gLv)) return '학교와 학년이 안 맞음';

    /* ④ 학교 이름 vs 과목 — 「영일초 수능영어」가 여기서 걸립니다.
          예전에는 이 대조가 아예 없어서 그대로 통과했습니다. */
    if (lvClash(rLv, sLv)) return '학교와 과목이 안 맞음';

    /* ⑤ 목적이 품은 학년 vs 나머지 (초등 대상인데 '수능 대비') */
    if (lvClash(pLv, gLv) || lvClash(pLv, sLv) || lvClash(pLv, rLv))
      return '목적과 학년이 안 맞음';

    /* ⑥ 과목과 '○○학원' 목적이 서로 다른 과목 (영어내신 + 수학학원) */
    var FIELDS = ['영어', '수학', '국어', '논술', '과학', '사회', '한국사', '코딩',
      '중국어', '일본어', '미술', '음악', '체육'];
    function fieldsIn(t) {
      return FIELDS.filter(function (f) { return String(t || '').indexOf(f) >= 0; });
    }
    var pF = fieldsIn(purpose), sF = fieldsIn(subject);
    if (pF.length && sF.length && !pF.some(function (f) { return sF.indexOf(f) >= 0; }))
      return '과목과 다른 과목 학원';

    /* ⑦ 지역 자리에 학교가 왔는데 목적이 다른 과목 학원인 경우는 그냥 둡니다
          (「영일초 영어학원」은 학부모가 실제로 이렇게 검색합니다) */
    return null;
  }
  A.badCombo = badCombo;   /* 화면에서 골라낸 것만 저장할 때도 씁니다 */

  $('kwGo').onclick = function () {
    var a = splitv('k1'), b = splitv('k2'), c = splitv('k3'), d = splitv('k4');
    if (!a.length || !b.length) { A.toast('지역과 과목은 채워 주세요'); return; }
    var filterOn = $('kwFilter').checked;
    var all = [], dropped = 0;
    a.forEach(function (x) {
      b.forEach(function (y) {
        c.forEach(function (z) {
          d.forEach(function (w) {
            if (filterOn && badCombo(x, z, y, w)) { dropped++; return; }
            all.push({ kw: x + ' ' + z + ' ' + y + ' ' + w, brief: z + ' · ' + w });
          });
        });
      });
    });
    if (!all.length) {
      $('kwInfo').textContent = '쓸 만한 조합이 하나도 없습니다. 걸러내기를 끄고 다시 해보세요.';
      A.toast('쓸 만한 조합이 없습니다'); return;
    }
    var want = Math.max(1, Number($('kwN').value) || 100);
    var weeks = Math.max(1, Number($('kwW').value) || 4);
    var picked = [];
    if (want >= all.length) picked = all.slice();
    else { var step = all.length / want; for (var i = 0; i < want; i++) picked.push(all[Math.floor(i * step)]); }

    var per = Math.ceil(picked.length / weeks);
    KWDRAFT = picked.map(function (p, i) {
      return { keyword: p.kw, brief: p.brief, week: Math.floor(i / per) + 1 };
    });
    $('kwInfo').innerHTML = '쓸 만한 조합 ' + all.length + '개 중 <b>' + picked.length
      + '개</b>를 뽑아 ' + weeks + '주로 나눴습니다 (주당 약 ' + per + '편)'
      + (dropped ? ' · <b style="color:var(--bad)">말이 안 되는 조합 ' + dropped + '개는 뺐습니다</b>' : '');
    $('kwOut').className = 'tblbox tblscroll';
    $('kwOut').innerHTML = '<table><thead><tr>'
      + '<th style="width:34px"><input type="checkbox" id="kwAll" checked></th>'
      + '<th>#</th><th>주차</th>'
      + '<th>이 글이 노릴 검색어 — 제목에 그대로 들어갑니다</th><th>다룰 내용</th></tr></thead><tbody>'
      + KWDRAFT.map(function (p, i) {
        return '<tr><td><input type="checkbox" class="kw-pick" value="' + i + '" checked></td>'
          + '<td class="mono">' + (i + 1) + '</td><td class="mono">' + p.week + '주차</td>'
          + '<td><b>' + esc(p.keyword) + '</b></td><td class="mono">' + esc(p.brief) + '</td></tr>';
      }).join('') + '</tbody></table>';
    $('kwAll').onclick = function () {
      var on = this.checked;
      document.querySelectorAll('.kw-pick').forEach(function (c) { c.checked = on; });
    };
    $('kwSave').disabled = false;
    A.toast(picked.length + '개를 만들었습니다'
      + (dropped ? ' (이상한 것 ' + dropped + '개 제외)' : ''));
  };
  $('kwSave').onclick = async function () {
    var oid = $('kwOrder').value;
    if (!oid || !KWDRAFT.length) { A.toast('주문과 키워드를 확인해 주세요'); return; }
    /* 체크를 푼 것은 빼고 만듭니다 */
    var keep = [];
    document.querySelectorAll('.kw-pick').forEach(function (c) {
      if (c.checked) keep.push(KWDRAFT[Number(c.value)]);
    });
    if (!keep.length) { A.toast('만들 검색어를 하나 이상 체크해 주세요'); return; }
    KWDRAFT = keep;
    if (!kwPaidCheck()) {
      A.toast('입금 확인을 먼저 해주세요 — 위 안내를 봐주세요');
      $('kwPaid').scrollIntoView({ block: 'center' });
      return;
    }

    /* 이미 만들어 둔 글이 있으면 — 지우고 새로 할지, 뒤에 더할지 물어봅니다 */
    var exist = POSTS.filter(function (p) {
      return p.order_id === oid && p.status === 'pending' && !p.blogger_id;
    });
    var already = POSTS.filter(function (p) { return p.order_id === oid; }).length;
    var replace = false;
    if (already) {
      var ord = A.ORDERS.filter(function (x) { return x.id === oid; })[0] || {};
      var nm = ord.academy_name || '';
      var st = kwMade(oid);
      if (st.up >= st.made && st.made > 0
        && !confirm('⚠️ 「' + nm + '」은 이미 ' + st.made + '편을 다 써서 올렸습니다.\n\n'
          + '여기서 또 만들면 학원이 주문한 ' + (ord.total_qty || '?') + '편보다 많이 쓰게 됩니다.\n'
          + '정말 더 만드시겠습니까?')) { A.toast('취소했습니다'); return; }
      var ans = window.prompt(
        '「' + nm + '」에는 이미 글이 ' + already + '편 있습니다'
        + (exist.length ? ' (그중 아직 안 맡긴 글 ' + exist.length + '편)' : '') + '.\n\n'
        + '  1 = 뒤에 ' + KWDRAFT.length + '편을 더 만들기\n'
        + (exist.length
          ? '  2 = 아직 안 맡긴 ' + exist.length + '편을 지우고 새로 만들기\n'
          : '')
        + '\n번호를 넣어 주세요 (취소하려면 그냥 닫기)', '1');
      if (ans === null) return;
      ans = String(ans).trim();
      if (ans === '2' && exist.length) replace = true;
      else if (ans !== '1') { A.toast('취소했습니다'); return; }
    }

    this.disabled = true;
    try {
      if (replace) {
        var del = await A.rpc('posts_clear_pending', { p_order: oid });
        A.toast('안 맡긴 글 ' + del + '편을 지웠습니다');
      }
      var n = await A.rpc('posts_generate', { p_order: oid, p_items: KWDRAFT });
      A.toast(n + '편을 만들었습니다');
      await A.loadAdmin(); A.show('assign');
    } catch (e) {
      A.toast('실패: ' + e.message);
      A.msg && kwPaidCheck();
    }
    this.disabled = false;
  };

  /* ── 학원이 보낸 글감을 「소재」로 잘라 글마다 나눠줍니다 ──
     통째로 뿌리면 같은 학원 글끼리 비슷해져 유사문서로 걸립니다. */
  var TOPICS = [];
  function tpFill() {
    var el = $('tpOrder'); if (!el) return;
    var k = el.value;
    el.innerHTML = A.ORDERS.map(function (o) {
      return '<option value="' + o.id + '">' + esc(o.academy_name) + '</option>';
    }).join('') || '<option value="">주문이 없습니다</option>';
    if (k) el.value = k;
  }
  async function tpLoad() {
    var oid = $('tpOrder').value; if (!oid) return;
    TOPICS = await A.sel('blog_topics', { eq: { order_id: oid }, order: 'sort' });
    if (!TOPICS.length) TOPICS = [{ title: '', body: '' }];
    tpRender();
    var mine = POSTS.filter(function (p) { return p.order_id === oid; });
    var got = mine.filter(function (p) { return p.topic_id; }).length;
    $('tpInfo').innerHTML = mine.length
      ? '이 주문 글 ' + mine.length + '편 중 <b>' + got + '편</b>에 소재가 붙어 있습니다'
      : '아직 글이 없습니다. 위에서 글을 먼저 만드세요';
  }
  function tpRender() {
    $('tpList').innerHTML = TOPICS.map(function (t, i) {
      return '<div class="tprow"><div class="row" style="margin-bottom:6px">'
        + '<span class="tpn">' + (i + 1) + '</span>'
        + '<input class="inp" data-tpt="' + i + '" placeholder="소재 제목 — 예) [영어] 수행평가 감점 케어" '
        + 'value="' + esc(t.title || '') + '" style="flex:1">'
        /* 과목을 정해 두면 그 과목 사진이 이 소재를 맡은 글에 갑니다 */
        + '<select class="inp" data-tpsub="' + i + '" style="width:auto" title="이 소재의 과목 — 사진을 맞춰 줍니다">'
        + ['', '공통', '영어', '수학', '국어', '학습코칭'].map(function (s) {
          return '<option value="' + s + '"' + ((t.subject || '') === s ? ' selected' : '') + '>'
            + (s || '과목…') + '</option>';
        }).join('') + '</select>'
        + '<button class="xdel" data-tpdel="' + i + '" title="지우기">×</button></div>'
        + '<textarea class="inp" data-tpb="' + i + '" rows="4" '
        + 'placeholder="블로거가 읽을 내용을 붙여넣으세요">' + esc(t.body || '') + '</textarea>'
        + '<input class="inp" data-tptag="' + i + '" style="margin-top:6px;font-size:12.5px" '
        + 'placeholder="이 소재에만 붙일 태그 (쉼표로 구분 · 안 쓰셔도 됩니다)" '
        + 'value="' + esc((t.tags || []).join(', ')) + '"></div>';
    }).join('');
  }
  function tpCollect() {
    var out = [];
    TOPICS.forEach(function (t, i) {
      var ti = document.querySelector('[data-tpt="' + i + '"]');
      var bo = document.querySelector('[data-tpb="' + i + '"]');
      var su = document.querySelector('[data-tpsub="' + i + '"]');
      var tg = document.querySelector('[data-tptag="' + i + '"]');
      out.push({ title: ti ? ti.value.trim() : '', body: bo ? bo.value.trim() : '',
                 subject: su ? su.value : (t.subject || ''),
                 tags: tg ? splitTags(tg.value) : (t.tags || []) });
    });
    return out;
  }
  if ($('tpOrder')) {
    $('tpOrder').onchange = tpLoad;
    $('tpAdd').onclick = function () { TOPICS = tpCollect(); TOPICS.push({ title: '', body: '' }); tpRender(); };
    $('tpSave').onclick = async function () {
      var items = tpCollect().filter(function (t) { return t.title && t.body; });
      if (!items.length) { A.toast('제목과 내용을 채운 소재가 하나도 없습니다'); return; }
      this.disabled = true;
      try {
        var n = await A.rpc('topics_set', { p_order: $('tpOrder').value, p_items: items });
        A.toast('소재 ' + n + '개를 저장했습니다'); await tpLoad();
      } catch (e) { A.toast('실패: ' + e.message); }
      this.disabled = false;
    };
    $('tpSpread').onclick = async function () {
      var all = confirm('아직 소재가 없는 글에만 배정할까요?\n\n[확인] 안 붙은 글만\n[취소] 전부 다시 배정');
      this.disabled = true;
      try {
        var n = await A.rpc('topics_spread', { p_order: $('tpOrder').value, p_all: !all });
        A.toast(n + '편에 소재를 배정했습니다');
        await A.loadAdmin(); await tpLoad();
      } catch (e) { A.toast('실패: ' + e.message); }
      this.disabled = false;
    };
    /* 학원이 진행현황에서 보낸 전달사항을 그대로 가져옵니다 */
    $('tpLoadNote').onclick = async function () {
      var notes = await A.sel('order_notes', { eq: { order_id: $('tpOrder').value }, order: 'created_at' });
      $('tpNote').innerHTML = notes.length
        ? '<div class="note" style="margin-bottom:12px"><b>학원이 보낸 전달사항 ' + notes.length + '건</b>'
        + ' — 아래에서 필요한 부분을 골라 소재로 잘라 넣으세요.'
        + notes.map(function (n) {
          return '<pre class="tpnote">' + esc(n.body) + '</pre>';
        }).join('') + '</div>'
        : '<div class="note" style="margin-bottom:12px">이 학원이 보낸 전달사항이 없습니다.</div>';
    };
  }
  document.addEventListener('click', function (e) {
    var d = e.target.closest('[data-tpdel]');
    if (d) { TOPICS = tpCollect(); TOPICS.splice(Number(d.dataset.tpdel), 1);
      if (!TOPICS.length) TOPICS = [{ title: '', body: '' }]; tpRender(); }
  });

  /* ── 글에 같이 나가는 규칙 — 광고 표시 문구 · 하루 편수 ──
     둘 다 settings key='blog' 한 줄에 들어갑니다 (ad_lines · form.daily_limit). */
  function renderRules() {
    if (!$('adLines') || !A.IS_ADMIN) return;
    $('adLines').value = (A.AD_LINES || []).join('\n');
    var f = A.FORM || {};
    $('dailyLimit').value = String(f.daily_limit || 1);
    $('sameAcad').checked = f.same_academy_daily !== 0;
    /* ⚠️ 값이 없으면 「요구함」이 기본입니다 (서버 blog_require_t1() 과 같은 규칙) */
    if ($('reqT1')) $('reqT1').checked = f.require_t1 !== false;
    var cap = Number(A.MONTH_CAP) || 30;
    $('monthCap').value = String(cap);
    $('capNow').textContent = String(cap);
  }
  if ($('ruleSave')) $('ruleSave').onclick = async function () {
    var lines = $('adLines').value.split('\n')
      .map(function (s) { return s.trim(); }).filter(Boolean);
    if (!lines.length) { A.toast('광고 표시 문구는 최소 하나는 있어야 합니다'); return; }
    this.disabled = true;
    var cur = await A.sb.from('settings').select('value').eq('key', 'blog').maybeSingle();
    var v = (cur.data && cur.data.value) || {};
    v.ad_lines = lines;
    v.form = Object.assign({}, v.form, {
      daily_limit: Number($('dailyLimit').value) || 1,
      same_academy_daily: $('sameAcad').checked ? 1 : 0,
      /* 1차 줌을 배정 조건으로 볼지 — 서버 blog_require_t1() 이 같은 값을 읽습니다 */
      require_t1: $('reqT1') ? !!$('reqT1').checked : true
    });
    /* 월 상한은 posts_auto_assign 이 settings.month_cap 을 직접 읽습니다 (form 안이 아닙니다) */
    v.month_cap = Math.max(1, Number($('monthCap').value) || 30);
    var r = await A.sb.from('settings').update({ value: v }).eq('key', 'blog').select();
    this.disabled = false;
    if (r.error || !r.data || !r.data.length) { A.toast('저장 실패 (권한 확인 필요)'); return; }
    A.AD_LINES = lines; A.FORM = v.form; A.MONTH_CAP = v.month_cap;
    A.toast('저장했습니다 — 문구 ' + lines.length + '개 · 하루 ' + v.form.daily_limit
      + '편 · 월 ' + v.month_cap + '편 · 1차 줌 '
      + (v.form.require_t1 ? '필요' : '안 봄'));
    renderRules(); renderOrders(); renderAssign();
  };

  /* ── 태그 정하기 ──
     예전엔 작성 폼에 「태그 7~10개」라고만 적혀 있어서 블로거가 알아서 달았습니다.
     그러면 학원이 강조하는 말이 태그에서 빠지고, 50편이 같은 태그를 달 위험도 있습니다.
     여기서 정해 두면 글마다 조합을 달리해 내려갑니다 (규칙은 core.js A.tagsFor). */
  function tgFill() {
    var el = $('tgOrder'); if (!el) return;
    var k = el.value;
    el.innerHTML = A.ORDERS.map(function (o) {
      return '<option value="' + o.id + '">' + esc(o.academy_name) + '</option>';
    }).join('') || '<option value="">주문이 없습니다</option>';
    if (k) el.value = k;
  }
  function tgOrderNow() {
    var id = $('tgOrder') && $('tgOrder').value;
    return A.ORDERS.filter(function (o) { return o.id === id; })[0] || null;
  }
  function splitTags(v) {
    return String(v || '').split(/[,\n]/)
      .map(function (t) { return t.trim().replace(/^#+/, ''); })
      .filter(Boolean);
  }
  function tgLoad() {
    var o = tgOrderNow(); if (!o) return;
    var t = o.tags || {};
    $('tgFixed').value = (t.fixed || []).join(', ');
    $('tgPool').value = (t.pool || []).join(', ');
    tgPreview();
  }
  /* 이대로 저장하면 글 1·2·3번에 무엇이 붙는지 바로 보여줍니다 */
  function tgPreview() {
    var o = tgOrderNow(); if (!o || !$('tgPrev')) return;
    var cfg = { fixed: splitTags($('tgFixed').value), pool: splitTags($('tgPool').value) };
    var mine = POSTS.filter(function (p) { return p.order_id === o.id; }).slice(0, 3);
    if (!mine.length) {
      mine = [1, 2, 3].map(function (n) { return { seq: n, keyword: '(검색어 예시 ' + n + ')' }; });
    }
    $('tgInfo').textContent = '고정 ' + cfg.fixed.length + '개 · 돌려쓰기 ' + cfg.pool.length + '개';
    $('tgPrev').innerHTML = '<div class="sec">이렇게 나갑니다</div>'
      + mine.map(function (p) {
        var tg = A.tagsFor({
          tags: cfg, keyword: p.keyword, seq: p.seq,
          topic_tags: topicTagsOf(p)
        });
        return '<div class="obit" style="padding:10px 12px"><b style="font-size:12.5px">'
          + esc(p.keyword || '') + '</b><div class="tagline">'
          + tg.map(function (x) { return '<span>#' + esc(x) + '</span>'; }).join('') + '</div></div>';
      }).join('')
      + '<div class="mono" style="margin-top:6px">앞쪽 고정 태그는 모든 글에 같이 가고, '
      + '뒤쪽은 글마다 다르게 뽑힙니다.</div>';
  }
  function topicTagsOf(p) {
    var t = ALLTOPICS.filter(function (x) { return x.id === p.topic_id; })[0];
    return (t && t.tags) || [];
  }
  /* 주문에 이미 들어 있는 글감(지역·과목·학년·목적)에서 태그 후보를 만들어 줍니다.
     ⚠️ 조합을 그냥 곱하면 「안말초 수능영어」처럼 말이 안 되는 것이 쏟아집니다.
     키워드 만들 때 쓰는 badCombo() 를 그대로 재사용해 걸러 냅니다. */
  function tgSuggest() {
    var o = tgOrderNow(); if (!o) { A.toast('주문을 먼저 고르세요'); return; }
    var reg = o.target_regions || [], sub = o.target_subjects || [];
    var gra = o.target_grades || [], pur = o.target_purposes || [];

    /* 학교 이름은 그 자체로 좋은 태그이고, 동네 이름은 조합에 씁니다 */
    var school = reg.filter(function (r) { return /(초|중|고)$/.test(r); });
    var area = reg.filter(function (r) { return school.indexOf(r) < 0; });

    var fixed = [o.academy_name].concat(area.slice(0, 2).map(function (r) { return r + '학원'; }));
    var pool = [];
    area.forEach(function (r) {
      sub.forEach(function (x) { if (!badCombo(r, '', x, '')) pool.push(r + x); });
      gra.forEach(function (g) { if (!badCombo(r, g, '', '')) pool.push(r + g + '학원'); });
      pool.push(r + '학원추천');
    });
    sub.forEach(function (x) {
      gra.forEach(function (g) { if (!badCombo('', g, x, '')) pool.push(g + x); });
      pur.forEach(function (u) { if (!badCombo('', '', x, u)) pool.push(x + u); });
    });
    school.forEach(function (sc) { pool.push(sc + '학원'); pool.push(sc + '내신'); });

    var seen = {}, out = [];
    fixed.forEach(function (t) { seen[String(t).replace(/\s+/g, '')] = 1; });
    pool.concat(sub, school).forEach(function (t) {
      t = String(t || '').replace(/\s+/g, '');
      if (t && !seen[t]) { seen[t] = 1; out.push(t); }
    });
    $('tgFixed').value = fixed.filter(Boolean).join(', ');
    $('tgPool').value = out.join(', ');
    tgPreview();
    A.toast('글감에서 ' + out.length + '개를 뽑았습니다. 이상한 건 지우세요');
  }
  if ($('tgOrder')) {
    $('tgOrder').onchange = tgLoad;
    $('tgFixed').oninput = tgPreview;
    $('tgPool').oninput = tgPreview;
    $('tgSuggest').onclick = tgSuggest;
    $('tgSave').onclick = async function () {
      var o = tgOrderNow(); if (!o) return;
      var body = { fixed: splitTags($('tgFixed').value), pool: splitTags($('tgPool').value) };
      if (!body.fixed.length && !body.pool.length) { A.toast('태그를 하나라도 넣어 주세요'); return; }
      this.disabled = true;
      try {
        var n = await A.rpc('order_set_tags', { p_order: o.id, p_tags: body });
        o.tags = body;
        A.toast('태그 ' + n + '개를 저장했습니다');
        renderOrders();
      } catch (e) { A.toast('실패: ' + e.message); }
      this.disabled = false;
    };
  }

  /* ═══════════ 리뷰 4 · 5 · 6 ═══════════ */

  function rvOrders() {
    return A.ORDERS.filter(function (o) { return (o.track || 'blog') === 'review'; });
  }
  function rvFill(id) {
    var el = $(id); if (!el) return;
    var k = el.value;
    el.innerHTML = rvOrders().map(function (o) {
      return '<option value="' + o.id + '">' + esc(o.academy_name) + ' (' + o.total_qty + '편)</option>';
    }).join('') || '<option value="">리뷰 주문이 없습니다</option>';
    if (k) el.value = k;
  }
  function rvOrderNow(id) { return rvOrderOf(id); }
  function rvOrderOf(id) {
    var v = $(id) && $(id).value;
    return A.ORDERS.filter(function (o) { return o.id === v; })[0] || null;
  }

  /* Edge Function 이 돌려준 진짜 오류 글을 꺼냅니다.
     supabase-js 는 non-2xx 면 본문을 안 읽고 일반적인 문장만 던지는데,
     우리 함수는 무엇이 잘못됐는지 우리 말로 담아 보냅니다(키 거절·잔액 없음 등). */
  async function fnError(err) {
    try {
      var b = err && err.context && typeof err.context.json === 'function'
        ? await err.context.json() : null;
      if (b && b.error) return b.error;
    } catch (e) { /* 본문이 JSON 이 아니면 그냥 넘어갑니다 */ }
    return (err && err.message) || '불러오지 못했습니다';
  }

  /* ── 4 리뷰 만들기 ── */
  var RMDRAFT = [];
  function rmPaint() {
    var o = rvOrderOf('rmOrder'); if (!$('rmInfo')) return;
    rvPaintPrompt();
    if (!o) { $('rmInfo').innerHTML = A.empty('리뷰 주문이 없습니다.'); return; }
    var specs = RVSPECS.filter(function (x) { return x.order_id === o.id; });
    var made = POSTS.filter(function (x) { return x.order_id === o.id; }).length;
    var want = specs.reduce(function (a, x) { return a + (x.qty || 0); }, 0);
    $('rmInfo').innerHTML = '<div class="note">'
      + '<b>' + esc(o.academy_name) + '</b> — 주문 ' + o.total_qty + '편 · '
      + '구성 합계 ' + want + '편 · <b>지금까지 만든 리뷰 ' + made + '편</b>'
      + (specs.length
        ? '<div class="tagline" style="margin-top:8px">' + specs.map(function (x) {
            return '<span>' + esc(x.category) + ' ' + x.qty + '편</span>';
          }).join('') + '</div>'
        : '<br><b style="color:var(--bad)">3 주문·입금에서 리뷰 구성을 먼저 정해 주세요.</b>')
      + '</div>';
  }
  /* ⭐ 기본 규칙 — Edge Function 의 DEFAULT_RULES 와 **같은 글**이어야 합니다.
     화면에서 고쳐 저장하면 settings.blog.rv_rules 에 들어가고, 그때부터 그걸 보냅니다. */
  var RV_RULES_DEFAULT = [
    '당신은 네이버 플레이스 리뷰를 대신 써 주는 사람입니다.',
    '규칙:',
    '- 리뷰 하나는 2~4문장. 실제 손님이 쓴 것처럼 짧고 구어체로.',
    '- 모든 리뷰의 표현이 서로 겹치면 안 됩니다. 시작하는 말, 문장 구조, 마무리를 전부 다르게.',
    "- '정말', '너무', '진짜' 같은 말을 반복해서 쓰지 마세요.",
    '- 별점·이모지·해시태그·과장된 광고 문구는 넣지 마세요.',
    '- 주어진 정보 안에서만 쓰고, 없는 사실을 지어내지 마세요.',
    '- 형식을 정확히 지키세요. 설명이나 인사말을 앞뒤에 붙이지 마세요.'
  ].join('\n');

  /* ⚠️ 화면에 적힌 글이 곧 보내는 글이어야 합니다.
     예전엔 저장한 값만 봐서, 규칙을 고쳐 놓고 [저장] 없이 만들면 **고친 게 조용히 무시**됐습니다.
     이제 칸에 적힌 것을 먼저 씁니다. [규칙 저장]은 다음에 열어도 남아 있게 하는 용도입니다. */
  function rvRules() {
    var el = $('rvRules'), t = el && (el.value || '').trim();
    if (t) return t;
    return (A.RV_RULES || '').trim() || RV_RULES_DEFAULT;
  }

  var RMLAST = null;   /* 마지막으로 주고받은 것 — [무엇을 주고받았는지 보기] 용 */

  /* 클로드에게 그대로 넘길 수 있게 한 덩어리로 만듭니다 */
  function rmBrief() {
    var o = rvOrderOf('rmOrder'); if (!o) return '';
    var specs = RVSPECS.filter(function (x) { return x.order_id === o.id; });
    var L = [];
    L.push('네이버 리뷰를 만들어 주세요. 아래 형식 그대로 돌려주시면 됩니다.');
    L.push('');
    L.push('■ 업체');
    L.push('- 이름: ' + o.academy_name);
    if (o.region) L.push('- 지역: ' + o.region);
    if (o.map_url) L.push('- 네이버 지도: ' + o.map_url);
    L.push('- 방문 여부: ' + (o.visit_type === 'material' ? '리뷰어가 방문하지 않음' : '리뷰어가 직접 방문·결제'));
    L.push('');
    L.push('■ 만들 리뷰');
    specs.forEach(function (x) {
      L.push('- ' + x.category + ' ' + x.qty + '편'
        + ((x.points || []).length ? ' — ' + x.points.join(', ') : '')
        + (x.note ? ' (' + x.note + ')' : ''));
    });
    L.push('');
    if (o.info_pack) { L.push('■ 업체가 준 정보'); L.push(o.info_pack); L.push(''); }
    L.push('■ 지켜 주세요');
    L.push('- 리뷰 하나에 2~4문장. 네이버 리뷰답게 짧고 구어체로.');
    L.push('- ' + specs.reduce(function (a, x) { return a + (x.qty || 0); }, 0)
      + '편이 서로 표현이 겹치지 않게. 같은 문장·같은 시작말을 쓰지 마세요.');
    L.push('- 세부 항목이 있으면 편마다 하나씩 돌아가며 다루세요.');
    L.push('- 별점·이모지·해시태그는 넣지 마세요.');
    L.push('- 지어내지 마세요. 위에 준 것 안에서만 쓰세요.');
    L.push('');
    L.push('■ 이 형식으로 돌려주세요 (--- 로 나눔)');
    L.push('[갈래] 세부항목');
    L.push('리뷰 본문');
    L.push('---');
    L.push('[갈래] 세부항목');
    L.push('리뷰 본문');
    return L.join('\n');
  }
  /* 붙여넣은 것을 --- 로 잘라 읽습니다. 첫 줄이 [갈래] 세부항목 이면 떼어냅니다 */
  function rmParse(txt) {
    return String(txt || '').split(/^\s*-{3,}\s*$/m).map(function (blk) {
      var lines = blk.replace(/\r/g, '').split('\n');
      while (lines.length && !lines[0].trim()) lines.shift();
      while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
      if (!lines.length) return null;
      var cat = '', pt = '';
      var m = lines[0].match(/^\s*\[([^\]]+)\]\s*(.*)$/);
      if (m) { cat = m[1].trim(); pt = (m[2] || '').trim(); lines.shift(); }
      var body = lines.join('\n').trim();
      if (!body) return null;
      return { category: cat, point: pt, body: body };
    }).filter(Boolean);
  }
  /* ⚙️ 지시문 상자 — ①규칙(고칠 수 있음) ②이번에 보낼 주문 내용(읽기 전용) */
  function rvPaintPrompt() {
    if (!$('rvRules')) return;
    if (document.activeElement !== $('rvRules')) $('rvRules').value = rvRules();
    $('rvBriefPrev').textContent = rmBrief() || '(주문을 고르시면 여기에 보입니다)';
  }
  if ($('rvRulesSave')) $('rvRulesSave').onclick = async function () {
    var t = $('rvRules').value.trim();
    if (!t) { A.toast('규칙이 비었습니다. [기본값으로]를 누르시면 처음 것으로 돌아갑니다'); return; }
    this.disabled = true;
    var cur = await A.sb.from('settings').select('value').eq('key', 'blog').maybeSingle();
    var v = (cur.data && cur.data.value) || {};
    v.rv_rules = t;
    var r = await A.sb.from('settings').update({ value: v }).eq('key', 'blog').select();
    this.disabled = false;
    if (r.error || !r.data || !r.data.length) { A.toast('저장 실패 (권한 확인 필요)'); return; }
    A.RV_RULES = t;
    A.toast('규칙을 저장했습니다. 다음부터 이 규칙으로 만듭니다');
  };
  if ($('rvRulesReset')) $('rvRulesReset').onclick = function () {
    $('rvRules').value = RV_RULES_DEFAULT;
    A.toast('기본 규칙을 넣었습니다. 쓰시려면 [규칙 저장]을 눌러 주세요');
  };

  /* 🔍 무엇을 주고받았는지 — 추측이 아니라 **함수가 실제로 보낸 글**을 그대로 보여줍니다
     (Edge Function 이 sent 로 되돌려 줍니다). 비용도 여기서 같이 계산합니다. */
  function rvPaintSeen() {
    var box = $('rmSeenBox'); if (!box) return;
    if (!RMLAST) { box.innerHTML = ''; return; }
    var u = RMLAST.usage || {};
    /* Claude Opus 5 = 100만 토큰당 입력 $5 · 출력 $25 */
    var usd = ((u.in || 0) / 1e6) * 5 + ((u.out || 0) / 1e6) * 25;
    box.innerHTML = '<details class="rvseen" style="margin-top:12px">'
      + '<summary style="cursor:pointer;font-size:13px;font-weight:700;color:var(--ink-2)">'
      + '🔍 방금 무엇을 주고받았는지 보기 <span class="mono">(토큰 '
      + won(u.in || 0) + ' + ' + won(u.out || 0) + ' · 약 ' + usd.toFixed(3) + ' 달러)</span></summary>'
      + '<div class="note" style="margin-top:10px"><b>이건 기록일 뿐입니다.</b> '
      + '아래 내용은 저장되지 않고, 화면을 새로 고치면 사라집니다.</div>'
      + '<div class="sec">① 보낸 규칙</div>'
      + '<pre class="tpnote">' + esc(RMLAST.system || '') + '</pre>'
      + '<div class="sec">② 보낸 주문 내용</div>'
      + '<pre class="tpnote">' + esc(RMLAST.user || '') + '</pre>'
      + '<div class="sec">③ 받은 글</div>'
      + '<pre class="tpnote">' + esc(RMLAST.text || '') + '</pre>'
      + '<div class="note" style="margin-top:12px">'
      + '<b>비용</b> — 이번에 <b>약 ' + usd.toFixed(3) + ' 달러</b>'
      + '(원화로 대략 ' + won(Math.round(usd * 1400)) + '원, 1달러 1,400원 기준)를 썼습니다.<br>'
      + '<b>모델</b> ' + esc(RMLAST.model || '-') + ' · <b>생각 깊이</b> ' + esc(RMLAST.effort || '-')
      + '</div></details>';
  }

  if ($('rmOrder')) {
    $('rmOrder').onchange = rmPaint;
    /* ── 프로그램 안에서 바로 만들기 ──
       ⚠️ API 키를 브라우저에 두면 누구나 열어볼 수 있습니다. 그래서 Supabase Edge Function
       (make-reviews)이 서버에서 대신 부르고, 여기서는 결과 글만 받아 옵니다.
       받은 것은 바로 저장하지 않고 화면에 채워 넣습니다 — 눈으로 보고 저장하시라고. */
    $('rmAuto').onclick = async function () {
      var o = rvOrderNow('rmOrder') || rvOrderOf('rmOrder');
      if (!o) { A.toast('주문을 고르세요'); return; }
      var specs = RVSPECS.filter(function (x) { return x.order_id === o.id; });
      var want = specs.reduce(function (a, x) { return a + (x.qty || 0); }, 0);
      if (!want) { A.toast('3 주문·입금에서 리뷰 구성을 먼저 정해 주세요'); return; }

      this.disabled = true; this.textContent = '만드는 중… (1~2분)';
      var btn = this;
      $('rmMsg').innerHTML = '';
      RMLAST = null; rvPaintSeen();
      try {
        var r = await A.sb.functions.invoke('make-reviews', {
          body: { brief: rmBrief(), count: want, rules: rvRules() }
        });
        /* ⚠️ supabase-js 는 2xx 가 아니면 r.error.message 에 「Edge Function returned a
           non-2xx status code」라는 **쓸모없는 말**만 담습니다. 진짜 이유(키가 거절됐다,
           잔액이 없다…)는 r.error.context 안의 응답 본문에 있습니다. 그걸 꺼내 보여줍니다. */
        if (r.error) throw new Error(await fnError(r.error));
        if (r.data && r.data.error) throw new Error(r.data.error);
        $('rmPaste').value = (r.data && r.data.text) || '';
        /* 함수가 되돌려준 「실제로 보낸 글」을 그대로 붙잡아 둡니다 */
        var sent = (r.data && r.data.sent) || {};
        RMLAST = {
          system: sent.system, user: sent.user, model: sent.model, effort: sent.effort,
          text: r.data.text, usage: r.data.usage
        };
        rvPaintSeen();
        $('rmParse').click();
        A.toast('만들었습니다. 확인하고 [이대로 리뷰 만들기]를 누르세요');
      } catch (e) {
        /* 토스트는 금방 사라지고 길면 잘립니다 — 무엇을 해야 하는지 화면에 남겨 둡니다 */
        $('rmMsg').innerHTML = '<div class="note warn" style="margin-top:12px">'
          + '<b>만들지 못했습니다.</b><br>' + esc(e.message) + '</div>';
        A.toast('실패: ' + e.message.slice(0, 60));
      }
      btn.disabled = false; btn.textContent = '✨ 여기서 바로 만들기';
    };
    $('rmCopy').onclick = function () {
      var t = rmBrief();
      if (!t) { A.toast('주문을 고르세요'); return; }
      navigator.clipboard.writeText(t).then(function () {
        A.toast('복사했습니다. 클로드에게 붙여넣으세요');
      });
    };
    $('rmParse').onclick = function () {
      RMDRAFT = rmParse($('rmPaste').value);
      var by = {};
      RMDRAFT.forEach(function (x) { by[x.category || '(갈래 없음)'] = (by[x.category || '(갈래 없음)'] || 0) + 1; });
      $('rmCount').innerHTML = RMDRAFT.length
        ? '<b>' + RMDRAFT.length + '편</b>을 읽었습니다'
        : '읽어낸 것이 없습니다 — --- 로 나눠져 있는지 보세요';
      /* 같은 문장이 섞여 있으면 여기서 잡습니다 */
      var seen = {}, dup = 0;
      RMDRAFT.forEach(function (x) {
        var k = x.body.replace(/\s+/g, '');
        if (seen[k]) dup++; else seen[k] = 1;
      });
      $('rmPrev').innerHTML = RMDRAFT.length
        ? (dup ? '<div class="note warn"><b>똑같은 본문이 ' + dup + '건 있습니다.</b> '
            + '같은 글이 여러 개 올라가면 바로 걸립니다. 다시 받으세요.</div>' : '')
          + '<div class="tagline" style="margin-bottom:10px">'
          + Object.keys(by).map(function (k) { return '<span>' + esc(k) + ' ' + by[k] + '편</span>'; }).join('')
          + '</div>'
          + RMDRAFT.slice(0, 5).map(function (x, i) {
            return '<div class="obit" style="padding:10px 12px">'
              + '<b style="font-size:12.5px">' + (i + 1) + '. [' + esc(x.category || '-') + '] '
              + esc(x.point || '') + '</b>'
              + '<div class="mono" style="margin-top:5px;white-space:pre-wrap">' + esc(x.body) + '</div></div>';
          }).join('')
          + (RMDRAFT.length > 5 ? '<div class="mono">앞의 5편만 보여드립니다.</div>' : '')
        : '';
      $('rmSave').disabled = !RMDRAFT.length;
    };
    $('rmSave').onclick = async function () {
      var o = rvOrderOf('rmOrder'); if (!o || !RMDRAFT.length) return;
      this.disabled = true;
      try {
        var n = await A.rpc('reviews_generate', {
          p_order: o.id, p_items: RMDRAFT, p_replace: $('rmReplace').checked
        });
        A.toast(n + '편을 만들었습니다');
        $('rmPaste').value = ''; $('rmPrev').innerHTML = ''; $('rmCount').textContent = '';
        RMDRAFT = [];
        await A.loadAdmin(); A.show('r-assign');
      } catch (e) { A.toast('실패: ' + e.message); this.disabled = false; }
    };
  }

  /* ── 5 리뷰 나눠주기 ── */
  function renderRvAssign() {
    if (!$('raPosts')) return;
    rvFill('raOrder');
    var o = rvOrderOf('raOrder');
    if (!o) { $('raPosts').innerHTML = A.empty('리뷰 주문이 없습니다.'); $('raPeople').innerHTML = ''; return; }

    if ($('raFrom') && !$('raFrom').value) $('raFrom').value = A.today();
    if ($('raTo') && !$('raTo').value) $('raTo').value = o.deadline || '';

    var mine = POSTS.filter(function (p) { return p.order_id === o.id; });
    var idle = mine.filter(function (p) { return p.status === 'pending'; });
    var timed = mine.filter(function (p) { return p.write_at; });

    $('raInfo').innerHTML = '아직 안 맡긴 리뷰 <b>' + idle.length + '편</b> · 시각이 정해진 것 '
      + timed.length + '편';

    /* 날짜별 편수 미리보기 */
    var by = {};
    timed.forEach(function (p) { var d = String(p.write_at).slice(0, 10); by[d] = (by[d] || 0) + 1; });
    var days = Object.keys(by).sort();
    $('raPrev').innerHTML = days.length
      ? '<div class="sec">날짜별 편수</div><div class="tagline">'
        + days.map(function (d) {
          return '<span' + (by[d] > 5 ? ' style="background:var(--bad-bg);color:var(--bad)"' : '')
            + '>' + d.slice(5) + ' · ' + by[d] + '편</span>';
        }).join('') + '</div>'
      : '';

    /* 같은 사람이 같은 날 이 가게 리뷰를 여러 개 맡았는지 */
    var clash = {};
    mine.filter(function (p) { return p.blogger_id && p.write_at; }).forEach(function (p) {
      var k = p.blogger_id + '|' + String(p.write_at).slice(0, 10);
      clash[k] = (clash[k] || 0) + 1;
    });
    var bad = Object.keys(clash).filter(function (k) { return clash[k] > 1; });
    $('raClash').innerHTML = bad.length
      ? '<div class="note warn" style="margin-bottom:12px"><b>같은 사람이 같은 날 이 가게 리뷰를 '
        + '두 개 이상 맡은 것이 ' + bad.length + '건 있습니다.</b> 한 사람이 하루에 같은 가게 리뷰를 '
        + '여러 개 올리면 바로 티가 납니다.<br>'
        + bad.map(function (k) {
          var pr = k.split('|'), who = A.PEOPLE.filter(function (x) { return x.id === pr[0]; })[0];
          return '· <b>' + esc(who ? who.name : '?') + '</b> — ' + pr[1] + ' 에 ' + clash[k] + '편';
        }).join('<br>') + '</div>'
      : '';

    $('raPosts').innerHTML = idle.length
      ? '<div class="picklist">' + idle.map(function (p) {
        return '<label class="pickrow"><input type="checkbox" class="pk-rv" value="' + p.id + '">'
          + '<span style="flex:1;min-width:0"><b>' + esc(p.category || '-') + '</b> '
          + '<span class="sub">' + esc(p.keyword || '') + '</span>'
          + '<div class="mono" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'
          + esc((p.body || '').slice(0, 40)) + '</div></span>'
          + '<span class="dday calm">' + (p.write_at ? A.fdt(p.write_at) : '시각 미정') + '</span></label>';
      }).join('') + '</div>'
      : A.empty(mine.length ? '맡길 리뷰가 남아 있지 않습니다.' : '아직 리뷰를 안 만들었습니다. 4번으로 가세요.');

    var appr = A.PEOPLE.filter(function (p) {
      return p.status === 'approved' && READY.review && READY.review[p.id];
    });
    $('raPeople').innerHTML = appr.length
      ? '<div class="picklist">' + appr.map(function (p) {
        var n = POSTS.filter(function (x) { return x.blogger_id === p.id && x.status !== 'cancelled'; }).length;
        return '<label class="pickrow"><input type="checkbox" class="pk-rvp" value="' + p.id + '">'
          + '<span style="flex:1"><b>' + esc(p.name) + '</b> '
          + '<span class="sub">' + esc(A.commName(p.community_id)) + '</span></span>'
          + '<span class="mono">누적 ' + n + '</span></label>';
      }).join('') + '</div>'
      : A.empty('리뷰 교육을 마친 사람이 없습니다. 2 리뷰어 교육을 먼저 끝내 주세요.');
  }
  if ($('raOrder')) {
    $('raOrder').onchange = renderRvAssign;
    $('raGo').onclick = async function () {
      var o = rvOrderOf('raOrder'); if (!o) return;
      if (!$('raTo').value) { A.toast('언제까지 올릴지 정해 주세요'); return; }
      this.disabled = true;
      try {
        var r = await A.rpc('reviews_schedule', {
          p_order: o.id, p_from: $('raFrom').value || null, p_to: $('raTo').value,
          p_h0: Number($('raH0').value) || 11, p_h1: Number($('raH1').value) || 21,
          p_all: $('raAll').checked
        });
        A.toast((r.scheduled || 0) + '편에 시각을 깔았습니다 (하루 약 ' + (r.per_day || 0) + '편)');
        await A.loadAdmin(); renderRvAssign();
      } catch (e) { A.toast('실패: ' + e.message); }
      this.disabled = false;
    };
    $('raAuto').onclick = async function () {
      var ids = pickedRv('pk-rv');
      if (!ids.length) { A.toast('맡길 리뷰를 고르세요'); return; }
      var pool = pickedRv('pk-rvp');
      this.disabled = true;
      try {
        var r = await A.rpc('posts_auto_assign', { p_posts: ids, p_pool: pool.length ? pool : null });
        A.toast((r.assigned || 0) + '편을 나눠줬습니다');
        await A.loadAdmin(); renderRvAssign();
      } catch (e) { A.toast('실패: ' + e.message); }
      this.disabled = false;
    };
    $('raAssign').onclick = async function () {
      var ids = pickedRv('pk-rv'), who = pickedRv('pk-rvp');
      if (!ids.length || !who.length) { A.toast('리뷰와 사람을 고르세요'); return; }
      this.disabled = true;
      try {
        var n = await A.rpc('posts_assign', { p_posts: ids, p_bloggers: who });
        A.toast(n + '편을 맡겼습니다');
        await A.loadAdmin(); renderRvAssign();
      } catch (e) { A.toast('실패: ' + e.message); }
      this.disabled = false;
    };
  }
  function pickedRv(cls) {
    return Array.prototype.map.call(document.querySelectorAll('.' + cls + ':checked'),
      function (c) { return c.value; });
  }

  /* ── 6 올라왔는지 확인 ── */
  function renderRvCheck() {
    var box = $('rcList'); if (!box) return;
    var up = POSTS.filter(function (p) {
      var o = A.ORDERS.filter(function (x) { return x.id === p.order_id; })[0];
      return o && (o.track || 'blog') === 'review' && p.status === 'published';
    });
    var c = $('cRvCheck');
    if (c) { c.textContent = up.length; c.classList.toggle('hide', !up.length); }

    box.innerHTML = up.length ? up.map(function (p) {
      var o = A.ORDERS.filter(function (x) { return x.id === p.order_id; })[0] || {};
      var who = A.PEOPLE.filter(function (x) { return x.id === p.blogger_id; })[0];
      return '<div class="card" style="margin-bottom:12px">'
        + '<div class="row" style="justify-content:space-between"><div>'
        + '<h3 style="font-size:15.5px">' + esc(o.academy_name || '') + ' <span class="chip">'
        + esc(p.category || '-') + '</span></h3>'
        + '<div class="mono" style="margin-top:3px">' + esc(who ? who.name : '?')
        + ' · ' + A.fdt(p.published_at) + ' 올림'
        + (p.memo ? ' · 닉네임 ' + esc(p.memo) : '') + '</div></div>'
        + (o.map_url
          ? '<a class="btn btn-a btn-s" href="' + esc(o.map_url) + '" target="_blank" rel="noopener">'
            + '📍 네이버 지도에서 보기 ↗</a>'
          : '<span class="chip c-bad">지도 주소 없음</span>') + '</div>'
        + '<div class="grid g2" style="gap:14px;margin-top:12px">'
        + '<div><label class="f">우리가 준 본문</label>'
        + '<pre class="tpnote" style="margin-top:0">' + esc(p.body || '') + '</pre></div>'
        + '<div><label class="f">리뷰어가 올린 화면</label>'
        + (p.proof_path
          ? '<button class="btn btn-s" data-rvproof="' + esc(p.proof_path) + '">🖼 캡처 보기</button>'
          : '<div class="note warn" style="margin:0">캡처가 없습니다.</div>') + '</div>'
        + '</div>'
        + '<div class="row" style="margin-top:14px">'
        + '<button class="btn btn-a btn-s" data-rvok="' + p.id + '">올라왔습니다 — 확인</button>'
        + '<button class="btn btn-s" data-rvno="' + p.id + '">다시 올려 달라기</button>'
        + '</div></div>';
    }).join('') : A.empty('지금 확인할 리뷰가 없습니다. 리뷰어가 올리면 여기에 뜹니다.');
  }
  A.renderRvCheck = renderRvCheck;

  /* ═══ 5 글 나눠주기 ═══ */
  /* ⭐ 이 사람이 지금 글을 못 받는 **정확한 이유**.
     ⚠️ 예전엔 「검수자·관리자」 한마디로 뭉뚱그렸습니다. 그래서 관리자가 「블로거 병행」을
     켜 놓고도 화면이 그대로 「검수자·관리자」라고 해서, 체크가 안 먹은 줄 알았습니다.
     서버의 blogger_ready(id, track) 와 **같은 순서로** 조건을 따집니다. */
  function trackOfOrder(oid) {
    var o = A.ORDERS.filter(function (x) { return x.id === oid; })[0];
    return (o && o.track) || 'blog';
  }

  function whyNotReady(p, TK) {
    TK = TK || 'blog';
    if (p.status !== 'approved') return '승인 안 됨';
    if (p.quality === 'low') return '저품질로 표시해 두셨습니다';
    if (blogRoleOf(p.id) && !p.also_blogging) {
      return '검수자·관리자 — 「블로거 병행」이 꺼져 있습니다';
    }
    /* 교육 기록을 아직 못 읽었으면 넘겨짚지 않습니다 */
    if (!ALLMATS.length && !ALLSESS.length) return '교육 미완';

    var need = ALLMATS.filter(function (m) { return m.required && (m.track || 'blog') === TK; });
    function gOf(m, st) {
      return ALLPROG.some(function (g) {
        return g.material_id === m.id && g.blogger_id === p.id && g.status === st;
      });
    }
    var done = need.filter(function (m) { return gOf(m, 'approved'); }).length;
    var wait = need.filter(function (m) { return gOf(m, 'submitted'); }).length;

    var t1 = ALLSESS.filter(function (x) {
      return x.kind === 't1' && (x.track || 'blog') === TK;
    }).map(function (x) { return x.id; });
    var came = ATT.some(function (a) {
      return a.blogger_id === p.id && t1.indexOf(a.session_id) >= 0
        && (a.mode === 'live' || (a.mode === 'video' && a.confirmed_at));
    });

    /* ⚠️ 1차 줌을 조건에서 빼 두셨으면 여기서도 따지면 안 됩니다 —
       서버는 통과시키는데 화면만 「미참석」이라고 하면 또 헷갈립니다. */
    var needT1 = (A.FORM || {}).require_t1 !== false;
    var miss = [];
    if (needT1 && !t1.length) miss.push('1차 줌 일정이 없습니다');
    else if (needT1 && !came) miss.push('1차 줌 미참석');
    if (done < need.length) {
      miss.push('필수 영상 ' + done + '/' + need.length
        + (wait ? ' — ' + wait + '건은 요약을 냈고 확인 대기' : ''));
    }
    return miss.join(' · ') || '알 수 없음';
  }

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

    /* 주문 편수보다 많이 만들어졌으면 여기서 잡아야 합니다.
       「맡길 글 있음」만 보고 그냥 나눠주면 학원이 시킨 것보다 많이 쓰게 됩니다. */
    (function () {
      var box = $('asOver'); if (!box) return;
      var o = A.ORDERS.filter(function (x) { return x.id === oid; })[0];
      var made = POSTS.filter(function (p) { return p.order_id === oid; }).length;
      var over = o ? made - o.total_qty : 0;

      /* 지금 나눠주는 글이 얼마짜리인지 — 회원 구분에 따라 지급액이 달라지니 여기서 한 번 더 */
      schPaint();
      var mb = $('asMember');
      if (mb) mb.innerHTML = !o ? '' : '<div class="note" style="margin:0 0 12px">'
        + memBadge(o) + ' <b>' + esc(o.academy_name) + '</b> — 편당 '
        + won(o.sale_price) + '원을 받는 주문입니다. '
        + '1단계 블로거가 한 편 쓰면 <b>' + won(basePay(o)) + '원</b>, '
        + '단계가 오르면 그만큼 더 갑니다'
        + (o.is_premium ? '.' : ' (일반 회원이라 프리미엄 주문의 ' + A.payMult() + '배입니다).')
        + '</div>';

      /* ⭐ 지금 이 주문을 맡을 수 있는 사람이 몇 명인지 — 안 그러면 왜 배정이 안 되는지
         한참 헤매게 됩니다. 못 받는 사람은 이유별로 묶어서 보여 줍니다. */
      (function () {
        var wbox = $('asWho'); if (!wbox) return;
        var TK = trackOfOrder(oid);
        var app = A.PEOPLE.filter(function (x) { return x.status === 'approved'; });
        var ok = app.filter(function (x) { return stat(x.id).ready; });
        var no = app.filter(function (x) { return !stat(x.id).ready; });
        var by = {};
        no.forEach(function (x) {
          var r = whyNotReady(x, TK);
          (by[r] = by[r] || []).push(x.name);
        });
        var left = POSTS.filter(function (q) {
          return q.order_id === oid && q.status === 'pending';
        }).length;
        var o2 = A.ORDERS.filter(function (x) { return x.id === oid; })[0];
        var dd = o2 && o2.deadline ? A.dday(o2.deadline) : null;

        wbox.innerHTML = '<div class="note' + (ok.length ? '' : ' warn') + '" style="margin:0 0 12px">'
          + '<b>지금 맡을 수 있는 사람 ' + ok.length + '명</b>'
          + (no.length ? ' · 못 받는 사람 ' + no.length + '명' : '')
          + (left ? ' · 안 맡긴 글 <b>' + left + '편</b>' : '')
          + (dd != null ? ' · 마감 ' + (dd < 0 ? '<b style="color:var(--bad)">' + (-dd) + '일 지남</b>'
              : dd === 0 ? '<b style="color:var(--bad)">오늘</b>'
              : '<b' + (dd <= 7 ? ' style="color:var(--bad)"' : '') + '>D-' + dd + '</b>') : '')
          + (ok.length ? '' : '<br><b style="color:var(--bad)">한 사람도 못 받는 상태입니다.</b> '
              + '아래 이유를 풀어 주셔야 글이 나갑니다.')
          + (no.length ? '<div style="margin-top:9px">' + Object.keys(by).map(function (r) {
              return '· <b>' + esc(r) + '</b> — ' + esc(by[r].join(', '))
                + ' <span class="mono">(' + by[r].length + '명)</span>';
            }).join('<br>')
            + '<div class="mono" style="margin-top:8px">'
            + '「필수 영상」은 본인이 <b>센터에서 영상을 보고 요약을 내면</b>, '
            + '「2 블로거 교육 → 낸 요약 확인하기」에서 통과시켜 주시면 풀립니다. '
            + '<button class="link" data-go="edu">2번으로 가기 →</button></div></div>' : '')
          + '</div>';
      })();

      /* ⚠️ 같은 학원 글이 한 사람에게 하루 두 편 이상 간 경우.
         배정은 후순위로 밀 뿐 막지는 않습니다 — 막으면 글이 안 나가고 마감을 못 맞춥니다.
         사람이 모자라서 생기는 일이므로 여기서 눈에 보이게만 해 둡니다. */
      var clash = {};
      POSTS.filter(function (p) {
        return p.order_id === oid && p.blogger_id && p.publish_on
          && ['cancelled'].indexOf(p.status) < 0;
      }).forEach(function (p) {
        var k = p.blogger_id + '|' + p.publish_on;
        clash[k] = (clash[k] || 0) + 1;
      });
      var bad = Object.keys(clash).filter(function (k) { return clash[k] > 1; });
      var cbox = $('asClash');
      if (cbox) cbox.innerHTML = bad.length
        ? '<div class="note warn" style="margin:0 0 12px"><b>같은 학원 글이 하루에 두 편 이상 간 사람이 '
          + bad.length + '건 있습니다.</b> 맡을 사람이 모자라서 생긴 일입니다. '
          + '한 블로그에 같은 학원 글이 몰리면 서로 검색어를 잡아먹습니다.<br>'
          + bad.map(function (k) {
            var pr = k.split('|'), who = A.PEOPLE.filter(function (x) { return x.id === pr[0]; })[0];
            return '· <b>' + esc(who ? who.name : '?') + '</b> — ' + pr[1] + ' 에 ' + clash[k] + '편';
          }).join('<br>')
          + '<br><br><b>블로거를 더 모으시거나</b> 발행 기간을 늘려 다시 까시면 풀립니다.</div>'
        : '';

      box.innerHTML = (o && over > 0)
        ? '<div class="msg err" style="margin:0 0 12px">'
        + '<b>⚠️ 주문은 ' + o.total_qty + '편인데 글이 ' + made + '편 만들어져 있습니다 (' + over + '편 초과).</b><br>'
        + '키워드를 두 번 만드신 것 같습니다. 이대로 나눠주면 학원이 시킨 것보다 많이 쓰게 됩니다. '
        + '아래에서 <b>남는 ' + over + '편은 빼고</b> 맡기시거나, 「4 키워드 만들기」에서 '
        + '<b>안 맡긴 글을 지우고 새로</b> 만들어 주세요.</div>'
        : '';
    })();

    /* ── 발행 일정 짜기 ──
     ⚠️ 예전 「주차」는 이 화면의 필터일 뿐이었고 아무 힘이 없었습니다.
     마감일은 주차와 무관하게 「배정한 날 + 7일」로 일괄 계산돼서, 50편을 한꺼번에
     배정하면 전부 같은 날 마감이 되고 글이 며칠 안에 다 올라갔습니다.
     이제 글마다 발행 예정일을 깔고, 그날이 되어야 링크를 넣을 수 있습니다(서버에서 막습니다). */
  function schPaint() {
    var oid = $('asOrder') && $('asOrder').value;
    var o = A.ORDERS.filter(function (x) { return x.id === oid; })[0];
    if (!o || !$('schFrom')) return;
    if (!$('schFrom').value) $('schFrom').value = o.paid_at && o.paid_at > A.today() ? o.paid_at : A.today();
    if (!$('schTo').value) $('schTo').value = o.deadline || '';

    var mine = POSTS.filter(function (p) {
      return p.order_id === oid && ['published','verified','paid','cancelled'].indexOf(p.status) < 0;
    });
    var got = mine.filter(function (p) { return p.publish_on; });
    $('schInfo').innerHTML = mine.length
      ? '아직 안 올라간 글 <b>' + mine.length + '편</b> 중 <b>' + got.length + '편</b>에 날짜가 있습니다'
      : '이 주문에 아직 글이 없습니다';

    /* 어느 날 몇 편이 올라가는지 — 하루에 몰려 있으면 여기서 보입니다 */
    var by = {};
    got.forEach(function (p) { by[p.publish_on] = (by[p.publish_on] || 0) + 1; });
    var days = Object.keys(by).sort();
    $('schPrev').innerHTML = days.length
      ? '<div class="sec">날짜별 편수</div><div class="tagline">'
        + days.map(function (d) {
          return '<span' + (by[d] > 3 ? ' style="background:var(--bad-bg);color:var(--bad)"' : '')
            + '>' + d.slice(5) + ' · ' + by[d] + '편</span>';
        }).join('') + '</div>'
        + '<div class="mono" style="margin-top:6px">하루 4편 이상인 날은 빨갛게 표시했습니다. '
        + '그날 맡을 사람이 그만큼 있어야 합니다.</div>'
      : '';
  }
  if ($('schGo')) $('schGo').onclick = async function () {
    var oid = $('asOrder').value;
    if (!oid) { A.toast('주문을 고르세요'); return; }
    if (!$('schTo').value) { A.toast('언제까지 올릴지 정해 주세요'); return; }
    this.disabled = true;
    try {
      var r = await A.rpc('posts_schedule', {
        p_order: oid, p_from: $('schFrom').value || null,
        p_to: $('schTo').value, p_all: $('schAll').checked
      });
      A.toast((r.scheduled || 0) + '편에 날짜를 깔았습니다 (하루 약 ' + (r.per_day || 0) + '편)');
      await A.loadAdmin(); A.show('assign'); schPaint();
    } catch (e) { A.toast('실패: ' + e.message); }
    this.disabled = false;
  };

  /* 비어 있을 때 왜 비었는지 알려줍니다 — 그냥 '없습니다'만 뜨면 답답합니다 */
    function whyEmpty() {
      var o = A.ORDERS.filter(function (x) { return x.id === oid; })[0];
      if (!o) return '<div class="empty">먼저 위에서 주문을 골라 주세요.</div>';
      var made = POSTS.filter(function (p) { return p.order_id === oid; }).length;
      if (!made) {
        return '<div class="empty" style="text-align:left;line-height:1.8">'
          + '<b>아직 글이 하나도 안 만들어졌습니다.</b><br>'
          + (o.paid_at
            ? '「4 키워드 만들기」에서 [키워드 만들기] → <b>[이대로 글 만들기]</b> 까지 두 번 눌러 주세요. '
              + '두 번째 버튼을 눌러야 글이 생깁니다.<br>'
              + '<button class="link" data-gokw2="' + o.id + '">4번으로 가기 →</button>'
            : '<b style="color:var(--bad)">이 주문은 아직 입금 확인이 안 됐습니다.</b> '
              + '입금 확인 전에는 글이 만들어지지 않습니다.<br>'
              + '「3 주문 · 입금」에서 [입금 확인]을 먼저 누르시고, 그다음 4번에서 글을 만드시면 됩니다.<br>'
              + '<button class="link" data-gopay="' + o.id + '">3번으로 가기 →</button>')
          + '</div>';
      }
      if (wk) return '<div class="empty">이 주차에는 맡길 글이 없습니다. 위에서 「전체 주차」로 바꿔 보세요.</div>';
      return '<div class="empty">이 학원 글은 모두 맡겼습니다. 👍</div>';
    }

    $('postList').innerHTML = mine.length ? mine.map(function (p, i) {
      return '<label class="pickrow" draggable="true" data-post="' + p.id + '">'
        + '<span class="grip" title="끌어서 오른쪽 블로거에게 놓으세요">⠿</span>'
        + '<input type="checkbox" class="pk-post" value="' + p.id + '">'
        + '<span><b>' + esc(p.keyword || '(제목 없음)') + '</b></span>'
        + '<span class="sub">#' + p.seq
        + (p.publish_on ? ' · <b style="color:var(--amber)">' + p.publish_on.slice(5) + ' 발행</b>'
                        : p.week ? ' · ' + p.week + '주차' : '') + '</span>'
        + '<button class="xdel" data-delpost="' + p.id + '" title="이 글을 지웁니다">✕</button></label>';
    }).join('')
      + (mine.length > 1 ? '<div class="row" style="padding:8px 12px">'
        + '<button class="btn btn-s" id="delChecked">체크한 글 지우기</button>'
        + '<span class="mono">잘못 만들어진 검색어를 뺄 때 쓰세요</span></div>' : '')
      : whyEmpty();

    /* 이번 달 '배정받은' 편수 — 끝낸 편수(done_month)가 아니라 받은 편수로 봐야 공평합니다 */
    var thisM = A.thisMonth() + '-01';
    function gotThisMonth(bid) {
      return POSTS.filter(function (x) {
        return x.blogger_id === bid && x.cycle_month === thisM && x.status !== 'cancelled';
      }).length;
    }
    /* 자동 배정과 같은 순서로 보여줍니다 — 위에 있는 사람이 먼저 받습니다 */
    var ppl = A.PEOPLE.filter(function (p) { return p.status === 'approved'; })
      .map(function (p) { return { p: p, s: stat(p.id), m: gotThisMonth(p.id) }; })
      .sort(function (a, b) {
        if (a.s.ready !== b.s.ready) return a.s.ready ? -1 : 1;
        if (!!a.p.wants_more !== !!b.p.wants_more) return a.p.wants_more ? -1 : 1;
        if (a.m !== b.m) return a.m - b.m;
        return (a.p.name || '').localeCompare(b.p.name || '');
      });

    $('peopleList').innerHTML = ppl.length ? ppl.map(function (x) {
      var p = x.p, s = x.s;
      var here = POSTS.filter(function (y) { return y.order_id === oid && y.blogger_id === p.id; }).length;
      if (!s.ready) {
        return '<label class="pickrow" style="opacity:.55;cursor:not-allowed"><input type="checkbox" disabled>'
          + '<span><b>' + esc(p.name) + '</b> <span class="mono">' + esc(A.commName(p.community_id)) + '</span></span>'
          + '<span class="sub" style="color:var(--bad)">' + esc(whyNotReady(p, trackOfOrder(oid))) + '</span></label>';
      }
      return '<label class="pickrow drop" data-drop="' + p.id + '">'
        + '<input type="checkbox" class="pk-ppl" value="' + p.id + '">'
        + '<span><b>' + esc(p.name) + '</b>'
        + (p.wants_more ? ' <span class="chip c-ok">★ 많이 원함</span>' : '')
        + ' <span class="mono">' + esc(A.commName(p.community_id))
        + ' · ' + p.level + '단계</span></span>'
        + '<span class="sub">이번 달 <b>' + x.m + '편</b> · 이 학원 ' + here + '편</span></label>';
    }).join('') : '<div class="empty">승인된 블로거가 없습니다.</div>';

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
    $('doAuto').disabled = !a;            /* 자동은 사람을 안 골라도 됩니다 */
    $('assignHint').textContent = !a ? '왼쪽에서 글을 고르세요'
      : !b ? a + '편 — [⚖️ 고르게 자동으로]를 누르시면 알아서 나눠줍니다'
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

  /* 고르게 자동 배정 — 사람을 안 고르면 배정 가능한 사람 전체가 대상 */
  $('doAuto').onclick = async function () {
    var posts = picked('pk-post'), pool = picked('pk-ppl');
    if (!posts.length) { A.toast('나눠줄 글을 고르세요'); return; }
    if (!confirm(posts.length + '편을 고르게 나눠줄까요?\n\n'
      + (pool.length ? '고르신 ' + pool.length + '명 안에서만 나눕니다.'
        : '「많이 쓰고 싶어요」를 켠 사람부터, 이번 달 적게 받은 순으로 나눕니다.'))) return;
    this.disabled = true;
    try {
      var r = await A.rpc('posts_auto_assign', {
        p_posts: posts, p_pool: pool.length ? pool : null
      });
      var who = (r.people || []).map(function (p) {
        return (p.wants ? '★' : '') + p.name + ' ' + p.month + '편';
      }).join(' · ');
      A.toast(r.assigned + '편을 나눠줬습니다');
      if (who) A.toast('이번 달 — ' + who);
      await A.loadAdmin();
    } catch (e) { A.toast('실패: ' + e.message); }
    this.disabled = false;
  };

  /* ═══ 6 검수 ═══ */
  var RV_BY = 'acad';        /* 'acad' 학원별 · 'comm' 공동체별 */

  function commOf(p) {
    var b = A.PEOPLE.filter(function (x) { return x.id === p.blogger_id; })[0];
    return b ? b.community_id : null;
  }
  function isMineComm(cid) { return cid && (A.MY_COMMS || []).indexOf(cid) >= 0; }

  /* ⚠️ 「6 검수하기」는 **블로그 갈래 전용** 화면입니다. 리뷰는 「6 올라왔는지 확인」(r-check)에서
     따로 봅니다. 그런데 여기서 갈래를 안 걸러서 **리뷰가 블로그 검수 화면에도 같이 떴습니다** —
     같은 건이 두 화면에 나와 두 번 손대게 됩니다. */
  function isBlogPost(p) {
    var o = A.ORDERS.filter(function (x) { return x.id === p.order_id; })[0];
    return !o || (o.track || 'blog') === 'blog';
  }

  function renderReview() {
    var draft = POSTS.filter(function (p) { return p.status === 'submitted' && isBlogPost(p); });
    var live = POSTS.filter(function (p) { return p.status === 'published' && isBlogPost(p); });
    $('rcDraft').textContent = draft.length; $('rcLive').textContent = live.length;

    document.querySelectorAll('[data-rvby]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.rvby === RV_BY);
    });
    $('rvByHint').textContent = (A.MY_COMMS || []).length
      ? '보라색으로 칠해진 줄이 내가 맡은 공동체입니다'
      : (RV_BY === 'comm' ? '글을 쓴 사람의 공동체로 묶었습니다' : '');

    if (RV_BY === 'comm') { renderReviewByComm(draft); return; }

    var bOrders = A.ORDERS.filter(function (o) { return (o.track || 'blog') === 'blog'; });
    $('rvAcadList').innerHTML = bOrders.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>학원</th><th>주문한 글</th><th>원고 상황</th><th>올라간 글</th><th>마감일</th><th>남은 기간</th></tr></thead><tbody>'
      + bOrders.map(function (o) {
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

  /* 공동체별로 보기 — 글을 쓴 사람이 속한 공동체로 묶습니다 */
  function renderReviewByComm(draft) {
    var mine = A.COMMS.filter(function (c) { return isMineComm(c.id); });
    var rest = A.COMMS.filter(function (c) { return !isMineComm(c.id); });
    var list = mine.concat(rest);                 /* 내가 맡은 곳을 위로 */

    var none = POSTS.filter(function (p) {
      return p.status === 'submitted' && !commOf(p);
    }).length;

    $('rvAcadList').innerHTML = '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>공동체</th><th>사람</th><th>원고 상황</th><th>올라간 글</th>'
      + '<th>이번 달 끝낸 글</th></tr></thead><tbody>'
      + list.map(function (c) {
        var todo = draft.filter(function (p) { return commOf(p) === c.id; }).length;
        var doneR = POSTS.filter(function (p) {
          return commOf(p) === c.id && ['approved', 'published', 'verified', 'paid'].indexOf(p.status) >= 0;
        }).length;
        var up = POSTS.filter(function (p) {
          return commOf(p) === c.id && ['published', 'verified', 'paid'].indexOf(p.status) >= 0;
        }).length;
        var ppl = A.PEOPLE.filter(function (b) {
          return b.community_id === c.id && b.status === 'approved';
        }).length;
        return '<tr class="' + (isMineComm(c.id) ? 'mycomm ' : '') + (todo ? 'clickme' : '') + '"'
          + (todo ? ' data-opencomm="' + c.id + '"' : '') + '>'
          + '<td><b>' + esc(c.name) + '</b>'
          + (isMineComm(c.id) ? '<span class="minetag">내 담당</span>' : '') + '</td>'
          + '<td class="num">' + ppl + '명</td>'
          + '<td><div class="mixcell">'
          + (todo ? '<span class="pill todo">봐야 할 원고 ' + todo + '</span>'
            : '<span class="pill off">볼 원고 없음</span>')
          + '<span class="pill done">끝낸 원고 ' + doneR + '</span></div></td>'
          + '<td class="num">' + up + '편</td>'
          + '<td class="num">' + POSTS.filter(function (p) {
            return commOf(p) === c.id && ['verified', 'paid'].indexOf(p.status) >= 0
              && p.cycle_month === A.thisMonth() + '-01';
          }).length + '편</td></tr>';
      }).join('')
      + (none ? '<tr><td><b>담당자 미정</b></td><td class="num">-</td>'
        + '<td><span class="pill todo">봐야 할 원고 ' + none + '</span></td>'
        + '<td class="num">-</td><td class="num">-</td></tr>' : '')
      + '</tbody></table></div>';
  }

  /* 처리 후 보고 있던 곳으로 돌아갑니다 */
  function rvBack() { if (RV_COMM) openComm(RV_COMM); else if (RV_ORDER) openAcad(RV_ORDER); }
  A.refreshReview = function () { if (POSTS.length) renderReview(); };

  /* 시연용으로 넣어둔 가짜 주소는 눌러도 열리지 않습니다 — 발표 중 404가 뜨지 않게
     링크 대신 「시연용」 배지를 보여줍니다. 진짜 주소는 그대로 링크가 됩니다. */
  function isDemoUrl(u) { return /demo_blog\d/.test(String(u || '')); }
  function postLink(u, label) {
    if (!u) return '';
    if (isDemoUrl(u))
      return '<span class="chip c-wait" title="시연용으로 넣어둔 주소입니다. 실제로는 블로거가 넣은 진짜 주소가 들어갑니다">'
        + '시연용 주소</span>';
    return '<a class="mono" href="' + esc(u) + '" target="_blank" rel="noopener">' + label + '</a>';
  }
  A.postLink = postLink; A.isDemoUrl = isDemoUrl;

  /* 원고 표 — 학원별·공동체별 둘 다 같은 모양을 씁니다 */
  function rvHead(byComm) {
    return '<thead><tr><th>' + (byComm ? '학원' : '공동체') + '</th><th>누가</th>'
      + '<th>블로그 제목</th><th>원고 낸 날</th><th style="min-width:180px">검수 기록</th>'
      + '<th>처리</th></tr></thead>';
  }

  /* 누가 언제 검수했는지 — 통과도 돌려보낸 것도, 왜 돌려보냈는지도 남깁니다.
     블로거가 다시 내면 사유가 지워지므로 기록(REWORKS)에서 가져옵니다. */
  function reviewLog(p) {
    var out = [];
    if (p.reviewed_at) {
      var who = staffName(p.reviewed_by) || '기록 없음';
      var done = ['approved', 'published', 'verified', 'paid'].indexOf(p.status) >= 0;
      out.push((p.status === 'rework'
        ? '<b style="color:var(--bad)">돌려보냄</b>'
        : done ? '<b style="color:var(--ok)">원고 통과</b>'
          : p.rework_count > 0 ? '<b style="color:var(--bad)">지난번에 돌려보냄</b>' : '검수함')
        + ' · ' + esc(who) + ' · ' + A.fdate(p.reviewed_at));
    } else if (p.rework_count > 0) {
      out.push('<b style="color:var(--bad)">' + p.rework_count + '번 돌려보냄</b>');
    } else {
      out.push('<span class="chip c-off">아직 안 봄</span>');
    }

    /* 돌려보낸 이력 — 몇 번째에 왜 돌려보냈는지 */
    var hist = (REWORKS[p.id] || []);
    if (hist.length) {
      out.push(hist.map(function (h, i) {
        var r = (h.reasons || []).join(', ');
        return '<span style="color:var(--bad)">↩ ' + (i + 1) + '차 반려</span> '
          + '<span class="mono">' + A.fdate(h.at)
          + (staffName(h.actor) ? ' · ' + esc(staffName(h.actor)) : '') + '</span>'
          + (r ? '<br><span class="mono">사유 · ' + esc(r) + '</span>' : '')
          + (h.note ? '<br><span class="mono">“' + esc(h.note) + '”</span>' : '');
      }).join('<br>'));
    } else if (p.status === 'rework' && (p.reject_reasons || []).length) {
      out.push('<span class="mono">사유 · ' + esc(p.reject_reasons.join(', ')) + '</span>'
        + (p.review_note ? '<br><span class="mono">“' + esc(p.review_note) + '”</span>' : ''));
    }

    if (p.verified_at)
      out.push('<span style="color:var(--ok)">올린 글 확인</span> <span class="mono">'
        + esc(staffName(p.verified_by) || '') + ' · ' + A.fdate(p.verified_at)
        + (p.keyword_rank ? ' · ' + A.rankText(p.keyword_rank) : '') + '</span>');
    return out.join('<br>');
  }

  function rvRow(p, dim, byComm) {
    var b = A.PEOPLE.filter(function (x) { return x.id === p.blogger_id; })[0] || {};
    var cls = dim ? ' style="opacity:.5"' : (p.rework_count > 0 ? ' class="sent"' : '');
    return '<tr' + cls + '>'
      + '<td>' + (byComm ? '<b>' + esc(orderName(p.order_id)) + '</b>'
        : (b.name ? esc(A.commName(b.community_id))
          + (isMineComm(b.community_id) ? '<span class="minetag">내 담당</span>' : '')
          : '<span class="mono">—</span>')) + '</td>'
      + '<td>' + (b.name ? '<b>' + esc(b.name) + '</b> ' + A.lvBadge(b.level || 1)
        : '<span class="mono">담당자 미정</span>') + '</td>'
      + '<td><b>' + esc(p.keyword || '') + '</b>'
      + (dim ? '<div style="margin-top:3px">' + A.stChip(p.status) + '</div>' : '') + '</td>'
      + '<td class="mono">' + (p.submitted_at ? A.fdate(p.submitted_at) : '아직') + '</td>'
      + '<td style="font-size:12.5px;line-height:1.6">' + reviewLog(p) + '</td>'
      + '<td><div class="row">'
      + (p.content_url ? '<a class="btn btn-s" href="' + esc(p.content_url) + '" target="_blank" rel="noopener">원고 열기 ↗</a>' : '')
      + (dim ? '' : '<button class="btn btn-a btn-s" data-approve="' + p.id + '">승인</button>'
        + '<button class="btn btn-s" data-openrj="' + p.id + '">돌려보내기</button>')
      + '</div></td></tr>';
  }

  /* 공동체 하나를 열어 그 안의 원고를 봅니다 */
  function openComm(cid) {
    RV_ORDER = null; RV_COMM = cid;
    var c = A.COMMS.filter(function (x) { return x.id === cid; })[0] || {};
    var all = POSTS.filter(function (p) { return commOf(p) === cid && p.status !== 'cancelled'; });
    var todo = all.filter(function (p) { return p.status === 'submitted'; });
    var rest = all.filter(function (p) { return p.status !== 'submitted'; });

    $('rvCrumb').textContent = '← 공동체 목록';
    $('rvAcadName').innerHTML = esc(c.name)
      + (isMineComm(cid) ? '<span class="minetag">내 담당</span>' : '');
    $('rvAcadMeta').innerHTML = A.PEOPLE.filter(function (b) {
      return b.community_id === cid && b.status === 'approved';
    }).length + '명 · 봐야 할 원고 ' + todo.length + '편 · 만든 글 ' + all.length + '편';

    $('rvPosts').innerHTML =
      (todo.length ? '<div class="tblbox tblscroll"><table>' + rvHead(true) + '<tbody>'
        + todo.map(function (p) { return rvRow(p, false, true); }).join('') + '</tbody></table></div>'
        : A.empty('지금 볼 원고가 없습니다.'))
      + (rest.length ? '<div class="sec">아직 원고가 안 온 글 · 이미 끝난 글 <small>'
        + rest.length + '편</small></div>'
        + '<div class="tblbox tblscroll"><table>' + rvHead(true) + '<tbody>'
        + rest.map(function (p) { return rvRow(p, true, true); }).join('') + '</tbody></table></div>' : '');
    A.view('acad-posts');
  }

  function openAcad(oid) {
    RV_ORDER = oid; RV_COMM = null;
    var o = A.ORDERS.filter(function (x) { return x.id === oid; })[0] || {};
    var all = POSTS.filter(function (p) { return p.order_id === oid && p.status !== 'cancelled'; });
    var todo = all.filter(function (p) { return p.status === 'submitted'; });
    var rest = all.filter(function (p) { return p.status !== 'submitted'; });
    var d = A.dday(o.deadline);

    $('rvCrumb').textContent = '← 학원 목록';
    $('rvAcadName').textContent = o.academy_name || '';
    $('rvAcadMeta').innerHTML = o.total_qty + '편 주문 · <b style="color:var(--amber)">마감 '
      + (o.deadline || '-') + (d == null ? '' : d >= 0 ? ' (' + d + '일 남음)' : ' (지났습니다)')
      + '</b> · 봐야 할 원고 ' + todo.length + '편 · 만든 글 ' + all.length + '편';

    /* 사진 꼬리표는 검수자도 답니다 — 원고를 읽는 사람이 사진도 같이 보는 게 자연스럽고,
       관리자 한 명이 다 하면 병목이 됩니다 (서버도 blog_reviewer 로 열어 뒀습니다) */
    var pbox = $('rvAcadPics');
    if (pbox) {
      var tg = o.photo_tags || {}, tn = Object.keys(tg).length;
      var np = (o.photo_paths || []).length;
      pbox.innerHTML = !np ? ''
        : '<div class="note' + (tn ? '' : ' warn') + '" style="margin-bottom:14px">'
        + '<b>학원이 보낸 사진 ' + np + '장</b> — '
        + (tn ? '그중 ' + tn + '장에 꼬리표가 달려 있습니다. '
              : '<b>꼬리표가 없어 사진이 글 내용과 상관없이 나가고 있습니다.</b> ')
        + '꼬리표를 달면 영어 글에는 영어 사진이, 맨 앞에는 간판 사진이 갑니다.'
        + '<div class="row" style="margin-top:10px">'
        + '<button class="btn btn-s" data-seepics="' + o.id + '">🖼 사진 보기 · 꼬리표 · 내려받기</button>'
        + '</div></div>';
    }

    $('rvPosts').innerHTML =
      (todo.length ? '<div class="tblbox tblscroll"><table>' + rvHead(false) + '<tbody>'
        + todo.map(function (p) { return rvRow(p, false, false); }).join('') + '</tbody></table></div>'
        : A.empty('지금 볼 원고가 없습니다.'))
      + (rest.length ? '<div class="sec">아직 원고가 안 온 글 · 이미 끝난 글 <small>'
        + rest.length + '편 — 회색은 아직 손댈 게 없다는 뜻입니다</small></div>'
        + '<div class="tblbox tblscroll"><table>' + rvHead(false) + '<tbody>'
        + rest.map(function (p) { return rvRow(p, true, false); }).join('') + '</tbody></table></div>' : '');
    A.view('acad-posts');
  }

  /* 올라간 글 확인 — 학원별로 묶고, 블로거 실명·공동체는 빼둡니다 */
  function renderLive() {
    var live = POSTS.filter(function (p) { return p.status === 'published' && isBlogPost(p); });
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
            + '<div class="row">'
            + (isDemoUrl(p.published_url)
              ? '<span class="chip c-wait">시연용 주소 — 실제로는 블로거가 넣은 진짜 주소가 열립니다</span>'
              : '<a class="btn btn-s" href="' + esc(p.published_url) + '" target="_blank" rel="noopener">글 열어보기 ↗</a>')
            + '<a class="btn btn-s" href="https://search.naver.com/search.naver?query=' + encodeURIComponent(p.keyword || '')
            + '" target="_blank" rel="noopener">이 검색어로 검색해보기 ↗</a></div></div>'
            + '<div style="min-width:200px"><label class="f">몇 번째에 나왔나요</label>'
            + '<div class="row" style="gap:6px">'
            + '<input class="inp" type="number" min="1" max="50" style="width:88px" '
            + 'data-rank="' + p.id + '" placeholder="예: 4">'
            + '<button class="btn btn-s" data-rank50="' + p.id + '" '
            + 'title="한참 내려도 안 보이면 누르세요">50+</button></div>'
            + '<div class="mono" style="margin-top:5px">위 [검색해보기] 로 나온 순서입니다.<br>'
            + '<b>한참 내려도 안 보이면 [50+]</b> 를 누르세요.<br>안 적으셔도 됩니다</div></div>'
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
      A.toast('돌려보냈습니다');
      document.querySelectorAll('.rj').forEach(function (c) { c.checked = false; });
      $('rjNote').value = '';
      await A.loadAdmin(); rvBack();
    } catch (e) { A.toast('실패: ' + e.message); }
    this.disabled = false;
  };

  /* ═══ 7 진행 현황 ═══ */
  function pgPicked() {
    return [].map.call(document.querySelectorAll('#pgStatus input:checked'), function (c) { return c.value; });
  }
  var PG_ROWS = [];
  /* 상태 이름이 갈래마다 다릅니다 — 리뷰엔 원고·검수 단계가 없습니다 */
  var PG_BLOG = [['pending','담당자 미정'],['assigned','배정됨'],['writing','쓰는 중'],
    ['submitted','원고 냄'],['rework','다시 쓰기'],['approved','원고 통과'],
    ['published','올림 · 확인 전'],['verified','확인 끝'],['paid','정산 완료']];
  var PG_RV = [['pending','담당자 미정'],['assigned','맡김 · 올리기 전'],
    ['published','올림 · 확인 전'],['verified','확인 끝'],['paid','정산 완료']];

  function renderProgress() {
    var RV = (A.TRACK || 'blog') === 'review';

    var ph = $('pgHead');
    if (ph) ph.innerHTML = RV
      ? '<h1>진행 현황</h1><p>리뷰 한 편이 한 줄입니다. 어디까지 갔는지 보고, 늦는 것을 찾습니다.</p>'
      : '<h1>진행 현황</h1><p>글 한 편이 한 줄입니다. 어디까지 갔는지 보고, 늦는 글을 찾습니다.</p>';

    /* 상태 칩을 갈래에 맞게 다시 그립니다 (고른 것은 그대로 둡니다) */
    var box = $('pgStatus');
    if (box) {
      var want = (RV ? PG_RV : PG_BLOG).map(function (x) { return x[0]; }).join(',');
      if (box.dataset.built !== want) {
        var keep = pgPicked();
        box.innerHTML = '<span class="mono">상태 (여러 개 고를 수 있습니다)</span>'
          + (RV ? PG_RV : PG_BLOG).map(function (x) {
            return '<label class="ck"><input type="checkbox" value="' + x[0] + '"'
              + (keep.indexOf(x[0]) >= 0 ? ' checked' : '') + '> ' + x[1] + '</label>';
          }).join('')
          + '<button class="btn btn-s" id="pgClear">전체 보기</button>';
        box.dataset.built = want;
      }
    }
    if ($('pgQ')) $('pgQ').placeholder = RV
      ? '갈래나 이름으로 찾기' : '검색어나 이름으로 찾기';

    var oid = $('pgOrder').value, sel = pgPicked(), q = ($('pgQ').value || '').trim();
    var rows = POSTS.filter(function (p) {
      /* 지금 보는 갈래 것만 */
      var o = A.ORDERS.filter(function (x) { return x.id === p.order_id; })[0];
      if (!o || ((o.track || 'blog') === 'review') !== RV) return false;
      if (oid && p.order_id !== oid) return false;
      if (sel.length && sel.indexOf(p.status) < 0) return false;
      if (q) {
        var b = A.PEOPLE.filter(function (x) { return x.id === p.blogger_id; })[0];
        var hay = (p.keyword || '') + ' ' + (p.category || '');
        if (hay.indexOf(q) < 0 && (!b || b.name.indexOf(q) < 0)) return false;
      }
      return true;
    });
    PG_ROWS = rows;
    var c = function (s) { return POSTS.filter(function (p) { return (!oid || p.order_id === oid) && p.status === s; }).length; };
    $('pgStats').innerHTML = st(c('pending'), '담당자 미정')
      + st(c('writing') + c('assigned'), '쓰는 중') + st(c('rework'), '돌려보낸 글', c('rework') > 0)
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
          + '<td>' + postLink(p.published_url, '글 보기 ↗') + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      + (rows.length > 300 ? '<div class="mono" style="margin-top:8px">앞의 300개만 보여드립니다. 필터를 좁혀 주세요.</div>' : '')
      : A.empty('해당하는 글이 없습니다.');
  }
  $('pgOrder').onchange = renderProgress;
  $('pgStatus').addEventListener('change', renderProgress);
  $('pgStatus').addEventListener('click', function (e) {
    if (e.target && e.target.id === 'pgClear') {
      document.querySelectorAll('#pgStatus input').forEach(function (c) { c.checked = false; });
      renderProgress();
    }
  });
  /* ⚠️ 「전체 보기」(#pgClear) 는 갈래에 따라 #pgStatus 안에 그때그때 그려집니다.
     그래서 여기서 $('pgClear') 로 직접 붙이면 안 됩니다 — 페이지가 열리는 시점엔
     아직 없는 요소라 null 이고, 거기서 터지면 이 파일의 아래쪽이 통째로 안 돌아갑니다.
     (실제로 그래서 「4 리뷰 만들기 →」 버튼과 주소 모음이 죽어 있었습니다.)
     누르는 것은 바로 위 #pgStatus 위임 처리기가 이미 받고 있습니다. */
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
        p.keyword_rank ? A.rankText(p.keyword_rank) : ''];
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
    RPAY = await A.sel('review_payouts', { eq: { month: m } });
    renderPay();
  }
  function renderPay() {
    /* 정산은 갈래를 안 나눕니다 — 사람이 같으니 한 사람에게 한 번만 보냅니다.
       그래서 여기서만은 블로그와 리뷰가 한 표에 같이 잡힙니다. */
    var ptn = $('payTrackNote');
    if (ptn) ptn.innerHTML = '<b>블로그와 리뷰가 함께 잡힙니다.</b> '
      + '한 사람이 두 가지를 다 했어도 공동체로 한 번만 보내야 하기 때문입니다.';

    var m = $('payMonth').value + '-01';
    var verified = POSTS.filter(function (p) { return p.status === 'verified' && p.cycle_month === m; });
    var blogTotal = CPAY.reduce(function (a, c) { return a + c.amount; }, 0);
    var revTotal = RPAY.reduce(function (a, r) { return a + r.amount; }, 0);
    var total = blogTotal + revTotal;
    var sale = POSTS.filter(function (p) {
      return ['verified', 'paid'].indexOf(p.status) >= 0 && p.cycle_month === m;
    }).reduce(function (a, p) { return a + (p.sale_rate || 0); }, 0);

    $('payStats').innerHTML = st(verified.length, '아직 마감 안 한 글')
      + st(blogTotal, '블로거 지급 (원)') + st(revTotal, '검수 수당 (원)')
      + st(Math.max(0, sale - total), '남는 돈 (원)');

    $('payList').innerHTML = CPAY.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>공동체</th><th>인원</th><th>편수</th><th>블로거 지급</th><th>검수 수당</th>'
      + '<th>실제 이체액</th><th>계좌</th><th>상태</th><th></th></tr></thead><tbody>'
      + CPAY.map(function (c) {
        var cm = A.COMMS.filter(function (x) { return x.id === c.community_id; })[0] || {};
        var rv = Number(c.review_amount) || 0;
        return '<tr class="clickme" data-opencp="' + c.id + '">'
          + '<td><b>' + esc(cm.name || '-') + '</b> <span class="mono">▸ 펼치기</span></td>'
          + '<td class="num">' + c.people_count + '명</td><td class="num">' + c.post_count + '</td>'
          + '<td class="num">' + won(c.amount) + '</td>'
          + '<td class="num">' + (rv ? won(rv) : '<span class="mono">-</span>') + '</td>'
          + '<td class="num"><b>' + won(c.amount + rv) + '</b></td>'
          + '<td class="mono">' + esc([cm.bank_name, cm.bank_no].filter(Boolean).join(' ') || '계좌 미입력') + '</td>'
          + '<td>' + (c.status === 'sent' ? '<span class="chip c-ok">보냈음 ' + A.fdate(c.sent_at) + '</span>'
            : '<span class="chip c-wait">아직 안 보냄</span>') + '</td>'
          + '<td>' + (c.status === 'sent' ? '' : '<button class="btn btn-s" data-send="' + c.id + '">보냄</button>') + '</td></tr>';
      }).join('') + '</tbody></table></div>'
      : A.empty('아직 마감하지 않았습니다. 위에서 [이 달 마감하기]를 눌러 주세요.');

    /* 공동체에 안 속한 검수자 — 개별로 보내야 합니다 */
    var loose = RPAY.filter(function (r) { return !r.community_payout; });
    $('payLoose').innerHTML = loose.length
      ? '<div class="sec">공동체에 안 속한 검수자 <small>' + loose.length
        + '명 · 개별로 이체하셔야 합니다</small></div>'
        + '<div class="tblbox tblscroll"><table><thead><tr>'
        + '<th>이름</th><th>원고 통과</th><th>노출 확인</th><th>수당</th></tr></thead><tbody>'
        + loose.map(function (r) {
          return '<tr><td><b>' + esc(staffName(r.staff_id) || '-') + '</b></td>'
            + '<td class="num">' + r.approve_count + '편</td>'
            + '<td class="num">' + r.verify_count + '편</td>'
            + '<td class="num"><b>' + won(r.amount) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>'
      : '';
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
      + '<tr><td colspan="4" style="text-align:right"><b>블로거 지급 합계</b></td>'
      + '<td class="num"><b>' + won(c.amount) + '</b></td></tr>'
      + '</tbody></table></div>'

      /* 이 공동체에 속한 검수자들의 수당 */
      + (function () {
        var rv = RPAY.filter(function (r) { return r.community_payout === c.id; });
        if (!rv.length) return '';
        return '<div class="sec">검수 수당 <small>이 공동체에서 검수를 맡으신 분들</small></div>'
          + '<div class="tblbox tblscroll"><table><thead><tr>'
          + '<th>이름</th><th>원고 통과</th><th>노출 확인</th><th>수당</th></tr></thead><tbody>'
          + rv.map(function (r) {
            return '<tr><td><b>' + esc(staffName(r.staff_id) || '-') + '</b></td>'
              + '<td class="num">' + r.approve_count + '편</td>'
              + '<td class="num">' + r.verify_count + '편</td>'
              + '<td class="num"><b>' + won(r.amount) + '</b></td></tr>';
          }).join('')
          + '<tr><td colspan="3" style="text-align:right"><b>검수 수당 합계</b></td>'
          + '<td class="num"><b>' + won(rv.reduce(function (a, r) { return a + r.amount; }, 0)) + '</b></td></tr>'
          + '</tbody></table></div>'
          + '<div class="note" style="margin-top:12px">이 공동체로 보낼 <b>실제 이체액</b>은 '
          + '블로거 지급 ' + won(c.amount) + '원 + 검수 수당 ' + won(c.review_amount || 0) + '원 = '
          + '<b>' + won(c.amount + (c.review_amount || 0)) + '원</b> 입니다.</div>';
      })();
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
    assigned: '글 배정', due1: '마감 임박', overdue: '마감 지남', rework: '다시 쓰기',
    payout: '정산 확정', approved: '신청 승인', rejected: '신청 거절', edu_wait: '교육 미이수',
    submitted: '검수할 원고', overdue_admin: '마감 지난 글', unpaid_order: '입금 지연',
    unassigned: '미배정 남음', academy_note: '학원 전달사항', custom: '직접 쓴 알림',
    order_paid: '입금 확인', first_post: '첫 글 올라감', half: '절반 진행', order_done: '전부 완료',
    approved_post: '원고 통과', edu_summary: '교육 요약 올라옴', edu_ok: '교육 이수 확인',
    edu_no: '교육 요약 다시쓰기', photos_added: '학원이 사진 보냄', published: '올라간 글 확인',
    info_changed: '학원 내용 바뀜'
  };
  var KIND_OF = {
    blogger: ['assigned', 'due1', 'overdue', 'rework', 'approved_post', 'payout',
      'approved', 'rejected', 'edu_wait', 'edu_ok', 'edu_no', 'info_changed', 'custom'],
    staff: ['submitted', 'edu_summary', 'overdue_admin', 'unpaid_order', 'unassigned',
      'academy_note', 'photos_added', 'custom'],
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
    ['notiScan', 'notiCopyAll', 'notiSentAll', 'notiTabs', 'notiSendBox'].forEach(function (id) {
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

  /* 직접 써서 보내기 */
  function renderSendPick() {
    var pick = $('nsWho').value === 'blogger-pick';
    $('nsPick').classList.toggle('hide', !pick);
    if (!pick) return;
    var list = A.PEOPLE.filter(function (p) { return p.status === 'approved'; });
    $('nsPeople').innerHTML = list.length ? list.map(function (p) {
      return '<label class="pickrow"><input type="checkbox" class="ns-p" value="' + p.id + '">'
        + '<span><b>' + esc(p.name) + '</b> <span class="mono">' + esc(A.commName(p.community_id)) + '</span></span>'
        + '</label>';
    }).join('') : '<div class="empty">승인된 블로거가 없습니다.</div>';
  }
  $('nsWho').onchange = renderSendPick;

  $('nsGo').onclick = async function () {
    var who = $('nsWho').value;
    var title = $('nsTitle').value.trim(), body = $('nsBody').value.trim();
    if (!title || !body) { A.toast('제목과 내용을 적어 주세요'); return; }
    var ids = null, aud = 'blogger';
    if (who === 'staff') aud = 'staff';
    else if (who === 'blogger-pick') {
      ids = [].map.call(document.querySelectorAll('.ns-p:checked'), function (c) { return c.value; });
      if (!ids.length) { A.toast('받을 사람을 골라 주세요'); return; }
    }
    var target = who === 'staff' ? '우리끼리'
      : ids ? ids.length + '명' : '블로거 전체';
    if (!confirm('「' + title + '」\n\n' + target + '에게 보낼까요?')) return;
    this.disabled = true;
    try {
      var n = await A.rpc('notify_send_custom',
        { p_audience: aud, p_ids: ids, p_title: title, p_body: body });
      A.toast(n + '건을 만들었습니다. 아래 목록에서 복사해 카톡으로도 보내세요');
      $('nsTitle').value = ''; $('nsBody').value = '';
      $('notiSendBox').open = false;
      NOTI_TAB = aud; NOTI_KIND = '';
      await loadNoti(false);
    } catch (e) { A.toast('실패: ' + e.message); }
    this.disabled = false;
  };

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

  /* ═══ 검수자 본인의 정산 ═══ */
  async function renderMyReviewPay() {
    var me = A.SESSION && A.SESSION.user ? A.SESSION.user.id : null;
    if (!me) return;
    var m = A.thisMonth() + '-01';
    var rr = revRate();
    $('rpA').textContent = won(rr.approve); $('rpV').textContent = won(rr.verify);
    $('rpT').textContent = won((Number(rr.approve) || 0) + (Number(rr.verify) || 0));

    /* 이번 달 내가 손댄 글 */
    var mineA = POSTS.filter(function (p) {
      return p.reviewed_by === me && p.cycle_month === m && (p.review_pay || 0) > 0;
    });
    var mineV = POSTS.filter(function (p) {
      return p.verified_by === me && p.cycle_month === m && (p.verify_pay || 0) > 0;
    });
    var sum = mineA.reduce(function (a, p) { return a + (p.review_pay || 0); }, 0)
      + mineV.reduce(function (a, p) { return a + (p.verify_pay || 0); }, 0);
    /* 아직 확인 안 끝난 글은 정산에 안 잡힙니다 */
    var locked = mineA.filter(function (p) {
      return ['verified', 'paid'].indexOf(p.status) < 0;
    }).length;

    $('rpStats').innerHTML = st(mineA.length, '원고 통과시킨 글')
      + st(mineV.length, '올라간 글 확인') + st(sum, '이번 달 수당 (원)')
      + st(locked, '아직 확정 안 된 글', locked > 0);

    $('rpNote').innerHTML = locked
      ? '<div class="note warn" style="margin-bottom:16px">'
      + '<b>글이 「확인 끝」이 되어야 수당이 확정됩니다.</b> 원고를 통과시켰어도 '
      + '블로거가 아직 안 올렸거나 노출 확인이 안 끝난 글이 ' + locked + '편 있습니다.</div>'
      : '';

    var rows = [];
    mineA.forEach(function (p) { rows.push({ p: p, kind: '원고 통과', pay: p.review_pay, at: p.reviewed_at }); });
    mineV.forEach(function (p) { rows.push({ p: p, kind: '노출 확인', pay: p.verify_pay, at: p.verified_at }); });
    rows.sort(function (a, b) { return (b.at || '').localeCompare(a.at || ''); });

    $('rpList').innerHTML = rows.length ? '<div class="tblbox tblscroll"><table>'
      + '<thead><tr><th>한 일</th><th>학원</th><th>검색어</th><th>언제</th><th>상태</th><th>수당</th></tr></thead><tbody>'
      + rows.map(function (r) {
        return '<tr><td>' + (r.kind === '원고 통과'
          ? '<span class="chip c-info">원고 통과</span>' : '<span class="chip c-ok">노출 확인</span>') + '</td>'
          + '<td>' + esc(orderName(r.p.order_id)) + '</td>'
          + '<td>' + esc(r.p.keyword || '') + '</td>'
          + '<td class="mono">' + A.fdate(r.at) + '</td>'
          + '<td>' + A.stChip(r.p.status) + '</td>'
          + '<td class="num"><b>' + won(r.pay) + '</b></td></tr>';
      }).join('') + '</tbody></table></div>'
      : A.empty('이번 달에 검수하신 글이 아직 없습니다.');

    /* 지난달 확정분 */
    var past = await A.sel('review_payouts', { order: 'month', asc: false });
    past = (past || []).filter(function (r) { return r.staff_id === me && r.month !== m; });
    $('rpPast').innerHTML = past.length ? '<div class="sec">지난달</div>'
      + '<div class="tblbox tblscroll"><table><thead><tr>'
      + '<th>기간</th><th>원고 통과</th><th>노출 확인</th><th>수당</th></tr></thead><tbody>'
      + past.map(function (r) {
        return '<tr><td>' + r.month.slice(0, 7).replace('-', '년 ') + '월</td>'
          + '<td class="num">' + r.approve_count + '편</td>'
          + '<td class="num">' + r.verify_count + '편</td>'
          + '<td class="num"><b>' + won(r.amount) + '</b></td></tr>';
      }).join('') + '</tbody></table></div>' : '';
  }

  /* ═══ 🔗 주소 모음 ═══ */
  function baseUrl() {
    return location.origin + location.pathname.replace(/[^/]*$/, '');
  }
  var LINKS = [
    { t: '블로거 모집 · 신청서', d: '블로그를 쓰실 분에게 보내는 주소입니다. 로그인 없이 바로 신청서가 열립니다.',
      u: function () { return baseUrl() + '#signup'; }, who: '새로 모집할 사람에게' },
    { t: '블로그 센터 (여기)', d: '블로거·검수자·관리자가 로그인해서 들어오는 곳입니다.',
      u: function () { return baseUrl(); }, who: '승인된 블로거·직원에게' },
    { t: 'ESC 홈페이지', d: '학원이 의뢰를 넣는 곳입니다. 블로그 홍보 신청도 여기서 받습니다.',
      u: function () { return 'https://intoedu.github.io/hakwon-support/'; }, who: '학원에게' },
    { t: 'ESC 관리자 (의뢰 관리)', d: '인력·컨텐츠·마케팅 의뢰를 관리하고, 직원 권한을 주는 곳입니다.',
      u: function () { return 'https://intoedu.github.io/hakwon-support/admin.html'; }, who: 'ESC 직원만' }
  ];

  function linkRow(title, desc, url, who, extra) {
    return '<div class="card" style="margin-bottom:10px">'
      + '<div class="row" style="justify-content:space-between;align-items:flex-start">'
      + '<div style="min-width:200px"><b style="font-size:14.5px">' + esc(title) + '</b>'
      + (who ? ' <span class="chip c-off">' + esc(who) + '</span>' : '')
      + (desc ? '<div class="mono" style="margin-top:3px">' + esc(desc) + '</div>' : '')
      + (extra || '') + '</div>'
      + '<span style="display:flex;gap:6px;flex-wrap:wrap">'
      + '<button class="btn btn-p btn-s" data-copylink="' + esc(url) + '">📋 복사</button>'
      + '<a class="btn btn-s" href="' + esc(url) + '" target="_blank" rel="noopener">열어보기 ↗</a>'
      + '</span></div>'
      + '<div class="mono" style="margin-top:9px;padding:9px 11px;background:var(--surface-2);'
      + 'border:1px solid var(--line);border-radius:8px;word-break:break-all">' + esc(url) + '</div>'
      + '</div>';
  }

  function renderLinks() {
    $('linkFixed').innerHTML = LINKS.map(function (l) {
      return linkRow(l.t, l.d, l.u(), l.who, '');
    }).join('');

    var q = ($('linkQ').value || '').trim();
    var rows = A.ORDERS.filter(function (o) { return !q || o.academy_name.indexOf(q) >= 0; });
    /* 같은 학원은 주소가 하나 — 학원 이름으로 묶습니다 */
    var seen = {}, uniq = [];
    rows.forEach(function (o) {
      var k = (o.academy_name || '').trim();
      if (seen[k]) { seen[k].qty += o.total_qty; seen[k].n++; return; }
      seen[k] = { o: o, qty: o.total_qty, n: 1 }; uniq.push(seen[k]);
    });

    $('linkOrders').innerHTML = uniq.length ? uniq.map(function (g) {
      return linkRow(g.o.academy_name,
        g.n + '건 주문 · 모두 ' + g.qty + '편' + (g.o.region ? ' · ' + g.o.region : ''),
        statusUrl(g.o), '이 학원에게', '');
    }).join('') : A.empty(q ? '찾는 학원이 없습니다.' : '아직 주문이 없습니다.');
  }
  $('linkQ').oninput = renderLinks;

  /* ═══ 화면 진입 시 ═══ */
  A.onShow = function (name) {
    if (!A.IS_REVIEWER) return;      /* 관리자·검수자 둘 다 true */
    if (name === 'links') renderLinks();
    if (name === 'r-pay') renderMyReviewPay();
    if (name === 'noti') loadNoti(true);
    if (name === 'edu' || name === 'r-edu') loadEdu();
    if (name === 'r-make') { rvFill('rmOrder'); rmPaint(); rvPaintSeen(); }
    if (name === 'r-assign') renderRvAssign();
    if (name === 'r-check') renderRvCheck();
    if (name === 'pay') loadPay();
    if (name === 'review') A.view('acad-list');
    if (name === 'kw' && $('kwOrder').value) { $('kwOrder').onchange(); tpFill(); tpLoad(); }  /* 주문 글감을 자동으로 채웁니다 */
  };

  /* ═══ 동작 ═══ */
  document.addEventListener('click', async function (e) {
    var t;

    if ((t = e.target.closest('[data-openacad]'))) { openAcad(t.dataset.openacad); return; }
    if ((t = e.target.closest('[data-opencomm]'))) { openComm(t.dataset.opencomm); return; }
    if ((t = e.target.closest('[data-opencp]'))) { openCP(t.dataset.opencp); return; }
    if ((t = e.target.closest('[data-mem]'))) {
      var mr = document.querySelector('[data-memrow="' + t.dataset.mem + '"]');
      if (mr) { mr.classList.toggle('hide'); t.textContent = mr.classList.contains('hide') ? '멤버 보기' : '접기'; }
      return;
    }
    if ((t = e.target.closest('[data-gokw]'))) {
      if ((A.TRACK || 'blog') === 'review') {
        var rmo = $('rmOrder'); if (rmo) rmo.value = t.dataset.gokw;
        rmPaint(); A.show('r-make'); return;
      }
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
        A.toast('승인했습니다'); await A.loadAdmin(); rvBack(); }
      catch (err) { A.toast('실패: ' + err.message); t.disabled = false; }
      return;
    }
    /* [50+] — 한참 내려도 안 보이는 경우. 999 로 넣고 숫자 칸은 잠급니다.
       다시 누르면 풀립니다. 비워 두는 것(=아직 안 재봄)과 구분되어야 합니다. */
    /* 블로그 주소 고치기 */
    if ((t = e.target.closest('[data-nidedit]'))) {
      NID_EDIT[t.dataset.nidedit] = true;
      renderStaffAll();
      var f = document.querySelector('[data-nidin="' + t.dataset.nidedit + '"]');
      if (f) { f.focus(); f.select(); }
      return;
    }
    if ((t = e.target.closest('[data-nidcancel]'))) {
      delete NID_EDIT[t.dataset.nidcancel];
      renderStaffAll();
      return;
    }
    if ((t = e.target.closest('[data-nidsave]'))) {
      var nid0 = t.dataset.nidsave;
      var box = document.querySelector('[data-nidin="' + nid0 + '"]');
      if (!box) return;
      var v = A.normNid(box.value);
      if (!A.NID_OK.test(v)) {
        A.toast('네이버 아이디 형식이 아닙니다 — 영문 소문자·숫자·_·- 만, 3~20자');
        return;
      }
      t.disabled = true;
      try {
        await A.rpc('blogger_set_blog', { p_id: nid0, p_nid: v });
        delete NID_EDIT[nid0];
        A.toast('blog.naver.com/' + v + ' 로 고쳤습니다');
        await A.loadAdmin();
      } catch (err) { A.toast('실패: ' + err.message); t.disabled = false; }
      return;
    }

    if ((t = e.target.closest('[data-rank50]'))) {
      var rin = document.querySelector('[data-rank="' + t.dataset.rank50 + '"]');
      if (!rin) return;
      var on = Number(rin.value) >= A.RANK_OUT;
      if (on) {
        rin.value = ''; rin.disabled = false;
        t.classList.remove('btn-a'); t.textContent = '50+';
      } else {
        rin.value = String(A.RANK_OUT); rin.disabled = true;
        t.classList.add('btn-a'); t.textContent = '50+ ✓';
      }
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
        A.toast(ok ? '확인 완료. 이제 정산 대상입니다' : '돌려보낸 것으로 되돌렸습니다');
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
          await A.rpc('blogger_decide', { p_id: id, p_status: act, p_reason: null });
          A.toast(act === 'approved' ? '승인했습니다' : act === 'hold' ? '보류함으로 옮겼습니다'
            : act === 'paused' ? '쉬는 중으로 바꿨습니다' : '대기로 되돌렸습니다');
        }
        await A.loadAdmin();
      } catch (err) { A.toast('실패: ' + err.message); }
      t.disabled = false; return;
    }

    /* 여러 명 한꺼번에 처리 */
    if ((t = e.target.closest('[data-bulk]'))) {
      var ids = pickedApply();
      if (!ids.length) { A.toast('먼저 사람을 골라 주세요'); return; }
      var act = t.dataset.bulk;
      var word = act === 'approved' ? '승인' : act === 'hold' ? '보류'
        : act === 'rejected' ? '거절' : '대기로 되돌리기';
      var why = null;
      if (act === 'rejected') {
        why = prompt('고르신 ' + ids.length + '명 모두에게 같은 사유가 갑니다.\n'
          + '신청한 분 화면에 그대로 보입니다.',
          '블로그를 시작한 지 얼마 되지 않았습니다. 3개월 뒤 다시 신청하실 수 있습니다.');
        if (why === null) return;
        if (!why.trim()) { A.toast('사유를 적어 주세요'); return; }
      } else if (!confirm(ids.length + '명을 ' + word + '할까요?'
        + (act === 'approved' ? '\n\n모두 1단계로 시작하고, 승인 알림이 각자에게 만들어집니다.' : ''))) return;

      var btns = document.querySelectorAll('[data-bulk]');
      btns.forEach(function (b) { b.disabled = true; });
      t.textContent = '처리 중…';
      try {
        var n = await A.rpc('bloggers_decide_many', { p_ids: ids, p_status: act, p_reason: why });
        A.toast(n + '명을 ' + word + '했습니다');
        await A.loadAdmin();
      } catch (err) {
        A.toast('실패: ' + err.message);
        btns.forEach(function (b) { b.disabled = false; });
        t.textContent = word;
      }
      return;
    }

    if ((t = e.target.closest('[data-nbopen]'))) {
      var who = A.PEOPLE.filter(function (x) { return x.id === t.dataset.nbopen; })[0];
      if (who) nbEdit(t.closest('td'), who);
      return;
    }
    /* 신청자에게 보낼 문구를 만들어 복사합니다 — 그대로 문자·카톡에 붙이시면 됩니다 */
    if ((t = e.target.closest('[data-askmsg]'))) {
      var pr = t.dataset.askmsg.split(':'), kind = pr[0];
      var who = A.PEOPLE.filter(function (x) { return x.id === pr[1]; })[0];
      if (!who) return;
      var sign = '\n\n' + (A.SIGN || 'ESC 이은총 드림');
      var txt = kind === 'url'
        ? who.name + '님, 안녕하세요. ESC 학원지원센터입니다.\n'
          + '블로그 신청 감사합니다. 적어 주신 블로그 주소가 열리지 않아 확인 부탁드립니다.\n\n'
          + '적어 주신 주소 : ' + (who.blog_url || '-') + '\n\n'
          + '내 블로그에 들어가셔서 주소창에 보이는 주소를 그대로 보내 주시면 '
          + '저희가 고쳐 넣겠습니다. (blog.naver.com/ 뒤에 오는 부분입니다)\n'
          + '다시 신청하실 필요는 없습니다.' + sign
        : who.name + '님, 안녕하세요. ESC 학원지원센터입니다.\n'
          + '블로그를 열어 보니 이웃 수가 공개로 되어 있지 않아 확인이 어렵습니다.\n\n'
          + '네이버 블로그 앱에서 [내 블로그 → 통계] 로 들어가시면 이웃 수가 보입니다. '
          + '그 화면을 캡처해서 보내 주시면 됩니다.\n'
          + '꼭 필요한 것은 아니니 어려우시면 넘어가셔도 됩니다. '
          + '단계를 올릴 때 참고만 하는 숫자입니다.' + sign;
      navigator.clipboard.writeText(txt).then(function () {
        A.toast('문구를 복사했습니다 — ' + (who.phone || '연락처 없음') + ' 으로 보내세요');
      }, function () { A.toast('복사에 실패했습니다'); });
      return;
    }

    /* 이웃 수 비공개 — 숫자는 비우고 「확인한 때」만 남깁니다.
       그래야 「열어봤는데 안 보이더라」와 「아직 안 열어봤다」가 구분됩니다. */
    if ((t = e.target.closest('[data-nbhide]'))) {
      t.disabled = true;
      try {
        await A.rpc('blogger_set_neighbors', { p_id: t.dataset.nbhide, p_n: null });
        A.toast('비공개로 적어 두었습니다');
        await A.loadAdmin();
      } catch (err) { A.toast('실패: ' + err.message); t.disabled = false; }
      return;
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

    /* 학원이 뒤늦게 보낸 내용을, 이미 글을 맡고 있는 분들에게 알립니다 */
    if ((t = e.target.closest('[data-chgnoti]'))) {
      var wbox = document.querySelector('[data-chgwhat="' + t.dataset.chgnoti + '"]');
      var what = wbox ? wbox.value.trim() : '';
      if (!what) { A.toast('무엇이 바뀌었는지 한 줄 적어 주세요'); wbox && wbox.focus(); return; }
      t.disabled = true;
      try {
        var cnt = await A.rpc('notify_order_changed', {
          p_order: t.dataset.chgnoti, p_what: what
        });
        A.toast(cnt ? cnt + '명에게 알렸습니다' : '지금 이 학원 글을 맡고 있는 분이 없습니다');
        if (cnt) wbox.value = '';
        await loadNoti(false);
      } catch (err) { A.toast('실패: ' + err.message); }
      t.disabled = false; return;
    }

    /* ── 리뷰 확인 ── */
    if ((t = e.target.closest('[data-rvproof]'))) {
      var r0 = await A.sb.storage.from('request-photos')
        .createSignedUrl(t.dataset.rvproof, 3600);
      if (r0.error || !r0.data) { A.toast('캡처를 불러오지 못했습니다'); return; }
      PICS = [{ url: r0.data.signedUrl, path: t.dataset.rvproof }];
      PICORDER = null; PICTAGS = {}; PSHOWN = 0;
      $('picTitle').textContent = '리뷰어가 올린 화면';
      $('picBody').innerHTML = '';
      morePics();
      $('picModal').classList.add('on');
      return;
    }
    if ((t = e.target.closest('[data-rvok]')) || (t = e.target.closest('[data-rvno]'))) {
      var ok = !!t.dataset.rvok;
      var pid = t.dataset.rvok || t.dataset.rvno;
      t.disabled = true;
      try {
        await A.rpc('post_verify', { p_post: pid, p_ok: ok, p_rank: null,
          p_note: ok ? null : '지도에서 리뷰를 찾지 못했습니다. 다시 확인해 주세요.' });
        A.toast(ok ? '확인했습니다' : '다시 올려 달라고 보냈습니다');
        await A.loadAdmin();
      } catch (err) { A.toast('실패: ' + err.message); t.disabled = false; }
      return;
    }

    /* ── 리뷰 주문 ── */
    if ((t = e.target.closest('[data-savemap]'))) {
      var mu = document.querySelector('[data-mapu="' + t.dataset.savemap + '"]');
      t.disabled = true;
      var r = await A.sb.from('blog_orders')
        .update({ map_url: mu && mu.value.trim() ? mu.value.trim() : null })
        .eq('id', t.dataset.savemap).select();
      t.disabled = false;
      if (r.error || !r.data || !r.data.length) { A.toast('저장 실패 (권한 확인 필요)'); return; }
      A.toast('지도 주소를 저장했습니다'); await A.loadAdmin(); return;
    }
    if ((t = e.target.closest('[data-savevisit]'))) {
      var vs = document.querySelector('[data-visit="' + t.dataset.savevisit + '"]');
      t.disabled = true;
      var r2 = await A.sb.from('blog_orders').update({ visit_type: vs ? vs.value : 'visit' })
        .eq('id', t.dataset.savevisit).select();
      t.disabled = false;
      if (r2.error || !r2.data || !r2.data.length) { A.toast('저장 실패'); return; }
      A.toast('저장했습니다'); await A.loadAdmin(); return;
    }
    if ((t = e.target.closest('[data-rvadd]'))) {
      var oid = t.dataset.rvadd;
      var cur = rvCollect(oid); cur.push({ category: '', qty: 0, points: [] });
      document.querySelector('[data-rvspec="' + oid + '"]').innerHTML = rvSpecRows(oid, cur);
      return;
    }
    if ((t = e.target.closest('[data-rvdel]'))) {
      var pr = t.dataset.rvdel.split('_'); var oid2 = pr[0], idx = Number(pr[1]);
      var cur2 = rvCollect(oid2); cur2.splice(idx, 1);
      if (!cur2.length) cur2 = [{ category: '', qty: 0, points: [] }];
      document.querySelector('[data-rvspec="' + oid2 + '"]').innerHTML = rvSpecRows(oid2, cur2);
      return;
    }
    if ((t = e.target.closest('[data-rvsave]'))) {
      var oid3 = t.dataset.rvsave;
      var items = rvCollect(oid3).filter(function (x) { return x.category && x.qty > 0; });
      if (!items.length) { A.toast('갈래와 편수를 채워 주세요'); return; }
      t.disabled = true;
      try {
        var n = await A.rpc('review_specs_set', { p_order: oid3, p_items: items });
        A.toast('리뷰 구성 ' + n + '줄을 저장했습니다');
        await A.loadAdmin();
      } catch (err) { A.toast('실패: ' + err.message); }
      t.disabled = false; return;
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

    if ((t = e.target.closest('[data-openpm]'))) { openPromote(t.dataset.openpm); return; }
    if ((t = e.target.closest('[data-pmrole]'))) { PM.role = t.dataset.pmrole; pmPaint(); return; }

    if ((t = e.target.closest('[data-staffk]'))) {
      var k = t.dataset.staffk;
      if (!k) STAFF_FILTER = [];
      else {
        var i = STAFF_FILTER.indexOf(k);
        if (i >= 0) STAFF_FILTER.splice(i, 1); else STAFF_FILTER.push(k);
      }
      renderBlogStaff(); return;
    }

    /* 담당 공동체 켜고 끄기 */
    if ((t = e.target.closest('[data-setcomm]'))) {
      var wrap = t.closest('[data-commsfor]'), sid = wrap.dataset.commsfor;
      t.classList.toggle('on');
      var picked = [];
      wrap.querySelectorAll('button.on').forEach(function (b) { picked.push(b.dataset.setcomm); });
      try {
        await A.rpc('blog_staff_set_comms', { p_id: sid, p_comms: picked });
        A.toast(picked.length ? '담당 공동체 ' + picked.length + '곳으로 바꿨습니다' : '담당 공동체를 비웠습니다');
        await A.loadAdmin();
      } catch (err) { A.toast('실패: ' + err.message); await A.loadAdmin(); }
      return;
    }

    /* 검수하기 — 학원별 / 공동체별 */
    if ((t = e.target.closest('[data-rvby]'))) { RV_BY = t.dataset.rvby; renderReview(); return; }

    /* 이름을 누르면 그 아래에 신청 내용이 펼쳐집니다 */
    if ((t = e.target.closest('[data-bopen]'))) {
      var bid = t.dataset.bopen;
      var open = document.querySelector('[data-bdet="' + bid + '"]');
      if (open) { open.remove(); return; }
      document.querySelectorAll('.bdetail').forEach(function (el) { el.remove(); });
      var who = A.PEOPLE.filter(function (x) { return x.id === bid; })[0];
      var row = document.querySelector('[data-brow="' + bid + '"]');
      if (who && row) row.insertAdjacentHTML('afterend', bDetailRow(who));
      return;
    }
    /* 그 블로거가 보는 화면으로 넘어갑니다 */
    if ((t = e.target.closest('[data-seeblog]'))) {
      A.PREVIEW_WANT = t.dataset.seeblog;   /* applyView 가 이 사람을 먼저 엽니다 */
      A.applyView('blogger');
      return;
    }

    /* 「이 사람 화면 보기」 — 왼쪽 전환 스위치를 그 사람으로 맞춥니다 */
    if ((t = e.target.closest('[data-seeas]'))) {
      var sid = t.dataset.seeas;
      A.applyView('reviewer');
      var pw = $('previewWho');
      if (pw) { pw.value = sid; A.pickPreview('reviewer', sid); }
      return;
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

    /* 「5번으로 가기」 — 남은 글을 먼저 맡기라고 보낼 때 */
    if ((t = e.target.closest('[data-goassign]'))) {
      var ael = $('asOrder');
      if (ael) { ael.value = t.dataset.goassign; if (ael.onchange) ael.onchange(); }
      A.show('assign');
      return;
    }
    /* 「3번으로 가기」 · 「4번으로 가기」 — 그 주문을 골라 둔 채로 넘어갑니다 */
    if ((t = e.target.closest('[data-gopay]'))) {
      A.show('orders');
      setTimeout(function () {
        var el = document.querySelector('[data-ordercard="' + t.dataset.gopay + '"]');
        if (el) {
          el.scrollIntoView({ block: 'center' });
          el.style.outline = '2px solid var(--amber)'; el.style.outlineOffset = '3px';
        }
      }, 150);
      return;
    }
    if ((t = e.target.closest('[data-gokw2]'))) {
      $('kwOrder').value = t.dataset.gokw2;
      $('kwOrder').onchange();
      A.show('kw');
      return;
    }

    /* 잘못 만들어진 글 지우기 (아직 아무도 안 맡은 것만) */
    if ((t = e.target.closest('[data-delpost]'))) {
      e.preventDefault();
      var dp = POSTS.filter(function (x) { return x.id === t.dataset.delpost; })[0] || {};
      if (!confirm('「' + (dp.keyword || '') + '」\n\n이 글을 지울까요? 되돌릴 수 없습니다.')) return;
      try {
        var dn = await A.rpc('posts_delete', { p_posts: [t.dataset.delpost] });
        A.toast(dn ? '지웠습니다' : '이미 맡긴 글이라 지울 수 없습니다');
        await A.loadAdmin();
      } catch (err) { A.toast('실패: ' + err.message); }
      return;
    }
    if ((t = e.target.closest('#delChecked'))) {
      var sel = picked('pk-post');
      if (!sel.length) { A.toast('지울 글을 체크해 주세요'); return; }
      if (!confirm(sel.length + '편을 지울까요? 되돌릴 수 없습니다.')) return;
      try {
        var dn2 = await A.rpc('posts_delete', { p_posts: sel });
        A.toast(dn2 + '편을 지웠습니다');
        await A.loadAdmin();
      } catch (err) { A.toast('실패: ' + err.message); }
      return;
    }

    /* 학원이 보낸 사진 보기 — 비공개 저장소라 1시간짜리 임시 주소를 만들어 띄웁니다 */
    if ((t = e.target.closest('[data-seepics]'))) {
      var po = A.ORDERS.filter(function (x) { return x.id === t.dataset.seepics; })[0];
      if (!po) return;
      t.disabled = true;
      try { await showPics(po); } catch (err) { A.toast('불러오지 못했습니다: ' + err.message); }
      t.disabled = false;
      return;
    }

    if ((t = e.target.closest('[data-wants]'))) {
      t.disabled = true;
      try {
        await A.rpc('blogger_set_wants_admin',
          { p_id: t.dataset.wants, p_want: t.dataset.on !== '1' });
        await A.loadAdmin();
      } catch (err) { A.toast('실패: ' + err.message); t.disabled = false; }
      return;
    }

    if ((t = e.target.closest('[data-copylink]'))) {
      var lu = t.dataset.copylink;
      try { await navigator.clipboard.writeText(lu); A.toast('주소를 복사했습니다'); }
      catch (err) { window.prompt('아래 주소를 복사해 보내주세요', lu); }
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
    if ((t = e.target.closest('[data-sumok]')) || (t = e.target.closest('[data-sumno]'))) {
      var ok = !!t.dataset.sumok, k = (t.dataset.sumok || t.dataset.sumno).split('|');
      var nt = document.querySelector('[data-sumnote="' + (t.dataset.sumok || t.dataset.sumno) + '"]');
      if (!ok && !confirm('다시 써 달라고 돌려보낼까요?\n블로거에게 알림이 갑니다.')) return;
      t.disabled = true;
      try {
        await A.rpc('training_review', {
          p_material: k[0], p_blogger: k[1], p_ok: ok,
          p_note: nt && nt.value.trim() ? nt.value.trim() : null
        });
        A.toast(ok ? '이수 처리했습니다' : '다시 써 달라고 보냈습니다');
        await loadEdu();
      } catch (err) { A.toast('실패: ' + err.message); t.disabled = false; }
      return;
    }
    if ((t = e.target.closest('[data-saverp]'))) {
      var rp = document.querySelector('[data-rp="' + t.dataset.saverp + '"]');
      t.disabled = true;
      var r = await A.sb.from('training_sessions')
        .update({ replay_url: rp && rp.value.trim() ? rp.value.trim() : null })
        .eq('id', t.dataset.saverp).select();
      t.disabled = false;
      if (r.error || !r.data || !r.data.length) { A.toast('저장 실패 (권한 확인 필요)'); return; }
      A.toast('녹화본 주소를 저장했습니다'); await loadEdu(); return;
    }
    if ((t = e.target.closest('[data-attok]')) || (t = e.target.closest('[data-attno]'))) {
      var ok = !!t.dataset.attok;
      var kk = (t.dataset.attok || t.dataset.attno).split('|');
      t.disabled = true;
      try {
        await A.rpc('training_attend_confirm', { p_session: kk[0], p_blogger: kk[1], p_ok: ok });
        A.toast(ok ? '이수 처리했습니다' : '되돌렸습니다');
        await loadEdu(); await openAttend(kk[0]);
      } catch (err) { A.toast('실패: ' + err.message); t.disabled = false; }
      return;
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
        var now = !a ? '<span class="mono">체크 안 함</span>'
          : a.mode === 'live'
            ? '<span class="chip c-ok">실시간 참석</span>'
              + (a.self_at ? ' <span class="chip">본인 체크</span>' : '')
            : a.mode === 'video'
              ? (a.confirmed_at
                ? '<span class="chip c-ok">녹화본 이수</span>'
                : '<span class="chip c-wait">확인 기다림</span>')
              : '<span class="chip c-bad">결석</span>';
        /* 녹화본으로 봤다고 낸 사람은 요약을 읽고 통과시킵니다 */
        var note = (a && a.mode === 'video' && a.note)
          ? '<div class="note" style="margin-top:7px;font-size:12.5px">'
            + '<b>낸 요약</b> · ' + esc(a.note)
            + (a.confirmed_at ? '' :
              '<div class="row" style="margin-top:8px">'
              + '<button class="btn btn-a btn-s" data-attok="' + sid + '|' + p.id + '">이수 처리</button>'
              + '<button class="btn btn-s" data-attno="' + sid + '|' + p.id + '">다시 보라기</button></div>')
            + '</div>'
          : '';
        return '<tr><td><b>' + esc(p.name) + '</b></td><td>' + esc(A.commName(p.community_id)) + '</td>'
          + '<td>' + now + note + '</td><td><div class="row">'
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
      /* 지금 보고 있는 갈래로 만듭니다 (order_create 는 블로그 기준이라 뒤에서 표시만 바꿉니다) */
      if ((A.TRACK || 'blog') === 'review') {
        var last = await A.sb.from('blog_orders').select('id')
          .eq('academy_name', name).order('created_at', { ascending: false }).limit(1);
        if (last.data && last.data.length) {
          await A.sb.from('blog_orders').update({ track: 'review' }).eq('id', last.data[0].id);
        }
      }
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
      min_chars: Number($('nm_chars').value) || 150,
      check_question: $('nm_q').value.trim() || null, required: $('nm_req').checked,
      sort: MATS.length
    }).select();
    this.disabled = false;
    if (r.error) { A.toast('추가 실패: ' + r.error.message); return; }
    $('nm_title').value = ''; $('nm_url').value = ''; $('nm_q').value = ''; $('nm_chars').value = '';
    A.toast('자료를 올렸습니다'); await loadEdu();
  };

  /* 리뷰 갈래 교육 — 같은 표에 track 만 'review' 로 넣습니다 */
  if ($('btnAddRvSession')) $('btnAddRvSession').onclick = async function () {
    if (!$('rns_at').value) { A.toast('날짜를 넣어 주세요'); return; }
    this.disabled = true;
    var r = await A.sb.from('training_sessions').insert({
      kind: $('rns_kind').value, held_at: new Date($('rns_at').value).toISOString(),
      zoom_url: $('rns_url').value.trim() || null, track: 'review'
    }).select();
    this.disabled = false;
    if (r.error) { A.toast('추가 실패: ' + r.error.message); return; }
    $('rns_url').value = ''; A.toast('리뷰 교육 일정을 추가했습니다'); await loadEdu();
  };
  if ($('btnAddRvMat')) $('btnAddRvMat').onclick = async function () {
    var title = $('rnm_title').value.trim(), url = $('rnm_url').value.trim();
    if (!title || !url) { A.toast('제목과 주소를 넣어 주세요'); return; }
    this.disabled = true;
    var r = await A.sb.from('training_materials').insert({
      title: title, url: url,
      min_chars: Number($('rnm_min').value) || 150,
      check_question: $('rnm_q').value.trim() || null, required: $('rnm_req').checked,
      sort: ALLMATS.length, track: 'review'
    }).select();
    this.disabled = false;
    if (r.error) { A.toast('추가 실패: ' + r.error.message); return; }
    $('rnm_title').value = ''; $('rnm_url').value = ''; $('rnm_q').value = '';
    A.toast('리뷰 교육 자료를 올렸습니다'); await loadEdu();
  };

  document.addEventListener('change', async function (e) {
    /* 신청 목록 — 전체 선택 / 낱개 체크 */
    if (e.target.id === 'bulkAll') {
      var on = e.target.checked;
      document.querySelectorAll('.pk-apply').forEach(function (c) { c.checked = on; });
      refreshBulk();
    }
    if (e.target.classList.contains('pk-apply')) refreshBulk();

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

    /* 블로거 병행 체크 */
    if (e.target.dataset && e.target.dataset.also) {
      try {
        await A.rpc('blogger_set_also', { p_id: e.target.dataset.also, p_also: e.target.checked });
        A.toast(e.target.checked ? '글도 받게 했습니다' : '글은 안 받게 했습니다');
        await A.loadAdmin();
      } catch (err) { A.toast('실패: ' + err.message); await A.loadAdmin(); }
    }
  });
  /* ESC 직원 신청·직분은 홈페이지 관리자 페이지에서 다룹니다 */
  ['goEscStaff', 'goEscStaff2'].forEach(function (id) {
    var b = $(id);
    if (b) b.onclick = function () {
      window.open('https://intoedu.github.io/hakwon-support/admin.html#staff', '_blank', 'noopener');
    };
  });

  $('picClose').onclick = function () { $('picModal').classList.remove('on'); };
  $('picModal').onclick = function (e) { if (e.target === this) this.classList.remove('on'); };

  $('fName').oninput = renderList;
  $('fComm').onchange = renderList;
  $('fLevel').onchange = renderList;
})(window.ESC);
