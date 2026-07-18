"""
Centralized logging for CoolPilot's backend.

One logger namespace ("coolpilot"), console + rotating file, so every
module just does `logging.getLogger("coolpilot.<module>")` and gets
consistent formatting without reconfiguring anything.
"""

import logging
import logging.handlers
import os

LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
LOG_FILE = os.path.join(LOG_DIR, "coolpilot.log")

_configured = False


def setup_logging(level: int = logging.INFO) -> None:
    global _configured
    if _configured:
        return

    os.makedirs(LOG_DIR, exist_ok=True)

    formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)-8s %(name)-28s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    file_handler = logging.handlers.RotatingFileHandler(
        LOG_FILE, maxBytes=2_000_000, backupCount=3
    )
    file_handler.setFormatter(formatter)

    root = logging.getLogger("coolpilot")
    root.setLevel(level)
    root.addHandler(console_handler)
    root.addHandler(file_handler)
    root.propagate = False

    _configured = True
