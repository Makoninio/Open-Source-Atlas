from __future__ import annotations

import logging
from collections.abc import Iterator
from typing import Any

import requests
from requests import Response, Session
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


logger = logging.getLogger(__name__)


class GitHubClient:
    def __init__(self, token: str, timeout: int = 30) -> None:
        if not token:
            raise ValueError("GITHUB_TOKEN is required for authenticated GitHub API requests.")

        self.base_url = "https://api.github.com"
        self.timeout = timeout
        self.session = self._build_session(token)

    def _build_session(self, token: str) -> Session:
        session = requests.Session()
        session.headers.update(
            {
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {token}",
                "X-GitHub-Api-Version": "2022-11-28",
            }
        )

        retry = Retry(
            total=5,
            backoff_factor=1,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=("GET",),
            respect_retry_after_header=True,
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
        return session

    def _request(self, path: str, params: dict[str, Any] | None = None) -> Response:
        url = f"{self.base_url}{path}"
        response = self.session.get(url, params=params, timeout=self.timeout)
        self._raise_for_status(response)
        return response

    @staticmethod
    def _raise_for_status(response: Response) -> None:
        try:
            response.raise_for_status()
        except requests.HTTPError as exc:
            message = response.text[:500]
            raise requests.HTTPError(f"{exc}. Response body: {message}") from exc

    def get_repository(self, full_name: str) -> dict[str, Any]:
        logger.info("Fetching repository metadata for %s", full_name)
        return self._request(f"/repos/{full_name}").json()

    def get_paginated(self, path: str, params: dict[str, Any] | None = None) -> Iterator[dict[str, Any]]:
        next_url = f"{self.base_url}{path}"
        next_params = {"per_page": 100, **(params or {})}

        while next_url:
            response = self.session.get(next_url, params=next_params, timeout=self.timeout)
            self._raise_for_status(response)

            data = response.json()
            if not isinstance(data, list):
                raise ValueError(f"Expected paginated list response for {next_url}")

            for item in data:
                yield item

            next_url = response.links.get("next", {}).get("url")
            next_params = None

    def get_contributors(self, full_name: str) -> Iterator[dict[str, Any]]:
        logger.info("Fetching contributors for %s", full_name)
        return self.get_paginated(f"/repos/{full_name}/contributors")

    def get_issues(self, full_name: str) -> Iterator[dict[str, Any]]:
        logger.info("Fetching issues for %s", full_name)
        return self.get_paginated(f"/repos/{full_name}/issues", params={"state": "all"})

    def get_pull_requests(self, full_name: str) -> Iterator[dict[str, Any]]:
        logger.info("Fetching pull requests for %s", full_name)
        return self.get_paginated(f"/repos/{full_name}/pulls", params={"state": "all"})

    def get_commits(self, full_name: str) -> Iterator[dict[str, Any]]:
        logger.info("Fetching commits for %s", full_name)
        return self.get_paginated(f"/repos/{full_name}/commits")
