"""Make the ``app`` package importable when running pytest from the repo root.

pytest's rootdir is ``api/`` (where the pytest config lives), but the test files
sit under ``api/tests/``; this ensures ``api/`` is on ``sys.path`` so ``from app
import ...`` resolves regardless of how the suite is invoked.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
