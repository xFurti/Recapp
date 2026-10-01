"""Render Workflows service entry point.

Deployed as a separate Render Workflow service (start command:
`python -m api.workflow`). The web service starts `extract_items` runs through
the Render API and polls them (see api/jobs.py).
"""

from render import TaskContext, Workflows

from .tasks import extract_items as _extract_items

app = Workflows()


@app.task
def extract_items(ctx: TaskContext, payload: dict) -> dict:
    return _extract_items(payload)


if __name__ == "__main__":
    app.start()
