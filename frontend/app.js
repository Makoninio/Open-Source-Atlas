const dataPath = "./data/story_data.json";
const themeStorageKey = "open-source-atlas-theme";

const numberFormat = new Intl.NumberFormat("en-US");

async function loadStoryData() {
  const response = await fetch(dataPath);
  if (!response.ok) {
    throw new Error(`Failed to load ${dataPath}`);
  }
  return response.json();
}

function renderHeroMetrics(summary) {
  const metrics = [
    ["Tracked repos", summary.repo_count],
    ["Total stars", summary.total_stars],
    ["Total commits", summary.total_commits],
    ["Total contributors", summary.total_contributors],
  ];

  const container = document.querySelector("#hero-metrics");
  container.innerHTML = metrics
    .map(
      ([label, value]) => `
        <div class="metric-box">
          <div class="metric-value">${numberFormat.format(value)}</div>
          <div class="metric-label">${label}</div>
        </div>
      `,
    )
    .join("");

}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const sun = document.querySelector("#theme-icon-sun");
  const moon = document.querySelector("#theme-icon-moon");

  if (sun && moon) {
    sun.style.display = theme === "light" ? "block" : "none";
    moon.style.display = theme === "light" ? "none" : "block";
  }
}

function setupThemeToggle() {
  const savedTheme = localStorage.getItem(themeStorageKey);
  const initialTheme = savedTheme || "dark";
  applyTheme(initialTheme);

  const button = document.querySelector("#theme-toggle");
  if (!button) {
    return;
  }

  button.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    localStorage.setItem(themeStorageKey, nextTheme);
    applyTheme(nextTheme);
  });
}

function setupStoryScroll() {
  const story = document.querySelector("[data-scroll-story]");
  if (!story) {
    return;
  }

  const updateProgress = () => {
    const rect = story.getBoundingClientRect();
    const scrollable = Math.max(rect.height - window.innerHeight, 1);
    const progressed = Math.min(Math.max(-rect.top / scrollable, 0), 1);
    story.style.setProperty("--story-progress", progressed.toFixed(4));
  };

  updateProgress();
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);
}

function renderRepoCards(repositories) {
  const container = document.querySelector("#repo-card-grid");
  container.innerHTML = repositories
    .map(
      (repo) => `
        <article class="repo-card">
          <div class="repo-card-header">
            <div>
              <div class="repo-card-title">${repo.full_name}</div>
              <div class="repo-card-language">${repo.language || "Unknown language"}</div>
            </div>
            <div class="timeline-age">${repo.age_years} yrs old</div>
          </div>
          <div class="repo-card-description">${repo.description || "No description available."}</div>
          <div class="repo-card-metrics">
            <div class="repo-card-metric"><strong>${numberFormat.format(repo.stars)}</strong><span>Stars</span></div>
            <div class="repo-card-metric"><strong>${numberFormat.format(repo.commits)}</strong><span>Commits</span></div>
            <div class="repo-card-metric"><strong>${numberFormat.format(repo.pull_requests)}</strong><span>PRs</span></div>
            <div class="repo-card-metric"><strong>${numberFormat.format(repo.contributors)}</strong><span>Contributors</span></div>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderTimeline(repositories) {
  const container = document.querySelector("#timeline-chart");
  const sorted = [...repositories].sort((a, b) => a.created_year - b.created_year);

  container.innerHTML = sorted
    .map(
      (repo) => `
        <div class="timeline-node">
          <div class="timeline-year">${repo.created_year}</div>
          <div class="timeline-name">${repo.full_name}</div>
          <div class="timeline-age">${repo.age_years} years in public view</div>
        </div>
      `,
    )
    .join("");
}

function renderMomentum(monthlyActivity, repositories) {
  const repoNames = repositories.map((repo) => repo.full_name);
  const container = document.querySelector("#momentum-chart");

  const rows = repoNames.map((repoName) => {
    const values = monthlyActivity.map((month) => month.counts[repoName] || 0);
    const max = Math.max(...values, 1);

    const bars = values
      .map((value) => {
        const height = Math.max((value / max) * 100, value > 0 ? 10 : 4);
        return `<div class="sparkline-bar" style="height:${height}%"></div>`;
      })
      .join("");

    return `
      <div class="sparkline-row">
        <div class="sparkline-label">${repoName}</div>
        <div class="sparkline-track">${bars}</div>
      </div>
    `;
  });

  container.innerHTML = rows.join("");
}

function renderBarChart(targetId, rows, valueKey) {
  const max = Math.max(...rows.map((row) => row[valueKey]), 1);
  const container = document.querySelector(targetId);

  container.innerHTML = rows
    .map(
      (row) => `
        <div class="bar-row">
          <div class="bar-label">${row.full_name}</div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${(row[valueKey] / max) * 100}%"></div>
          </div>
          <div class="bar-value">${numberFormat.format(row[valueKey])}</div>
        </div>
      `,
    )
    .join("");
}

function renderLeaderboard(contributors) {
  const container = document.querySelector("#contributors-list");
  container.innerHTML = contributors
    .map(
      (row, index) => `
        <div class="leaderboard-row">
          <div class="leaderboard-rank">${String(index + 1).padStart(2, "0")}</div>
          <div class="leaderboard-name">${row.login}</div>
          <div class="leaderboard-value">${numberFormat.format(row.contributions)}</div>
        </div>
      `,
    )
    .join("");
}

async function main() {
  try {
    setupThemeToggle();
    setupStoryScroll();
    const data = await loadStoryData();
    renderHeroMetrics(data.summary);
    renderRepoCards(data.repositories);
    renderTimeline(data.repositories);
    renderMomentum(data.monthly_activity, data.repositories);
    renderBarChart("#issues-chart", data.repositories, "open_issues");
    renderBarChart("#prs-chart", data.repositories, "pull_requests");
    renderLeaderboard(data.top_contributors);
  } catch (error) {
    console.error(error);
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div style="padding:16px;background:#ff7b72;color:#0d1117;font-family:IBM Plex Sans,sans-serif;">
        Failed to load story data. Run <code>python scripts/build_story_data.py</code> from the project root.
      </div>`,
    );
  }
}

main();
