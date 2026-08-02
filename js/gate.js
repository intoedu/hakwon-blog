/* 로그인 · 블로거 신청 */
(function (A) {
  'use strict';
  var $ = A.$;

  A.prefillLoggedIn = function () {
    if (!A.SESSION) return;
    $('su_email').value = A.SESSION.user.email;
    $('su_email').disabled = true;
    $('su_pwWrap').classList.add('hide');
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

  $('btnSignup').onclick = async function () {
    var v = function (id) { return ($(id).value || '').trim(); };
    var comm = v('su_comm'), name = v('su_name'), age = v('su_age');
    var nid = v('su_nid'), alias = v('su_alias'), band = v('su_band'), phone = v('su_phone');
    var email = v('su_email'), pw = $('su_pw').value, pw2 = $('su_pw2').value;

    if (!comm) { A.msg('suMsg', '공동체를 골라 주세요.'); return; }
    if (!name) { A.msg('suMsg', '이름을 입력해 주세요.'); return; }
    if (!nid) { A.msg('suMsg', '블로그 네이버 아이디를 입력해 주세요.'); return; }
    if (/[^\w.-]/.test(nid)) { A.msg('suMsg', '네이버 아이디만 넣어 주세요. 주소 전체가 아니라 아이디 부분입니다.'); return; }
    if (!band) { A.msg('suMsg', '블로그 이웃 수 구간을 골라 주세요.'); return; }
    if (!phone) { A.msg('suMsg', '전화번호를 입력해 주세요.'); return; }

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
        A.msg('suMsg', /already/i.test(up.error.message)
          ? '이미 가입된 이메일입니다. 로그인해 주세요.' : '가입에 실패했습니다: ' + up.error.message);
        this.disabled = false; return;
      }
      uid = up.data.user.id;
      if (!up.data.session) await A.sb.auth.signInWithPassword({ email: email, password: pw });
    }

    var ins = await A.sb.from('bloggers').insert({
      id: uid, email: email || (A.SESSION && A.SESSION.user.email),
      name: name, phone: phone, age: age ? Number(age) : null,
      community_id: comm, naver_id: nid, blog_alias: alias || null,
      blog_url: 'https://blog.naver.com/' + nid,
      neighbors_band: band
    }).select();

    this.disabled = false;
    if (ins.error) { A.msg('suMsg', '신청 저장에 실패했습니다: ' + ins.error.message); return; }
    A.toast('신청이 접수되었습니다');
    location.hash = '';
    A.boot();
  };
})(window.ESC);
