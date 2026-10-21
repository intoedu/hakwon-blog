// ============================================================
// 알림톡 한 건 보내기 (솔라피)
//
// 센터(ESC 학원지원)와 인투마케팅이 **같은 함수 한 벌**을 씁니다.
// 받는 사람이 누구냐에 따라 발신 채널이 갈립니다 —
//   고객(order_paid·first_post·half·order_done·request_received) → 인투마케팅
//   나머지(블로거 17종)                                          → ESC 학원지원
//
// 부르는 법 ---------------------------------------------------
//   POST /functions/v1/send-alimtalk
//   헤더 : Authorization: Bearer <로그인한 관리자 토큰>   (센터 화면에서 시험 발송)
//          또는 x-call-token: <1회용 열쇠>                 (DB 트리거에서 부를 때)
//          또는 Authorization: Bearer <service_role 키>   (다른 서버에서 부를 때)
//   본문 : { "kind": "request_received",
//            "to": "01012345678",
//            "vars": { "상호": "○○학원", "서비스명": "홈페이지 제작" },
//            "ref": "request:<신청 id>" }
//
//   돌려주는 값 : { ok:true, message_id }           보냈습니다
//                 { ok:true, skipped:"<이유>" }      보내지 않았습니다 (실패가 아닙니다)
//                 { ok:false, error:"<사유>" }       보내려다 실패했습니다
//
// 🔴 `vars` 의 키는 템플릿 변수 이름과 **글자까지 같아야** 합니다.
//    `#{ }` 는 붙여도 되고 빼도 됩니다 — 이 함수가 붙여서 보냅니다.
//
// 🔴 템플릿이 승인되지 않았거나 솔라피 키가 없으면 **보내지 않고 skipped** 로
//    돌려줍니다. 부르는 쪽은 실패로 보지 않아도 되고, 미리 붙여 두어도 안전합니다.
//
// 필요한 비밀값 — Supabase 대시보드 > Edge Functions > Secrets
//   SOLAPI_API_KEY        솔라피 API Key
//   SOLAPI_API_SECRET     솔라피 API Secret
//   SOLAPI_SENDER         대체발송용 발신번호 (없어도 보내집니다)
//
// 🔴 **넣어야 하는 것은 솔라피 키 두 개뿐입니다.** 서버끼리 쓰는 열쇠는 DB 안에서
//    1회용으로 주고받으므로(alimtalk_calls 표) 사람이 옮겨 적을 값이 없습니다.
//
// 템플릿 ID · 발신프로필(pfId) 은 비밀값이 아니라 센터 `settings` 표
// key='blog' 의 `alimtalk_templates` · `alimtalk_pf` 에 있습니다.
// 보낸 기록은 `alimtalk_log` 표에 남습니다.
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2.47.10';

const SOLAPI_URL = 'https://api.solapi.com/messages/v4/send-many/detail';

/* 고객에게 가는 알림 — 「인투마케팅」 채널로 나갑니다.
   🔴 블로거용을 인투마케팅 채널로 보내면 안 됩니다 (브랜드가 다릅니다) */
const CUSTOMER_KINDS = [
  'order_paid', 'first_post', 'half', 'order_done', 'request_received',
];

/* 🔴 22번 신청접수안내의 `#{서비스명}` 에 들어갈 수 있는 값은 이 다섯뿐입니다.
   검수 의견에 이 다섯을 적어 승인받았으므로, 다른 값은 승인 범위를 벗어납니다. */
const SERVICE_NAMES = [
  '블로그·리뷰', '홈페이지 제작', 'SNS 채널', '그래픽 디자인', '영상 제작',
];

const env = (k: string) => Deno.env.get(k) ?? '';
const digits = (v: unknown) => String(v ?? '').replace(/[^0-9]/g, '');

/* 휴대전화인지 — 유선번호로는 알림톡이 가지 않습니다.
   병의원·요식업은 유선번호만 쓰는 곳이 많아 **막지 않고** 건너뜁니다.
   그런 건은 담당자가 전화로 연락합니다 (2026-10-12 행정 결정) */
