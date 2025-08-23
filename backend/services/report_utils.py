import os, datetime
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from store.state import STATE
import pandas as pd

# =======================
# Helpers (display & rec)
# =======================
def _feature_display_name(feat: str) -> str:
    """
    Nama fitur yang ditampilkan ke user.
    - Jika STATE['feature_display_map'] ada, gunakan itu (bisa dari header Google Form).
    - Tangani one-hot: 'Pertanyaan__Kategori' -> 'Pertanyaan'.
    - Fallback: pakai base name (sebelum '__').
    """
    fmap = STATE.get("feature_display_map") or {}
    base = feat.split("__")[0]
    return fmap.get(feat) or fmap.get(base) or base


def _smart_actions_for_cluster(cid: int, means_by_c: pd.DataFrame, global_mean: pd.Series) -> list[str]:
    """
    Kembalikan 1–3 langkah rekomendasi spesifik untuk klaster `cid`:
    - fokus pada 3 indikator dengan rata-rata klaster paling di bawah rata-rata global,
    - tambah tindakan kontekstual berdasarkan kata kunci pertanyaan.
    """
    deltas = (means_by_c.loc[cid] - global_mean).dropna()
    worst3 = deltas.nsmallest(3).index.tolist()
    worst_full = [_feature_display_name(f) for f in worst3]

    text = " ".join(worst_full).lower()
    actions: list[str] = []

    if worst_full:
        actions.append(
            f"Fokus perbaikan pada: {', '.join(worst_full)} (rata-rata klaster di bawah keseluruhan)."
        )

    # tindakan kontekstual
    if any(k in text for k in ["waktu", "antri", "estimasi", "cepat"]):
        actions.append("Kurangi waktu tunggu: atur alur antrean, tampilkan estimasi layanan, dan tambah petugas di jam sibuk.")
    if any(k in text for k in ["kebersihan", "rapi", "hasil cuci"]):
        actions.append("Perkuat QC akhir: checklist kebersihan sebelum serah terima dan refresh SOP detailer.")
    if any(k in text for k in ["pegawai", "ramah", "tanggap", "perhatian", "pelayanan"]):
        actions.append("Coaching frontliner: skrip sapaan–konfirmasi kebutuhan–closing, plus evaluasi penugasan.")
    if any(k in text for k in ["harga", "biaya"]):
        actions.append("Transparansi harga: sederhanakan paket, jelaskan manfaat, dan sediakan bundling untuk repeat visit.")
    if any(k in text for k in ["akses", "lokasi", "parkir", "nyaman"]):
        actions.append("Perbaiki akses & kenyamanan: signage/arah parkir jelas dan fasilitas ruang tunggu (kursi, minum, colokan).")
    if any(k in text for k in ["proses", "pencucian"]):
        actions.append("Standardisasi proses: audit harian tahapan cuci dan dokumentasi penyimpangan.")

    return actions[:3] or ["Pertahankan kualitas yang sudah baik dan lakukan monitoring berkala."]


def build_simple_pdf(path_out, dataset_name, params, metrics, labels):
    W, H = A4
    c = canvas.Canvas(path_out, pagesize=A4)
    y = H - 50
    c.setFont("Helvetica-Bold", 14); c.drawString(50, y, "Laporan Clustering — KangJoe CarWash"); y -= 20
    c.setFont("Helvetica", 10)
    c.drawString(50, y, f"Tanggal: {datetime.datetime.now():%Y-%m-%d %H:%M}"); y -= 14
    c.drawString(50, y, f"Dataset: {dataset_name}"); y -= 14
    if params:
        c.drawString(50, y, f"Params: k={params.get('k')}, n_init={params.get('n_init')}, max_iter={params.get('max_iter')}"); y -= 14
    if metrics:
        c.drawString(50, y, f"Metrics: WCSS={metrics.get('wcss'):.2f}, Silhouette={metrics.get('silhouette')}, DBI={metrics.get('dbi')}"); y -= 18
    # distribusi sederhana
    from collections import Counter
    cnt = Counter(labels) if labels is not None else {}
    for k,v in sorted(cnt.items()):
        c.drawString(50, y, f"Cluster C{k}: {v} data"); y -= 12
    # tambahkan ringkasan singkat
    c.drawString(50, y, "Ringkasan: lihat halaman Insights untuk ciri utama & rekomendasi."); y -= 16
    c.showPage(); c.save()
    return path_out
