import io, base64
import numpy as np
from sklearn.cluster import KMeans
try:
    from kneed import KneeLocator
except Exception:
    KneeLocator = None

from sklearn.metrics import davies_bouldin_score, silhouette_score
import matplotlib.pyplot as plt

# ==============================
#  Core utilities
# ==============================

def elbow_wcss(X, k_values):
    """Hitung WCSS untuk setiap k pada k_values."""
    wcss = []
    for k in k_values:
        km = KMeans(n_clusters=k, n_init=10, random_state=42)
        km.fit(X)
        wcss.append(float(km.inertia_))
    return wcss

def _knee_point_by_distance(k_values, wcss):
    """
    Cari titik siku (knee) dengan metode 'max distance to line'
    antara (k_min, wcss_min) dan (k_max, wcss_max).
    """
    x = np.array(k_values, dtype=float)
    y = np.array(wcss, dtype=float)

    p1 = np.array([x[0], y[0]], dtype=float)
    p2 = np.array([x[-1], y[-1]], dtype=float)
    v = p2 - p1
    v_norm = np.linalg.norm(v)
    line_unit = v / (v_norm if v_norm != 0 else 1.0)

    pts = np.stack([x, y], axis=1)
    vecs = pts - p1
    proj = (vecs @ line_unit)[:, None] * line_unit
    perp = vecs - proj
    dists = np.linalg.norm(perp, axis=1)
    idx = int(np.argmax(dists))
    return int(x[idx])

def compute_elbow(
    X, k_min=2, k_max=10, *,
    init="k-means++", n_init=10, max_iter=300, random_state=42,
    prefer_smaller_when_close=True
):
    # 1) Hitung WCSS
    ks = list(range(int(k_min), int(k_max) + 1))
    wcss = []
    for k in ks:
        km = KMeans(n_clusters=k, init=init, n_init=n_init,
                    max_iter=max_iter, random_state=random_state)
        km.fit(X)
        wcss.append(float(km.inertia_))
    wcss = np.asarray(wcss, dtype=float)

    # ---------- kandidat 1: KneeLocator ----------
    k_kneedle = None
    if KneeLocator is not None:
        try:
            kl = KneeLocator(ks, wcss, curve="convex", direction="decreasing")
            if isinstance(kl.knee, (int, np.integer)):
                k_kneedle = int(kl.knee)
        except Exception:
            pass

    # ---------- kandidat 2: jarak-ke-garis (skip ujung) ----------
    x1, y1 = ks[0], wcss[0]
    x2, y2 = ks[-1], wcss[-1]
    dx, dy = (x2 - x1), (y2 - y1)
    denom = (dx*dx + dy*dy) ** 0.5 or 1.0

    dists = []
    for i, k in enumerate(ks):
        x0, y0 = k, wcss[i]
        num = abs(dy*(x0 - x1) - dx*(y0 - y1))
        dists.append(num / denom)

    if len(dists) > 2:
        k_line = ks[1 + int(np.argmax(dists[1:-1]))]   # hindari endpoint
    else:
        k_line = ks[int(np.argmax(dists))]

    # ---------- kandidat 3: kelengkungan (second derivative) ----------
    # ambil argmax(|Δ² wcss|) pada titik tengah
    if len(ks) >= 3:
        d2 = np.diff(np.diff(wcss))
        ks_mid = ks[1:-1]
        k_curv = int(ks_mid[int(np.argmax(np.abs(d2)))])
    else:
        k_curv = None

    # ---------- pemilihan akhir ----------
    candidates = [k for k in [k_kneedle, k_line, k_curv] if isinstance(k, (int, np.integer))]
    if not candidates:
        k_suggest = None
    else:
        # aturan: jika ada dua kandidat berdekatan (selisih ≤1), ambil yang lebih kecil
        picked = None
        if prefer_smaller_when_close and len(candidates) >= 2:
            for a in candidates:
                for b in candidates:
                    if a != b and abs(a - b) <= 1:
                        picked = min(a, b)
                        break
                if picked is not None:
                    break
        # jika belum ada keputusan: utamakan kelengkungan → line → kneedle
        k_suggest = picked or (k_curv or k_line or k_kneedle)

    # ---------- siapkan plot ----------
    fig, ax = plt.subplots(figsize=(6,4), dpi=140)
    ax.plot(ks, wcss, marker="o")
    ax.set_title("Elbow Method (WCSS)")
    ax.set_xlabel("Number of clusters (k)")
    ax.set_ylabel("WCSS")

    # hasil final (merah)
    if isinstance(k_suggest, int):
        ax.axvline(k_suggest, ls="--", color="r", label=f"k={k_suggest}")
    ax.legend()

    buf = io.BytesIO(); fig.tight_layout(); fig.savefig(buf, format="png"); plt.close(fig)
    img_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    # WCSS pada k terpilih
    try:
        k_idx = ks.index(int(k_suggest))
        wcss_at_k = float(wcss[k_idx])
    except Exception:
        wcss_at_k = None

    return {
        "ks": ks,
        "wcss": wcss.tolist(),
        "k_suggest": int(k_suggest) if isinstance(k_suggest, int) else None,
        "wcss_at_k": wcss_at_k,
        "image_base64": img_b64,
    }


