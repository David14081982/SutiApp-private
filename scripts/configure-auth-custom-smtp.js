'use strict';

const assert = require('assert').strict;
const fs = require('fs');
const path = require('path');
const tls = require('tls');

const root = path.resolve(__dirname, '..');
const DEFAULT_EMAIL_RATE_LIMIT = 30;

function env() {
  const values = {};
  for (const raw of fs.readFileSync(path.join(root, 'supabase.env'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const at = line.indexOf('=');
    values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^["']|["']$/g, '');
  }
  return values;
}

async function request(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = data && (data.code || data.error_code);
    const safeCode = /^[A-Za-z0-9_.-]{1,80}$/.test(String(code || '')) ? String(code) : 'REMOTE_ERROR';
    throw new Error(`HTTP_${response.status}:${safeCode}`);
  }
  return data;
}

function managementContext(values) {
  assert(values.SUPABASE_URL && values.SUPABASE_ACCESS_TOKEN, 'SUPABASE_MANAGEMENT_CONFIGURATION_MISSING');
  return {
    ref: new URL(values.SUPABASE_URL).hostname.split('.')[0],
    headers: {
      Authorization: `Bearer ${values.SUPABASE_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'SutiApp-CustomSmtp/1.0',
    },
  };
}

async function getAuthConfig(ctx) {
  return request(`https://api.supabase.com/v1/projects/${ctx.ref}/config/auth`, { headers: ctx.headers });
}

async function patchAuthConfig(ctx, body) {
  return request(`https://api.supabase.com/v1/projects/${ctx.ref}/config/auth`, {
    method: 'PATCH',
    headers: ctx.headers,
    body: JSON.stringify(body),
  });
}

async function resendUsage(values) {
  const response = await fetch('https://api.resend.com/usage', {
    headers: { Authorization: `Bearer ${values.SMTP_PASS}`, 'User-Agent': 'SutiApp-CustomSmtp/1.0' },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) return { available: false, httpStatus: response.status };
  return {
    available: true,
    dailyUsed: data && data.emails && data.emails.daily && Number(data.emails.daily.used),
    dailyLimit: data && data.emails && data.emails.daily && data.emails.daily.limit,
    monthlyUsed: data && data.emails && data.emails.monthly && Number(data.emails.monthly.used),
    monthlyLimit: data && data.emails && data.emails.monthly && Number(data.emails.monthly.limit),
    requestsPerWindow: data && data.rate_limit && Number(data.rate_limit.limit),
    rateWindow: data && data.rate_limit && data.rate_limit.duration,
  };
}

function validate(values) {
  for (const key of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_ADMIN_EMAIL', 'SMTP_SENDER_NAME']) {
    assert(values[key], `${key}_MISSING`);
  }
  assert.equal(values.SMTP_HOST, 'smtp.resend.com', 'SMTP_HOST_UNEXPECTED');
  assert.equal(values.SMTP_PORT, '465', 'SMTP_PORT_UNEXPECTED');
  assert.equal(values.SMTP_USER, 'resend', 'SMTP_USER_UNEXPECTED');
  assert(/^re_[A-Za-z0-9_-]{8,}$/.test(values.SMTP_PASS), 'SMTP_PASS_FORMAT_INVALID');
  assert.equal(values.SMTP_ADMIN_EMAIL, 'no-reply@auth.sutiapp.com', 'SMTP_SENDER_UNEXPECTED');
  assert.equal(values.SMTP_SENDER_NAME, 'SutiApp', 'SMTP_SENDER_NAME_UNEXPECTED');
}

function verifySmtpCredentials(values) {
  return new Promise((resolve, reject) => {
    let stage = 'greeting';
    let buffer = '';
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(result);
    };
    const socket = tls.connect({
      host: values.SMTP_HOST,
      port: Number(values.SMTP_PORT),
      servername: values.SMTP_HOST,
      rejectUnauthorized: true,
    });
    socket.setTimeout(15000, () => finish(new Error('SMTP_TIMEOUT')));
    socket.on('error', (error) => finish(new Error(`SMTP_TLS_${error.code || 'ERROR'}`)));
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      if (!buffer.endsWith('\r\n')) return;
      const lines = buffer.trimEnd().split(/\r\n/);
      const last = lines[lines.length - 1];
      if (stage === 'greeting' && /^220 /.test(last)) {
        stage = 'ehlo'; buffer = ''; socket.write('EHLO sutiapp.com\r\n'); return;
      }
      if (stage === 'ehlo' && /^250 /.test(last)) {
        stage = 'auth'; buffer = '';
        const payload = Buffer.from(`\0${values.SMTP_USER}\0${values.SMTP_PASS}`).toString('base64');
        socket.write(`AUTH PLAIN ${payload}\r\n`);
        return;
      }
      if (stage === 'auth' && /^235 /.test(last)) {
        const result = { tlsAuthorized: socket.authorized, tlsProtocol: socket.getProtocol(), credentialsValid: true };
        stage = 'quit'; buffer = ''; socket.write('QUIT\r\n'); finish(null, result); return;
      }
      if (/^[45]\d\d /.test(last)) finish(new Error(`SMTP_REJECTED_${last.slice(0, 3)}`));
    });
  });
}

function safe(config) {
  return {
    provider: config.smtp_host ? 'CUSTOM_SMTP' : 'SUPABASE_DEFAULT_EMAIL',
    smtpConfigured: Boolean(config.smtp_host && config.smtp_user && config.smtp_admin_email),
    smtpHostPass: config.smtp_host === 'smtp.resend.com',
    smtpPortPass: Number(config.smtp_port) === 465,
    smtpUserPass: config.smtp_user === 'resend',
    senderPass: config.smtp_admin_email === 'no-reply@auth.sutiapp.com',
    senderNamePass: config.smtp_sender_name === 'SutiApp',
    emailRateLimit: Number(config.rate_limit_email_sent),
    minimumIntervalSeconds: Number(config.smtp_max_frequency),
    emailAutoconfirm: Boolean(config.mailer_autoconfirm),
  };
}

async function main() {
  const mode = process.argv[2];
  assert(['--check', '--apply', '--status', '--resend-usage'].includes(mode), 'EXPLICIT_MODE_REQUIRED');
  const values = env();
  validate(values);
  const ctx = managementContext(values);
  const before = await getAuthConfig(ctx);

  if (mode === '--resend-usage') {
    console.log(JSON.stringify({ status: 'PASS', mode: 'RESEND_USAGE', usage: await resendUsage(values), secretsPrinted: false }));
    return;
  }

  if (mode === '--status') {
    console.log(JSON.stringify({ status: 'PASS', mode: 'STATUS', authConfig: safe(before), secretsPrinted: false }));
    return;
  }

  const smtp = await verifySmtpCredentials(values);
  if (mode === '--check') {
    console.log(JSON.stringify({ status: 'PASS', mode: 'CHECK', smtp, authConfig: safe(before), secretsPrinted: false }));
    return;
  }

  const rateIndex = process.argv.indexOf('--rate');
  const cliRate = rateIndex >= 0 ? process.argv[rateIndex + 1] : null;
  const requestedRate = Number(cliRate || values.AUTH_EMAIL_RATE_LIMIT || DEFAULT_EMAIL_RATE_LIMIT);
  assert(Number.isInteger(requestedRate) && requestedRate >= 2 && requestedRate <= 18000, 'AUTH_EMAIL_RATE_LIMIT_INVALID');
  await patchAuthConfig(ctx, {
    external_email_enabled: true,
    mailer_secure_email_change_enabled: true,
    mailer_autoconfirm: false,
    smtp_admin_email: values.SMTP_ADMIN_EMAIL,
    smtp_host: values.SMTP_HOST,
    smtp_port: values.SMTP_PORT,
    smtp_user: values.SMTP_USER,
    smtp_pass: values.SMTP_PASS,
    smtp_sender_name: values.SMTP_SENDER_NAME,
    smtp_max_frequency: 60,
    rate_limit_email_sent: requestedRate,
  });
  const after = await getAuthConfig(ctx);
  const result = safe(after);
  assert.equal(result.smtpConfigured, true, 'CUSTOM_SMTP_NOT_CONFIGURED');
  assert.equal(result.smtpHostPass, true, 'SMTP_HOST_MISMATCH');
  assert.equal(result.smtpPortPass, true, 'SMTP_PORT_MISMATCH');
  assert.equal(result.smtpUserPass, true, 'SMTP_USER_MISMATCH');
  assert.equal(result.senderPass, true, 'SMTP_SENDER_MISMATCH');
  assert.equal(result.senderNamePass, true, 'SMTP_SENDER_NAME_MISMATCH');
  assert.equal(result.emailRateLimit, requestedRate, 'AUTH_EMAIL_RATE_LIMIT_MISMATCH');
  assert.equal(result.emailAutoconfirm, false, 'EMAIL_AUTOCONFIRM_MUST_REMAIN_DISABLED');
  console.log(JSON.stringify({ status: 'PASS', mode: 'APPLY', smtp, authConfig: result, secretsPrinted: false }));
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'FAIL', error: error.message, secretsPrinted: false }));
  process.exitCode = 1;
});
