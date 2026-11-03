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
FIELDS = 'provinsi,tgl_update,total_hotspot,hotspot_rendah,hotspot_sedang,hotspot_tinggi,luas_lahan_terbakar_sipongi_2026,total_personil_gabungan,sortie_water_bombing'
URL = BASE + '?' + urlencode({'where':'1=1','outFields':FIELDS,'returnGeometry':'false','f':'json','resultRecordCount':2000})
ROOT = Path(__file__).resolve().parents[1]

def main():
    req = Request(URL, headers={'User-Agent':'Karhutla-Monitor-Public-Dashboard/0.1 (informational data) Accept: application/json','Accept':'application/json'})
    with urlopen(req, timeout=30) as response:
        data = json.load(response)
    if data.get('error'):
        raise RuntimeError(f"ArcGIS API error: {data['error']}")
    if not isinstance(data.get('features'), list):
        raise RuntimeError('Unexpected ArcGIS response: missing features')
    rows = [feature.get('attributes', {}) for feature in data['features']]
    rows = [row for row in rows if isinstance(row,dict) and str(row.get('provinsi') or '').strip()]
    if not rows:
        raise RuntimeError('BNPB returned no named provinces; refusing to replace current snapshot')
    latest = {}
    for row in rows:
        name = row['provinsi'].strip().upper()
        old = latest.get(name)
        if old is None or str(row.get('tgl_update') or '') > str(old.get('tgl_update') or ''):
            latest[name] = {k:row.get(k) for k in FIELDS.split(',')}
    payload = {
        'source': BASE.rsplit('/query',1)[0],
        'fetched_at': datetime.now(timezone.utc).isoformat(),
        'scope_note': 'Subset of BNPB layer only; not necessarily national data',
        'features': [{'attributes':row} for row in sorted(latest.values(),key=lambda r:r['provinsi'])]
    }
    output = ROOT / 'data' / 'karhutla.json'
    output.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Wrote {len(latest)} distinct province records -> {output}')

if __name__ == '__main__': main()
