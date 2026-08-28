#!/usr/bin/env python3
"""Reversible live proof for Admin upload, permission denial, persistence and cleanup."""
from __future__ import annotations

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
    path = ROOT / "scripts/apply-master-assets.py"
    spec = importlib.util.spec_from_file_location("sutiapp_master_assets", path)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def request(url: str, key: str, token: str, method: str = "GET", body=None, content_type="application/json"):
    payload = json.dumps(body).encode() if content_type == "application/json" and body is not None else body
    headers={"apikey": key, "Authorization": "Bearer " + token, "Accept": "application/json", "User-Agent": "SutiApp-Admin-Affiliate-Document-Test/1.0"}
    if body is not None: headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=payload, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            raw = response.read()
            return response.status, json.loads(raw) if raw and "json" in response.headers.get("Content-Type", "") else raw.decode("utf-8", "replace")
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
    base = env["SUPABASE_URL"].rstrip("/")
    key = env["SUPABASE_PUBLISHABLE_KEY"]
    admin = login(base, key, env["H005_TEST_EMAIL"], env["H005_TEST_PASSWORD"])
    normal = login(base, key, env["H005_TEST3_EMAIL"], env["H005_TEST3_PASSWORD"])
    stale = master.management_sql(env, """
select name from storage.objects o
where bucket_id='private-assets' and name like 'affiliate-documents/%/qa-admin-%.pdf'
  and not exists(select 1 from public.private_assets pa where pa.storage_bucket=o.bucket_id and pa.storage_path=o.name)
""")
    for row in stale:
        stale_url = base + "/storage/v1/object/private-assets/" + urllib.parse.quote(row["name"], safe="/")
        stale_status, stale_data = request(stale_url, key, admin, "DELETE")
        if stale_status not in (200, 204):
            raise RuntimeError("STALE_QA_OBJECT_CLEANUP_FAILED: " + json.dumps(stale_data))
    target = master.management_sql(env, """
select json_build_object('affiliate_id',a.id,'document_type_id',t.id,'type_label',t.label) result
from public.affiliates a cross join public.document_types t
where t.enabled and 'application/pdf'=any(t.accepted_mime_types)
  and not exists(select 1 from public.affiliate_documents d where d.affiliate_id=a.id and d.document_type_id=t.id)
order by a.created_at,a.id,t.sort_order limit 1
""")[0]["result"]
    before = snapshot(master, env)
    nonce = str(time.time_ns())
    payload = ("%PDF-1.4\n% SutiApp reversible admin upload " + nonce + "\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n").encode()
    digest = hashlib.sha256(payload).hexdigest().upper()
    path = f"affiliate-documents/{target['affiliate_id']}/qa-admin-{nonce}.pdf"
    rpc_payload = {
        "p_affiliate_id": target["affiliate_id"], "p_document_type_id": target["document_type_id"],
        "p_storage_path": path, "p_mime_type": "application/pdf", "p_file_size": len(payload),
        "p_sha256": digest, "p_reason": "Prueba reversible de carga administrativa",
    }
    rpc_url = base + "/rest/v1/rpc/register_admin_affiliate_document"
    storage_url = base + "/storage/v1/object/private-assets/" + urllib.parse.quote(path, safe="/")
    document_id = asset_id = None
    storage_uploaded = False
    report = None
    try:
        normal_status, _ = request(rpc_url, key, normal, "POST", rpc_payload)
        anonymous_status, _ = request(rpc_url, key, key, "POST", rpc_payload)
        if normal_status < 400 or anonymous_status < 400:
            raise RuntimeError("UNAUTHORIZED_UPLOAD_RPC_ALLOWED")
        upload_status, upload_data = request(storage_url, key, admin, "POST", payload, "application/pdf")
        if upload_status not in (200, 201):
            raise RuntimeError("STORAGE_UPLOAD_FAILED: " + json.dumps(upload_data))
        storage_uploaded = True
        rpc_status, rpc_data = request(rpc_url, key, admin, "POST", rpc_payload)
        if rpc_status != 200:
            raise RuntimeError("ADMIN_UPLOAD_RPC_FAILED: " + json.dumps(rpc_data))
        document_id = rpc_data["document"]["id"]
        persisted = master.management_sql(env, f"""
select json_build_object(
  'document_id',d.id,'asset_id',d.private_asset_id,'affiliate_id',d.affiliate_id,
  'status',d.status,'storage_path',pa.storage_path,'sha256',pa.content_sha256,
  'audit_exists',exists(select 1 from public.sensitive_change_audit s where s.target_id=d.id and s.action='ADMIN_UPLOAD')
) result
from public.affiliate_documents d join public.private_assets pa on pa.id=d.private_asset_id
where d.id='{document_id}'::uuid
""")[0]["result"]
        asset_id = persisted["asset_id"]
        after_upload = snapshot(master, env)
        if persisted["affiliate_id"] != target["affiliate_id"] or persisted["status"] != "PENDING_REVIEW" or persisted["storage_path"] != path or persisted["sha256"] != digest or not persisted["audit_exists"]:
            raise RuntimeError("PERSISTENCE_MISMATCH: " + json.dumps(persisted))
        referenced_delete_status, _ = request(storage_url, key, admin, "DELETE")
        if referenced_delete_status < 400:
            raise RuntimeError("REFERENCED_STORAGE_OBJECT_DELETE_ALLOWED")
        report = {
            "status": "PASS", "admin_upload": True, "normal_denied": True, "anonymous_denied": True,
            "private_storage": True, "referenced_delete_denied": True, "persistence": persisted, "before": before, "after_upload": after_upload,
            "credentials_exposed": False,
        }
    finally:
        if document_id:
            master.management_sql(env, f"""
begin;
delete from public.sensitive_change_audit where target_id='{document_id}'::uuid;
delete from public.affiliate_documents where id='{document_id}'::uuid;
delete from public.private_assets where id='{asset_id}'::uuid
  and not exists(select 1 from public.affiliate_documents where private_asset_id='{asset_id}'::uuid)
  and not exists(select 1 from public.affiliate_files where private_asset_id='{asset_id}'::uuid);
commit;
""")
        if storage_uploaded:
            delete_status, delete_data = request(storage_url, key, admin, "DELETE")
            if delete_status not in (200, 204):
                raise RuntimeError("STORAGE_FIXTURE_CLEANUP_FAILED: " + json.dumps(delete_data))
        after = snapshot(master, env)
        if before != after:
            raise RuntimeError("LIVE_TEST_CLEANUP_MISMATCH: " + json.dumps({"before": before, "after": after}))
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
