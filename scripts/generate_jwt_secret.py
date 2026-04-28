#!/usr/bin/env python3
"""Print a random hex string suitable for JWT_SECRET (paste into Vercel / .env only).

Does not write files or print to logs elsewhere — stdout only.
"""

from __future__ import annotations

import secrets

if __name__ == "__main__":
    print(secrets.token_hex(32))
