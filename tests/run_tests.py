"""Run the Python test suite from any directory:  python tests/run_tests.py [unittest args]"""
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path[:0] = [str(HERE), str(HERE.parent / "backend")]  # tests import each other and backend modules flat

if __name__ == "__main__":
    if len(sys.argv) > 1:
        unittest.main(module=None, argv=[sys.argv[0], *sys.argv[1:]])
    else:
        suite = unittest.defaultTestLoader.discover(str(HERE), pattern="test_*.py", top_level_dir=str(HERE))
        sys.exit(not unittest.TextTestRunner(verbosity=1).run(suite).wasSuccessful())
