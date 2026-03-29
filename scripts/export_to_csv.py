from __future__ import annotations

import csv
import logging
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.config import get_settings
from app.db import SessionLocal, init_db
from app.models import (
    Commit,
    Contributor,
    Issue,
    PullRequest,
    Repository,
    RepositoryContributor,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

MODELS_TO_EXPORT = [
    Repository,
    Commit,
    Issue,
    PullRequest,
    Contributor,
    RepositoryContributor,
]


def export_model_to_csv(session, model, export_dir: Path) -> None:
    table_name = model.__tablename__
    file_path = export_dir / f"{table_name}.csv"
    
    # Get all column names from the model
    columns = [column.name for column in model.__mapper__.columns]
    
    records = session.query(model).all()
    
    with open(file_path, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        
        for record in records:
            row = []
            for col in columns:
                value = getattr(record, col)
                # Handle datetime or other objects that need standard string conversion
                row.append(str(value) if value is not None else "")
            writer.writerow(row)
            
    logger.info("Exported %d records to %s", len(records), file_path)


def main() -> None:
    settings = get_settings()
    if not settings.database_url:
        raise RuntimeError("DATABASE_URL must be set.")
    if SessionLocal is None:
        raise RuntimeError("Database session is not configured.")

    init_db()

    export_dir = Path(__file__).resolve().parents[1] / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)
    logger.info("Export directory set to %s", export_dir)

    with SessionLocal() as session:
        for model in MODELS_TO_EXPORT:
            export_model_to_csv(session, model, export_dir)
            
    logger.info("Data export complete.")


if __name__ == "__main__":
    main()
