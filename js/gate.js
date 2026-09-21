/* 로그인 · 블로거 신청 */
(function (A) {
  'use strict';
  var $ = A.$;

  A.prefillLoggedIn = function () {
    if (!A.SESSION) return;
    $('su_email').value = A.SESSION.user.email;
    $('su_email').disabled = true;
    $('su_pwWrap').classList.add('hide');

    /* ESC 직원이 블로거를 병행할 때는 공동체가 아니라 ESC 소속입니다.
       공동체 칸 맨 위에 「ESC」를 넣어 두고 그것을 고르게 합니다 (community_id 는 빈 값). */
    if (A.IS_ADMIN || A.IS_REVIEWER) {
      var sel = $('su_comm');
      if (sel && !sel.dataset.esc) {
        sel.insertAdjacentHTML('afterbegin', '<option value="esc">ESC (직원)</option>');
        sel.dataset.esc = '1';
        sel.value = 'esc';
      }
    }
  };

  $('btnBackAdmin').onclick = function () {
    location.hash = '';
    A.boot();
  };

  $('btnLogin').onclick = async function () {
    var email = $('li_email').value.trim(), pw = $('li_pw').value;
    if (!email || !pw) { A.msg('loginMsg', '이메일과 비밀번호를 입력해 주세요.'); return; }
    this.disabled = true; A.msg('loginMsg', '');
    var r = await A.sb.auth.signInWithPassword({ email: email, password: pw });
    this.disabled = false;
    if (r.error) { A.msg('loginMsg', '이메일이나 비밀번호가 맞지 않습니다.'); return; }
    location.hash = '';
    A.boot();
  };

  /* 적으시는 대로 「이 주소가 열립니다」를 보여 줍니다 —
     대문자로 적으면 안 열린다는 것을 내는 순간이 아니라 그 자리에서 알 수 있게. */
  if ($('su_nid')) $('su_nid').oninput = function () {
    var h = $('su_nid_hint'); if (!h) return;
    var v = A.normNid(this.value);
    if (!v) {
      h.innerHTML = 'blog.naver.com/<b>여기에 들어가는 부분</b> · 주소를 통째로 붙여넣으셔도 됩니다';
      return;
    }
    var ok = A.NID_OK.test(v);
    h.innerHTML = ok
      ? '이 주소가 열립니다 → <a href="https://blog.naver.com/' + A.esc(v)
        + '" target="_blank" rel="noopener">blog.naver.com/' + A.esc(v) + ' ↗</a>'
        + ' <b>눌러서 내 블로그가 맞는지 확인해 주세요</b>'
      : '<b style="color:var(--bad)">영문 소문자·숫자·_·- 만 쓸 수 있습니다 (3~20자)</b>';
  };

  /* ── 만 14세 미만이면 보호자 칸을 엽니다 ──
     나이는 저장하지 않고 생년월일에서 **만 나이**로 계산합니다(서버 blog_age_real 과 같은 규칙).
     한국시간 오늘(A.today) 기준 · 생일이 아직 안 지났으면 한 살 뺍니다. */
  function suRealAge() {
    var by = parseInt(($('su_by').value || '').trim(), 10),
        bm = parseInt(($('su_bm').value || '').trim(), 10),
        bd = parseInt(($('su_bd').value || '').trim(), 10);
    if (!by || !bm || !bd) return null;
    if (by < 100) by += (by > 30 ? 1900 : 2000);
    var t = A.today(), md = ('0' + bm).slice(-2) + '-' + ('0' + bd).slice(-2);
    var a = Number(t.slice(0, 4)) - by;
    if (t.slice(5) < md) a -= 1;
    return a;
  }
  function suGuardianToggle() {
    var a = suRealAge(), box = $('su_gBox');
    if (box) box.classList.toggle('hide', !(a != null && a < 14));
  }
  ['su_by', 'su_bm', 'su_bd'].forEach(function (id) {
    var el = $(id); if (el) el.addEventListener('input', suGuardianToggle);
  });
  /* 관계에서 「기타」를 고르면 직접 적는 칸을 엽니다 (후견인 등) */
  if ($('su_gRel')) $('su_gRel').addEventListener('change', function () {
    $('su_gRelEtcBox').classList.toggle('hide', this.value !== '기타');
    if (this.value === '기타') $('su_gRelEtc').focus();
  });

  $('btnSignup').onclick = async function () {
    var v = function (id) { return ($(id).value || '').trim(); };
    var comm = v('su_comm'), name = v('su_name');
    var nid = v('su_nid'), alias = v('su_alias'), band = v('su_band'), phone = v('su_phone');
    var email = v('su_email'), pw = $('su_pw').value, pw2 = $('su_pw2').value;

    if (!comm) { A.msg('suMsg', '공동체를 골라 주세요.'); return; }
    if (comm === 'esc') comm = null;      /* ESC 직원 — 공동체 없음 */
    if (!name) { A.msg('suMsg', '이름을 입력해 주세요.'); return; }

    /* ── 생년월일 ──
       예전에는 「나이」를 손으로 적게 했습니다. 세는나이로 적는 분과 만나이로 적는 분이
       섞여서, 만 14세 미만(법정대리인 동의가 필요한 경계)을 가릴 수가 없었습니다.
       나이는 저장하지 않고 생년월일에서 매번 계산합니다. */
    var by = parseInt(v('su_by'), 10), bm = parseInt(v('su_bm'), 10), bd = parseInt(v('su_bd'), 10);
    if (!by || !bm || !bd) { A.msg('suMsg', '생년월일을 모두 넣어 주세요.'); return; }
    if (by < 100) by += (by > 30 ? 1900 : 2000);
    var bdt = new Date(by, bm - 1, bd);
    if (bdt.getFullYear() !== by || bdt.getMonth() !== bm - 1 || bdt.getDate() !== bd) {
      A.msg('suMsg', '날짜를 다시 확인해 주세요.'); return;
    }
    var birth = by + '-' + ('0' + bm).slice(-2) + '-' + ('0' + bd).slice(-2);

    /* ── 만 14세 미만 → 보호자 정보 필수 ──
       서버(bloggers_guard)가 가입 순간 consent_required 를 켜고, 보호자 동의 전에는 승인이 막힙니다.
       🔴 보호자 번호가 들어오는 곳은 **여기 한 곳뿐**입니다. 알림톡 20번이 「신청하면서 보호자 연락처로
          등록한 번호로 보내드립니다」라서, 다른 입력 경로(동의 화면·리더 대리 입력 등)를 만들면 문장이 틀려집니다.
          서버도 가입 뒤에는 본인이 못 고치게 잠가 두었습니다. */
    var realAge = suRealAge(), minor = realAge != null && realAge < 14;
    var gName = '', gPhone = '', gRel = '';
    suGuardianToggle();
    if (minor) {
      gName = v('su_gName'); gPhone = v('su_gPhone').replace(/\D/g, ''); gRel = v('su_gRel');
      if (!gName) { A.msg('suMsg', '보호자 성함을 적어 주세요.'); return; }
      if (!/^01[016789]\d{7,8}$/.test(gPhone)) { A.msg('suMsg', '보호자 휴대전화 번호를 다시 확인해 주세요.'); return; }
      if (!gRel) { A.msg('suMsg', '보호자와의 관계를 골라 주세요.'); return; }
      if (gRel === '기타') {
        gRel = v('su_gRelEtc');
        if (!gRel) { A.msg('suMsg', '보호자와의 관계를 직접 적어 주세요. (예: 후견인)'); return; }
      }
    }
    if (!nid) { A.msg('suMsg', '블로그 네이버 아이디를 입력해 주세요.'); return; }
    /* 주소를 통째로 붙여넣었거나 대문자로 적었으면 여기서 바로잡습니다.
       ⚠️ 네이버 아이디는 소문자만 씁니다 — 대문자로 두면 안 열리는 주소가 됩니다. */
    nid = A.normNid(nid);
    $('su_nid').value = nid;
    if (!A.NID_OK.test(nid)) {
      A.msg('suMsg', '네이버 아이디를 다시 봐 주세요. blog.naver.com/ 뒤에 오는 부분이며 '
        + '영문 소문자·숫자·_·- 만 쓸 수 있습니다 (지금 넣으신 것: ' + nid + ')');
      return;
    }
    if (!band) { A.msg('suMsg', '블로그 이웃 수 구간을 골라 주세요.'); return; }
    if (!phone) { A.msg('suMsg', '전화번호를 입력해 주세요.'); return; }
    /* 동의 세 칸 — 약관 · 개인정보 · 알림 (2026-09-21). 시각은 서버가 찍습니다 */
    if (!$('su_Terms').checked || !$('su_Privacy').checked || !$('su_Noti').checked) {
      A.msg('suMsg', '맨 아래 동의 세 칸을 모두 체크해 주세요.'); return;
    }

    this.disabled = true; A.msg('suMsg', '');
    var uid = null, alreadyIn = $('su_email').disabled;

    if (alreadyIn) {
      uid = A.SESSION.user.id;
    } else {
      if (!email) { A.msg('suMsg', '이메일을 입력해 주세요.'); this.disabled = false; return; }
      if (pw.length < 6) { A.msg('suMsg', '비밀번호는 6자 이상으로 해 주세요.'); this.disabled = false; return; }
      if (pw !== pw2) { A.msg('suMsg', '비밀번호 확인이 다릅니다.'); this.disabled = false; return; }
      var up = await A.sb.auth.signUp({ email: email, password: pw });
      if (up.error) {
        /* ⚠️ 「이미 가입된 이메일」은 대개 **비밀번호를 잊고 다시 가입하려는 것**입니다.
           그냥 「로그인하세요」라고만 하면 또 막힙니다. 어떻게 풀지 알려 줍니다. */
        A.msg('suMsg', /already/i.test(up.error.message)
          ? '이 이메일로는 이미 가입되어 있습니다. 새로 가입하지 마시고 로그인해 주세요. '
            + '비밀번호가 기억나지 않으시면 담당자(010-7318-1790)에게 연락해 주시면 '
            + '새 비밀번호를 만들어 드립니다.'
          : '가입에 실패했습니다: ' + up.error.message);
        this.disabled = false; return;
      }
      uid = up.data.user.id;
      if (!up.data.session) await A.sb.auth.signInWithPassword({ email: email, password: pw });
    }

    var ins = await A.sb.from('bloggers').insert({
      id: uid, email: email || (A.SESSION && A.SESSION.user.email),
      name: name, phone: phone, birth_date: birth,
      community_id: comm, naver_id: nid, blog_alias: alias || null,   /* null 이면 ESC 소속 */
      blog_url: 'https://blog.naver.com/' + nid,
      neighbors_band: band,
      guardian_name: minor ? gName : null,
      guardian_phone: minor ? gPhone : null,
      guardian_relation: minor ? gRel : null
    }).select();

    this.disabled = false;
    if (ins.error) { A.msg('suMsg', '신청 저장에 실패했습니다: ' + ins.error.message); return; }
    try { await A.rpc('blogger_agree', {}); } catch (e) { /* 동의 기록만 실패해도 신청은 살립니다 */ }
    A.toast('신청이 접수되었습니다');
    location.hash = '';
    A.boot();
  };

  /* 이미 가입한 분 — 한 번만 받는 동의 화면 */
  var ba = $('btnAgree');
  if (ba) ba.onclick = async function () {
    if (!$('ag_Terms').checked || !$('ag_Privacy').checked || !$('ag_Noti').checked) {
      A.msg('agMsg', '세 칸을 모두 체크해 주세요.'); return;
    }
    this.disabled = true; A.msg('agMsg', '');
    try {
      await A.rpc('blogger_agree', {});
      A.toast('고맙습니다');
      await A.boot();
    } catch (e) {
      A.msg('agMsg', '저장에 실패했습니다. 다시 눌러 주세요. (' + e.message + ')');
      this.disabled = false;
    }
  };
})(window.ESC);
