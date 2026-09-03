'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const SITE_URL = 'https://david14081982.github.io/SutiApp-private/';
const REDIRECT_URLS = Object.freeze([
  SITE_URL,
  SITE_URL + '?auth_flow=activation',
  SITE_URL + '?auth_flow=recovery',
]);

function env() {
  const values = {};
  for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('=');
    values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

function body(sql) {
  return sql.replace(/^\s*begin\s*;?/i, '').replace(/\s*commit\s*;?\s*$/i, '');
}

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`HTTP_${response.status}:${data && (data.message || data.error) || 'UNKNOWN'}`);
  return data;
}

function context(values) {
  assert(values.SUPABASE_URL && values.SUPABASE_ACCESS_TOKEN, 'Supabase management configuration missing');
  return {
    ref: new URL(values.SUPABASE_URL).hostname.split('.')[0],
    headers: {
      Authorization: `Bearer ${values.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SutiApp-AuthActivationCert/1.0',
    },
  };
}

async function sql(ctx, query) {
  return request(`https://api.supabase.com/v1/projects/${ctx.ref}/database/query`, {
    method: 'POST', headers: ctx.headers, body: JSON.stringify({ query }),
  });
}

async function authConfig(ctx) {
  return request(`https://api.supabase.com/v1/projects/${ctx.ref}/config/auth`, { headers: ctx.headers });
}

async function setProductionAuthConfig(ctx) {
  return request(`https://api.supabase.com/v1/projects/${ctx.ref}/config/auth`, {
    method: 'PATCH', headers: ctx.headers,
    body: JSON.stringify({ site_url: SITE_URL, uri_allow_list: REDIRECT_URLS.join(',') }),
  });
}

async function schemaStatus(ctx) {
  const rows = await sql(ctx, `select
    to_regprocedure('public.get_affiliate_activation_status(text)') is not null as rpc_present,
    (select count(*)::integer from public.affiliates) as affiliate_count,
    (select count(*)::integer from public.affiliates where auth_user_id is not null) as linked_count`);
  return rows[0];
}

function safeConfig(config) {
  const allow = String(config.uri_allow_list || '').split(',').map((value) => value.trim()).filter(Boolean);
  return {
    siteUrlPass: config.site_url === SITE_URL,
    redirectUrlsPass: REDIRECT_URLS.every((url) => allow.includes(url)),
    provider: config.smtp_host ? 'CUSTOM_SMTP' : 'SUPABASE_DEFAULT_EMAIL',
    smtpConfigured: Boolean(config.smtp_host && config.smtp_user),
    emailRateLimit: Number(config.rate_limit_email_sent),
    minimumIntervalSeconds: Number(config.smtp_max_frequency),
    emailAutoconfirm: Boolean(config.mailer_autoconfirm),
  };
}

async function main() {
  const mode = process.argv[2];
  if (!['--dry-run', '--apply', '--status'].includes(mode)) throw new Error('Explicit mode required: --dry-run | --apply | --status');
  const values = env();
  const ctx = context(values);
  const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260903000150_auth_prod_activation_preflight.sql'), 'utf8');
  const recovery = fs.readFileSync(path.join(root, 'supabase/recovery/20260903000150_auth_prod_activation_preflight_recovery.sql'), 'utf8');
  const beforeSchema = await schemaStatus(ctx);
  const beforeConfig = await authConfig(ctx);

  if (mode === '--dry-run') {
    if (!beforeSchema.rpc_present) {
      await sql(ctx, `begin;${body(migration)}
        do $check$ begin
          if public.get_affiliate_activation_status('invalid')->>'status' <> 'INVALID_EMAIL' then raise exception 'INVALID_EMAIL_CONTRACT'; end if;
          if has_function_privilege('anon','public.get_affiliate_activation_status(text)','EXECUTE') is not true then raise exception 'ANON_GRANT_MISSING'; end if;
        end $check$;
        ${body(recovery)}
        do $check$ begin
          if to_regprocedure('public.get_affiliate_activation_status(text)') is not null then raise exception 'RECOVERY_FAILED'; end if;
        end $check$; rollback;`);
    }
    console.log(JSON.stringify({ status: 'PASS', mode: 'DRY_RUN', schema: beforeSchema.rpc_present ? 'ALREADY_PRESENT' : 'FORWARD_RECOVERY', dataRowsChanged: 0, configBefore: safeConfig(beforeConfig) }));
    return;
  }

  if (mode === '--apply') {
    if (!beforeSchema.rpc_present) await sql(ctx, migration);
    await setProductionAuthConfig(ctx);
  }

  const afterSchema = await schemaStatus(ctx);
  const afterConfig = await authConfig(ctx);
  assert.equal(afterSchema.rpc_present, true, 'Activation preflight RPC missing');
  assert.equal(afterSchema.affiliate_count, beforeSchema.affiliate_count, 'Affiliate count changed during schema/config apply');
  assert.equal(afterSchema.linked_count, beforeSchema.linked_count, 'Auth linkage count changed during schema/config apply');
  const safe = safeConfig(afterConfig);
  assert.equal(safe.siteUrlPass, true, 'Production Site URL mismatch');
  assert.equal(safe.redirectUrlsPass, true, 'Production redirect allowlist mismatch');
  console.log(JSON.stringify({ status: 'PASS', mode: mode === '--apply' ? 'APPLIED' : 'STATUS', schema: afterSchema, authConfig: safe, dataRowsChanged: 0 }));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message }));
  process.exitCode = 1;
});
