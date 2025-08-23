import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler, MinMaxScaler

def apply_missing(df: pd.DataFrame, how: str) -> pd.DataFrame:
    if how == "none":
        return df
    if how == "drop":
        return df.dropna(how="any").reset_index(drop=True)
    if how in ("mean","median"):
        num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if how == "mean":
            df[num_cols] = df[num_cols].fillna(df[num_cols].mean())
        else:
            df[num_cols] = df[num_cols].fillna(df[num_cols].median())
        obj_cols = [c for c in df.columns if c not in num_cols]
        for c in obj_cols:
            df[c] = df[c].fillna("")
        return df
    return df

def encode_df(df: pd.DataFrame, mode: str):
    if mode == "label":
        out = df.copy()
        for c in out.columns:
            if out[c].dtype == "object":
                out[c] = pd.Categorical(out[c]).codes
        return out, out.columns.tolist()
    out = pd.get_dummies(df, drop_first=False, dtype=float)
    return out, out.columns.tolist()

def scale_array(X, how: str):
    if how == "none":
        return X
    if how == "standard":
        return StandardScaler().fit_transform(X)
    if how == "minmax":
        return MinMaxScaler().fit_transform(X)
    return X
