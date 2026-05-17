# Sakina Notebooks

Four module notebooks per the assignment brief. Each notebook trains and
exports a model artifact consumed by [`../api`](../api).

## Planned notebooks

| # | Notebook                       | Dataset                          | Output artifact                |
|---|--------------------------------|----------------------------------|--------------------------------|
| 1 | `01_language_detection.ipynb`  | Language ID corpus               | `models/lang_id.joblib`        |
| 2 | `02_emotion.ipynb`             | GoEmotions + DAIR (6 classes)    | `models/emotion-xlmr/`         |
| 3 | `03_intent.ipynb`              | Custom few-shot examples         | `prompts/intent_few_shot.json` |
| 4 | `04_rag.ipynb`                 | Mental Health Counseling corpus  | Qdrant collection + BM25 idx   |

## Local run

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
jupyter lab
```

## Conventions

- Cell tags: `parameters` (papermill), `injected-parameters`, `outputs`.
- Each notebook ends by writing artifacts to `../api/app/models/` or pushing
  vectors to Qdrant Cloud.
- All randomness is seeded (`SEED=42`).
- No hardcoded paths — use environment variables or notebook parameters.
- Strip outputs before committing (`nbstripout` in pre-commit).
