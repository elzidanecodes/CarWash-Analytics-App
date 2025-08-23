# report_routes.py
from __future__ import annotations

import os
from datetime import datetime

import numpy as np
import pandas as pd
from flask import Blueprint, jsonify, request, send_file

from store.state import STATE
from services.viz_utils import pie_distribution_b64
from services.report_utils import _feature_display_name, _smart_actions_for_cluster, build_simple_pdf

OUT_DIR = os.path.join(os.getcwd(), "outputs")

report_bp = Blueprint("report", __name__, url_prefix="/api")

# ======================
#    Report – Summary
# ======================
@report_bp.get("/report/summary")
def report_summary():
    """
    Ringkasan untuk menu Insights:
    - overview (dataset, rows, cols, k, generated_at)
    - metrics (wcss, dbi, silhouette)
    - clusters (size, share, traits=full questions, actions=smart)
    - top_features (varians antar-mean cluster)
    - images.distribution_b64 (pie chart)
    """
    X = STATE.get("X")
    labels = STATE.get("last_labels")
    km = STATE.get("last_model")
    feat = STATE.get("feature_names") or []

    # Jika belum ada hasil model, kembalikan objek kosong agar frontend tetap aman
    if X is None or labels is None:
        return jsonify({
            "overview": None, "metrics": None,
            "clusters": [], "top_features": [],
            "images": {}, "generated": ""
        })

    labels = np.asarray(labels, dtype=int)
    k = int(getattr(km, "n_clusters", int(labels.max() + 1)))
    counts = np.bincount(labels, minlength=k).astype(int)
    total = int(labels.size)

    # Overview & metrics
    from sklearn.metrics import silhouette_score, davies_bouldin_score

    overview = {
        "dataset": STATE.get("dataset_name"),
        "rows": int(X.shape[0]),
        "cols": int(X.shape[1]),
        "k": k,
        "generated_at": STATE.get("generated_at")
                    or datetime.now().strftime("%Y-%m-%d %H:%M"),
    }
    wcss = float(getattr(km, "inertia_", STATE.get("last_inertia", 0.0)))
    # pakai metrik yang sudah dihitung kalau ada; kalau tidak & k>1, hitung cepat di sini
    dbi = STATE.get("last_dbi")
    sil = STATE.get("last_silhouette")
    if dbi is None and k > 1:
        try:
            dbi = float(davies_bouldin_score(X, labels))
            STATE["last_dbi"] = dbi
        except Exception:
            dbi = None
    if sil is None and k > 1:
        try:
            sil = float(silhouette_score(X, labels))
            STATE["last_silhouette"] = sil
        except Exception:
            sil = None

    metrics = {"wcss": wcss, "dbi": dbi, "silhouette": sil}

    # Profil cluster
    dfX = pd.DataFrame(X, columns=feat)
    dfX["_c"] = labels
    means_by_c = dfX.groupby("_c").mean(numeric_only=True)
    global_mean = dfX.drop(columns=["_c"]).mean(numeric_only=True)

    # Urutkan fitur yang paling membedakan (varians antar cluster)
    var_across = means_by_c.var(axis=0).sort_values(ascending=False)

    clusters = []
    for cid in sorted(means_by_c.index):
        size = int(counts[cid])
        share = (size / total) if total else 0.0

        # Ciri utama = deviasi terbesar utk cluster ini (dihormati urutan var_across)
        diffs_abs = (means_by_c.loc[cid] - global_mean).abs()
        ranked = diffs_abs.loc[var_across.index].sort_values(ascending=False)
        top_feats = ranked.head(3).index.tolist()
        traits_full = [_feature_display_name(f) for f in top_feats]

        actions = _smart_actions_for_cluster(cid, means_by_c, global_mean)

        clusters.append({
            "id": int(cid),
            "size": size,
            "share": share,
            "title": None,
            "traits": traits_full,   # pertanyaan full (bukan singkatan)
            "actions": actions,      # 1–3 butir rekomendasi
        })

    # Top features global (untuk panel "Fitur Terinformasi")
    topf = [
        {"feature": _feature_display_name(f),
         "importance": float(v / (var_across.iloc[0] or 1.0))}
        for f, v in var_across.head(10).items()
    ]

    # Pie distribusi
    dist_b64 = pie_distribution_b64(labels)

    # Generated narrative singkat
    if clusters:
        parts = [
            f"Sistem membentuk {k} cluster dari {total} responden."
        ]
        parts.append(
            "Proporsi: " + ", ".join(
                [f"C{c['id']} {int(round(c['share'] * 100))}%"
                 for c in sorted(clusters, key=lambda x: x['id'])]
            )
        )
        generated_text = " ".join(parts)
    else:
        generated_text = ""

    return jsonify({
        "overview": overview,
        "metrics": metrics,
        "clusters": clusters,
        "top_features": topf,
        "images": {"distribution_b64": dist_b64},
        "generated": generated_text
    })


# ======================
#   Report – Download
# ======================
@report_bp.get("/report/download")
def report_download():
    """
    Unduh report:
    - ?format=pdf → report.pdf (ringkas; gunakan build_simple_pdf)
    - ?format=csv → report.csv (ringkasan cluster: id, size, share)
    """
    fmt = (request.args.get("format") or "pdf").lower()

    km = STATE.get("last_model")
    labels = STATE.get("last_labels")
    if km is None or labels is None:
        return jsonify({"error": "Belum ada hasil clustering untuk diunduh."}), 400

    labels = np.asarray(labels, dtype=int)
    k = int(getattr(km, "n_clusters", int(labels.max() + 1)))
    counts = np.bincount(labels, minlength=k).astype(int)
    total = int(labels.size)

    os.makedirs(OUT_DIR, exist_ok=True)

    if fmt == "pdf":
        params = {
            "k": k,
            "n_init": getattr(km, "n_init", None),
            "max_iter": getattr(km, "max_iter", None),
        }
        metrics = {"wcss": float(getattr(km, "inertia_", 0.0))}
        path_out = os.path.join(OUT_DIR, "report.pdf")
        build_simple_pdf(
            out_path=path_out,
            dataset_name=STATE.get("dataset_name") or "dataset.csv",
            params=params,
            metrics=metrics,
            labels=labels,
        )
        return send_file(path_out, as_attachment=True, download_name="report.pdf")

    elif fmt == "csv":
        df = pd.DataFrame({
            "cluster": list(range(k)),
            "size": counts.tolist(),
            "share": (counts / (total or 1)).round(6).tolist(),
        })
        path_out = os.path.join(OUT_DIR, "report.csv")
        df.to_csv(path_out, index=False)
        return send_file(path_out, as_attachment=True, download_name="report.csv")

    else:
        return jsonify({"error": "Format tidak didukung. Gunakan 'pdf' atau 'csv'."}), 400
