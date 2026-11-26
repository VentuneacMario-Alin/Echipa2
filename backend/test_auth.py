import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_rrm.db")

from fastapi.testclient import TestClient  # noqa: E402

from backend.database import Base, engine  # noqa: E402
from backend.main import app  # noqa: E402


class AuthTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        self.client = TestClient(app)

    def register_and_login(self, email="ana@example.com"):
        body = {"name": "Ana", "email": email, "password": "parola1234"}
        self.assertEqual(self.client.post("/auth/register", json=body).status_code, 201)
        response = self.client.post("/auth/login", json={"email": email, "password": "parola1234"})
        self.assertEqual(response.status_code, 200)

    def test_me_requires_authentication(self):
        self.assertEqual(self.client.get("/auth/me").status_code, 401)

    def test_me_returns_current_user(self):
        self.register_and_login()
        response = self.client.get("/auth/me")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["email"], "ana@example.com")
        self.assertEqual(response.json()["role"], "cititor")

    def test_register_cannot_choose_admin_role(self):
        body = {"name": "X", "email": "x@example.com", "password": "parola1234", "role": "admin"}
        self.assertEqual(self.client.post("/auth/register", json=body).json()["role"], "cititor")

    def test_duplicate_email_and_wrong_password(self):
        self.register_and_login()
        body = {"name": "Ana", "email": "ANA@example.com", "password": "parola1234"}
        self.assertEqual(self.client.post("/auth/register", json=body).status_code, 409)
        bad = self.client.post("/auth/login", json={"email": "ana@example.com", "password": "gresita"})
        self.assertEqual(bad.status_code, 401)

    def test_logout_clears_session(self):
        self.register_and_login()
        self.client.post("/auth/logout")
        self.assertEqual(self.client.get("/auth/me").status_code, 401)

    def test_cors_allows_frontend_origin_with_credentials(self):
        origin = "http://localhost:8000"
        response = self.client.options(
            "/auth/login",
            headers={"Origin": origin, "Access-Control-Request-Method": "POST",
                     "Access-Control-Request-Headers": "content-type"},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["access-control-allow-origin"], origin)
        self.assertEqual(response.headers["access-control-allow-credentials"], "true")

    def test_cors_rejects_unknown_origin(self):
        response = self.client.options(
            "/auth/login",
            headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "POST"},
        )
        self.assertNotIn("access-control-allow-origin", response.headers)


if __name__ == "__main__":
    unittest.main()
