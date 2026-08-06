#!/usr/bin/env python3
"""Prepare the collectstatic volume, then run the app without root privileges."""

from __future__ import annotations

import os
import pwd
import sys
from pathlib import Path


SERVICE_USER = "acme"
STATIC_ROOT = Path("/app/staticfiles")


def chown_tree(path: Path, uid: int, gid: int) -> None:
    os.chown(path, uid, gid, follow_symlinks=False)
    for root, directories, files in os.walk(path):
        for name in (*directories, *files):
            os.chown(Path(root, name), uid, gid, follow_symlinks=False)


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("No application command was supplied.")

    if os.getuid() == 0:
        account = pwd.getpwnam(SERVICE_USER)
        STATIC_ROOT.mkdir(parents=True, exist_ok=True)
        chown_tree(STATIC_ROOT, account.pw_uid, account.pw_gid)
        os.initgroups(SERVICE_USER, account.pw_gid)
        os.setgid(account.pw_gid)
        os.setuid(account.pw_uid)

    os.execvp(sys.argv[1], sys.argv[1:])


if __name__ == "__main__":
    main()
