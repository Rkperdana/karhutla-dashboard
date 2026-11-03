# Indonesia Karhutla Monitor 2026 — Geospatial Explorer

Dashboard web statis responsif untuk eksplorasi data karhutla berdasarkan sumber primer BNPB. Desain memprioritaskan peta dan pengalaman mobile. **Tidak ada statistik contoh atau angka buatan.** Nilai tampil hanya jika berhasil diperoleh dari BNPB atau snapshot yang tervalidasi.

## Struktur

- `index.html` — tata letak dashboard
- `styles.css` — desain desktop, tablet, dan mobile
- `app.js` — logika interaktif, filter, choropleth, ranking, ekspor
- `data/karhutla.json` — snapshot kosong awal (tidak memuat nilai buatan)
- `scripts/update_snapshot.py` — pengunduh data resmi BNPB untuk snapshot
- `.github/workflows/` — deploy GitHub Pages dan pembaruan snapshot terjadwal

## Menjalankan lokal

Jalankan di folder ini:

```bash
python -m http.server 8000
```

Lalu kunjungi http://localhost:8000. Jangan buka lewat `file://` karena permintaan data dan pustaka eksternal dapat diblokir.

## Hosting GitHub Pages

1. Buat repository baru (misalnya `karhutla-monitor`), lalu unggah **seluruh isi folder ini** ke root repository pada cabang `main`.
2. Masuk ke Settings → Pages → Build and deployment → pilih **GitHub Actions**.
3. Pada tab Actions jalankan workflow `Deploy GitHub Pages` secara manual, atau push commit ke `main`.
4. Jika ingin menyimpan snapshot otomatis, beri izin yang diperlukan untuk workflow `Refresh BNPB karhutla snapshot`. Jadwal disetel setiap hari pukul 10.25 WIB dan hanya berjalan jika Actions diaktifkan.

## Sumber

- Dashboard resmi: https://data.bnpb.go.id/data/karhutla2026
- Metadata layer: https://gis.bnpb.go.id/server/rest/services/2026_karhutla/mv_prov_karhutla_2026/MapServer/3
- ArcGIS REST query: https://gis.bnpb.go.id/server/rest/services/2026_karhutla/mv_prov_karhutla_2026/MapServer/3/query
- Batas provinsi primer: https://geoservices.big.go.id/gis/rest/services/STIG/Batas_Provinsi/MapServer/0
- Fallback geometri: https://github.com/AlfianAliM/Indonesia-GeoJSON (`provinsi.geojson`, lisensi MIT menurut dokumentasi repositori)
- Pustaka peta: Leaflet 1.9.4; basemap CARTO/OSM (atribusi pada peta).

## Catatan penting tentang data

Layer BNPB `mv_prov_karhutla_2026` memiliki extent geografis terbatas (sekitar 100–117° BT). Oleh karena itu statistik tidak otomatis mewakili seluruh Indonesia. Setiap angka KPI diberi keterangan **wilayah tercakup**, bukan total nasional. Wilayah tanpa rekaman diberi warna abu-abu, bukan dianggap nol.

Satu snapshot `tgl_update` per provinsi dipilih sebagai rekaman terbaru bila ada duplikat tanggal. Grafik tren harian dikosongkan, sebab satu snapshot bukan deret waktu. Warna choropleth menunjukkan **jumlah hotspot atau luas lahan terbakar**, bukan peringkat risiko kebakaran. `luas_lahan_terbakar_sipongi_2026` dikutip dengan label sesuai konteks sumber. Komposisi hotspot hanya ditampilkan jika semua komponennya ada.

Browser dapat memblokir pemanggilan langsung ke layanan BNPB atau BIG karena CORS atau pembatasan jaringan. Jika demikian, dashboard menggunakan snapshot lokal jika tersedia; jika tidak, status ditampilkan sebagai *Data belum tersedia*. Untuk solusi yang lebih andal, jalankan `scripts/update_snapshot.py` dari GitHub Actions. Dashboard tidak menyamarkan kegagalan koneksi sebagai angka nol.

## Pengembangan berikutnya

Fitur yang sudah dibuat: navigasi, peta Leaflet, cari provinsi, filter tingkat hotspot, ganti layer hotspot/luas, batas provinsi, panel detail, KPIs, ranking, donut, tabel, ekspor CSV/JSON, dark mode, refresh, dan desain mobile. Tren historis yang akurat, level kabupaten/kota, ekspor XLSX/PDF, serta komparasi periode perlu sumber dan pengujian data tambahan.
