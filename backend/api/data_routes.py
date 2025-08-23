import json
from flask import Blueprint, request, jsonify
from services.io_utils import read_csv_or_xlsx, save_upload
from services.prep_utils import apply_missing, encode_df, scale_array
from store.state import STATE

data_bp = Blueprint("data", __name__, url_prefix="/api")

@data_bp.post("/upload")
def upload():
    """
    FormData: file, filename, mapping(json), preprocessing(json)
    """
    f = request.files.get("file")
    mapping = json.loads(request.form.get("mapping") or "{}")
    prep = json.loads(request.form.get("preprocessing") or "{}")
    fname = request.form.get("filename") or (f.filename if f else None)

    path = save_upload(f, fname)
    df = read_csv_or_xlsx(path)

    STATE["dataset_name"] = fname
    STATE["df_raw"] = df.copy()
    STATE["mapping"] = mapping
    STATE["prep"] = prep

    # fiturkan
    feat_cols = (mapping.get("features") or [])
    used_cols = [c for c in feat_cols if c in df.columns]
    df_used = df[used_cols].copy()

    # preprocessing
    df_used = apply_missing(df_used, prep.get("missing","none"))
    df_enc, feat_names = encode_df(df_used, prep.get("encoding","onehot"))
    X = df_enc.values.astype(float)
    X = scale_array(X, prep.get("scaling","none"))

    STATE["df_used"] = df_used
    STATE["X"] = X
    STATE["feature_names"] = feat_names

    return jsonify({"message": "Dataset tersimpan & siap dimodelkan."})
