from flask import Blueprint, request, jsonify
import numpy as np

# Ambil STATE & utils dari package sesuai struktur kamu
from store.state import STATE
from services.model_utils import (
    compute_elbow, train_kmeans, cluster_counts, centroid_table,
    compute_dbi, compute_silhouette, compute_silhouette_curve
)

model_bp = Blueprint("model", __name__, url_prefix="/api")

# =========================
# 1) Elbow → tentukan K
# =========================
@model_bp.post("/model/elbow")
def model_elbow():
    if STATE.get("X") is None:
        return jsonify({"error": "Belum ada dataset ter-preprocessing."}), 400

    payload = request.get_json(silent=True) or {}
    k_min = int(payload.get("k_min", 2))
    k_max = int(payload.get("k_max", 10))

    try:
        res = compute_elbow(
            STATE["X"], k_min=k_min, k_max=k_max,
            init="k-means++", n_init=10, max_iter=300, random_state=42
        )
        # simpan k_suggest ke state agar dipakai train
        STATE["k_suggest"] = int(res["k_suggest"])
        return jsonify({
            "image_base64": res["image_base64"],
            "k_suggest": res["k_suggest"],
            "wcss_at_k": res["wcss_at_k"],
        })
    except Exception as e:
        return jsonify({"error": f"Gagal menghitung Elbow: {e}"}), 500

# =========================
# 2) Train KMeans pakai K dari Elbow (default)
# =========================
@model_bp.post("/model/train")
def model_train():
    # Pastikan X sudah siap (hasil preprocessing yang sama dipakai Elbow & Silhouette)
    X = STATE.get("X")
    if X is None:
        return jsonify({"error": "Belum ada dataset ter-preprocessing."}), 400

    payload = request.get_json(silent=True) or {}
    p = payload.get("params") or {}

    # Param & fallback
    k = int(p.get("k") or STATE.get("k_suggest") or 3)
    init = p.get("init") or "k-means++"
    n_init = int(p.get("n_init", 10))
    max_iter = int(p.get("max_iter", 300))
    random_state = int(p.get("random_state", 42))

    # Guard ukuran k vs jumlah sampel
    n_samples = len(X)
    if k < 2:
        k = 2
    if k >= n_samples:
        return jsonify({"error": f"k={k} terlalu besar untuk n={n_samples}"}), 400

    try:
        trained = train_kmeans(
            X, k=k, init=init, n_init=n_init,
            max_iter=max_iter, random_state=random_state
        )

        # Simpan state lengkap utk evaluasi & halaman lain
        STATE.update({
            "last_model":     trained.get("model"),
            "last_labels":    trained["labels"].tolist(),
            "last_k":         int(trained["k"]),
            "last_inertia":   float(trained["inertia"]),
            "last_centroids": trained["centroids"].tolist(),
            "train_params":   {
                "k": int(k), "init": init, "n_init": n_init,
                "max_iter": max_iter, "random_state": random_state
            }
        })

        # === (BARU) Siapkan centroid skala asli (Likert) & profil cluster ===
        feature_names = STATE.get("feature_names")
        scaler = STATE.get("scaler")  # simpan saat preprocessing
        dfLik = STATE.get("df_likert")  # DataFrame kolom asli skala 1–5 (disiapkan saat preprocessing)

        # 1) Centroid pada skala asli (bila ada scaler)
        try:
            if scaler is not None and hasattr(scaler, "inverse_transform"):
                centroids_original = scaler.inverse_transform(trained["centroids"])
            else:
                centroids_original = trained["centroids"]  # fallback (mungkin sudah 1–5)
            STATE["last_centroids_original"] = centroids_original.tolist()
        except Exception:
            STATE["last_centroids_original"] = trained["centroids"].tolist()

        # 2) Profil cluster per fitur: avg (dari centroid original) & mode (dari data asli)
        cluster_profile = {}  # {cid: {feat: {"avg": float, "mode": int|None}}}
        labels_arr = trained["labels"]
        k_now = int(trained["k"])

        # Siapkan nama fitur
        if not feature_names:
            feature_names = [f"f{i+1}" for i in range(trained["centroids"].shape[1])]

        # Rata-rata dari centroid_original
        for cid in range(k_now):
            per_feat = {}
            for j, feat in enumerate(feature_names):
                avg_val = float(centroids_original[cid, j]) if j < centroids_original.shape[1] else None
                per_feat[feat] = {"avg": None if avg_val is None else avg_val, "mode": None}
            cluster_profile[cid] = per_feat

        # Mode dari data asli (jika tersedia)
        try:
            if dfLik is not None:
                tmp = dfLik.copy()
                tmp["_c"] = labels_arr
                for cid in range(k_now):
                    sub = tmp[tmp["_c"] == cid]
                    for feat in feature_names:
                        if feat in sub.columns:
                            m = sub[feat].mode()
                            if not m.empty:
                                cluster_profile[cid][feat]["mode"] = int(round(m.iloc[0]))
        except Exception:
            pass

        STATE["cluster_profile"] = cluster_profile

        # Hitung silhouette score (bonus)
        try:
            silhouette_score_val = compute_silhouette(X, trained["labels"])
            if np.isnan(silhouette_score_val):
                silhouette_score_val = None
        except Exception:
            silhouette_score_val = None

        # Hitung jumlah anggota cluster dan tabel centroid
        counts = cluster_counts(trained["labels"])
        centroids_tbl = centroid_table(trained["centroids"], feature_names)

        return jsonify({
            "ok": True,
            "k": int(trained["k"]),
            "inertia": float(trained["inertia"]),
            "silhouette": silhouette_score_val,  # bonus (boleh dipakai atau diabaikan di UI)
            "counts": counts,
            "centroids": centroids_tbl
        })

    except Exception as e:
        # kirim pesan jelas biar kebaca di frontend (pastikan postJSON menampilkan body error)
        return jsonify({"error": f"Gagal melatih KMeans: {e}"}), 500

