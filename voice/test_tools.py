"""Handler tests against a local stub of the Worker. Run: python3 -m unittest voice/test_tools.py -v"""
import http.server
import json
import os
import sys
import threading
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import tool_implementation as T  # noqa: E402

SEEN = {}


class Stub(http.server.BaseHTTPRequestHandler):
    def do_POST(self):  # noqa: N802
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        SEEN.update(path=self.path, auth=self.headers.get("Authorization"), body=body)
        if self.headers.get("Authorization") != "Bearer good":
            self.send_response(401); self.end_headers(); self.wfile.write(b'{"error":"secret detail"}'); return
        out = json.dumps({"status": "booked", "booking_reference": "SUYAT-ABCD1234", "response_text": "ok"}).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.end_headers(); self.wfile.write(out)

    def log_message(self, *a):
        pass


class ToolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = http.server.HTTPServer(("127.0.0.1", 0), Stub)
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.srv.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()

    def env(self, secret="good", base=None):
        os.environ["SUYAT_API_BASE"] = (base if base is not None else self.base) + "/"
        os.environ["VOICE_TOOL_SECRET"] = secret

    def test_book_sends_bearer_and_arguments(self):
        self.env()
        r = T.TOOL_RESULT_FUNCTIONS["book_appointment"]({"patient_name": "Ana Reyes", "date": "2026-11-10"})
        self.assertEqual(r["booking_reference"], "SUYAT-ABCD1234")
        self.assertEqual(SEEN["path"], "/api/voice/tool")
        self.assertEqual(SEEN["body"]["tool"], "book_appointment")
        self.assertEqual(SEEN["body"]["arguments"]["patient_name"], "Ana Reyes")

    def test_unauthorized_never_leaks_server_body(self):
        self.env(secret="bad")
        r = T.TOOL_RESULT_FUNCTIONS["check_available_slots"]({"date": "2026-11-10"})
        self.assertEqual(r["status"], "error")
        self.assertEqual(r["code"], "HTTP_401")
        self.assertNotIn("secret detail", json.dumps(r))

    def test_unreachable_is_speakable_not_an_exception(self):
        self.env(base="http://127.0.0.1:9")
        r = T.TOOL_RESULT_FUNCTIONS["cancel_appointment"]({"patient_phone": "0917", "date": "2026-11-10"})
        self.assertEqual(r["status"], "error")
        self.assertIn("trouble", r["response_text"])

    def test_not_configured(self):
        os.environ.pop("SUYAT_API_BASE", None); os.environ.pop("VOICE_TOOL_SECRET", None)
        self.assertEqual(T.check_available_slots_result({})["code"], "NOT_CONFIGURED")

    def test_registry_matches_tools_yaml(self):
        names = [l.split(":")[0] for l in open(os.path.join(os.path.dirname(__file__), "tools.yaml")) if l and not l.startswith((" ", "#")) and ":" in l]
        self.assertEqual(sorted(names), sorted(T.TOOL_RESULT_FUNCTIONS))


if __name__ == "__main__":
    unittest.main()
