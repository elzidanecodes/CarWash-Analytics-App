import os, time, pandas as pd
from config import UPLOAD_DIR

def read_csv_or_xlsx(path: str) -> pd.DataFrame:
    if path.lower().endswith(".csv"):
        try:
            return pd.read_csv(path)
        except:
            return pd.read_csv(path, sep=";")
    return pd.read_excel(path)

def save_upload(file, filename: str | None = None) -> str:
    """Simpan file upload dan return pathnya."""
    safe = filename or (file.filename if file else None)
    if not file or not safe:
        raise ValueError("File tidak ditemukan.")
    safe = os.path.basename(safe)
    path = os.path.join(UPLOAD_DIR, f"{int(time.time())}_{safe}")
    file.save(path)
    return path