/* 블로거 화면 */
(function (A) {
  'use strict';
  var $ = A.$, esc = A.esc, won = A.won;
  var MY = [], SESS = [], MATS = [], MINE = [], ATT = [], PAY = [], NOTI = [], CUR = null;
  var PREVIEW = false;   /* 관리자가 블로거 화면을 들여다보는 중이면 true */

  /* ── 갈래(블로그 / 리뷰) ──
     한 사람이 블로그도 쓰고 리뷰도 올릴 수 있습니다. 그래서 받아온 것은 통째로 두고
     (ALL_*), 지금 고른 갈래 것만 걸러서 화면에 씁니다.
     교육도 갈래마다 따로라서 서버 판정(blogger_ready(id, track))과 같은 기준으로 거릅니다. */
  var ALL_MY = [], ALL_SESS = [], ALL_MATS = [];
  function TK() { return A.isRv() ? 'review' : 'blog'; }
  function ofTrack(list) {
    var t = TK();
    return (list || []).filter(function (x) { return (x.track || 'blog') === t; });
  }
  function applyTrack() {
    MY = ofTrack(ALL_MY); SESS = ofTrack(ALL_SESS); MATS = ofTrack(ALL_MATS);
    CUR = null;                       /* 갈래가 바뀌면 보고 있던 글은 다른 갈래 것입니다 */
  }
  /* 갈래를 바꾸면 core.js 가 불러 줍니다 */
  A.afterBloggerTrack = function () {
    if (!A.ME) return;
    applyTrack();
    renderInbox(); renderEdu(); renderWork(); renderPay();
    lockPreview();
  };

  /* 내 작업함 맨 위의 [📝 블로그] [⭐ 리뷰] — 관리자 사이드바의 것과 같은 data-track 을 씁니다 */
  function renderTrackSw() {
    var box = $('bTrackSw'); if (!box) return;
    var nB = ALL_MY.filter(function (p) { return (p.track || 'blog') === 'blog'; }).length;
    var nR = ALL_MY.filter(function (p) { return (p.track || 'blog') === 'review'; }).length;
    box.innerHTML = '<div class="tracksw" style="margin-bottom:16px">'
      + '<button data-track="blog"' + (A.isRv() ? '' : ' class="on"') + '>📝 블로그'
      + (nB ? ' <b>' + nB + '</b>' : '') + '</button>'
      + '<button data-track="review"' + (A.isRv() ? ' class="on"' : '') + '>⭐ 리뷰'
      + (nR ? ' <b>' + nR + '</b>' : '') + '</button></div>';
  }

  /* 글쓰기 화면에 남겨 두는 상태.
     ⚠️ 예전엔 submitted 가 빠져 있어서 **원고를 내는 순간 글이 화면에서 사라졌습니다.**
     검수 중인지 통과됐는지 볼 데가 없어져 「주소 넣는 곳을 못 찾겠다」가 됩니다. */
  var WORKST = ['assigned', 'writing', 'rework', 'submitted', 'approved', 'published'];

  /* 관리자가 「블로거」로 전환했을 때 — 그 사람 눈으로 보이는 화면을 그대로 그립니다.
     보기만 되고 버튼은 잠급니다. (서버도 남의 글은 못 건드리게 막혀 있습니다) */
  A.loadBloggerPreview = async function (id) {
    var who = A.PEOPLE.filter(function (x) { return x.id === id; })[0];
    if (!who) { A.toast('블로거를 고르세요'); return; }

    /* 자기 자신을 고른 것이면 미리보기가 아니라 「내 블로거 화면」입니다 — 잠그지 않습니다.
       관리자가 블로거를 병행할 때 자기 글을 실제로 쓰고 낼 수 있어야 하니까요.
       (서버는 my_posts 뷰와 RPC 가 전부 auth.uid() 기준이라 남의 것은 어차피 못 건드립니다) */
    if (A.SESSION && A.SESSION.user && id === A.SESSION.user.id) {
      A.ME = who; CUR = null;
      A.$('previewBar').classList.add('hide');
      A.$('meRole').textContent = '내 블로거 화면';
      await A.loadBlogger();          /* PREVIEW 를 false 로 되돌리고 진짜 내 것을 읽습니다 */
      A.openApp('b-inbox');
      return;
    }

    PREVIEW = true; A.ME = who; CUR = null;
    A.$('previewName').textContent = who.name;

    /* ⚠️ 미리보기는 my_posts 뷰가 아니라 blog_posts 를 직접 읽습니다(남의 것을 봐야 하므로).
       그래서 뷰가 붙여 주던 **소재와 태그를 여기서 따로 가져와야** 합니다 —
       안 그러면 관리자 눈에는 「이 글에서 다룰 이야기」가 통째로 빠져 보입니다. */
    var r = await A.sb.from('blog_posts')
      .select('*, blog_orders(academy_name,region,info_pack,academy_url,photo_paths,photo_note,'
        + 'photo_tags,track,map_url,visit_type,tags),'
        + 'blog_topics(title,body,subject,tags)')
      .eq('blogger_id', id).order('due_date');
    ALL_MY = (r.data || []).map(function (x) {
      var o = x.blog_orders || {}; delete x.blog_orders;
      var t = x.blog_topics || {}; delete x.blog_topics;
      Object.assign(x, o);
      x.topic_title = t.title; x.topic_body = t.body;
      x.topic_subject = t.subject; x.topic_tags = t.tags;
      return x;
    });
    ALL_SESS = await A.sel('training_sessions', { order: 'held_at' });
    ALL_MATS = await A.sel('training_materials_public', { order: 'sort' });
    MINE = await A.sel('training_progress', { eq: { blogger_id: id } });
    ATT = await A.sel('training_attendance', { eq: { blogger_id: id } });
    PAY = await A.sel('blog_payouts', { eq: { blogger_id: id }, order: 'month', asc: false });
    NOTI = await A.sel('notifications', { eq: { blogger_id: id }, order: 'created_at', asc: false });

    applyTrack();
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
          /* 갈래 고르기(블로그/리뷰)도 잠그면 안 됩니다 — 무엇을 바꾸는 버튼이 아니라
             무엇을 볼지 고르는 칸입니다. 잠가 두면 관리자가 리뷰어 화면을 못 봅니다. */
          if (el.closest && el.closest('#bTrackSw')) return;
          /* ⚠️ 사진 보기·받기도 잠그면 안 됩니다 — 무엇을 바꾸는 게 아니라 보는 것입니다.
             잠가 두어서 관리자가 블로거 화면에서 사진을 못 보고 ZIP 도 못 받았습니다. */
          if (el.matches && el.matches('[data-getpics],[data-zippics]')) return;
          el.disabled = true;
        });
    });
  }
  A.afterBloggerRender = lockPreview;

  A.loadBlogger = async function () {
    PREVIEW = false;
    ALL_MY = await A.sel('my_posts', { order: 'due_date' });
    ALL_SESS = await A.sel('training_sessions', { order: 'held_at' });
    ALL_MATS = await A.sel('training_materials_public', { order: 'sort' });
    MINE = await A.sel('training_progress');
    ATT = await A.sel('training_attendance');
    PAY = await A.sel('blog_payouts', { order: 'month', asc: false });
    NOTI = await A.sel('notifications', { order: 'created_at', asc: false });
    applyTrack();
    renderInbox(); renderEdu(); renderWork(); renderPay();
  };

  /* 글을 많이 받고 싶은지 본인이 켭니다 — 켠 사람에게 먼저 배정됩니다 */
  function renderWants() {
    var box = $('bWants'); if (!box) return;
    var on = !!A.ME.wants_more;
    box.innerHTML = '<div class="card" style="margin-bottom:18px">'
      + '<div class="row" style="justify-content:space-between;gap:12px">'
      + '<div style="min-width:220px;flex:1">'
      + '<b style="font-size:14.5px">글을 더 받고 싶으신가요?</b>'
      + '<div class="mono" style="margin-top:4px;line-height:1.6">'
      + '켜두시면 <b>글이 남을 때 먼저 배정</b>해 드립니다. 켠 분들끼리는 '
      + '<b>이번 달 적게 받은 순서</b>로 돌아가니 한 사람에게 몰리지 않습니다.<br>'
      + '언제든 끄실 수 있고, 꺼도 글이 아예 안 오는 것은 아닙니다.</div></div>'
      + '<button class="btn ' + (on ? 'btn-a' : '') + '" id="bWantsBtn">'
      + (on ? '★ 많이 받는 중 — 끄기' : '많이 받고 싶어요') + '</button>'
      + '</div></div>';

    $('bWantsBtn').onclick = async function () {
      if (PREVIEW) { A.toast('미리보기에서는 바꿀 수 없습니다'); return; }
      this.disabled = true;
      try {
        var v = await A.rpc('blogger_set_wants', { p_want: !on });
        A.ME.wants_more = v;
        A.toast(v ? '많이 받는 것으로 해두었습니다' : '평소대로 받습니다');
        renderWants();
      } catch (e) { A.toast('실패: ' + e.message); this.disabled = false; }
    };
  }

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

  /* 이수는 「요약을 내고 → 관리자가 통과시킨 것」만 인정합니다.
     내기만 한 것(waiting)은 아직 이수가 아닙니다. */
  function progOf(id) {
    return MINE.filter(function (g) { return g.material_id === id; })[0] || null;
  }
  function ready() {
    var req = MATS.filter(function (m) { return m.required; });
    var done = req.filter(function (m) {
      var g = progOf(m.id); return g && g.status === 'approved';
    }).length;
    var wait = req.filter(function (m) {
      var g = progOf(m.id); return g && g.status === 'submitted';
    }).length;
    var t1 = SESS.filter(function (s) { return s.kind === 't1'; }).map(function (s) { return s.id; });
    var att1 = ATT.some(function (a) { return t1.indexOf(a.session_id) >= 0 && ['live', 'video'].indexOf(a.mode) >= 0; });
    /* ⚠️ 1차 줌을 배정 조건에서 뺄 수 있습니다 (관리자 설정).
       서버 blogger_ready 와 같은 규칙이어야 화면과 실제가 어긋나지 않습니다. */
    var needT1 = (A.FORM || {}).require_t1 !== false;
    return {
      videoDone: done, videoWait: wait, videoNeed: req.length,
      t1: att1, needT1: needT1,
      ok: done >= req.length && (!needT1 || att1)
    };
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

    var W = A.WORDS(), RV = A.isRv();

    renderNoti();
    renderWants();
    renderTrackSw();
    $('bhWho').textContent = A.ME.name + ' 님, 반갑습니다.';
    $('bStats').innerHTML =
      s(todo.length, '지금 할 일') + s(monthDone.length, '이번 달 끝낸 ' + W.what)
      + s(A.ME.level + '단계', '내 단계 (' + rateLabel(lv) + ')')
      + s(won(monthDone.reduce(function (a, p) { return a + (p.payout_rate || 0); }, 0)), '이번 달 받을 돈 (원)');

    $('bGate').innerHTML = r.ok ? '' :
      '<div class="note warn" style="margin-bottom:18px"><b>아직 '
      + (RV ? '리뷰어 교육' : '교육') + '이 안 끝났습니다.</b> '
      + (r.needT1
        ? '1차 교육 참석' + (r.t1 ? ' <span style="color:var(--ok)">✓</span>' : ' <b style="color:var(--bad)">미완</b>') + ' · '
        : '')
      + '필수 영상 ' + r.videoDone + '/' + r.videoNeed
      + '. 다 마치셔야 ' + A.josa(W.what, '이') + ' 배정됩니다. '
      + '<button class="link" data-go="b-edu">' + (RV ? '리뷰어 교육' : '교육') + ' 받으러 가기 →</button></div>';

    /* 통과됐고 **오늘 올릴 날**인 글만 맨 위에 띄웁니다.
       예정일이 아직 안 온 글까지 「올려 주세요」라고 하면 혼란만 줍니다.

       ⚠️ 리뷰는 흐름이 다릅니다 — 검수(approved) 단계가 아예 없고, 대신 **올릴 시각**
       (write_at)이 정해져 있습니다. 그래서 「지금 올릴 것 / 시각을 기다리는 것」으로 가릅니다. */
    var today = A.today();
    if (RV) { renderRvTodo(todo); return renderLevelBox(lv); }
    var pub = todo.filter(function (p) {
      return p.status === 'approved' && (!p.publish_on || p.publish_on <= today);
    });
    var soon = todo.filter(function (p) {
      return p.status === 'approved' && p.publish_on && p.publish_on > today;
    });
    $('bTodo').innerHTML = (pub.length
      ? '<div class="note ok" style="margin-bottom:14px"><b>오늘 올릴 글이 ' + pub.length + '편 있습니다.</b><br>'
      + '올리신 뒤에 <b>「2 글 쓰기」 3번 칸</b>에서 <b>올린 글 주소</b>를 넣어 주셔야 정산에 잡힙니다. '
      + '올리기만 하고 주소를 안 넣으시면 저희가 알 수 없습니다.<br>'
      + '<span class="mono">' + pub.map(function (p) { return esc(p.keyword || ''); }).join(' · ') + '</span></div>'
      : '')
      + (soon.length
      ? '<div class="note" style="margin-bottom:14px"><b>원고가 통과됐고 올릴 날을 기다리는 글이 '
      + soon.length + '편 있습니다.</b> 그날이 되면 올리시면 됩니다.<br>'
      + '<span class="mono">' + soon.map(function (p) {
          return esc(p.publish_on) + ' · ' + esc(p.keyword || '');
        }).join(' / ') + '</span></div>'
      : '')
      + (todo.length ? todo.map(function (p) {
      /* 통과된 글은 「원고 마감」이 아니라 「올릴 날」을 보여줘야 합니다 */
      var showDate = (p.status === 'approved' && p.publish_on) ? p.publish_on : p.due_date;
      var d = A.dday(showDate);
      var late = d != null && d <= 0 && p.status !== 'approved';
      var label = p.status === 'approved'
        ? (p.publish_on && p.publish_on > today ? '내용 미리 보기' : '올리고 주소 넣기')
        : p.status === 'rework' ? '고치러 가기' : '글 쓰러 가기';
      return '<div class="job' + (late ? ' due' : '') + '"><div>'
        + '<h4>' + esc(p.keyword || '') + '</h4>'
        + '<div class="meta">' + esc(p.academy_name) + ' · ' + won(p.payout_rate) + '원 · '
        + (p.status === 'rework'
          ? '<b style="color:var(--bad)">다시 쓰기 — ' + esc((p.reject_reasons || []).join(', ')) + '</b>'
          : A.ST[p.status] ? A.ST[p.status][0] : p.status) + '</div></div>'
        + '<div class="right">'
        + '<span class="dday' + (late ? '' : ' calm') + '">'
        + (p.status === 'approved' && p.publish_on ? '올릴 날 ' : '') + (showDate || '-')
        + (d != null ? (d < 0 ? ' 지남' : d === 0 ? ' 오늘' : ' D-' + d) : '') + '</span>'
        + '<button class="btn btn-a btn-s" data-open="' + p.id + '">' + label + '</button></div></div>';
    }).join('') : A.empty(r.ok ? '지금 맡으신 글이 없습니다. 배정되면 여기에 뜹니다.' : '교육을 마치면 글이 배정됩니다.'));

    renderLevelBox(lv);
  }

  /* 내 단계 상자 — 블로그·리뷰가 같이 씁니다 (단계와 단가는 갈래를 안 가립니다) */
  function renderLevelBox(lv) {
    var next = A.LEVELS.filter(function (l) { return l.lv === A.ME.level + 1; })[0];
    var RV = A.isRv();
    $('bLevel').innerHTML = '<div class="card"><div class="row" style="gap:14px">'
      + '<span class="lv' + (A.ME.level >= 5 ? ' l5' : A.ME.level === 4 ? ' l4' : '')
      + '" style="width:34px;height:34px;font-size:15px">' + A.ME.level + '</span>'
      + '<div style="flex:1"><b style="font-size:15px">' + A.ME.level + '단계 · ' + esc(lv.name) + '</b> '
      + '<span class="mono">' + rateLabel(lv) + '</span>'
      + '<div class="mono" style="margin-top:4px">'
      /* ⚠️ 다음 단계 단가를 그냥 숫자로 적으면 안 됩니다 — settings.levels 는 프리미엄 학원
         기준이라, 일반 학원 글(2배)을 받는 사람에겐 「지금 2,000원인데 다음 단계가 1,500원」
         처럼 **승급하면 줄어드는 것처럼** 보입니다. 배수는 학원마다 다르고 블로거는 판매가를
         못 읽으므로, 학원과 무관하게 늘 맞는 **비율**로 말합니다. */
      + (next
        ? '다음은 ' + next.lv + '단계(' + esc(next.name) + ')입니다. '
          + (lv.rate ? '<b>지금보다 편당 '
              + (Math.round(next.rate / lv.rate * 100) / 100) + '배</b>를 받습니다. ' : '')
          + (RV ? '리뷰를 제때 올리고 확인이 잘 되면 올라갑니다.'
                : '글을 꾸준히 쓰고 한 번에 통과되면 올라갑니다.')
        : '가장 높은 단계입니다.')
      + '<br><b>단계는 블로그·리뷰가 같이 씁니다.</b>'
      + (myRates().length > 1
        ? '<br><b>학원에 따라 편당 단가가 다릅니다.</b> 글마다 정해진 값은 「2 '
          + (RV ? '리뷰 올리기' : '글 쓰기') + '」에서 보실 수 있습니다.'
        : '')
      + '</div></div></div>'
      + (RV
        ? '<div class="note warn" style="margin-top:14px"><b>정해 드린 시각에 올려 주세요.</b><br>'
        + '같은 가게 리뷰가 한꺼번에 올라가면 바로 티가 납니다. '
        + '그래서 날짜와 <b>시각까지</b> 벌려 두었습니다.</div></div>'
        : '<div class="note warn" style="margin-top:14px"><b>' + dailyRule() + '</b><br>'
        + '몰아서 올리면 블로그가 광고 블로그로 찍혀 검색에 안 나오게 됩니다. '
        + '그러면 내 블로그가 손해입니다. <b>글마다 올릴 날을 정해 드리니 그날 올리시면 됩니다.</b>'
        + '</div></div>');
  }

  /* 리뷰 할 일 — 검수 단계가 없고 「올릴 시각」이 기준입니다 */
  function renderRvTodo(todo) {
    var now = new Date();
    var nowT = todo.filter(function (p) { return !p.write_at || new Date(p.write_at) <= now; });
    var later = todo.filter(function (p) { return p.write_at && new Date(p.write_at) > now; });
    $('bTodo').innerHTML = (nowT.length
      ? '<div class="note ok" style="margin-bottom:14px"><b>지금 올리실 리뷰가 '
      + nowT.length + '건 있습니다.</b><br>'
      + '올리신 뒤에 <b>「2 리뷰 올리기」 3번 칸</b>에 <b>화면 캡처</b>를 올려 주셔야 정산에 잡힙니다. '
      + '네이버 리뷰는 글마다 주소가 없어서 캡처가 유일한 증거입니다.<br>'
      + '<span class="mono">' + nowT.map(function (p) {
          return esc((p.academy_name || '') + ' · ' + (p.category || ''));
        }).join(' / ') + '</span></div>'
      : '')
      + (later.length
      ? '<div class="note" style="margin-bottom:14px"><b>올릴 시각을 기다리는 리뷰가 '
      + later.length + '건 있습니다.</b> 그 시각이 되면 올리시면 됩니다.<br>'
      + '<span class="mono">' + later.map(function (p) {
          return A.fdt(p.write_at) + ' · ' + esc(p.academy_name || '');
        }).join(' / ') + '</span></div>'
      : '')
      + (todo.length ? todo.map(function (p) {
      var wa = p.write_at ? new Date(p.write_at) : null;
      var waiting = wa && wa > now;
      return '<div class="job"><div>'
        + '<h4>' + esc(p.category || p.keyword || '리뷰') + '</h4>'
        + '<div class="meta">' + esc(p.academy_name || '') + ' · ' + won(p.payout_rate) + '원 · '
        + (A.ST[p.status] ? A.ST[p.status][0] : p.status) + '</div></div>'
        + '<div class="right">'
        + '<span class="dday' + (waiting ? ' calm' : '') + '">'
        + (wa ? A.fdt(p.write_at) : '시각 미정') + '</span>'
        + '<button class="btn btn-a btn-s" data-open="' + p.id + '">'
        + (waiting ? '내용 미리 보기' : '올리러 가기') + '</button></div></div>';
    }).join('') : A.empty('지금 맡으신 리뷰가 없습니다. 배정되면 여기에 뜹니다.'));
  }
  /* ⚠️ 단계 단가(settings.levels)는 **프리미엄 회원 학원 기준**입니다.
     일반 회원 학원 글은 두 배가 나가는데, 화면엔 「편당 1,000원」이라 적혀 있고
     받을 돈은 2,000원으로 떠서 헷갈렸습니다. 맡은 글의 실제 단가로 말합니다.
     (판매가는 블로거가 못 읽으므로 배수를 계산할 수 없습니다 — 자기 글 값을 씁니다) */
  function myRates() {
    var r = {};
    MY.forEach(function (p) { if (p.payout_rate) r[p.payout_rate] = 1; });
    return Object.keys(r).map(Number).sort(function (a, b) { return a - b; });
  }
  function rateLabel(lv) {
    var rs = myRates();
    if (!rs.length) return '편당 ' + won(lv.rate) + '원부터';
    if (rs.length === 1) return '편당 ' + won(rs[0]) + '원';
    return '편당 ' + won(rs[0]) + '~' + won(rs[rs.length - 1]) + '원';
  }

  function s(n, label) {
    return '<div class="stat"><b>' + (typeof n === 'number' ? won(n) : esc(n)) + '</b><span>' + label + '</span></div>';
  }

  function renderEdu() {
    var r = ready();
    var W = A.WORDS(), RV = A.isRv();
    /* ⚠️ 교육은 갈래마다 따로입니다. 블로그 교육을 다 들으셨어도 리뷰는 리뷰 교육을
       마치셔야 배정됩니다 (서버도 blogger_ready(id, track) 로 같게 봅니다). */
    $('bEduState').innerHTML = '<div class="card"><div class="steps">'
      + '<div class="step done">승인</div>'
      + (r.needT1 ? '<div class="step ' + (r.t1 ? 'done' : 'now') + '">1차 줌</div>' : '')
      + '<div class="step ' + (r.videoDone >= r.videoNeed && r.videoNeed ? 'done'
          : (!r.needT1 || r.t1) ? 'now' : '') + '">영상 보기</div>'
      + '<div class="step ' + (r.ok ? 'now' : '') + '">첫 ' + W.what + ' 1건</div>'
      + '<div class="step">2차 줌</div></div>'
      + '<div class="note" style="margin-top:15px">'
      + '<b>지금 보시는 것은 ' + (RV ? '⭐ 리뷰어 교육' : '📝 블로그 교육') + '입니다.</b> '
      + '위 작업함에서 갈래를 바꾸시면 다른 교육이 나옵니다.<br><br>'
      + (r.ok ? '<b>' + A.josa(W.edu, '을') + ' 마치셨습니다.</b> 이제 ' + A.josa(W.what, '이') + ' 배정됩니다.'
        + (RV ? ' 리뷰는 저희가 본문까지 써서 드립니다. 그대로 올리시면 됩니다.'
              : ' 첫 글을 쓰시면 2차 줌에서 같이 보면서 피드백해 드립니다.')
        : '<b>' + (r.needT1 ? '1차 줌 참석과 필수 영상 요약' : '필수 영상 요약')
        + '</b>을 마치셔야 ' + A.josa(W.what, '이') + ' 배정됩니다. '
        + '지금 영상은 ' + r.videoDone + '/' + r.videoNeed + ' 이수하셨습니다.'
        + (r.videoWait ? ' <b style="color:var(--wait)">' + r.videoWait
          + '건은 요약을 내셨고 담당자 확인을 기다리는 중입니다.</b>' : ''))
      + (RV ? '' : '<br><br><b>첫 글도 연습이 아니라 진짜 일입니다.</b> 학원이 돈을 낸 주문이고, 통과되면 정상적으로 지급됩니다.')
      + '</div></div>';

    /* 지난 회차도 남겨 둡니다 — 못 오신 분이 녹화본으로 이수해야 하니까요 */
    $('bEduSessions').innerHTML = SESS.length
      ? SESS.slice().reverse().map(sessRow).join('')
      : A.empty('아직 잡힌 ' + (RV ? '리뷰어 교육 ' : '') + '일정이 없습니다. 정해지면 알려드립니다.');

    $('bEduMats').innerHTML = MATS.length
      ? '<div class="matlist">' + MATS.map(matRow).join('') + '</div>'
      : A.empty('아직 올라온 ' + (RV ? '리뷰어 교육 ' : '') + '영상이 없습니다.');
    if (OPEN) openPlayer(OPEN, true);
  }

  /* ══ 교육 영상 ══
     예전에는 「봤습니다」 버튼 하나로 끝나서 안 보고도 누를 수 있었습니다.
     지금은 ① 이 페이지 안에서 영상이 재생되고 ② 실제로 본 시간을 재고
     ③ 요약을 직접 써서 내면 ④ 관리자·검수자가 읽고 통과시켜야 이수됩니다. */
  var PASTED = {}, PASTETXT = {}, OPEN = null, TICK = null;

  /* ── 붙여넣기 표시 ──
     ⚠️ 예전엔 한 번 붙여넣으면 **영영 표시가 남았습니다.** 지우고 손으로 다시 써도
     빨간 글씨가 그대로라 「고쳤는데도 안 없어진다」가 됐습니다(사용자 신고).
     이제 붙여넣은 글 조각을 기억해 두고, **그 조각이 칸에 아직 남아 있을 때만** 표시합니다.
     통째로 지우고 새로 쓰시면 사라집니다.
     띄어쓰기를 지운 뒤 20글자 창으로 훑기 때문에, 몇 글자 고치는 것으로는 안 없어집니다. */
  function noSpace(t) { return (t || '').replace(/\s+/g, ''); }
  function pasteLeft(id) {
    var ta = $('sum-' + id);
    if (!ta) return !!PASTED[id];
    var frags = PASTETXT[id] || [];
    if (!frags.length) return !!PASTED[id];      /* 붙여넣은 내용을 못 잡았으면 표시를 유지합니다 */
    var cur = noSpace(ta.value), W = 20;
    return frags.some(function (f) {
      var n = noSpace(f);
      if (!n) return false;
      if (n.length <= W) return cur.indexOf(n) >= 0;
      for (var i = 0; i + W <= n.length; i++) {
        if (cur.indexOf(n.slice(i, i + W)) >= 0) return true;
      }
      return false;
    });
  }
  var SEEN = {};        /* 영상id → { 초: 1 } — 실제로 재생된 "서로 다른 초"만 셉니다 */
  var DUR = {};         /* 영상id → 실제 길이(초). 유튜브가 알려줍니다 */
  var PLAYER = null;    /* 지금 열려 있는 유튜브 플레이어 */
  var LOOSE = {};       /* 유튜브 API가 안 뜨면 화면에 띄워둔 시간으로 대신 잽니다 */

  /* 「본 시간」은 화면을 켜 둔 시간이 아니라 **실제로 재생된 구간**입니다.
     0.5초마다 재생 위치를 찍어 초 단위로 모으므로,
     ① 틀어놓고 자리를 비우면 → 재생 중이 아니면 안 셉니다
     ② 막대를 끝으로 끌면   → 지나친 구간은 안 찍혀서 안 셉니다 */
  function skey(id) { return 'esc_seen_' + (A.ME ? A.ME.id : '') + '_' + id; }
  function seenOf(id) {
    if (!SEEN[id]) {
      SEEN[id] = {};
      try {
        (JSON.parse(localStorage.getItem(skey(id)) || '[]') || [])
          .forEach(function (s) { SEEN[id][s] = 1; });
      } catch (e) { /* 사파리 시크릿 모드 */ }
    }
    return SEEN[id];
  }
  function watched(id) { return Object.keys(seenOf(id)).length; }
  function markSec(id, sec) {
    var s = seenOf(id);
    if (s[sec]) return false;
    s[sec] = 1;
    try { localStorage.setItem(skey(id), JSON.stringify(Object.keys(s).map(Number))); } catch (e) { }
    return true;
  }

  /* 유튜브 조작용 스크립트를 한 번만 불러옵니다 */
  var YT_WAIT = [];
  function ytApi(cb) {
    if (window.YT && window.YT.Player) { cb(); return; }
    YT_WAIT.push(cb);
    if (document.getElementById('ytapi')) return;
    var s = document.createElement('script');
    s.id = 'ytapi';
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = function () { YT_WAIT.splice(0).forEach(function (f) { f('fail'); }); };
    document.head.appendChild(s);
    window.onYouTubeIframeAPIReady = function () {
      YT_WAIT.splice(0).forEach(function (f) { f(); });
    };
    setTimeout(function () { YT_WAIT.splice(0).forEach(function (f) { f('fail'); }); }, 6000);
  }

  function mountPlayer(id, vid) {
    ytApi(function (fail) {
      if (OPEN !== id) return;
      if (fail || !window.YT || !window.YT.Player) { LOOSE[id] = true; paint(id); return; }
      try {
        PLAYER = new YT.Player('ytp-' + id, {
          videoId: vid,
          playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
          events: {
            onReady: function (e) { DUR[id] = Math.round(e.target.getDuration() || 0); paint(id); },
            onStateChange: function () { paint(id); }
          }
        });
      } catch (e) { LOOSE[id] = true; paint(id); }
    });
  }
  function killPlayer() {
    if (PLAYER && PLAYER.destroy) { try { PLAYER.destroy(); } catch (e) { } }
    PLAYER = null;
  }
  var ytId = A.ytId;      /* 주소에서 영상 id 뽑기 — 썸네일과 같은 것을 씁니다 (core.js) */
  function mmss(s) {
    s = Math.max(0, Math.round(s));
    return Math.floor(s / 60) + '분 ' + ('0' + (s % 60)).slice(-2) + '초';
  }
  /* 봐야 하는 최소 시간 — 유튜브가 알려준 실제 길이를 먼저 쓰고, 없으면 등록된 분수로 */
  function fullSec(m) { return DUR[m.id] || (m.minutes ? m.minutes * 60 : 0); }
  function needSec(m) { return Math.round(fullSec(m) * 0.7); }
  function matOf(id) { return MATS.filter(function (m) { return m.id === id; })[0]; }

  function matRow(m) {
    var g = progOf(m.id);
    var st = g ? g.status : '';
    var tag = st === 'approved' ? '<span style="color:var(--ok)">이수 완료</span>'
      : st === 'submitted' ? '<span style="color:var(--wait)">요약 냄 · 확인 기다리는 중</span>'
        : st === 'rejected' ? '<b style="color:var(--bad)">다시 써 주세요</b>'
          : '<span style="color:var(--wait)">아직 안 보셨습니다</span>';
    return '<div class="mat">' + A.ytThumb(m.url) + '<div style="flex:1;min-width:150px">'
      + '<h4>' + esc(m.title) + (m.required ? ' <span class="chip c-bad">필수</span>' : '') + '</h4>'
      + '<div class="meta">' + (m.minutes ? m.minutes + '분 · ' : '') + tag + '</div></div>'
      + (st === 'approved' ? '<span class="chip c-ok">✓</span>'
        : '<button class="btn btn-a btn-s" data-play="' + m.id + '">'
        + (OPEN === m.id ? '접기' : st === 'rejected' ? '다시 하기' : '영상 보고 요약 쓰기') + '</button>')
      + '</div>'
      + '<div class="matopen" id="mo-' + m.id + '"></div>';
  }

  /* 영상 + 요약 칸을 그 자리에서 펼칩니다 */
  function openPlayer(id, keep) {
    var m = matOf(id); if (!m) return;
    if (OPEN && OPEN !== id) { var old = $('mo-' + OPEN); if (old) old.innerHTML = ''; }
    OPEN = id;
    var g = progOf(id), vid = ytId(m.url), box = $('mo-' + id);
    if (!box) return;

    box.innerHTML =
      (vid
        ? '<div class="ytwrap" id="mp-' + id + '"><div id="ytp-' + id + '"></div></div>'
        + '<div class="mono" style="margin-top:6px">여기서 바로 보시면 됩니다. '
        + '<b>재생하는 동안만 시간이 올라갑니다</b> — 틀어놓고 자리를 비우거나 '
        + '막대를 끝으로 끌면 올라가지 않습니다.</div>'
        : '<div class="note warn" id="mp-' + id + '">유튜브 영상이 아니라 여기서 바로 못 틉니다. '
        + '<a href="' + esc(m.url) + '" target="_blank" rel="noopener">자료 열기 ↗</a></div>')
      + '<div id="wt-' + id + '" class="wbar"></div>'
      + (g && g.status === 'rejected' && g.review_note
        ? '<div class="note bad" style="margin-top:12px"><b>다시 써 달라는 이유</b><br>' + esc(g.review_note) + '</div>' : '')
      + (m.check_question
        ? '<div style="margin-top:14px"><label class="f">확인 질문 — ' + esc(m.check_question) + '</label>'
        + '<input class="inp" id="ans-' + id + '" value="' + esc(g && g.answer || '') + '" placeholder="영상에서 들은 대로 적어 주세요"></div>' : '')
      + '<div style="margin-top:14px"><label class="f">본 내용을 요약해 주세요 '
      + '<small>' + (m.min_chars || 150) + '자 이상</small></label>'
      + '<textarea class="inp" id="sum-' + id + '" rows="6" '
      + 'placeholder="무엇을 배웠는지, 내 글에 어떻게 쓸지 내 말로 적어 주세요.">' + esc(g && g.summary || '') + '</textarea>'
      + '<div class="row" style="justify-content:space-between;margin-top:6px">'
      + '<span class="mono" id="cnt-' + id + '"></span>'
      + '<span class="mono">직접 손으로 써 주세요. <b>붙여넣기는 표시가 남습니다.</b></span></div></div>'
      + '<div class="row" style="margin-top:12px">'
      + '<button class="btn btn-a" id="sb-' + id + '">요약 내기</button>'
      + '<span class="mono">낸 요약을 담당자가 읽고 이수 처리해 드립니다.</span></div>';

    var ta = $('sum-' + id);
    ta.addEventListener('input', function () { paint(id); });
    ta.addEventListener('paste', function (e) {
      /* 무엇을 붙여넣었는지 붙잡아 둡니다 — 나중에 아직 남아 있는지 보려고 */
      var t = '';
      try { t = ((e.clipboardData || window.clipboardData).getData('text') || '').trim(); }
      catch (err) { t = ''; }
      if (t) (PASTETXT[id] = PASTETXT[id] || []).push(t);
      PASTED[id] = true;
      setTimeout(function () { paint(id); }, 0);
    });
    $('sb-' + id).onclick = function () { submitSummary(id); };
    killPlayer();
    if (vid) mountPlayer(id, vid); else LOOSE[id] = true;
    paint(id);
    startTick();
    if (!keep) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    lockPreview();
  }

  /* 본 시간 막대와 글자 수를 다시 그립니다 */
  function paint(id) {
    var m = matOf(id); if (!m || OPEN !== id) return;
    var need = needSec(m), got = watched(id), ok = !need || got >= need;
    var playing = !!(PLAYER && PLAYER.getPlayerState && PLAYER.getPlayerState() === 1);
    var bar = $('wt-' + id);
    if (bar) bar.innerHTML = need
      ? '<div class="wfill" style="width:' + Math.min(100, Math.round(got / need * 100)) + '%"></div>'
      + '<span>' + (ok ? '✓ 충분히 보셨습니다'
        : (playing ? '▶ ' : '') + '본 부분 ' + mmss(got) + ' / ' + mmss(fullSec(m)) + ' 중 '
        + mmss(need) + ' 이상') + '</span>'
      : '<span>영상을 끝까지 보신 뒤 요약해 주세요.</span>';

    var ta = $('sum-' + id); if (!ta) return;
    var len = ta.value.trim().length, min = m.min_chars || 150;
    /* 붙여넣은 것이 아직 칸에 남아 있는지 매번 다시 봅니다 */
    var pnow = pasteLeft(id);
    if (!pnow) { PASTED[id] = false; PASTETXT[id] = []; }
    var cnt = $('cnt-' + id);
    if (cnt) cnt.innerHTML = '<b style="color:var(--' + (len >= min ? 'ok' : 'bad') + ')">' + len + '자</b> / ' + min + '자'
      + (pnow ? ' · <span style="color:var(--bad)">붙여넣기 있음</span>'
        + ' <span class="mono">(지우고 손으로 다시 쓰시면 없어집니다)</span>' : '');

    var btn = $('sb-' + id); if (!btn || PREVIEW) return;
    var why = !ok ? '영상을 더 보셔야 합니다' : len < min ? (min - len) + '자 더 써 주세요' : '';
    btn.disabled = !!why;
    btn.textContent = why || '요약 내기';
  }

  /* 0.5초마다 재생 위치를 찍습니다. 재생 중일 때만 찍히므로
     틀어만 놓거나 건너뛴 구간은 쌓이지 않습니다. */
  function startTick() {
    if (TICK) return;
    TICK = setInterval(function () {
      if (!OPEN) return;
      var scr = document.querySelector('.screen[data-screen="b-edu"]');
      if (!scr || !scr.classList.contains('on')) return;
      if (!$('mp-' + OPEN)) return;

      if (PLAYER && PLAYER.getPlayerState) {
        if (!DUR[OPEN] && PLAYER.getDuration) DUR[OPEN] = Math.round(PLAYER.getDuration() || 0);
        if (PLAYER.getPlayerState() !== 1) return;          /* 1 = 재생 중 */
        if (markSec(OPEN, Math.floor(PLAYER.getCurrentTime() || 0))) paint(OPEN);
        return;
      }
      /* 유튜브 조작 스크립트가 막힌 환경 — 화면을 보고 있는 동안만 어림잡아 셉니다 */
      if (LOOSE[OPEN] && !document.hidden) {
        HALF = !HALF; if (!HALF) return;                    /* 0.5초 × 2 = 1초 */
        if (markSec(OPEN, watched(OPEN))) paint(OPEN);
      }
    }, 500);
  }
  var HALF = false;

  async function submitSummary(id) {
    if (PREVIEW) { A.toast('미리보기에서는 낼 수 없습니다'); return; }
    var m = matOf(id), btn = $('sb-' + id);
    var ansEl = $('ans-' + id);
    btn.disabled = true; btn.textContent = '내는 중…';
    try {
      await A.rpc('training_submit', {
        p_material: id,
        p_summary: $('sum-' + id).value.trim(),
        p_answer: ansEl ? ansEl.value.trim() : null,
        p_watched: watched(id),
        p_pasted: pasteLeft(id)
      });
      A.toast('냈습니다. 담당자가 읽고 이수 처리해 드립니다');
      OPEN = null;
      await A.loadBlogger();
    } catch (e) {
      A.toast(e.message); btn.disabled = false; paint(id);
    }
  }

  function renderWork() {
    if (!CUR) CUR = MY.filter(function (p) { return WORKST.indexOf(p.status) >= 0; })[0];
    if (!CUR) {
      $('bWork').innerHTML = A.empty(A.isRv()
        ? '지금 올리실 리뷰가 없습니다. 배정되면 작업함에 뜹니다.'
        : '지금 쓸 글이 없습니다. 배정되면 작업함에 뜹니다.');
      return;
    }
    var p = MY.filter(function (x) { return x.id === CUR.id; })[0] || CUR;
    CUR = p;
    if ((p.track || 'blog') === 'review') { renderRvWork(p); return; }

    var head = '<div class="card" style="margin-bottom:16px">'
      + '<div class="row" style="justify-content:space-between;margin-bottom:12px"><div>'
      + '<h3 style="font-size:16.5px">' + esc(p.keyword || '') + '</h3>'
      + '<div class="mono" style="margin-top:3px">' + esc(p.academy_name)
      + ' · 원고 ' + (p.due_date || '-') + '까지'
      + (p.publish_on ? ' · <b style="color:var(--amber)">' + p.publish_on + ' 발행</b>' : '')
      + ' · ' + won(p.payout_rate) + '원</div></div>'
      + A.stChip(p.status) + '</div>'
      + (p.status === 'rework' ? '<div class="note bad" style="margin-bottom:12px"><b>고쳐야 할 것</b><br>'
        + (p.reject_reasons || []).map(function (r) { return '· ' + esc(r); }).join('<br>')
        + (p.review_note ? '<br><br>' + esc(p.review_note) : '') + '</div>' : '')
      + '<dl class="kv">'
      + '<dt>제목에 꼭 넣을 말</dt><dd><b>' + esc(p.keyword || '') + '</b></dd>'
      + '<dt>이 글이 다룰 것</dt><dd>' + esc(p.brief || '-') + '</dd>'
      + '<dt>지역</dt><dd>' + esc(p.region || '-') + '</dd>'
      + '</dl>'
      + topicBlock(p)
      + tagBlock(p)
      + adBlock(p)
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
      + fl('태그', tagCount(p) ? '아래에 정해 둔 ' + tagCount(p) + '개를 그대로 넣으세요'
        : '7~10개')
      + fl('광고 표기', '맨 아래 한 줄 — 정보팩에 들어 있습니다')
      + '</div>'
      + '<div class="grid g2" style="margin-top:14px">'
      + '<div class="card"><label class="f">분량</label><div style="font-size:20px;font-weight:750">1,200~1,500자</div></div>'
      + '<div class="card"><label class="f">사진</label><div style="font-size:20px;font-weight:750">5~8장</div></div></div>'
      + '<div class="note warn" style="margin-top:14px"><b>가보지 않은 걸 가본 것처럼 쓰면 안 됩니다.</b> '
      + '"상담받고 왔어요"가 아니라 <b>"찾는 분들을 위해 정리해봤습니다"</b> 로 써 주세요.</div>';

    /* ── 세 단계를 늘 같이 보여줍니다 ──
       예전엔 「원고 내기」와 「주소 넣기」가 상태에 따라 하나씩만 떴습니다. 그래서
       원고를 내면 화면이 통째로 바뀌어 지금 어디까지 왔는지, 주소는 어디에 넣는지
       알 수가 없었습니다. 이제 세 칸이 늘 있고 지금 할 칸만 색이 삽니다. */
    var st = p.status;
    var sent = ['submitted', 'approved', 'published'].indexOf(st) >= 0;   /* 원고를 냈나 */
    var okd = ['approved', 'published'].indexOf(st) >= 0;                 /* 통과됐나 */
    var up = st === 'published';                                          /* 올렸나 */

    /* ① 원고 내기 */
    var s1 = sent
      ? '<div class="step done"><div class="sh"><span class="sn">1</span>원고 내기'
        + '<span class="chip c-ok">냈습니다</span></div>'
        + (p.content_url
          ? '<a class="btn btn-s" href="' + esc(p.content_url) + '" target="_blank" rel="noopener">'
            + '낸 원고 열어보기 ↗</a>' : '')
        + '<div class="mono" style="margin-top:8px">고칠 것이 있으면 담당자가 '
        + '돌려보내 드립니다. 그때 다시 열립니다.</div></div>'
      : '<div class="step now"><div class="sh"><span class="sn">1</span>원고 내기</div>'
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

    /* ② 검수 */
    var s2 = st === 'submitted'
      ? '<div class="step wait"><div class="sh"><span class="sn">2</span>검수'
        + '<span class="chip c-wait">보는 중</span></div>'
        + '<div class="mono">담당자가 원고를 읽고 있습니다. <b>하루 안에</b> 결과를 알려드립니다. '
        + '결과가 나오면 이 자리에 뜨고, 알림도 갑니다.</div></div>'
      : st === 'rework'
        ? '<div class="step bad"><div class="sh"><span class="sn">2</span>검수'
          + '<span class="chip c-bad">고쳐 주세요</span></div>'
          + '<div class="note bad"><b>고쳐야 할 것</b><br>'
          + ((p.reject_reasons || []).map(function (r) { return '· ' + esc(r); }).join('<br>') || '·  —')
          + (p.review_note ? '<br><br>' + esc(p.review_note) : '') + '</div>'
          + '<div class="mono" style="margin-top:8px">고치신 뒤 위 1번에서 다시 내주세요.</div></div>'
        : okd
          ? '<div class="step ok"><div class="sh"><span class="sn">2</span>검수'
            + '<span class="chip c-ok">통과</span></div>'
            + '<div class="mono">원고가 통과됐습니다. 이제 아래 3번으로 가시면 됩니다.</div></div>'
          : '<div class="step lock"><div class="sh"><span class="sn">2</span>검수</div>'
            + '<div class="mono">원고를 내시면 담당자가 읽습니다.</div></div>';

    /* ③ 블로그에 올리고 주소 넣기 — 칸은 처음부터 보이되 통과 전에는 잠깁니다 */
    /* 발행 예정일 — 이날이 되어야 올립니다. 서버에서도 막습니다(post_publish) */
    var pon = p.publish_on || null;
    var waitDay = pon && pon > A.today();          /* 아직 그날이 안 됨 */
    var canPub = okd && !waitDay;
    var dleft = pon ? A.dday(pon) : null;

    var s3 = '<div class="step ' + (up ? 'done' : canPub ? 'ok' : 'lock') + '">'
      + '<div class="sh"><span class="sn">3</span>블로그에 올리고 주소 넣기'
      + (up ? '<span class="chip c-ok">넣었습니다</span>'
           : canPub ? '<span class="chip c-ok">지금 하세요</span>'
                 : waitDay ? '<span class="chip c-wait">' + pon + ' 부터</span>'
                 : '<span class="chip">아직 잠겨 있습니다</span>') + '</div>'
      + (waitDay && okd
        ? '<div class="note warn" style="margin-bottom:12px">'
          + '<b>원고는 통과됐지만 올리는 날은 ' + esc(pon) + ' 입니다'
          + (dleft != null ? ' (' + dleft + '일 남음)' : '') + '.</b><br>'
          + '한 학원 글이 며칠 안에 몰려 올라가면 서로 검색어를 잡아먹고, '
          + '그 블로그가 광고 블로그로 보입니다. 그래서 날짜를 벌려 두었습니다.<br>'
          + '<b>그날 센터에 들어오시면 이 칸이 열립니다.</b> '
          + '미리 예약 발행을 걸어두셔도 됩니다.</div>'
        : '')
      + (canPub && !up
        ? '<div class="note" style="margin-bottom:12px"><b>올리기 전에 확인해 주세요.</b><br>'
          + '· ' + dailyRule() + '<br>'
          + '· 제목에 <b>' + esc(p.keyword || '') + '</b> 이 들어갔는지<br>'
          + '· 맨 아래 광고 표기가 있는지</div>'
        : '')
      + '<label class="f">올린 글 주소</label>'
      + '<input class="inp" id="pubUrl" placeholder="https://blog.naver.com/…" '
      + 'value="' + esc(p.published_url || '') + '"'
      + (canPub && !up ? ' style="border-color:var(--ok)"' : ' disabled') + '>'
      + (up
        ? '<div class="row" style="margin-top:10px">'
          + '<a class="btn btn-s" href="' + esc(p.published_url || '') + '" target="_blank" rel="noopener">'
          + '올린 글 열어보기 ↗</a>'
          + '<span class="mono">담당자가 검색 순위를 확인하면 정산에 잡힙니다</span></div>'
        : canPub
          ? '<div class="mono" style="margin-top:5px">'
            + '내 블로그에서 그 글을 열고, 주소창의 주소를 그대로 복사해 오시면 됩니다.</div>'
            + '<div class="row" style="margin-top:14px">'
            + '<button class="btn btn-a" id="btnPublish">다 올렸습니다</button>'
            + '<span class="mono"><b>주소를 넣으셔야 정산에 잡힙니다.</b> 올리기만 하면 저희가 모릅니다</span></div>'
          : waitDay
            ? ''
            : '<div class="mono" style="margin-top:5px">'
              + '<b>원고가 통과되어야 열립니다.</b> 통과 전에 올리시면 고쳐 달라고 할 때 '
              + '이미 올라간 글을 내려야 합니다.</div>')
      + '</div>'
      + (up || canPub
        ? '<div class="note warn" style="margin-top:14px"><b>올린 글은 1년 동안 지우지 말아 주세요.</b> '
          + '학원이 그 기간만큼 값을 치른 것이라, 중간에 지우면 정산을 되돌려야 합니다.</div>'
        : '');

    var act = '<div class="sec">여기까지 오면 끝납니다</div>' + s1 + s2 + s3;

    var pick = MY.filter(function (x) { return WORKST.indexOf(x.status) >= 0; });
    var picker = pick.length > 1 ? '<div class="row" style="margin-bottom:14px">'
      + '<label class="f" style="margin:0">쓸 글 고르기</label>'
      + '<select class="inp" id="workPick" style="width:auto;flex:1;min-width:200px">'
      + pick.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === p.id ? ' selected' : '') + '>'
          + esc(x.keyword || '') + ' (' + (A.ST[x.status] ? A.ST[x.status][0] : x.status) + ')</option>';
      }).join('') + '</select></div>' : '';

    /* 원고가 통과된 뒤에는 「올린 글 주소 넣기」가 맨 위에 옵니다.
       예전에는 긴 작성 가이드 아래에 묻혀 있어서 못 찾으셨습니다. */
    $('bWork').innerHTML = picker + head + (sent || st === 'rework'
      ? act + '<details class="foldguide"><summary>글 쓰는 법 다시 보기</summary>' + form + '</details>'
      : form + act);

    if ($('workPick')) $('workPick').onchange = function () {
      CUR = MY.filter(function (x) { return x.id === this.value; }.bind(this))[0]; renderWork();
    };
    if ($('btnCopyTag')) $('btnCopyTag').onclick = function () {
      var txt = A.tagsFor(p).map(function (x) { return '#' + x; }).join(' ');
      navigator.clipboard.writeText(txt).then(function () { A.toast('태그를 복사했습니다'); });
    };
    if ($('btnCopyAd')) $('btnCopyAd').onclick = function () {
      navigator.clipboard.writeText(adLineOf(p)).then(function () { A.toast('광고 문구를 복사했습니다'); });
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
  /* 이 글에서 다룰 이야기 — 학원이 보낸 글감 중 이 글 몫만 보여줍니다.
     통째로 주면 50편이 서로 비슷해져 검색에서 통째로 밀립니다. */
  function topicBlock(p) {
    if (!p.topic_title) return '';
    return '<div class="topicbox"><div class="tb-h">✍️ 이 글에서 다룰 이야기'
      + '<span>학원이 알려준 내용입니다</span></div>'
      + '<b>' + esc(p.topic_title) + '</b>'
      + '<pre>' + esc(p.topic_body || '') + '</pre>'
      + '<div class="tb-w"><b>그대로 붙여넣지 마세요.</b> 읽고 이해한 다음 '
      + '<b>내 말로 풀어서</b> 써 주세요. 똑같이 옮겨 적으면 다른 분 글과 겹쳐 '
      + '검색에 안 잡히고, 돌려보내 드립니다.</div></div>';
  }
  /* ── 줌 한 회차 ──
     ⚠️ 예전엔 관리자가 한 명씩 눌러 줘야 했습니다. 100명이 되면 못 합니다.
     실시간 참석은 본인이 누르면 바로 인정하고(줌에 관리자가 같이 있었으니 대조가 됩니다),
     녹화본은 안 보고도 누를 수 있으므로 **한 줄 요약을 받고 관리자가 확인**해야 인정합니다. */
  function sessRow(x) {
    var a = ATT.filter(function (y) { return y.session_id === x.id; })[0];
    var past = new Date(x.held_at) <= new Date();
    var title = x.kind === 't1' ? '1차 교육 (줌)' : '2차 교육 (줌) — 내가 쓴 글 피드백';

    var state = !a ? ''
      : a.mode === 'live'
        ? '<span class="chip c-ok">참석 완료</span>'
        : a.mode === 'video'
          ? (a.confirmed_at
            ? '<span class="chip c-ok">녹화본으로 이수</span>'
            : '<span class="chip c-wait">녹화본 확인 기다리는 중</span>')
          : '<span class="chip c-bad">결석</span>';

    var right = (x.zoom_url && !past
      ? '<a class="btn btn-a btn-s" href="' + esc(x.zoom_url) + '" target="_blank" rel="noopener">줌 링크 ↗</a>'
      : '')
      + (past && x.replay_url
        ? '<a class="btn btn-s" href="' + esc(x.replay_url) + '" target="_blank" rel="noopener">녹화본 보기 ↗</a>'
        : '');

    /* 아직 체크 안 했고 이미 지난 회차면 본인이 고릅니다 */
    var pick = (past && (!a || a.mode === 'absent'))
      ? '<div class="attpick">'
        + '<div class="mono" style="margin-bottom:8px"><b>이 교육을 들으셨나요?</b> 직접 체크해 주세요.</div>'
        + '<div class="row">'
        + '<button class="btn btn-a btn-s" data-att1="' + x.id + '">줌에 참석했습니다</button>'
        + '<button class="btn btn-s" data-att2="' + x.id + '">못 갔습니다 — 녹화본으로 볼게요</button>'
        + '</div>'
        + '<div class="attvid hide" data-attbox="' + x.id + '">'
        + (x.replay_url
          ? '<div class="mono" style="margin:10px 0 8px">위 <b>[녹화본 보기]</b>로 끝까지 보신 뒤 '
            + '아래에 <b>무엇을 배우셨는지 20자 이상</b> 적어 주세요. 담당자가 읽고 이수 처리해 드립니다.</div>'
          : '<div class="note warn" style="margin:10px 0 8px">아직 녹화본이 안 올라왔습니다. '
            + '올라오면 알려드리겠습니다.</div>')
        + '<textarea class="inp" data-attnote="' + x.id + '" rows="3" '
        + 'placeholder="예) 블로그 지수와 C-Rank 개념, 제목 앞쪽에 검색어를 넣어야 하는 이유를 배웠습니다"></textarea>'
        + '<div class="row" style="margin-top:8px">'
        + '<button class="btn btn-a btn-s" data-att3="' + x.id + '">다 봤습니다 — 요약 내기</button>'
        + '</div></div></div>'
      : '';

    /* 되돌려진 경우(관리자가 확인을 풀었을 때) 다시 낼 수 있게 */
    var again = (a && a.mode === 'video' && !a.confirmed_at)
      ? '<div class="mono" style="margin-top:8px">낸 요약 — ' + esc(a.note || '') + '</div>'
      : '';

    return '<div class="job"><div><h4>' + title + ' ' + state + '</h4>'
      + '<div class="meta">' + A.fdt(x.held_at) + ' · 약 1시간'
      + (past ? ' · 지난 교육' : ' · 예정') + '</div>'
      + again + pick + '</div>'
      + '<div class="right">' + right + '</div></div>';
  }

  /* 이 글에 달 태그 — 글마다 조합이 다릅니다 (규칙은 core.js A.tagsFor) */
  function tagCount(p) { return A.tagsFor(p).length; }
  function tagBlock(p) {
    var tg = A.tagsFor(p);
    if (!tg.length) return '';
    return '<div class="tagbox"><label class="f">이 글에 달 태그 '
      + '<small>글마다 다릅니다 · 이대로 넣어 주세요</small></label>'
      + '<div class="tagline" id="tagLine">'
      + tg.map(function (x) { return '<span>#' + esc(x) + '</span>'; }).join('') + '</div>'
      + '<button class="btn btn-s" id="btnCopyTag">태그 복사</button>'
      + '<span class="mono" style="margin-left:8px">'
      + '<b>태그를 바꾸거나 더 넣지 말아 주세요.</b> 다른 분 글과 겹치지 않게 짠 것입니다.'
      + '</span></div>';
  }

  /* 광고 표시 문구 — 글마다 다른 문구가 돌아갑니다 (전부 같으면 광고글로 찍힙니다).
     고르는 규칙은 core.js A.adLine 에 있습니다 (관리자 화면과 같은 것을 씁니다) */
  function adLineOf(p) { return A.adLine(p); }

  /* 하루에 몇 편까지 올릴지 — 관리자가 4번 화면 ⚙️에서 정합니다.
     막지는 못합니다(본인 블로그라). 안내만 정확히 해 둡니다. */
  function dailyRule() {
    var f = A.FORM || {};
    var n = Number(f.daily_limit) || 1;
    if (n <= 1) return '오늘 이미 다른 글을 올리셨다면 내일 올려 주세요 <b>(하루 한 편)</b>';
    return '하루에 <b>' + n + '편까지</b> 올리실 수 있습니다'
      + (f.same_academy_daily === 0 ? ''
        : ' — 다만 <b>같은 학원 글은 하루 한 편만</b> 올려 주세요. '
          + '한 블로그에 같은 학원 글이 몰리면 광고 블로그로 보여 둘 다 검색에서 밀립니다');
  }
  function adBlock(p) {
    var line = adLineOf(p);
    if (!line) return '';
    return '<div class="adbox"><label class="f">맨 아래에 넣을 광고 표시 문구 '
      + '<small>글마다 다릅니다 · 이 글은 이 문장을 쓰세요</small></label>'
      + '<div class="adline" id="adLine">' + esc(line) + '</div>'
      + '<button class="btn btn-s" id="btnCopyAd">문구 복사</button>'
      + '<span class="mono" style="margin-left:8px">법으로 정해진 표시라 <b>꼭 넣으셔야</b> 합니다.</span></div>';
  }

  /* ── 이 글에 줄 사진 고르기 ──
     예전엔 순번으로 잘라 주기만 해서, 영어 이야기를 쓰는 글에 수학 사진이 가고
     간판 사진이 한 장도 없는 글이 생겼습니다. 이제 꼬리표를 보고 맞춰 줍니다.
       ① 간판·외부 한 장을 맨 앞에 (글의 첫 사진은 간판이어야 합니다)
       ② 이 글 소재와 같은 과목 사진
       ③ 모자라면 과목이 안 적힌(공통) 사진
       ④ 그래도 모자라면 남은 것에서
     같은 사진이 여러 블로그에 겹치면 중복으로 잡히므로, 각 묶음 안에서는
     글 순번만큼 밀어서 글마다 다른 조합이 나가게 합니다.
     꼬리표를 하나도 안 달았으면 예전처럼 순번으로만 자릅니다. */
  /* ── 리뷰 사진 나누기 ──
     리뷰는 블로그와 나누는 규칙이 다릅니다.
     ① **영수증은 한 사람당 한 장** — 같은 가게에서는 늘 같은 영수증이 갑니다.
        (리뷰마다 다른 영수증을 쓰면 한 사람이 여러 번 결제한 것처럼 보입니다)
     ② **실제 사진은 최대한 안 겹치게** — 리뷰 순번만큼 건너뛰며 집습니다.
        건너뛰는 폭은 1이 아니라 한 리뷰에 쓰는 장수(per)여야 옆 순번과 안 겹칩니다
        (블로그 사진에서 1칸씩 밀었다가 8장 중 6장이 같았던 것과 같은 이유). */
  var RV_PER = 3;                 /* 리뷰 하나에 붙일 실제 사진 장수 */

  function rvPhotos(p) {
    var tags = p.photo_tags || {};
    var all = (p.photo_paths || []).filter(function (x) { return !(tags[x] && tags[x].x); });
    if (!all.length) return [];
    var recs = all.filter(function (x) { return (tags[x] || {}).t === '영수증'; });
    var reals = all.filter(function (x) { return (tags[x] || {}).t !== '영수증'; });
    var out = [];

    /* ① 영수증 한 장 — 사람 + 가게로 정하니 같은 사람은 늘 같은 것을 받습니다.
       (my_posts 에는 order_id 가 없어서 가게 이름을 열쇠로 씁니다) */
    if (recs.length) {
      var who = (A.ME && A.ME.id) || '';
      var shop = p.order_id || p.academy_name || '';
      out.push(recs[A.adIndex(who + ':' + shop, recs.length)]);
    }

    /* ② 실제 사진 — 리뷰 순번만큼 건너뛰며 */
    if (reals.length) {
      var per = Math.min(RV_PER, reals.length);
      var st = ((p.seq || 1) - 1) * per % reals.length;
      for (var i = 0; i < per; i++) out.push(reals[(st + i) % reals.length]);
    }
    return out;
  }

  function myPhotos(p) {
    if ((p.track || 'blog') === 'review') return rvPhotos(p);
    var all = p.photo_paths || [];
    if (!all.length) return [];
    var per = Math.min(8, Math.max(5, Math.floor(all.length / 6) || 5));
    per = Math.min(per, all.length);
    var tags = p.photo_tags || {};
    var seq = (p.seq || 1) - 1;
    /* 「쓰지 않음」으로 빼 둔 사진은 아예 후보에서 뺍니다 (겹친 사진·못 쓸 사진) */
    all = all.filter(function (x) { return !(tags[x] && tags[x].x); });
    if (!all.length) return [];
    per = Math.min(per, all.length);

    /* 글마다 다른 데서 시작합니다. 한 칸씩이 아니라 한 글에 쓰는 장수(per)만큼 건너뛰어야
       옆 순번 글과 사진이 거의 안 겹칩니다 (한 칸씩 밀면 8장 중 6장이 같았습니다). */
    function rotate(list) {
      if (!list.length) return [];
      var s = (seq * per) % list.length;
      return list.slice(s).concat(list.slice(0, s));
    }
    var tagged = all.filter(function (x) { return tags[x] && tags[x].t; });
    if (!tagged.length) {                      /* 꼬리표가 없으면 예전 방식 그대로 */
      var out0 = [], start = seq * per % all.length;
      for (var i = 0; i < per; i++) out0.push(all[(start + i) % all.length]);
      return out0;
    }

    /* ⭐ 사진은 **그 글의 과목**을 따라야 합니다.
       예전엔 소재의 과목(topic_subject)만 봤는데, 소재가 과목을 안 보고 붙던 시절엔
       제목은 국어인데 사진은 영어가 가는 일이 있었습니다.
       이제 소재도 과목에 맞춰 붙지만, 글 자신의 과목을 먼저 봅니다. */
    var subj = p.subject || p.topic_subject || '';
    var signs = rotate(all.filter(function (x) { return (tags[x] || {}).t === '간판·외부'; }));
    var rest = all.filter(function (x) { return (tags[x] || {}).t !== '간판·외부'; });
    var mine = rotate(rest.filter(function (x) { return subj && (tags[x] || {}).s === subj; }));
    var common = rotate(rest.filter(function (x) {
      var s = (tags[x] || {}).s;
      return !s || s === '공통';
    }));
    var other = rotate(rest.filter(function (x) {
      var s = (tags[x] || {}).s;
      return s && s !== '공통' && s !== subj;
    }));

    var out = [], seen = {};
    function take(list, n) {
      for (var i = 0; i < list.length && n > 0; i++) {
        if (seen[list[i]]) continue;
        seen[list[i]] = 1; out.push(list[i]); n--;
      }
    }
    take(signs, 1);                            /* 간판 한 장은 반드시 맨 앞 */
    take(mine, per - out.length);
    take(common, per - out.length);
    take(other, per - out.length);
    take(all, per - out.length);               /* 그래도 모자라면 아무거나 */
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
      + '<b>맨 앞 사진이 간판·바깥</b>이니 글의 첫 사진으로 쓰세요. '
      + '다른 분과 같은 사진을 쓰면 검색에 안 걸릴 수 있으니 받으신 것만 쓰세요.</div>'
      + '<div class="note warn" style="margin-bottom:8px"><b>학생 얼굴이 나온 사진은 '
      + '올리시기 전에 모자이크(흐리게) 처리해 주세요.</b> 네이버 블로그 사진 편집에 '
      + '「모자이크」가 있습니다. 얼굴이 그대로 올라가면 학원이 곤란해집니다.</div>'
      + '<div class="row">'
      + '<button class="btn btn-a btn-s" data-getpics="' + p.id + '">사진 ' + mine.length + '장 보기</button>'
      + '<button class="btn btn-p btn-s" data-zippics="' + p.id + '">⬇ ' + mine.length + '장 한번에 받기</button>'
      + '</div>'
      + '<div id="picBox" style="margin-top:10px"></div></div>';
  }

  /* ── 리뷰어 화면 ──
     블로그와 완전히 다릅니다. 리뷰어는 글을 쓰지 않습니다.
     ①본문을 복사하고 ②사진을 받고 ③가게에 가서(또는 바로) 올리고 ④캡처를 올립니다. */
  function renderRvWork(p) {
    var wa = p.write_at ? new Date(p.write_at) : null;
    var waitTime = wa && wa > new Date();
    var up = ['published', 'verified', 'paid'].indexOf(p.status) >= 0;
    var pick = MY.filter(function (x) { return WORKST.indexOf(x.status) >= 0; });

    var picker = pick.length > 1 ? '<div class="row" style="margin-bottom:14px">'
      + '<label class="f" style="margin:0">할 일 고르기</label>'
      + '<select class="inp" id="workPick" style="width:auto;flex:1;min-width:200px">'
      + pick.map(function (x) {
        return '<option value="' + x.id + '"' + (x.id === p.id ? ' selected' : '') + '>'
          + esc((x.academy_name || '') + ' · ' + (x.category || x.keyword || '')) + '</option>';
      }).join('') + '</select></div>' : '';

    var head = '<div class="card" style="margin-bottom:16px">'
      + '<div class="row" style="justify-content:space-between;margin-bottom:12px"><div>'
      + '<h3 style="font-size:16.5px">' + esc(p.academy_name || '') + '</h3>'
      + '<div class="mono" style="margin-top:3px">'
      + '<b>' + esc(p.category || '리뷰') + '</b>'
      + (p.keyword ? ' · ' + esc(p.keyword) : '')
      + ' · ' + won(p.payout_rate) + '원</div></div>'
      + A.stChip(p.status) + '</div>'
      + '<dl class="kv">'
      + '<dt>언제 올리나요</dt><dd><b style="color:var(--amber)">'
      + (wa ? A.fdt(p.write_at) : '아직 안 정해졌습니다') + '</b></dd>'
      + '<dt>어디에 올리나요</dt><dd>'
      + (p.map_url
        ? '<a href="' + esc(p.map_url) + '" target="_blank" rel="noopener">네이버 지도에서 열기 ↗</a>'
        : '<span class="mono">지도 주소가 아직 없습니다</span>') + '</dd>'
      + '<dt>가야 하나요</dt><dd>'
      + (p.visit_type === 'material'
        ? '아니요 — 받은 사진과 내용으로 올리시면 됩니다'
        : '<b>네 — 직접 가서 결제하신 뒤</b> 영수증으로 인증하고 올려 주세요') + '</dd>'
      + '</dl></div>';

    /* ① 본문 */
    var s1 = '<div class="step ' + (up ? 'done' : 'now') + '">'
      + '<div class="sh"><span class="sn">1</span>이 내용을 그대로 올리세요</div>'
      + '<pre class="tpnote" style="margin-top:0;max-height:none">' + esc(p.body || '') + '</pre>'
      + '<div class="row" style="margin-top:10px">'
      + '<button class="btn btn-a btn-s" id="btnCopyRv">📋 본문 복사</button>'
      + '<span class="mono"><b>고치지 말고 그대로</b> 올려 주세요. 표현을 바꾸면 다른 분 리뷰와 겹칩니다.</span>'
      + '</div></div>';

    /* ② 사진 — 영수증 한 장 + 실제 사진 몇 장 */
    var mine = myPhotos(p);
    var ptags = p.photo_tags || {};
    var nRec = mine.filter(function (x) { return (ptags[x] || {}).t === '영수증'; }).length;
    var nReal = mine.length - nRec;
    var s2 = '<div class="step ' + (up ? 'done' : 'now') + '">'
      + '<div class="sh"><span class="sn">2</span>사진 붙이기</div>'
      + (mine.length
        ? '<div class="mono" style="margin-bottom:8px">이 리뷰에 쓸 사진 ' + mine.length + '장입니다'
          + (nRec ? ' — <b>영수증 ' + nRec + '장</b>(맨 앞) + 실제 사진 ' + nReal + '장'
                  : ' (실제 사진 ' + nReal + '장)') + '.<br>'
          + '<b>실제 사진은 다른 분과 안 겹치게 나눠 뒀습니다.</b> 받으신 것만 쓰세요.'
          + (nRec ? '<br><b>영수증은 한 분당 한 장</b>입니다 — 이 가게 리뷰를 여러 건 맡으셨어도 '
                  + '늘 같은 영수증이 갑니다.' : '')
          + '</div>'
          + (p.visit_type === 'visit'
            ? '<div class="note warn" style="margin-bottom:8px"><b>직접 가서 결제하셨다면 '
              + '내 영수증을 쓰세요.</b> 위 영수증은 그러지 못하는 경우에만 씁니다.</div>' : '')
          + '<div class="row">'
          + '<button class="btn btn-a btn-s" data-getpics="' + p.id + '">사진 보기</button>'
          + '<button class="btn btn-p btn-s" data-zippics="' + p.id + '">⬇ ' + mine.length + '장 한번에 받기</button>'
          + '</div><div id="picBox" style="margin-top:10px"></div>'
        : '<div class="mono">받은 사진이 없습니다. 직접 찍으신 사진을 쓰셔도 됩니다.</div>')
      + '</div>';

    /* ③ 올리고 캡처 */
    var s3 = '<div class="step ' + (up ? 'done' : waitTime ? 'lock' : 'ok') + '">'
      + '<div class="sh"><span class="sn">3</span>올리고 화면 캡처 올리기'
      + (up ? '<span class="chip c-ok">냈습니다</span>'
           : waitTime ? '<span class="chip c-wait">' + A.fdt(p.write_at) + ' 부터</span>'
                      : '<span class="chip c-ok">지금 하세요</span>') + '</div>'
      + (waitTime
        ? '<div class="note warn"><b>아직 올리실 때가 아닙니다.</b> '
          + '<b>' + A.fdt(p.write_at) + '</b> 이후에 올려 주세요.<br>'
          + '같은 가게 리뷰가 한꺼번에 올라가면 바로 티가 나서 시각을 벌려 두었습니다.</div>'
        : up
          ? '<div class="note ok">올리신 것을 담당자가 확인하고 있습니다.</div>'
          : '<div class="note" style="margin-bottom:12px"><b>올리신 뒤</b> 그 화면을 캡처해서 아래에 올려 주세요.<br>'
            + '네이버 리뷰는 글마다 주소가 없어서 <b>캡처가 유일한 증거</b>입니다.</div>'
            + '<label class="f">내 네이버 닉네임 <small>담당자가 지도에서 찾을 때 씁니다</small></label>'
            + '<input class="inp" id="rvNick" value="' + esc(p.memo || '') + '" placeholder="예: 먹보아저씨">'
            + '<label class="f" style="margin-top:12px">올린 화면 캡처</label>'
            + '<input type="file" class="inp" id="rvShot" accept="image/*">'
            + '<div class="row" style="margin-top:14px">'
            + '<button class="btn btn-a" id="btnRvDone">다 올렸습니다</button>'
            + '<span class="mono"><b>캡처를 올리셔야 정산에 잡힙니다.</b></span></div>')
      + '</div>';

    $('bWork').innerHTML = picker + head
      + '<div class="sec">이 순서대로 하시면 됩니다</div>' + s1 + s2 + s3;

    if ($('workPick')) $('workPick').onchange = function () {
      CUR = MY.filter(function (x) { return x.id === this.value; }.bind(this))[0]; renderWork();
    };
    if ($('btnCopyRv')) $('btnCopyRv').onclick = function () {
      navigator.clipboard.writeText(p.body || '').then(function () { A.toast('본문을 복사했습니다'); });
    };
    if ($('btnRvDone')) $('btnRvDone').onclick = async function () {
      var f = $('rvShot').files && $('rvShot').files[0];
      if (!f) { A.toast('올린 화면 캡처를 골라 주세요'); return; }
      this.disabled = true;
      try {
        var ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
        var path = 'proof/' + A.SESSION.user.id + '/' + p.id + '.' + ext;
        var upr = await A.sb.storage.from('request-photos').upload(path, f, { upsert: true });
        if (upr.error) throw new Error(upr.error.message);
        await A.rpc('review_done', {
          p_post: p.id, p_proof: path, p_nick: $('rvNick').value.trim() || null
        });
        A.toast('냈습니다. 담당자가 확인해 드립니다');
        await A.loadBlogger(); A.show('b-inbox');
      } catch (err) { A.toast('실패: ' + err.message); this.disabled = false; }
    };
    lockPreview();
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
    var W = A.WORDS(), RV = A.isRv();
    $('bPayStats').innerHTML = s(thisM.length, '이번 달 확정 편수')
      + s(lv.rate, '내 단계 단가 (원)')
      + s(thisM.reduce(function (a, p) { return a + (p.payout_rate || 0); }, 0), '이번 달 받을 돈 (원)')
      + s(MY.filter(function (p) { return ['verified', 'paid'].indexOf(p.status) >= 0; }).length,
          '지금까지 한 ' + W.what);

    var rows = MY.filter(function (p) { return p.published_at || p.status === 'rework'; });
    $('bPayList').innerHTML =
      '<div class="note" style="margin-bottom:14px">돈은 <b>' + esc(A.commName(A.ME.community_id))
      + '로 한 번에 보내집니다.</b> 공동체에서 나눠 받으시면 됩니다. 보통 다음 달 10일쯤입니다.<br>'
      + '<b>블로그와 리뷰는 합쳐서 한 번에 나갑니다.</b> 위 표는 지금 고르신 '
      + (RV ? '⭐ 리뷰' : '📝 블로그') + ' 것만 보여드리는 것이고, '
      + '아래 「지난달」은 둘을 합친 금액입니다.</div>'
      + (rows.length ? '<div class="tblbox tblscroll"><table>'
        + '<thead><tr><th>' + (RV ? '리뷰' : '글') + '</th><th>올린 날</th><th>상태</th>'
        + (RV ? '' : '<th>노출</th>') + '<th>금액</th></tr></thead><tbody>'
        + rows.map(function (p) {
          var pay = ['verified', 'paid'].indexOf(p.status) >= 0;
          return '<tr' + (p.status === 'rework' ? ' class="sent"' : '') + '>'
            + '<td>' + esc(RV ? ((p.academy_name || '') + ' · ' + (p.category || '')) : (p.keyword || '')) + '</td>'
            + '<td class="mono">' + (p.published_at ? A.fdate(p.published_at) : '아직') + '</td>'
            + '<td>' + A.stChip(p.status) + '</td>'
            + (RV ? '' : '<td class="num">' + (p.keyword_rank ? A.rankText(p.keyword_rank) : '-') + '</td>')
            + '<td class="num">' + (pay ? '<b>' + won(p.payout_rate) + '</b>' : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : A.empty('아직 올린 ' + A.josa(W.what, '이') + ' 없습니다.'))
      + (PAY.length ? '<div class="sec">지난달 <small>블로그·리뷰 합계</small></div>'
        + '<div class="tblbox tblscroll"><table>'
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
      g.disabled = false; g.textContent = '사진 ' + paths.length + '장 보기';
      if (r.error) { A.toast('사진을 불러오지 못했습니다: ' + r.error.message); return; }
      var box = A.$('picBox');
      var gtags = post.photo_tags || {};
      box.innerHTML = '<div class="row" style="gap:10px">'
        + r.data.map(function (x, i) {
          if (!x.signedUrl) return '';
          /* 누운 사진은 여기서도 돌려 보여줍니다 (받으시면 파일 자체가 바로 서 있습니다) */
          var rot = (gtags[paths[i]] || {}).r || 0;
          return '<a href="' + x.signedUrl + '" target="_blank" rel="noopener" '
            + 'style="display:block;width:96px"><img src="' + x.signedUrl
            + '" style="width:96px;height:72px;object-fit:cover;border-radius:6px;border:1px solid var(--line)'
            + (rot ? ';transform:rotate(' + rot + 'deg)' : '') + '">'
            + '<span class="mono">' + (i + 1) + '번'
            + ((gtags[paths[i]] || {}).t === '영수증' ? ' · 영수증'
               : i === 0 ? ' · 첫 사진' : '') + '</span></a>';
        }).join('') + '</div>'
        + '<div class="mono" style="margin-top:8px">한 장씩 받으시려면 사진을 누르세요. '
        + '<b>한번에 받으시려면 위의 [⬇ 한번에 받기]</b>가 편합니다. 링크는 1시간 동안 유효합니다.</div>';
      return;
    }

    /* 내 글 몫 사진을 ZIP 하나로 — 한 장씩 우클릭해서 받지 않아도 됩니다 */
    var z = e.target.closest('[data-zippics]');
    if (z) {
      var zp = MY.filter(function (x) { return x.id === z.dataset.zippics; })[0];
      if (!zp) return;
      var zpaths = myPhotos(zp);
      z.disabled = true; z.textContent = '주소 만드는 중…';
      var zr = await A.sb.storage.from('request-photos').createSignedUrls(zpaths, 3600);
      if (zr.error) {
        A.toast('사진을 불러오지 못했습니다: ' + zr.error.message);
        z.disabled = false; z.textContent = '⬇ ' + zpaths.length + '장 한번에 받기'; return;
      }
      var tg = zp.photo_tags || {};
      var items = (zr.data || []).filter(function (x) { return x.signedUrl; })
        .map(function (x, i) {
          var t = tg[zpaths[i]] || {};
          /* 파일 이름 앞에 순서를 붙여 둡니다 — 1번이 간판이라 글 맨 위에 넣으시면 됩니다.
             누운 사진은 rotate 로 바로 세워서 담습니다 (core.js zipDownload) */
          return { url: x.signedUrl, rotate: t.r || 0,
                   name: (i + 1) + '번' + (t.t ? '_' + t.t : '') + '_' + zpaths[i].split('/').pop() };
        });
      try {
        /* 파일 이름에 못 쓰는 글자를 걸러 냅니다 (esc 는 HTML 용이라 여기 쓰면 안 됩니다) */
        var safe = ((zp.academy_name || '') + ' - ' + (zp.keyword || '글'))
          .replace(/[\\/:*?"<>|]/g, ' ').trim();
        var n = await A.zipDownload(items, safe + ' 사진.zip',
          function (i, t) { z.textContent = '받는 중… ' + i + '/' + t; });
        A.toast(n + '장을 받았습니다. 압축을 풀어서 쓰세요');
      } catch (err) { A.toast('실패: ' + err.message); }
      z.disabled = false; z.textContent = '⬇ ' + zpaths.length + '장 한번에 받기';
      return;
    }
    /* 줌 참석 — 본인 체크 */
    var s1 = e.target.closest('[data-att1]');
    if (s1) {
      if (PREVIEW) { A.toast('미리보기에서는 바꿀 수 없습니다'); return; }
      s1.disabled = true;
      try {
        await A.rpc('training_self_attend', { p_session: s1.dataset.att1, p_mode: 'live', p_note: null });
        A.toast('참석으로 체크했습니다');
        await A.loadBlogger();
      } catch (err) { A.toast('실패: ' + err.message); s1.disabled = false; }
      return;
    }
    var s2 = e.target.closest('[data-att2]');
    if (s2) {
      var box = document.querySelector('[data-attbox="' + s2.dataset.att2 + '"]');
      if (box) box.classList.toggle('hide');
      return;
    }
    var s3 = e.target.closest('[data-att3]');
    if (s3) {
      if (PREVIEW) { A.toast('미리보기에서는 바꿀 수 없습니다'); return; }
      var nt = document.querySelector('[data-attnote="' + s3.dataset.att3 + '"]');
      var txt = nt ? nt.value.trim() : '';
      if (txt.length < 20) { A.toast('무엇을 배우셨는지 20자 이상 적어 주세요'); nt && nt.focus(); return; }
      s3.disabled = true;
      try {
        await A.rpc('training_self_attend', { p_session: s3.dataset.att3, p_mode: 'video', p_note: txt });
        A.toast('냈습니다. 담당자가 읽고 이수 처리해 드립니다');
        await A.loadBlogger();
      } catch (err) { A.toast('실패: ' + err.message); s3.disabled = false; }
      return;
    }

    var pl = e.target.closest('[data-play]');
    if (pl) {
      var id = pl.dataset.play;
      killPlayer();
      OPEN = (OPEN === id) ? null : id;                /* 같은 걸 또 누르면 접기 */
      renderEdu();
    }
  });
})(window.ESC);
