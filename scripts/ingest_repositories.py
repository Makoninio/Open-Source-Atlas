from __future__ import annotations

import logging
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.config import get_settings
from app.db import SessionLocal, init_db
from app.github_client import GitHubClient
from app.models import TrackedRepository
from app.services.ingestion_service import ingest_repository


logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


def main() -> None:
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL must be set.")
    if SessionLocal is None:
        raise RuntimeError("Database session is not configured.")

    init_db()
    client = GitHubClient(settings.github_token)

    with SessionLocal() as session:
        tracked_repositories = (
            session.query(TrackedRepository)
            .filter(TrackedRepository.is_active.is_(True))
            .order_by(TrackedRepository.full_name.asc())
            .all()
        )
        logger.info("Found %s active tracked repositories", len(tracked_repositories))

        for tracked_repository in tracked_repositories:
            ingest_repository(session, client, tracked_repository)
            session.commit()


if __name__ == "__main__":
    main()
