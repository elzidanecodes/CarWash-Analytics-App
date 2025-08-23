from flask import Flask
from flask_cors import CORS

# import blueprint dari tiap file
from api.data_routes import data_bp
from api.model_routes import model_bp
from api.report_routes import report_bp

def create_app():
    app = Flask(__name__)
    CORS(app)
    # daftar semua blueprint
    app.register_blueprint(data_bp)
    app.register_blueprint(model_bp)
    app.register_blueprint(report_bp)
    return app

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)