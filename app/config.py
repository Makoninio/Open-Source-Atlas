from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    github_token: str
    database_url: str
    tracked_repos_raw: str

    @property
    def tracked_repos(self) -> list[str]:
        return [repo.strip() for repo in self.tracked_repos_raw.split(",") if repo.strip()]


def get_settings() -> Settings:
    return Settings(
        github_token=os.getenv("GITHUB_TOKEN", ""),
        database_url=os.getenv("DATABASE_URL", ""),
        tracked_repos_raw=os.getenv("TRACKED_REPOS", ""),
    )
