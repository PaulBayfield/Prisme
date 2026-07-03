__title__ = "LCLPy"
__author__ = "Paul Bayfield"
__version__ = "1.0.1"
__description__ = "A Python library for interacting with LCL banking services."

__baseURL__ = "https://monespace.lcl.fr/api"

__headers__ = {"User-Agent": f"Primse/{__version__}"}

from .client import LCLClient


__all__ = ["LCLClient"]
