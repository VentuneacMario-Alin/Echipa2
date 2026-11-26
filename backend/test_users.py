import os
import unittest

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_rrm.db")

from fastapi.testclient import TestClient  # noqa: E402

from backend.database import Base, SessionLocal, engine  # noqa: E402
from backend.main import app  # noqa: E402
from backend.models import User  # noqa: E402
from backend.security import hash_password  # noqa: E402


def login(email: str) -> TestClient:
    client = TestClient(app)
    response = client.post("/auth/login", json={"email": email, "password": "parola1234"})
    assert response.status_code == 200
    return client


class UserAdminTests(unittest.TestCase):
    def setUp(self):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        with SessionLocal() as db:
            for role in ("admin", "editor", "cititor"):
                db.add(User(name=role, email=f"{role}@example.com",
                            password_hash=hash_password("parola1234"), role=role))
            db.commit()
        self.admin = login("admin@example.com")
        self.editor = login("editor@example.com")
        self.reader = login("cititor@example.com")

    def user_id(self, email):
        return next(u["id"] for u in self.admin.get("/users").json() if u["email"] == email)

    def test_only_admin_can_list_users(self):
        self.assertEqual(len(self.admin.get("/users").json()), 3)
        self.assertEqual(self.editor.get("/users").status_code, 403)
        self.assertEqual(TestClient(app).get("/users").status_code, 401)
        self.assertNotIn("password_hash", self.admin.get("/users").json()[0])

    def test_admin_changes_role_and_new_permissions_apply(self):
        reader_id = self.user_id("cititor@example.com")
        body = {"name": "x", "type_id": 1}
        self.assertEqual(self.reader.post("/resources", json=body).status_code, 403)
        updated = self.admin.patch(f"/users/{reader_id}", json={"role": "editor"})
        self.assertEqual(updated.json()["role"], "editor")
        self.assertEqual(self.reader.post("/resources", json=body).status_code, 404)

    def test_deactivated_user_loses_access(self):
        editor_id = self.user_id("editor@example.com")
        self.admin.patch(f"/users/{editor_id}", json={"is_active": False})
        self.assertEqual(self.editor.get("/auth/me").status_code, 401)

    def test_invalid_updates(self):
        admin_id = self.user_id("admin@example.com")
        self.assertEqual(self.admin.patch(f"/users/{admin_id}", json={"role": "cititor"}).status_code, 409)
        self.assertEqual(self.admin.patch(f"/users/{admin_id}", json={"is_active": False}).status_code, 409)
        self.assertEqual(self.admin.patch("/users/9999", json={"role": "editor"}).status_code, 404)
        self.assertEqual(self.admin.patch(f"/users/{admin_id}", json={"role": "superuser"}).status_code, 422)
        self.assertEqual(self.editor.patch(f"/users/{admin_id}", json={"role": "cititor"}).status_code, 403)


if __name__ == "__main__":
    unittest.main()
