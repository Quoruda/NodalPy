import os
import shutil
import tempfile
import unittest
from unittest.mock import patch
from app.core import storage_manager

class TestStorageManager(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.user_id = "test_user_123"
        self.user_storage = os.path.join(self.temp_dir, "users", self.user_id)
        os.makedirs(self.user_storage, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_get_user_storage_bytes(self):
        file_path = os.path.join(self.user_storage, "sample.txt")
        data = b"x" * 1024
        with open(file_path, "wb") as f:
            f.write(data)

        with patch("app.core.storage_manager.STORAGE_DIR", self.temp_dir):
            total_bytes = storage_manager.get_user_storage_bytes(self.user_id)
            self.assertEqual(total_bytes, 1024)

    def test_check_user_quota_under_limit(self):
        file_path = os.path.join(self.user_storage, "sample.txt")
        data = b"x" * (100 * 1024)
        with open(file_path, "wb") as f:
            f.write(data)

        with patch("app.core.storage_manager.STORAGE_DIR", self.temp_dir), \
             patch("app.core.storage_manager.get_tier_config", return_value={"max_disk_mb": 1}):
            is_valid = storage_manager.check_user_quota(self.user_id, incoming_bytes=0)
            self.assertTrue(is_valid)

    def test_check_user_quota_exceeded(self):
        file_path = os.path.join(self.user_storage, "sample.txt")
        data = b"x" * (2 * 1024 * 1024)
        with open(file_path, "wb") as f:
            f.write(data)

        with patch("app.core.storage_manager.STORAGE_DIR", self.temp_dir), \
             patch("app.core.storage_manager.get_tier_config", return_value={"max_disk_mb": 1}):
            is_valid = storage_manager.check_user_quota(self.user_id, incoming_bytes=0)
            self.assertFalse(is_valid)

if __name__ == "__main__":
    unittest.main()
