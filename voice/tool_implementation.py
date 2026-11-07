# SPDX-License-Identifier: Apache-2.0
"""Suyat Dental tool handlers for the NVA generic pipeline.

Each handler is a thin, stateless HTTP call to the clinic Worker (POST /api/voice/tool). All booking rules,
hours, double-booking protection and branch logic stay in the Worker, so chat, phone and this voice agent
can never disagree. Stdlib only (no extra dependencies in the NVA image).

Environment:
  SUYAT_API_BASE     e.g. https://clinic.example.workers.dev  (no trailing slash)
  VOICE_TOOL_SECRET  the same value set as a Worker secret
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Mapping

TIMEOUT_SECONDS = 8
SAFE_FAILURE = {
    "status": "error",
    "code": "SERVICE_UNAVAILABLE",
    "response_text": "I'm having trouble reaching our scheduling system. Please try again in a moment, or contact the clinic directly.",
}


def _call(tool: str, arguments: Mapping[str, Any] | None) -> dict[str, Any]:
    base = os.getenv("SUYAT_API_BASE", "").rstrip("/")
    secret = os.getenv("VOICE_TOOL_SECRET", "")
    if not base or not secret:
        return dict(SAFE_FAILURE, code="NOT_CONFIGURED")
    req = urllib.request.Request(
        f"{base}/api/voice/tool",
        data=json.dumps({"tool": tool, "arguments": dict(arguments or {})}).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {secret}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:  # noqa: S310 (https base from env)
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        # 400/401/503 etc.: never leak the body or the secret to the model
        return dict(SAFE_FAILURE, code=f"HTTP_{err.code}")
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return dict(SAFE_FAILURE)


def check_available_slots_result(arguments: Mapping[str, Any] | None) -> dict[str, Any]:
    return _call("check_available_slots", arguments)


def book_appointment_result(arguments: Mapping[str, Any] | None) -> dict[str, Any]:
    return _call("book_appointment", arguments)


def cancel_appointment_result(arguments: Mapping[str, Any] | None) -> dict[str, Any]:
    return _call("cancel_appointment", arguments)


def reschedule_appointment_result(arguments: Mapping[str, Any] | None) -> dict[str, Any]:
    return _call("reschedule_appointment", arguments)


# Registry consumed by the NVA overlay (same shape as the skill's tool-implementation templates).
TOOL_RESULT_FUNCTIONS = {
    "check_available_slots": check_available_slots_result,
    "book_appointment": book_appointment_result,
    "cancel_appointment": cancel_appointment_result,
    "reschedule_appointment": reschedule_appointment_result,
}
