import os
import tempfile
from pathlib import Path

import pytest

_tmp = Path(tempfile.mkdtemp(prefix="ieri-test-"))
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp / 'test.db'}"
os.environ["APP_ENV"] = "dev"
os.environ["OCR_PROVIDER"] = "mock"
os.environ["TASK_RUNNER"] = "inline"
os.environ["OWNER_USERNAME"] = "preside"
os.environ["OWNER_PASSWORD"] = "test-password"
os.environ["WEB_DIST"] = str(_tmp / "no-dist")

from fastapi.testclient import TestClient  # noqa: E402

from api.app import app  # noqa: E402


@pytest.fixture(scope="session")
def app_client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def client(app_client):
    app_client.cookies.clear()
    return app_client


def make_client():
    return TestClient(app)
