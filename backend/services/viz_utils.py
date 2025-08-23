import io, base64
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from collections import Counter

def _to_b64(fig, prefix=False):
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight")
    plt.close(fig)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return (f"data:image/png;base64,{b64}" if prefix else b64)

def plot_elbow_b64(ks, wcss, with_prefix=False):
    if not ks or not wcss:
        return None
    fig, ax = plt.subplots(figsize=(6, 4), dpi=140)
    ax.plot(ks, wcss, marker="o")
    ax.set_xlabel("Number of clusters (k)")
    ax.set_ylabel("WCSS")
    ax.set_title("Elbow Method")
    fig.tight_layout()
    return _to_b64(fig, prefix=with_prefix)

def pie_distribution_b64(labels, with_prefix=False):
    if labels is None or len(labels) == 0:
        return None
    cnt = Counter(labels)
    fig, ax = plt.subplots(figsize=(4, 4), dpi=140)
    ordered = sorted(cnt.items())
    ax.pie([n for _, n in ordered],
           labels=[f"C{c}" for c, _ in ordered],
           autopct="%1.0f%%")
    ax.set_title("Cluster Distribution")
    return _to_b64(fig, prefix=with_prefix)