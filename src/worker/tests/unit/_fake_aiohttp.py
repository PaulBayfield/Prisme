"""Shared fake aiohttp.ClientSession for LCLPy tests.

LCLPy's client and Account objects call ``aiohttp.ClientSession(...)`` as an
async context manager, then ``session.post(...)``/``session.get(...)`` as
another async context manager yielding a response with an async ``.json()``.
This fakes that whole chain without touching the network, and records every
request made (method, url, json body/params, and the headers the session
itself was constructed with) so tests can assert on them.

(aioresponses was tried first but its 0.7.9 release is incompatible with the
aiohttp version pinned here - aiohttp's ClientResponse now requires a
``stream_writer`` kwarg that aioresponses doesn't pass - so this hand-rolled
fake is used instead, per the task's suggested fallback.)
"""

from typing import Callable


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    async def json(self):
        return self._payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False


def make_fake_session_class(calls: dict, responder: Callable[..., dict]):
    """
    Build a fake replacement for ``aiohttp.ClientSession``.

    :param calls: Dict this populates with ``"session_headers"`` (headers
        each constructed session was given, in order) and ``"requests"``
        (one dict per request made, in order)
    :param responder: ``(method, url, **kwargs) -> payload`` used to decide
        what each request should "respond" with
    """

    class FakeSession:
        def __init__(self, headers=None, **kwargs):
            calls.setdefault("session_headers", []).append(headers)

        async def __aenter__(self):
            return self

        async def __aexit__(self, *exc_info):
            return False

        def post(self, url, json=None, **kwargs):
            calls.setdefault("requests", []).append(
                {"method": "POST", "url": url, "json": json, **kwargs}
            )
            return FakeResponse(responder("POST", url, json=json, **kwargs))

        def get(self, url, params=None, **kwargs):
            calls.setdefault("requests", []).append(
                {"method": "GET", "url": url, "params": params, **kwargs}
            )
            return FakeResponse(responder("GET", url, params=params, **kwargs))

    return FakeSession
