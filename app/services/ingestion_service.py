from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.github_client import GitHubClient
from app.models import Contributor, RawRepositoryPayload, Repository, RepositoryContributor, RepositoryStats, TrackedRepository


logger = logging.getLogger(__name__)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_github_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def ingest_repository(session: Session, client: GitHubClient, tracked_repository: TrackedRepository) -> None:
    logger.info("Starting ingestion for %s", tracked_repository.full_name)
    repository = upsert_repository_metadata(session, client, tracked_repository)
    ingest_contributors(session, client, repository)
    ingest_repository_stats(session, client, repository)
    logger.info("Finished ingestion for %s", tracked_repository.full_name)


def upsert_repository_metadata(
    session: Session, client: GitHubClient, tracked_repository: TrackedRepository
) -> Repository:
    payload = client.get_repository(tracked_repository.full_name)
    fetched_at = utcnow()

    session.add(
        RawRepositoryPayload(
            tracked_repository_id=tracked_repository.id,
            fetched_at=fetched_at,
            payload=payload,
        )
    )

    values: dict[str, Any] = {
        "tracked_repository_id": tracked_repository.id,
        "github_repo_id": payload["id"],
        "name": payload["name"],
        "full_name": payload["full_name"],
        "owner_login": payload["owner"]["login"],
        "description": payload.get("description"),
        "language": payload.get("language"),
        "default_branch": payload["default_branch"],
        "stars": payload["stargazers_count"],
        "forks": payload["forks_count"],
        "watchers": payload["watchers_count"],
        "open_issues": payload["open_issues_count"],
        "repo_created_at": parse_github_datetime(payload["created_at"]),
        "repo_updated_at": parse_github_datetime(payload["updated_at"]),
        "pushed_at": parse_github_datetime(payload.get("pushed_at")),
        "is_archived": payload["archived"],
        "size": payload["size"],
        "scraped_at": fetched_at,
    }

    stmt = insert(Repository).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[Repository.tracked_repository_id],
        set_={key: values[key] for key in values if key != "tracked_repository_id"},
    )
    session.execute(stmt)
    session.flush()

    logger.info("Saved repository metadata for %s", tracked_repository.full_name)
    return session.query(Repository).filter_by(tracked_repository_id=tracked_repository.id).one()


def ingest_contributors(session: Session, client: GitHubClient, repository: Repository) -> None:
    scraped_at = utcnow()

    try:
        for payload in client.get_contributors(repository.full_name):
            contributor_values = {
                "github_user_id": payload["id"],
                "login": payload["login"],
                "html_url": payload["html_url"],
                "avatar_url": payload.get("avatar_url"),
                "type": payload["type"],
                "scraped_at": scraped_at,
            }

            stmt = insert(Contributor).values(**contributor_values)
            stmt = stmt.on_conflict_do_update(
                index_elements=[Contributor.github_user_id],
                set_={key: contributor_values[key] for key in contributor_values if key != "github_user_id"},
            )
            session.execute(stmt)

            contributor = session.execute(
                select(Contributor).where(Contributor.github_user_id == payload["id"])
            ).scalar_one()

            link_values = {
                "repository_id": repository.id,
                "contributor_id": contributor.id,
                "contributions": payload["contributions"],
                "scraped_at": scraped_at,
            }
            link_stmt = insert(RepositoryContributor).values(**link_values)
            link_stmt = link_stmt.on_conflict_do_update(
                constraint="uq_repository_contributor_pair",
                set_={"contributions": link_values["contributions"], "scraped_at": scraped_at},
            )
            session.execute(link_stmt)
    except Exception as exc:
        message = str(exc)
        if "contributor list is too large" in message:
            logger.warning(
                "Skipping contributors for %s because GitHub does not expose contributor data for very large repositories.",
                repository.full_name,
            )
            return
        raise

    logger.info("Saved contributors for %s", repository.full_name)


def ingest_repository_stats(session: Session, client: GitHubClient, repository: Repository) -> None:
    scraped_at = utcnow()
    counts = client.get_issue_summary_counts(repository.full_name)
    commit_summary = client.get_commit_summary(repository.full_name)

    values = {
        "repository_id": repository.id,
        "total_issues": counts["total_issues"],
        "open_issues": counts["open_issues"],
        "total_pull_requests": counts["total_pull_requests"],
        "open_pull_requests": counts["open_pull_requests"],
        "commits_last_year": commit_summary["commits_last_year"],
        "weekly_commit_counts": commit_summary["weekly_commit_counts"],
        "scraped_at": scraped_at,
    }
    stmt = insert(RepositoryStats).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[RepositoryStats.repository_id],
        set_={key: values[key] for key in values if key != "repository_id"},
    )
    session.execute(stmt)

    logger.info("Saved repository summary counts for %s", repository.full_name)