def train_kmeans(X, k=3, init="k-means++", n_init=10, max_iter=300, random_state=42):
    """
    Latih KMeans dengan k tertentu. Return labels, centroids, inertia, dan model.
    """
    k = int(k)
    km = KMeans(
        n_clusters=k, init=init, n_init=n_init, max_iter=max_iter, random_state=random_state
    )
    km.fit(X)
    labels = km.labels_.astype(int)
    centroids = km.cluster_centers_.astype(float)
    inertia = float(km.inertia_)
    return {
        "labels": labels,
        "centroids": centroids,
        "inertia": inertia,
        "k": k,
        "model": km,   # <— penting untuk Insights/Report
    }

def cluster_counts(labels):
    """Hitung jumlah member per cluster → list of dict[{cluster, count}]."""
    labels = np.asarray(labels)
    uniques, counts = np.unique(labels, return_counts=True)
    return [{"cluster": int(c), "count": int(n)} for c, n in zip(uniques, counts)]

def centroid_table(centroids, feature_names=None):
    """
    Ubah centroids (k x p) jadi table-friendly:
      [{ feature, c0, c1, ... }]
    """
    centroids = np.asarray(centroids)
    k, p = centroids.shape
    if feature_names is None:
        feature_names = [f"f{i+1}" for i in range(p)]
    rows = []
    for j, fname in enumerate(feature_names):
        row = {"feature": fname}
        for ci in range(k):
            row[f"c{ci}"] = float(centroids[ci, j])
        rows.append(row)
    return rows

def compute_dbi(X, labels):
    labels = np.asarray(labels)
    return float(davies_bouldin_score(X, labels))

import numpy as np

def compute_silhouette(X, labels):
    labels = np.asarray(labels)
    if X is None or labels is None:      # guard
        return float("nan")
    if len(X) != len(labels):            # guard
        return float("nan")
    # minimal 2 cluster dan tidak semua label sama
    if len(np.unique(labels)) < 2:
        return float("nan")
    return float(silhouette_score(X, labels))

def compute_silhouette_curve(
    X, k_min=2, k_max=10, *,
    init="k-means++", n_init=10, max_iter=300, random_state=42
):
    ks = list(range(int(k_min), int(k_max)+1))
    scores = []
    for k in ks:
        if k < 2 or k >= len(X):
            scores.append(float("nan")); continue
        km = KMeans(n_clusters=k, init=init, n_init=n_init,
                    max_iter=max_iter, random_state=random_state)
        labels = km.fit_predict(X)
        try:
            s = silhouette_score(X, labels)
        except Exception:
            s = float("nan")
        scores.append(float(s))

    arr = np.array(scores, dtype=float)

    # plot — TANPA garis/legend
    fig, ax = plt.subplots(figsize=(6,4), dpi=140)
    ax.plot(ks, arr, marker="o")
    ax.set_title("Silhouette Score vs k")
    ax.set_xlabel("Number of clusters (k)")
    ax.set_ylabel("Silhouette score")
    buf = io.BytesIO(); fig.tight_layout(); fig.savefig(buf, format="png"); plt.close(fig)
    return {
        "ks": ks,
        "scores": [None if not np.isfinite(v) else float(v) for v in arr],
        "image_base64": base64.b64encode(buf.getvalue()).decode("ascii"),
    }