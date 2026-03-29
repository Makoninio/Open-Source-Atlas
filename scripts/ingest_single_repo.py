from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.config import get_settings
from app.db import SessionLocal, init_db
from app.github_client import GitHubClient
from app.models import TrackedRepository
from app.services.ingestion_service import ingest_repository


logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Ingest a single public GitHub repository.")
    parser.add_argument("repository", help="Repository in owner/name format, for example pallets/flask")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL must be set.")
    if SessionLocal is None:
        raise RuntimeError("Database session is not configured.")

    init_db()
    owner, repo_name = args.repository.split("/", maxsplit=1)
    full_name = f"{owner}/{repo_name}"

    client = GitHubClient(settings.github_token)

    with SessionLocal() as session:
        stmt = insert(TrackedRepository).values(
            owner=owner,
            repo_name=repo_name,
            full_name=full_name,
            is_active=True,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[TrackedRepository.full_name],
            set_={"owner": owner, "repo_name": repo_name, "is_active": True},
        )
        session.execute(stmt)
        session.commit()

        tracked_repository = session.query(TrackedRepository).filter_by(full_name=full_name).one()
        ingest_repository(session, client, tracked_repository)
        session.commit()


if __name__ == "__main__":
    main()
