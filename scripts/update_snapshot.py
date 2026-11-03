#!/usr/bin/env python3
"""Retrieve BNPB ArcGIS snapshot without creating placeholder numeric values.

Run in GitHub Actions or locally. Keeps only the latest record per province
so repeated daily records are not incorrectly aggregated.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import Request, urlopen

BASE = 'https://gis.bnpb.go.id/server/rest/services/2026_karhutla/mv_prov_karhutla_2026/MapServer/3/query'
V2 = 'https://gis.bnpb.go.id/server/rest/services/2026_karhutla/mv_tabeldata_karhutla_prov_2026_v2/MapServer/3/query'
FIELDS = 'provinsi,tgl_update,total_hotspot,hotspot_rendah,hotspot_sedang,hotspot_tinggi,luas_lahan_terbakar_sipongi_2026,total_personil_gabungan,sortie_water_bombing'
URL = BASE + '?' + urlencode({'where':'1=1','outFields':FIELDS,'returnGeometry':'false','f':'json','resultRecordCount':2000})
ROOT = Path(__file__).resolve().parents[1]
PRIORITY_PROVINCES = {'RIAU', 'JAMBI', 'SUMATERA SELATAN', 'KALIMANTAN BARAT', 'KALIMANTAN TENGAH', 'KALIMANTAN SELATAN'}

def main():
    candidates = []
    for base in (V2, BASE):
        url = base + '?' + urlencode({'where':'1=1','outFields':FIELDS,'returnGeometry':'false','f':'json','resultRecordCount':2000})
        try:
            req = Request(url, headers={'User-Agent':'Karhutla-Monitor/1.0','Accept':'application/json'})
            with urlopen(req, timeout=25) as response:
                data = json.load(response)
            if data.get('error') or not isinstance(data.get('features'), list):
                raise RuntimeError('Invalid ArcGIS response')
            rows = [feature.get('attributes', {}) for feature in data['features']]
            rows = [row for row in rows if isinstance(row,dict) and str(row.get('provinsi') or '').strip().upper() in PRIORITY_PROVINCES]
            if rows:
                newest = max(str(row.get('tgl_update') or '') for row in rows)
                candidates.append((newest,base,rows))
        except Exception as exc:
            print(f'Endpoint unavailable {base}: {exc}')
    if not candidates:
        raise RuntimeError('No verified province records from either BNPB endpoint')
    newest, selected_base, rows = max(candidates, key=lambda item:item[0])
    existing_path = ROOT / 'data' / 'karhutla.json'
    if existing_path.exists():
        existing = json.loads(existing_path.read_text(encoding='utf-8'))
        existing_dates = [str(x.get('attributes', {}).get('tgl_update') or '') for x in existing.get('features', [])]
        existing_newest = max(existing_dates, default='')
        if existing_newest and newest < existing_newest:
            print(f'Skipping stale API snapshot ({newest}); existing verified data is {existing_newest}')
            return
    if not rows:
        raise RuntimeError('BNPB returned no named provinces; refusing to replace current snapshot')
    latest = {}
    for row in rows:
        name = row['provinsi'].strip().upper()
        old = latest.get(name)
        if old is None or str(row.get('tgl_update') or '') > str(old.get('tgl_update') or ''):
            latest[name] = {k:row.get(k) for k in FIELDS.split(',')}
    payload = {
        'source': selected_base.rsplit('/query',1)[0],
        'fetched_at': datetime.now(timezone.utc).isoformat(),
        'scope_note': 'Six priority provinces only; not national totals; missing values are not zero',
        'features': [{'attributes':row} for row in sorted(latest.values(),key=lambda r:r['provinsi'])]
    }
    output = ROOT / 'data' / 'karhutla.json'
    if output.exists():
        try:
            previous = json.loads(output.read_text(encoding='utf-8'))
            previous_date = str(previous.get('reference_date') or max((str(f.get('attributes', {}).get('tgl_update') or '') for f in previous.get('features', [])), default=''))
            if previous_date > str(max((r.get('tgl_update') or '' for r in latest.values()), default='')):
                print(f'Keeping newer verified snapshot ({previous_date}); ArcGIS data is older')
                return
        except (ValueError, TypeError, OSError):
            pass
    output.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Wrote {len(latest)} distinct province records -> {output}')

if __name__ == '__main__': main()
