"""macOS fork-safety guard — must be the FIRST import in every RQ worker file.

ROOT CAUSE
==========
RQ uses os.fork() to execute jobs in isolated child processes.  On macOS,
any ObjC class that runs ``+initialize`` inside the forked child triggers
``performForkChildInitialize`` (a pthread_atfork handler registered by
libobjc).  If ``DisableInitializeForkSafety`` is false in the parent's
libobjc state, that handler calls ``_objc_fatal`` → SIGABRT:
  "crashed on child side of fork pre-exec"

The proximate trigger in this project is:
  urllib.request.getproxies()
    → getproxies_macosx_sysconf()
    → _get_proxies()                   ← C function from _scproxy
    → SCDynamicStoreCopyProxiesWithOptions
    → CFStringCreateMutable / _CFRuntimeCreateInstance
    → object_setClass                  ← ObjC class init
    → initializeNonMetaClass → performForkChildInitialize → ABORT

WHY os.environ / OBJC_DISABLE_INITIALIZE_FORK_SAFETY FROM PYTHON IS USELESS
============================================================================
libobjc reads that env-var in ``_objc_init()`` which is called when the
dylib loads — before the Python interpreter executes a single byte.  The C
global ``DisableInitializeForkSafety`` is frozen by the time any Python
code runs.  Setting it from ``os.environ`` only helps freshly exec()'d
children, not forked children that inherit the parent's frozen libobjc state.

THE CORRECT APPROACH
====================
Prevent ``_get_proxies()`` from ever being called in the child by patching
EVERY reference path.  Python 3.14's urllib/request.py does:

    from _scproxy import _get_proxies, _get_proxy_settings

This captures the C-function objects as local names in urllib.request's
module namespace.  Patching ``_scproxy._get_proxies`` ALONE is insufficient
because urllib has already bound the old C object.  We must also patch the
references inside urllib.request itself.

DO NOT call getproxies() as a "pre-warm" in this module.  Calling it in the
CHILD triggers the very ObjC class init we are trying to prevent.
"""

import sys

# ---------------------------------------------------------------------------
# Comprehensive ObjC-proxy-detection patch
# ---------------------------------------------------------------------------
# _scproxy exports both get_proxies (no underscore) and _get_proxies (with
# underscore). Python 3.14 urllib/request.py uses _get_proxies exclusively.
# Patch every variant so nothing can slip through regardless of Python version.

_noop = lambda: {}  # noqa: E731

try:
    import _scproxy  # type: ignore[import]

    _scproxy.get_proxies = _noop
    _scproxy.get_proxy_settings = _noop
    _scproxy._get_proxies = _noop
    _scproxy._get_proxy_settings = _noop
except ImportError:
    pass

# urllib.request captures _get_proxies by name at import time via:
#   from _scproxy import _get_proxies
# so patching _scproxy above doesn't affect the already-captured reference.
# We must patch urllib.request's own namespace too.
try:
    import urllib.request as _ur

    _ur.getproxies = _noop  # top-level public API
    if hasattr(_ur, "getproxies_macosx_sysconf"):
        _ur.getproxies_macosx_sysconf = _noop  # macos-specific path
    if hasattr(_ur, "_get_proxies"):
        _ur._get_proxies = _noop  # captured C reference
    if hasattr(_ur, "_get_proxy_settings"):
        _ur._get_proxy_settings = _noop

    del _ur
except Exception:
    pass

# ---------------------------------------------------------------------------
# Pre-import heavy C-extension modules (Layer 3 — safe to run in child/parent)
# ---------------------------------------------------------------------------
# With the patches above in place, importing httpx, langchain, etc. is safe
# even in the forked child — they cannot reach _scproxy's C functions.
if sys.platform == "darwin":
    _preload = [
        "pydantic",
        "pydantic_core",
        "httpx",
        "httpcore",
        "h11",
        "anyio",
        "asyncpg",
        "langchain_core",
    ]
    for _m in _preload:
        try:
            __import__(_m)
        except Exception:
            pass
    del _preload, _m
