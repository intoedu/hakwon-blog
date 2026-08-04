/* 블로거 화면 */
(function (A) {
  'use strict';
  var $ = A.$, esc = A.esc, won = A.won;
  var MY = [], SESS = [], MATS = [], MINE = [], ATT = [], PAY = [], NOTI = [], CUR = null;
  var PREVIEW = false;   /* 관리자가 블로거 화면을 들여다보는 중이면 true */

  /* 관리자가 「블로거」로 전환했을 때 — 그 사람 눈으로 보이는 화면을 그대로 그립니다.
     보기만 되고 버튼은 잠급니다. (서버도 남의 글은 못 건드리게 막혀 있습니다) */
  A.loadBloggerPreview = async function (id) {
    var who = A.PEOPLE.filter(function (x) { return x.id === id; })[0];
    if (!who) { A.toast('블로거를 고르세요'); return; }
    PREVIEW = true; A.ME = who; CUR = null;
    A.$('previewName').textContent = who.name;

    var r = await A.sb.from('blog_posts')
      .select('*, blog_orders(academy_name,region,info_pack,academy_url,photo_paths,photo_note)')
      .eq('blogger_id', id).order('due_date');
    MY = (r.data || []).map(function (x) {
      var o = x.blog_orders || {}; delete x.blog_orders;
      return Object.assign(x, o);
    });
    SESS = await A.sel('training_sessions', { order: 'held_at' });
    MATS = await A.sel('training_materials_public', { order: 'sort' });
    MINE = await A.sel('training_progress', { eq: { blogger_id: id } });
    ATT = await A.sel('training_attendance', { eq: { blogger_id: id } });
    PAY = await A.sel('blog_payouts', { eq: { blogger_id: id }, order: 'month', asc: false });
    NOTI = await A.sel('notifications', { eq: { blogger_id: id }, order: 'created_at', asc: false });

    renderInbox(); renderEdu(); renderWork(); renderPay();
    A.openApp('b-inbox');
    lockPreview();
  };

  /* 미리보기에서는 손대지 못하게 잠급니다 */
  function lockPreview() {
    if (!PREVIEW) return;
    ['b-inbox', 'b-edu', 'b-work', 'b-pay'].forEach(function (s) {
      document.querySelectorAll('.screen[data-screen="' + s + '"] button,'
        + ' .screen[data-screen="' + s + '"] input,'
        + ' .screen[data-screen="' + s + '"] textarea,'
        + ' .screen[data-screen="' + s + '"] select').forEach(function (el) {
          if (el.id === 'workPick') return;    /* 글 넘겨보기는 되게 둡니다 */
          el.disabled = true;
        });
    });
  }
  A.afterBloggerRender = lockPreview;

  A.loadBlogger = async function () {
    PREVIEW = false;
    MY = await A.sel('my_posts', { order: 'due_date' });
    SESS = await A.sel('training_sessions', { order: 'held_at' });
    MATS = await A.sel('training_materials_public', { order: 'sort' });
    MINE = await A.sel('training_progress');
    ATT = await A.sel('training_attendance');
    PAY = await A.sel('blog_payouts', { order: 'month', asc: false });
    NOTI = await A.sel('notifications', { order: 'created_at', asc: false });
    renderInbox(); renderEdu(); renderWork(); renderPay();
  };

  /* 안 읽은 알림 — 작업함 맨 위에 뜹니다 */
  function renderNoti() {
    var box = $('bNoti'); if (!box) return;
    var unread = NOTI.filter(function (n) { return !n.read_at; });
    if (!unread.length) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="sec">새 소식 <small>' + unread.length + '건</small>'
      + '<button class="link" style="float:right" id="bNotiRead">모두 읽음</button></div>'
      + unread.slice(0, 8).map(function (n) {
        return '<div class="card" style="margin-bottom:8px">'
          + '<b style="font-size:14px">' + esc(n.title) + '</b>'
          + '<span class="mono" style="margin-left:8px">' + A.fdt(n.created_at) + '</span>'
          + '<pre style="white-space:pre-wrap;font:inherit;font-size:13px;line-height:1.65;'
          + 'margin:8px 0 0;color:var(--ink-2)">' + esc(n.body) + '</pre>'
          + (n.link ? '<div style="margin-top:9px"><button class="btn btn-s" data-go="'
            + esc(n.link) + '">바로 가기 →</button></div>' : '')
          + '</div>';
      }).join('')
      + (unread.length > 8 ? '<div class="mono">앞의 8건만 보여드립니다.</div>' : '');

    $('bNotiRead').onclick = async function () {
      this.disabled = true;
      try { await A.rpc('notify_read'); NOTI.forEach(function (n) { n.read_at = 'x'; }); renderNoti(); }
      catch (e) { A.toast('실패: ' + e.message); }
    };
  }

  function ready() {
    var req = MATS.filter(function (m) { return m.required; });
    var done = req.filter(function (m) {
      return MINE.some(function (g) { return g.material_id === m.id; });
    }).length;
    var t1 = SESS.filter(function (s) { return s.kind === 't1'; }).map(function (s) { return s.id; });
    var att1 = ATT.some(function (a) { return t1.indexOf(a.session_id) >= 0 && ['live', 'video'].indexOf(a.mode) >= 0; });
    return { videoDone: done, videoNeed: req.length, t1: att1, ok: done >= req.length && att1 };
  }

  function renderInbox() {
    var r = ready();
    var lv = A.levelOf(A.ME.level);
    var todo = MY.filter(function (p) {
      return ['assigned', 'writing', 'rework', 'approved'].indexOf(p.status) >= 0;
    });
    var monthDone = MY.filter(function (p) {
      return ['verified', 'paid'].indexOf(p.status) >= 0 && p.cycle_month === A.thisMonth() + '-01';
    });

    renderNoti();
    $('bhWho').textContent = A.ME.name + ' 님, 반갑습니다.';
    $('bStats').innerHTML =
      s(todo.length, '지금 할 일') + s(monthDone.length, '이번 달 끝낸 글')
      + s(A.ME.level + '단계', '내 단계 (편당 ' + won(lv.rate) + '원)')
      + s(won(monthDone.reduce(function (a, p) { return a + (p.payout_rate || 0); }, 0)), '이번 달 받을 돈 (원)');

    $('bGate').innerHTML = r.ok ? '' :
      '<div class="note warn" style="margin-bottom:18px"><b>아직 교육이 안 끝났습니다.</b> '
      + '1차 교육 참석' + (r.t1 ? ' <span style="color:var(--ok)">✓</span>' : ' <b style="color:var(--bad)">미완</b>')
      + ' · 필수 영상 ' + r.videoDone + '/' + r.videoNeed
      + '. 다 마치셔야 글이 배정됩니다. <button class="link" data-go="b-edu">교육 받으러 가기 →</button></div>';

    $('bTodo').innerHTML = todo.length ? todo.map(function (p) {
      var d = A.dday(p.due_date);
      var late = d != null && d <= 0;
      var label = p.status === 'approved' ? '올리고 주소 넣기'
        : p.status === 'rework' ? '고치러 가기' : '글 쓰러 가기';
      return '<div class="job' + (late ? ' due' : '') + '"><div>'
        + '<h4>' + esc(p.keyword || '') + '</h4>'
        + '<div class="meta">' + esc(p.academy_name) + ' · ' + won(p.payout_rate) + '원 · '
        + (p.status === 'rework'
          ? '<b style="color:var(--bad)">수정 요청 — ' + esc((p.reject_reasons || []).join(', ')) + '</b>'
          : A.ST[p.status] ? A.ST[p.status][0] : p.status) + '</div></div>'
        + '<div class="right">'
        + '<span class="dday' + (late ? '' : ' calm') + '">' + (p.due_date || '-')
        + (d != null ? (d < 0 ? ' 지남' : d === 0 ? ' 오늘' : ' D-' + d) : '') + '</span>'
        + '<button class="btn btn-a btn-s" data-open="' + p.id + '">' + label + '</button></div></div>';
    }).join('') : A.empty(r.ok ? '지금 맡으신 글이 없습니다. 배정되면 여기에 뜹니다.' : '교육을 마치면 글이 배정됩니다.');

    var next = A.LEVELS.filter(function (l) { return l.lv === A.ME.level + 1; })[0];
    $('bLevel').innerHTML = '<div class="card"><div class="row" style="gap:14px">'
      + '<span class="lv' + (A.ME.level >= 5 ? ' l5' : A.ME.level === 4 ? ' l4' : '')
      + '" style="width:34px;height:34px;font-size:15px">' + A.ME.level + '</span>'
      + '<div style="flex:1"><b style="font-size:15px">' + A.ME.level + '단계 · ' + esc(lv.name) + '</b> '
      + '<span class="mono">편당 ' + won(lv.rate) + '원</span>'
      + '<div class="mono" style="margin-top:4px">'
      + (next ? '다음은 ' + next.lv + '단계(' + esc(next.name) + ' · 편당 ' + won(next.rate) + '원)입니다. '
        + '글을 꾸준히 쓰고 한 번에 통과되면 올라갑니다.' : '가장 높은 단계입니다.')
      + '</div></div></div>'
      + '<div class="note warn" style="margin-top:14px"><b>하루에 한 편만 올려 주세요.</b> '
      + '몰아서 올리면 블로그가 광고 블로그로 찍혀 검색에 안 나오게 됩니다. 그러면 내 블로그가 손해입니다.</div></div>';
  }
  function s(n, label) {
    return '<div class="stat"><b>' + (typeof n === 'number' ? won(n) : esc(n)) + '</b><span>' + label + '</span></div>';
  }

  function renderEdu() {
    var r = ready();
    $('bEduState').innerHTML = '<div class="card"><div class="steps">'
      + '<div class="step done">승인</div>'
      + '<div class="step ' + (r.t1 ? 'done' : 'now') + '">1차 줌</div>'
      + '<div class="step ' + (r.videoDone >= r.videoNeed && r.videoNeed ? 'done' : r.t1 ? 'now' : '') + '">영상 보기</div>'
      + '<div class="step ' + (r.ok ? 'now' : '') + '">첫 글 1편</div>'
      + '<div class="step">2차 줌</div></div>'
      + '<div class="note" style="margin-top:15px">'
      + (r.ok ? '<b>교육을 마치셨습니다.</b> 이제 글이 배정됩니다. 첫 글을 쓰시면 2차 줌에서 같이 보면서 피드백해 드립니다.'
        : '<b>1차 줌 참석과 필수 영상 시청</b>을 마치셔야 글이 배정됩니다. '
        + '지금 영상은 ' + r.videoDone + '/' + r.videoNeed + ' 보셨습니다.')
      + '<br><br><b>첫 글도 연습이 아니라 진짜 일입니다.</b> 학원이 돈을 낸 주문이고, 통과되면 정상적으로 지급됩니다.</div></div>';

    var future = SESS.filter(function (x) { return new Date(x.held_at) >= new Date(Date.now() - 864e5); });
    $('bEduSessions').innerHTML = future.length ? future.map(function (x) {
      var a = ATT.filter(function (y) { return y.session_id === x.id; })[0];
      return '<div class="job"><div><h4>' + (x.kind === 't1' ? '1차 교육 (줌)' : '2차 교육 (줌) — 내가 쓴 글 피드백') + '</h4>'
        + '<div class="meta">' + A.fdt(x.held_at) + ' · 약 1시간'
        + (a ? ' · <b style="color:var(--ok)">' + (a.mode === 'live' ? '참석 확인됨' : '녹화본으로 이수') + '</b>' : '') + '</div></div>'
        + '<div class="right">'
        + (x.zoom_url ? '<a class="btn btn-a btn-s" href="' + esc(x.zoom_url) + '" target="_blank" rel="noopener">줌 링크 ↗</a>' : '')
        + '</div></div>';
    }).join('') : A.empty('아직 잡힌 일정이 없습니다. 정해지면 알려드립니다.');

    $('bEduMats').innerHTML = MATS.length ? '<div class="matlist">' + MATS.map(function (m) {
      var done = MINE.some(function (g) { return g.material_id === m.id; });
      return '<div class="mat"><div class="thumb">▶</div><div style="flex:1;min-width:150px">'
        + '<h4>' + esc(m.title) + (m.required ? ' <span class="chip c-bad">필수</span>' : '') + '</h4>'
        + '<div class="meta">' + (m.minutes ? m.minutes + '분 · ' : '')
        + (done ? '<span style="color:var(--ok)">이수 완료</span>' : '<span style="color:var(--wait)">아직 안 보셨습니다</span>')
        + '</div></div>'
        + '<a class="btn btn-s" href="' + esc(m.url) + '" target="_blank" rel="noopener">보기 ↗</a>'
        + (done || !m.needs_code ? (done ? '' : '<button class="btn btn-a btn-s" data-watch="' + m.id + '">봤습니다</button>')
          : '<input class="inp" style="width:100px" data-code="' + m.id + '" placeholder="이수 코드">'
          + '<button class="btn btn-a btn-s" data-watch="' + m.id + '">확인</button>')
        + '</div>';
    }).join('') + '</div>' : A.empty('아직 올라온 영상이 없습니다.');
  }

  function renderWork() {
    if (!CUR) CUR = MY.filter(function (p) {
      return ['assigned', 'writing', 'rework', 'approved'].indexOf(p.status) >= 0;
    })[0];
    if (!CUR) { $('bWork').innerHTML = A.empty('지금 쓸 글이 없습니다. 배정되면 작업함에 뜹니다.'); return; }
    var p = MY.filter(function (x) { return x.id === CUR.id; })[0] || CUR;
    CUR = p;

    var head = '<div class="card" style="margin-bottom:16px">'
      + '<div class="row" style="justify-content:space-between;margin-bottom:12px"><div>'
      + '<h3 style="font-size:16.5px">' + esc(p.keyword || '') + '</h3>'
      + '<div class="mono" style="margin-top:3px">' + esc(p.academy_name) + ' · '
      + (p.due_date || '-') + '까지 · ' + won(p.payout_rate) + '원</div></div>'
      + A.stChip(p.status) + '</div>'
      + (p.status === 'rework' ? '<div class="note bad" style="margin-bottom:12px"><b>고쳐야 할 것</b><br>'
        + (p.reject_reasons || []).map(function (r) { return '· ' + esc(r); }).join('<br>')
        + (p.review_note ? '<br><br>' + esc(p.review_note) : '') + '</div>' : '')
      + '<dl class="kv">'
      + '<dt>제목에 꼭 넣을 말</dt><dd><b>' + esc(p.keyword || '') + '</b></dd>'
      + '<dt>이 글이 다룰 것</dt><dd>' + esc(p.brief || '-') + '</dd>'
      + '<dt>지역</dt><dd>' + esc(p.region || '-') + '</dd>'
      + '</dl>'
      + photoBlock(p)
      + (p.info_pack ? '<label class="f">정보 박스 — 글에 그대로 붙여넣으세요</label>'
        + '<textarea class="inp" id="ipk" readonly>' + esc(p.info_pack) + '</textarea>'
        + '<div class="row" style="margin-top:8px"><button class="btn btn-s" id="btnCopyPack">정보팩 복사</button>'
        + (p.academy_url ? '<a class="btn btn-s" href="' + esc(p.academy_url) + '" target="_blank" rel="noopener">학원 홈페이지 ↗</a>' : '')
        + '</div>' : '')
      + '</div>';

    var form = '<div class="sec">이 순서대로 쓰시면 됩니다</div><div class="formdoc">'
      + '<div class="fh">노란 <span class="mine">직접</span> 표시가 있는 세 곳만 직접 쓰세요. 나머지는 붙여넣기입니다</div>'
      + fl('제목', '25~35자 · 정해준 검색어를 앞쪽에<br><span style="color:var(--ink)">예) ' + esc(p.keyword || '') + ' 정리</span>')
      + fl('도입', '3~4줄 · 검색한 사람 상황으로 시작', true)
      + fl('사진 1', '건물 바깥이나 간판')
      + fl('본문 1', '4~6줄 · 위에서 정해준 내용으로', true)
      + fl('사진 2~3', '')
      + fl('본문 2', '4~6줄 · <b style="color:var(--ink)">숫자와 이름을 꼭 넣기</b> (한 반 8명 / 주 3회 90분)', true)
      + fl('사진 4~5', '')
      + fl('정보 박스', '위의 [정보팩 복사] 눌러서 그대로 붙여넣기')
      + fl('지도', '네이버 지도에서 학원 검색해서 넣기 · 30초')
      + fl('마무리', '2줄 + 학원 홈페이지 링크 1개')
      + fl('태그', '7~10개')
      + fl('광고 표기', '맨 아래 한 줄 — 정보팩에 들어 있습니다')
      + '</div>'
      + '<div class="grid g2" style="margin-top:14px">'
      + '<div class="card"><label class="f">분량</label><div style="font-size:20px;font-weight:750">1,200~1,500자</div></div>'
      + '<div class="card"><label class="f">사진</label><div style="font-size:20px;font-weight:750">5~8장</div></div></div>'
      + '<div class="note warn" style="margin-top:14px"><b>가보지 않은 걸 가본 것처럼 쓰면 안 됩니다.</b> '
      + '"상담받고 왔어요"가 아니라 <b>"찾는 분들을 위해 정리해봤습니다"</b> 로 써 주세요.</div>';

    var act;
    if (p.status === 'approved') {
      act = '<div class="sec">원고가 통과됐습니다 — 이제 올리시면 됩니다</div><div class="card">'
        + '<div class="note" style="margin-bottom:14px"><b>올리기 전에 확인해 주세요.</b><br>'
        + '· 오늘 이미 다른 글을 올리셨다면 내일 올려 주세요 (하루 한 편)<br>'
        + '· 제목에 <b>' + esc(p.keyword || '') + '</b> 이 들어갔는지<br>'
        + '· 맨 아래 광고 표기가 있는지</div>'
        + '<label class="f">올린 글 주소</label>'
        + '<input class="inp" id="pubUrl" placeholder="https://blog.naver.com/…">'
        + '<div class="row" style="margin-top:14px"><button class="btn btn-a" id="btnPublish">다 올렸습니다</button>'
        + '<span class="mono">확인이 끝나야 돈으로 잡힙니다</span></div></div>'
        + '<div class="note warn" style="margin-top:14px"><b>올린 글은 1년 동안 지우지 말아 주세요.</b> '
        + '학원이 그 기간만큼 값을 치른 것이라, 중간에 지우면 정산을 되돌려야 합니다.</div>';
    } else {
      act = '<div class="sec">다 쓰셨으면</div><div class="card">'
        + '<label class="f">구글 문서 링크</label>'
        + '<input class="inp" id="docUrl" value="' + esc(p.content_url || '') + '" placeholder="https://docs.google.com/…">'
        + '<div class="note warn" style="margin-top:10px"><b>링크만 보내면 저희가 못 엽니다.</b><br>'
        + '문서 오른쪽 위 <b>[공유]</b> → 아래쪽 <b>"제한됨"</b>을 눌러 '
        + '<b>"링크가 있는 모든 사용자"</b>로 바꿔 주세요.<br>'
        + '이걸 안 하시면 저희 화면에 <b>권한 요청</b>만 뜨고, 검수가 그만큼 늦어집니다.</div>'
        + '<label class="row" style="gap:8px;margin-top:10px;cursor:pointer;font-size:13.5px">'
        + '<input type="checkbox" id="docShared"> '
        + '<span><b>공유 설정을 “링크가 있는 모든 사용자”로 바꿨습니다</b></span></label>'
        + '<div style="margin-top:12px"><label class="f">남길 말 (안 쓰셔도 됩니다)</label>'
        + '<input class="inp" id="docMemo" value="' + esc(p.memo || '') + '"></div>'
        + '<div class="row" style="margin-top:14px"><button class="btn btn-a" id="btnSubmit">원고 내기</button>'
        + '<span class="mono">아직 블로그에 올리지 마세요. 통과된 다음에 올립니다</span></div></div>';
    }

    var pick = MY.filter(function (x) {
      return ['assigned', 'writing', 'rework', 'approved'].indexOf(x.status) >= 0;
    });
    var picker = pick.length > 1 ? '<div class="row" style="margin-bottom:14px">'
      + '<label class="f" style="margin:0">쓸 글 고르기</label>'
      + '<select class="inp" id="workPick" style="width:auto;flex:1;min-width:200px">'
      + pick.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === p.id ? ' selected' : '') + '>'
          + esc(x.keyword || '') + ' (' + (A.ST[x.status] ? A.ST[x.status][0] : x.status) + ')</option>';
      }).join('') + '</select></div>' : '';

    $('bWork').innerHTML = picker + head + form + act;

    if ($('workPick')) $('workPick').onchange = function () {
      CUR = MY.filter(function (x) { return x.id === this.value; }.bind(this))[0]; renderWork();
    };
    if ($('btnCopyPack')) $('btnCopyPack').onclick = function () {
      navigator.clipboard.writeText(p.info_pack || '').then(function () { A.toast('정보팩을 복사했습니다'); });
    };
    if ($('btnSubmit')) $('btnSubmit').onclick = async function () {
      var u = $('docUrl').value.trim();
      if (!/^https?:\/\//.test(u)) { A.toast('구글 문서 링크를 넣어 주세요'); return; }
      if (!$('docShared').checked) {
        A.toast('공유 설정을 바꾸셨는지 확인하고 체크해 주세요');
        $('docShared').closest('label').style.color = 'var(--bad)';
        return;
      }
      this.disabled = true;
      try {
        await A.rpc('post_submit', { p_post: p.id, p_url: u, p_memo: $('docMemo').value.trim() || null });
        A.toast('냈습니다. 하루 안에 결과를 알려드립니다');
        await A.loadBlogger(); A.show('b-inbox');
      } catch (e) { A.toast('실패: ' + e.message); this.disabled = false; }
    };
    if ($('btnPublish')) $('btnPublish').onclick = async function () {
      var u = $('pubUrl').value.trim();
      if (!/^https?:\/\//.test(u)) { A.toast('올린 글 주소를 넣어 주세요'); return; }
      this.disabled = true;
      try {
        await A.rpc('post_publish', { p_post: p.id, p_url: u, p_proof: null });
        A.toast('등록했습니다. 확인이 끝나면 정산에 잡힙니다');
        await A.loadBlogger(); A.show('b-inbox');
      } catch (e) { A.toast('실패: ' + e.message); this.disabled = false; }
    };
    lockPreview();          /* 글을 넘겨봐도 계속 잠겨 있게 */
  }
  /* 글마다 다른 사진이 가도록 순번으로 잘라 줍니다 (같은 사진이 여러 블로그에 겹치면
     중복으로 감지될 수 있어서 조합을 달리합니다) */
  function myPhotos(p) {
    var all = p.photo_paths || [];
    if (!all.length) return [];
    var per = Math.min(8, Math.max(5, Math.floor(all.length / 6) || 5));
    var start = ((p.seq || 1) - 1) * per % all.length;
    var out = [];
    for (var i = 0; i < Math.min(per, all.length); i++) out.push(all[(start + i) % all.length]);
    return out;
  }
  function photoBlock(p) {
    var mine = myPhotos(p);
    if (!mine.length) {
      return p.photo_note
        ? '<div class="note" style="margin:12px 0"><b>사진</b> — 학원이 링크로 주셨습니다.<br>'
        + '<a href="' + esc(p.photo_note) + '" target="_blank" rel="noopener">' + esc(p.photo_note) + ' ↗</a></div>'
        : '<div class="note warn" style="margin:12px 0"><b>사진이 아직 없습니다.</b> '
        + '직접 찍으신 사진(교재·시간표·안내문 등)을 5장 이상 넣어 주세요.</div>';
    }
    return '<div style="margin:12px 0"><label class="f">이 글에 쓸 사진 ' + mine.length + '장</label>'
      + '<div class="mono" style="margin-bottom:8px">글마다 다른 사진이 가도록 나눠 뒀습니다. '
      + '다른 분과 같은 사진을 쓰면 검색에 안 걸릴 수 있으니 받으신 것만 쓰세요.</div>'
      + '<button class="btn btn-a btn-s" data-getpics="' + p.id + '">사진 ' + mine.length + '장 받기</button>'
      + '<div id="picBox" style="margin-top:10px"></div></div>';
  }

  function fl(label, desc, mine) {
    return '<div class="formline"><div class="lb' + (mine ? ' me' : '') + '">' + label
      + (mine ? ' <span class="mine">직접</span>' : '') + '</div><div class="ds">' + desc + '</div></div>';
  }

  function renderPay() {
    var m = A.thisMonth() + '-01';
    var thisM = MY.filter(function (p) {
      return ['verified', 'paid'].indexOf(p.status) >= 0 && p.cycle_month === m;
    });
    var lv = A.levelOf(A.ME.level);
    $('bPayStats').innerHTML = s(thisM.length, '이번 달 확정 편수')
      + s(lv.rate, '내 단계 단가 (원)')
      + s(thisM.reduce(function (a, p) { return a + (p.payout_rate || 0); }, 0), '이번 달 받을 돈 (원)')
      + s(MY.filter(function (p) { return ['verified', 'paid'].indexOf(p.status) >= 0; }).length, '지금까지 쓴 글');

    var rows = MY.filter(function (p) { return p.published_at || p.status === 'rework'; });
    $('bPayList').innerHTML =
      '<div class="note" style="margin-bottom:14px">돈은 <b>' + esc(A.commName(A.ME.community_id))
      + '로 한 번에 보내집니다.</b> 공동체에서 나눠 받으시면 됩니다. 보통 다음 달 10일쯤입니다.</div>'
      + (rows.length ? '<div class="tblbox tblscroll"><table>'
        + '<thead><tr><th>글</th><th>올린 날</th><th>상태</th><th>노출</th><th>금액</th></tr></thead><tbody>'
        + rows.map(function (p) {
          var pay = ['verified', 'paid'].indexOf(p.status) >= 0;
          return '<tr' + (p.status === 'rework' ? ' class="sent"' : '') + '>'
            + '<td>' + esc(p.keyword || '') + '</td>'
            + '<td class="mono">' + (p.published_at ? A.fdate(p.published_at) : '아직') + '</td>'
            + '<td>' + A.stChip(p.status) + '</td>'
            + '<td class="num">' + (p.keyword_rank ? p.keyword_rank + '위' : '-') + '</td>'
            + '<td class="num">' + (pay ? '<b>' + won(p.payout_rate) + '</b>' : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : A.empty('아직 올린 글이 없습니다.'))
      + (PAY.length ? '<div class="sec">지난달</div><div class="tblbox tblscroll"><table>'
        + '<thead><tr><th>기간</th><th>편수</th><th>금액</th></tr></thead><tbody>'
        + PAY.map(function (b) {
          return '<tr><td>' + b.month.slice(0, 7).replace('-', '년 ') + '월</td>'
            + '<td class="num">' + b.post_count + '</td><td class="num"><b>' + won(b.amount) + '</b></td></tr>';
        }).join('') + '</tbody></table></div>' : '');
  }

  document.addEventListener('click', async function (e) {
    var t = e.target.closest('[data-open]');
    if (t && !A.IS_ADMIN) {
      CUR = MY.filter(function (x) { return x.id === t.dataset.open; })[0];
      renderWork(); A.show('b-work'); return;
    }
    var g = e.target.closest('[data-getpics]');
    if (g) {
      var post = MY.filter(function (x) { return x.id === g.dataset.getpics; })[0];
      if (!post) return;
      g.disabled = true; g.textContent = '불러오는 중…';
      var paths = myPhotos(post);
      var r = await A.sb.storage.from('request-photos').createSignedUrls(paths, 3600);
      g.disabled = false; g.textContent = '사진 ' + paths.length + '장 받기';
      if (r.error) { A.toast('사진을 불러오지 못했습니다: ' + r.error.message); return; }
      var box = A.$('picBox');
      box.innerHTML = '<div class="row" style="gap:10px">'
        + r.data.map(function (x, i) {
          if (!x.signedUrl) return '';
          return '<a href="' + x.signedUrl + '" target="_blank" rel="noopener" download '
            + 'style="display:block;width:96px"><img src="' + x.signedUrl
            + '" style="width:96px;height:72px;object-fit:cover;border-radius:6px;border:1px solid var(--line)">'
            + '<span class="mono">' + (i + 1) + '번</span></a>';
        }).join('') + '</div>'
        + '<div class="mono" style="margin-top:8px">사진을 눌러 저장하세요. 링크는 1시간 동안 유효합니다.</div>';
      return;
    }
    var w = e.target.closest('[data-watch]');
    if (w) {
      var el = document.querySelector('[data-code="' + w.dataset.watch + '"]');
      w.disabled = true;
      try {
        await A.rpc('training_watch', { p_material: w.dataset.watch, p_code: el ? el.value.trim() : '' });
        A.toast('이수 처리했습니다'); await A.loadBlogger();
      } catch (err) { A.toast(err.message); w.disabled = false; }
    }
  });
})(window.ESC);
