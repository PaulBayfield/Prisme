"""Root conftest for the worker project.

Having a conftest.py here (next to pyproject.toml) makes pytest add this
directory to sys.path in its default "prepend" import mode, so tests under
tests/unit/ can import worker modules directly (``import utils``,
``import income_forecast``, ``import categorizer``, ``lib.LCLPy...``)
without needing a src layout or installed package.
"""
