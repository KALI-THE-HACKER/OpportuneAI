from fastapi.testclient import TestClient

from app import app


def test_health_and_ready_endpoints() -> None:
    client = TestClient(app)

    health = client.get('/health')
    assert health.status_code == 200
    assert health.json().get('status') == 'healthy'

    ready = client.get('/ready')
    assert ready.status_code == 200
    assert ready.json().get('status') == 'ready'

    version = client.get('/api/v1/version')
    assert version.status_code == 200
    assert 'api_version' in version.json()