# =========================
# 3) Evaluasi DBI
# =========================
@model_bp.post("/model/dbi")
def model_dbi():
    if STATE.get("X") is None:
        return jsonify({"error": "Belum ada dataset."}), 400
    if not STATE.get("last_labels"):
        return jsonify({"error": "Belum ada hasil clustering."}), 400
    try:
        dbi = compute_dbi(STATE["X"], labels=STATE["last_labels"])
        STATE["last_dbi"] = float(dbi) 
        return jsonify({"dbi": float(dbi)})
    except Exception as e:
        return jsonify({"error": f"Gagal menghitung DBI: {e}"}), 500

# =========================
# 4) Evaluasi Silhouette
# =========================
@model_bp.post("/model/silhouette")
def model_silhouette():
    X = STATE.get("X")
    labels = STATE.get("last_labels")
    if X is None or labels is None:
        return jsonify({"score": None, "error": "Belum ada model/labels."}), 400
    score = compute_silhouette(X, labels)
    return jsonify({"score": None if np.isnan(score) else float(score)})

@model_bp.post("/model/silhouette-curve")
def model_silhouette_curve():
    X = STATE.get("X")
    if X is None:
        return jsonify({"error": "Belum ada dataset."}), 400
    payload = request.get_json(silent=True) or {}
    k_min = int(payload.get("k_min", 2))
    k_max = int(payload.get("k_max", 10))
    init = payload.get("init", "k-means++")
    n_init = int(payload.get("n_init", 10))
    max_iter = int(payload.get("max_iter", 300))
    random_state = int(payload.get("random_state", 42))
    out = compute_silhouette_curve(
        X, k_min=k_min, k_max=k_max,
        init=init, n_init=n_init, max_iter=max_iter, random_state=random_state
    )
    return jsonify(out)