const isMobile = (p: string) => /^01[016-9][0-9]{7,8}$/.test(p);

/* 솔라피 인증 — date + salt 를 API Secret 으로 HMAC-SHA256 서명합니다.
   서버 시각이 15분 이상 어긋나면 RequestTimeTooSkewed 가 돌아옵니다. */
async function authHeader(): Promise<string> {
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, '');
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(env('SOLAPI_API_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(date + salt));
  const signature = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `HMAC-SHA256 apiKey=${env('SOLAPI_API_KEY')}, date=${date}, salt=${salt}, signature=${signature}`;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-call-token',
      },
    });
  }
  if (req.method !== 'POST') return json({ ok: false, error: 'POST 로만 부를 수 있습니다' }, 405);

  const admin = createClient(
    env('SUPABASE_URL'),
    env('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
  );

  /* ── 부를 수 있는 사람인지 ──
     ① x-call-token 이 DB 에 있는 1회용 열쇠면 통과 (DB 트리거에서 부를 때).
        열쇠는 5분만 살고 한 번 쓰면 끝이라, 새어 나가도 되쓸 수 없습니다.
     ② service_role 키로 부르면 통과 (다른 서버에서 부를 때)
     ③ 아니면 로그인한 **관리자**여야 합니다 (센터 화면에서 시험 발송)
     🔴 아무나 부르게 두면 남의 번호로 알림톡을 쏠 수 있고 돈이 나갑니다. */
  let allowed = false;
  const callToken = req.headers.get('x-call-token');
  if (callToken) {
    const { data } = await admin.rpc('alimtalk_use_call_token', { p_token: callToken });
    allowed = data === true;
  }
  if (!allowed) {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (token && token === env('SUPABASE_SERVICE_ROLE_KEY')) {
      allowed = true;
    } else if (token) {
      const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      });
      const { data } = await asUser.rpc('blog_admin');
      allowed = data === true;
    }
  }
  if (!allowed) return json({ ok: false, error: '권한이 없습니다' }, 403);

  const body = await req.json().catch(() => ({}));
  const kind = String(body.kind ?? '').trim();
  const to = digits(body.to);
  const ref = body.ref ? String(body.ref).slice(0, 200) : null;
  const rawVars = (body.vars && typeof body.vars === 'object') ? body.vars : {};

  if (!kind) return json({ ok: false, error: 'kind 가 없습니다' }, 400);
  if (!to) return json({ ok: false, error: 'to (받는 번호) 가 없습니다' }, 400);

  const channel = CUSTOMER_KINDS.includes(kind) ? 'intomarketing' : 'esc';

  /* 기록 한 줄 남기기 — 보냈든 건너뛰었든 실패했든 */
  const log = async (status: string, extra: Record<string, unknown> = {}) => {
    await admin.from('alimtalk_log').insert({
      kind, channel, to_phone: to, vars: rawVars, ref, status, ...extra,
    });
  };

  /* ── 같은 건을 두 번 보내지 않습니다 ── */
  if (ref) {
    const { data: dup } = await admin.from('alimtalk_log')
      .select('message_id').eq('ref', ref).eq('status', 'sent').maybeSingle();
    if (dup) return json({ ok: true, skipped: '이미 보낸 건입니다', message_id: dup.message_id });
  }

  /* ── 템플릿 ID · 발신프로필 찾기 ── */
  const { data: st, error: stErr } = await admin
    .from('settings').select('value').eq('key', 'blog').maybeSingle();
  if (stErr || !st) {
    await log('failed', { error: '센터 설정을 읽지 못했습니다' });
    return json({ ok: false, error: '센터 설정을 읽지 못했습니다' }, 500);
  }
  const tpl = (st.value?.alimtalk_templates ?? {})[kind];
  const pfId = (st.value?.alimtalk_pf ?? {})[channel];

  if (!tpl?.id || !tpl?.approved) {
    const why = tpl?.id ? '템플릿이 아직 승인되지 않았습니다' : '등록된 템플릿이 없습니다 (kind: ' + kind + ')';
    await log('skipped', { template_id: tpl?.id ?? null, error: why });
    return json({ ok: true, skipped: why });
  }
  if (!pfId) {
    const why = channel + ' 채널의 발신프로필(pfId)이 없습니다';
    await log('skipped', { template_id: tpl.id, error: why });
    return json({ ok: true, skipped: why });
  }

  /* ── 휴대전화가 아니면 보내지 않습니다 ── */
  if (!isMobile(to)) {
    const why = '휴대전화 번호가 아닙니다 — 담당자가 전화로 연락해야 합니다';
    await log('skipped', { template_id: tpl.id, error: why });
    return json({ ok: true, skipped: why });
  }

  /* ── 🔴 `#{서비스명}` 은 승인받은 다섯 값만 ── */
  const svc = rawVars['서비스명'] ?? rawVars['#{서비스명}'];
  if (svc !== undefined && !SERVICE_NAMES.includes(String(svc))) {
    const why = '서비스명 「' + svc + '」 은 승인된 값이 아닙니다 (' + SERVICE_NAMES.join(' / ') + ')';
    await log('skipped', { template_id: tpl.id, error: why });
    return json({ ok: true, skipped: why });
  }

  /* 솔라피는 변수 키를 `#{이름}` 꼴로 받습니다. 어느 쪽으로 넘겨도 되게 붙여 줍니다 */
  const variables: Record<string, string> = {};
  for (const [k, v] of Object.entries(rawVars)) {
    variables[/^#\{.*\}$/.test(k) ? k : '#{' + k + '}'] = String(v ?? '');
  }

  /* ── 솔라피 키가 없으면 보내지 않고 기록만 ── */
  if (!env('SOLAPI_API_KEY') || !env('SOLAPI_API_SECRET')) {
    const why = '솔라피 키(SOLAPI_API_KEY · SOLAPI_API_SECRET)가 아직 없습니다';
    await log('skipped', { template_id: tpl.id, error: why });
    return json({ ok: true, skipped: why });
  }

  /* ── 보내기 ──
     🔴 disableSms: true — 알림톡이 실패해도 **문자로 대신 보내지 않습니다.**
        대체발송 문구는 솔라피 템플릿에 저장된 것이 나가므로, 뜻하지 않은 문장이
        고객·블로거에게 갈 수 있습니다. 실패한 건은 기록에 남으니 담당자가 처리합니다.
        (문자 대체발송을 켜려면 여기만 false 로 바꾸면 됩니다) */
  const payload = {
    messages: [{
      to,
      from: digits(env('SOLAPI_SENDER')) || undefined,
      type: 'ATA',
      kakaoOptions: { pfId, templateId: tpl.id, variables, disableSms: true },
    }],
    showMessageList: true,
  };

  let res: Response;
  let out: Record<string, unknown> = {};
  try {
    res = await fetch(SOLAPI_URL, {
      method: 'POST',
      headers: { Authorization: await authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    out = await res.json().catch(() => ({ status: res.status }));
  } catch (e) {
    await log('failed', { template_id: tpl.id, error: String(e) });
    return json({ ok: false, error: '솔라피에 닿지 못했습니다: ' + String(e) }, 502);
  }

  const okList = (out.messageList ?? []) as Array<Record<string, string>>;
  const badList = (out.failedMessageList ?? []) as Array<Record<string, string>>;

  if (!res.ok || badList.length || !okList.length) {
    const bad = badList[0] ?? {};
    const why = bad.statusMessage
      ? bad.statusMessage + ' (' + (bad.statusCode ?? '') + ')'
      : JSON.stringify(out).slice(0, 400);
    await log('failed', { template_id: tpl.id, error: why, response: out });
    return json({ ok: false, error: why }, 502);
  }

  const messageId = okList[0].messageId ?? null;
  await log('sent', { template_id: tpl.id, message_id: messageId, response: out });
  return json({ ok: true, message_id: messageId });
});
