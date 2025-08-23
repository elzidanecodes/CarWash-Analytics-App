# Single-user dev state (sederhana). Bisa diganti ke DB/cache kalau perlu.
STATE = {
    "dataset_name": None,
    "df_raw": None,        # DataFrame original
    "df_used": None,       # DataFrame setelah dipilih fitur + imputasi (sebelum encoding/scaling)
    "X": None,             # np.array siap modeling
    "feature_names": None,
    "mapping": None,       # {id, features[], label}
    "prep": None,          # {missing, scaling, encoding}
    "last_model": None,    # KMeans
    "last_labels": None,
    "last_params": None,
    "last_metrics": None,
    "generated_at": None,
    
}