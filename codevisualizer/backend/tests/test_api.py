import pytest
from fastapi.testclient import TestClient
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.main import app

client = TestClient(app)

def test_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_samples():
    res = client.get("/api/samples")
    assert res.status_code == 200
    samples = res.json()
    assert len(samples) >= 3
    assert any(s["id"] == "fastapi_auth" for s in samples)

def test_visualize_empty_code():
    res = client.post("/api/visualize", json={"code": ""})
    assert res.status_code == 400

def test_visualize_python():
    code = """
def authenticate(token: str):
    return True

@app.post("/login")
def login_handler():
    return authenticate("abc")
"""
    res = client.post("/api/visualize", json={"code": code, "language": "python", "provider": "fallback"})
    assert res.status_code == 200
    data = res.json()
    assert len(data["nodes"]) >= 2
    assert len(data["edges"]) >= 1
    assert "summary" in data
    assert "stats" in data

def test_visualize_javascript():
    code = """
function parseHeader(req) {
    return req.headers;
}
app.get('/status', (req, res) => {
    parseHeader(req);
    res.send('ok');
});
"""
    res = client.post("/api/visualize", json={"code": code, "language": "javascript", "provider": "fallback"})
    assert res.status_code == 200
    data = res.json()
    assert len(data["nodes"]) >= 2
