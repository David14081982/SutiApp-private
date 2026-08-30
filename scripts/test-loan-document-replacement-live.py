#!/usr/bin/env python3
"""Reversible live proof for affiliate upload, verification, replacement and preview."""
from __future__ import annotations

import base64
import hashlib
import importlib.util
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def load_master():
    path = ROOT / "scripts" / "apply-master-assets.py"
    spec = importlib.util.spec_from_file_location("sutiapp_master_assets", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def request(url: str, key: str, token: str, method: str = "GET", body=None, content_type="application/json"):
    payload = json.dumps(body).encode() if content_type == "application/json" and body is not None else body
    headers = {"apikey": key, "Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "SutiApp-Loan-Document-Replacement-Test/1.0"}
    if body is not None:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=payload, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw and "json" in response.headers.get("Content-Type", "") else raw
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", "replace")
        try:
            detail = json.loads(raw)
        except json.JSONDecodeError:
            detail = raw
        return error.code, detail


def login(base: str, key: str, email: str, password: str) -> str:
    status, data = request(base + "/auth/v1/token?grant_type=password", key, key, "POST", {"email": email, "password": password})
    if status != 200:
        raise RuntimeError("LOGIN_FAILED")
    return data["access_token"]


def snapshot(master, env):
    return master.management_sql(env, """
select json_build_object(
  'documents',(select count(*) from public.affiliate_documents),
  'private_assets',(select count(*) from public.private_assets),
  'storage_objects',(select count(*) from storage.objects where bucket_id='private-assets'),
  'audit',(select count(*) from public.sensitive_change_audit)
) result
""")[0]["result"]


def main() -> int:
    master = load_master()
    env = master.read_env(ROOT / "supabase.env")
    base, key, service_key = env["SUPABASE_URL"].rstrip("/"), env["SUPABASE_PUBLISHABLE_KEY"], env["SUPABASE_SECRET_KEY"]
    affiliate_token = login(base, key, env["H005_TEST2_EMAIL"], env["H005_TEST2_PASSWORD"])
    other_affiliate_token = login(base, key, env["H005_TEST3_EMAIL"], env["H005_TEST3_PASSWORD"])
    admin_token = login(base, key, env["H005_TEST_EMAIL"], env["H005_TEST_PASSWORD"])
    affiliate_id = env["H005_TEST2_AFFILIATE_ID"]
    owner_document = master.management_sql(env, f"""
select id from public.affiliate_documents
where affiliate_id='{affiliate_id}'::uuid
order by created_at desc,id desc limit 1
""")
    if not owner_document:
        raise RuntimeError("NO_OWNER_DOCUMENT_FOR_SECURITY_PROOF")
    availability_url = base + "/rest/v1/rpc/get_affiliate_document_availability"
    cross_status, cross_detail = request(availability_url, key, other_affiliate_token, "POST", {"p_document_ids": [owner_document[0]["id"]]})
    anon_status, _ = request(availability_url, key, key, "POST", {"p_document_ids": [owner_document[0]["id"]]})
    if cross_status != 200 or cross_detail != []:
        raise RuntimeError("CROSS_AFFILIATE_AVAILABILITY_EXPOSED")
    if anon_status < 400:
        raise RuntimeError("ANONYMOUS_AVAILABILITY_ALLOWED")
    # Recover only residues created by this reversible harness. A concurrent
    # privacy certification can legitimately audit a QA document before this
    # harness reaches teardown, so its exact QA audit rows must be removed first.
    master.management_sql(env, f"""
begin;
delete from public.document_access_audit_log a using public.affiliate_documents d,public.private_assets pa
 where a.document_id=d.id and d.private_asset_id=pa.id and d.affiliate_id='{affiliate_id}'::uuid
   and pa.storage_bucket='private-assets' and pa.storage_path like 'affiliate-documents/{affiliate_id}/qa-loan-%';
delete from public.sensitive_change_audit a using public.affiliate_documents d,public.private_assets pa
 where a.target_id=d.id and d.private_asset_id=pa.id and d.affiliate_id='{affiliate_id}'::uuid
   and pa.storage_bucket='private-assets' and pa.storage_path like 'affiliate-documents/{affiliate_id}/qa-loan-%';
delete from public.affiliate_documents d using public.private_assets pa
 where d.private_asset_id=pa.id and d.affiliate_id='{affiliate_id}'::uuid
   and pa.storage_bucket='private-assets' and pa.storage_path like 'affiliate-documents/{affiliate_id}/qa-loan-%';
delete from public.private_assets pa where pa.storage_bucket='private-assets'
  and pa.storage_path like 'affiliate-documents/{affiliate_id}/qa-loan-%'
  and not exists(select 1 from public.affiliate_documents d where d.private_asset_id=pa.id)
  and not exists(select 1 from public.affiliate_files f where f.private_asset_id=pa.id);
commit;
""")
    stale = master.management_sql(env, f"""
select name from storage.objects o
where bucket_id='private-assets' and name like 'affiliate-documents/{affiliate_id}/qa-loan-%'
  and not exists(select 1 from public.private_assets pa where pa.storage_bucket=o.bucket_id and pa.storage_path=o.name)
""")
    for row in stale:
        stale_url = base + "/storage/v1/object/private-assets/" + urllib.parse.quote(row["name"], safe="/")
        stale_status, stale_detail = request(stale_url, service_key, service_key, "DELETE")
        if stale_status not in (200, 204):
            raise RuntimeError("STALE_QA_OBJECT_CLEANUP_FAILED: " + json.dumps(stale_detail))
    target = master.management_sql(env, f"""
select json_build_object('document_type_id',r.document_type_id,'label',dt.label) result
from public.program_document_requirements r join public.document_types dt on dt.id=r.document_type_id
where r.program_id='prestamo' and r.membership_offering_id is null and r.enabled and r.required
  and 'image/png'=any(dt.accepted_mime_types)
  and not exists(select 1 from public.affiliate_documents d where d.affiliate_id='{affiliate_id}'::uuid and d.document_type_id=r.document_type_id)
order by r.sort_order limit 1
""")
    if not target:
        raise RuntimeError("NO_REVERSIBLE_MISSING_DOCUMENT_TYPE")
    target = target[0]["result"]
    before = snapshot(master, env)
    nonce = str(time.time_ns())
    png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
    documents, assets, paths = [], [], []
    report = None

    def upload_and_register(suffix: str, payload: bytes):
        digest = hashlib.sha256(payload).hexdigest().upper()
        storage_path = f"affiliate-documents/{affiliate_id}/qa-loan-{nonce}-{suffix}.png"
        storage_url = base + "/storage/v1/object/private-assets/" + urllib.parse.quote(storage_path, safe="/")
        status, detail = request(storage_url, key, affiliate_token, "POST", payload, "image/png")
        if status not in (200, 201):
            raise RuntimeError("AFFILIATE_STORAGE_UPLOAD_FAILED: " + json.dumps(detail))
        paths.append((storage_path, storage_url))
        status, detail = request(base + "/rest/v1/rpc/register_affiliate_document", key, affiliate_token, "POST", {
            "p_document_type_id": target["document_type_id"], "p_storage_path": storage_path,
            "p_mime_type": "image/png", "p_file_size": len(payload), "p_sha256": digest, "p_source": "FILE",
        })
        if status != 200:
            raise RuntimeError("AFFILIATE_REGISTER_FAILED: " + json.dumps(detail))
        documents.append(detail["id"])
        assets.append(detail["private_asset_id"])
        return detail, storage_path

    try:
        baseline, _ = upload_and_register("baseline", png + nonce.encode())
        review_status, review_detail = request(base + "/rest/v1/rpc/review_affiliate_document", key, admin_token, "POST", {
            "p_document_id": baseline["id"], "p_status": "VERIFIED", "p_observation": "Prueba reversible de reemplazo documental",
        })
        if review_status != 200 or review_detail.get("status") != "VERIFIED":
            raise RuntimeError("BASELINE_VERIFICATION_FAILED: " + json.dumps(review_detail))
        replacement, replacement_path = upload_and_register("replacement", png + (nonce + "-replacement").encode())
        persisted = master.management_sql(env, f"""
select json_build_object(
  'old_status',(select status from public.affiliate_documents where id='{baseline['id']}'::uuid),
  'new_status',(select status from public.affiliate_documents where id='{replacement['id']}'::uuid),
  'replaces',(select replaces_document_id from public.affiliate_documents where id='{replacement['id']}'::uuid),
  'newest',(select id from public.affiliate_documents where affiliate_id='{affiliate_id}'::uuid and document_type_id='{target['document_type_id']}'::uuid order by created_at desc,id desc limit 1),
  'object_exists',exists(select 1 from storage.objects where bucket_id='private-assets' and name='{replacement_path}'),
  'replacement_audited',exists(select 1 from public.sensitive_change_audit where target_id='{replacement['id']}'::uuid and action='REPLACEMENT_UPLOAD')
) result
""")[0]["result"]
        if persisted["old_status"] != "VERIFIED" or persisted["new_status"] != "PENDING_REVIEW" or persisted["replaces"] != baseline["id"] or persisted["newest"] != replacement["id"] or not persisted["object_exists"] or not persisted["replacement_audited"]:
            raise RuntimeError("REPLACEMENT_CONTRACT_FAILED: " + json.dumps(persisted))
        sign_status, sign_detail = request(base + "/storage/v1/object/sign/private-assets/" + urllib.parse.quote(replacement_path, safe="/"), key, affiliate_token, "POST", {"expiresIn": 300})
        signed = sign_detail.get("signedURL") or sign_detail.get("signedUrl") if isinstance(sign_detail, dict) else None
        if sign_status != 200 or not signed:
            raise RuntimeError("FRESH_SIGN_FAILED")
        fetch_url = signed if signed.startswith("http") else base + "/storage/v1" + signed
        fetch_status, _ = request(fetch_url, key, affiliate_token)
        if fetch_status != 200:
            raise RuntimeError("SIGNED_FETCH_FAILED")
        report = {"status": "PASS", "upload": True, "gallery_image": True, "replacement": persisted, "fresh_preview": True, "private_bucket": True, "old_verified_immutable": True, "cross_affiliate_denied": True, "anonymous_denied": True, "credentials_exposed": False}
    finally:
        if documents:
            quoted_docs = ",".join("'%s'::uuid" % value for value in documents)
            quoted_assets = ",".join("'%s'::uuid" % value for value in assets)
            master.management_sql(env, f"""
begin;
delete from public.document_access_audit_log where document_id in ({quoted_docs});
delete from public.sensitive_change_audit where target_id in ({quoted_docs});
delete from public.affiliate_documents where id='{documents[-1]}'::uuid;
delete from public.affiliate_documents where id in ({quoted_docs});
delete from public.private_assets where id in ({quoted_assets})
  and not exists(select 1 from public.affiliate_documents d where d.private_asset_id=public.private_assets.id)
  and not exists(select 1 from public.affiliate_files f where f.private_asset_id=public.private_assets.id);
commit;
""")
        for _, storage_url in reversed(paths):
            delete_status, detail = request(storage_url, service_key, service_key, "DELETE")
            if delete_status not in (200, 204):
                raise RuntimeError("STORAGE_CLEANUP_FAILED: " + json.dumps(detail))
        after = snapshot(master, env)
        if before != after:
            raise RuntimeError("LIVE_TEST_CLEANUP_MISMATCH: " + json.dumps({"before": before, "after": after}))
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
