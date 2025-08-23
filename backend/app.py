from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # aman saat dev; di prod bisa dimatikan jika 1 origin

@app.get("/api/healthz")
def healthz():
    return jsonify({"status": "ok"})

@app.get("/api/hello")
def hello():
    return jsonify({"message": "Hello from Flask dev API"})

if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
