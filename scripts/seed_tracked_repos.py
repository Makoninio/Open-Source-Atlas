from __future__ import annotations

import logging
import sys
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.config import get_settings
from app.db import SessionLocal, init_db
from app.models import TrackedRepository


logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL must be set.")
    if not settings.tracked_repos:
        raise RuntimeError("TRACKED_REPOS must contain at least one owner/repo entry.")
    if SessionLocal is None:
        raise RuntimeError("Database session is not configured.")

    init_db()

    with SessionLocal() as session:
        for full_name in settings.tracked_repos:
            owner, repo_name = full_name.split("/", maxsplit=1)
            values = {
                "owner": owner,
                "repo_name": repo_name,
                "full_name": full_name,
                "is_active": True,
            }
            stmt = insert(TrackedRepository).values(**values)
            stmt = stmt.on_conflict_do_update(
                index_elements=[TrackedRepository.full_name],
                set_={"owner": owner, "repo_name": repo_name, "is_active": True},
            )
            session.execute(stmt)
            logger.info("Seeded tracked repository: %s", full_name)

        session.commit()


if __name__ == "__main__":
    main()
