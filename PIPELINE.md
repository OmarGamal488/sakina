# Sakina Pipeline

This file is the project walkthrough backbone. It lists the modules in the order
they participate in a user turn, separating the core AI chat path from adjacent
features such as voice, soundscape, scribble, and letter forwarding.

## Ordered Runtime Modules

1. User input intake
   - Text input goes directly to `/chat` or `/chat/ui`.
   - Voice input first goes to Speech to Text, then enters the same text pipeline.

2. Speech to Text
   - Optional entry point for recorded audio.
   - Implemented in `api/app/stt.py` and exposed by `POST /stt`.
   - Uses Groq Whisper and returns plain text.

3. Crisis Management gate
   - Runs before language detection, emotion classification, intent routing, RAG,
     or reply generation.
   - Implemented in `api/app/safety.py`, called from `api/app/main.py`.
   - If triggered, the normal AI pipeline is short-circuited and a crisis response
     is streamed.
   - If a trusted person email is available, `api/app/main.py` posts to the n8n
     webhook configured as `crisis_help_webhook_url`.

4. Language Detection
   - Implemented in `api/app/models/language_id.py`.
   - Uses `api/app/models/artifacts/lang_id.joblib`.
   - The detector is a TF-IDF + calibrated LinearSVC pipeline with robustness
     guards for short text, no-signal text, script detection, and prior language.

5. Emotion Classifier
   - Implemented in `api/app/models/emotion.py`.
   - For non-English text, NLLB translates to English first.
   - A pretrained DistilBERT emotion model classifies into:
     `sadness`, `joy`, `love`, `anger`, `fear`, `surprise`.
   - Configuration lives in `api/app/models/artifacts/emotion_config.json`.

6. Intent Classifier / Router
   - Implemented in `api/app/models/intent.py`.
   - Uses a few-shot Lightning LLM prompt from
     `api/app/models/artifacts/intent_few_shot.json`.
   - Produces one of:
     `greeting`, `goodbye`, `gratitude`,
     `asking_mental_health_question`, `out_of_scope`.
   - Only `asking_mental_health_question` is routed to RAG.

7. Q&A RAG
   - Implemented in `api/app/models/rag.py`.
   - Runs only for `asking_mental_health_question`.
   - Uses the English query from the emotion module translation path.
   - Retrieval flow: BM25 + dense `BAAI/bge-m3` search, RRF fusion,
     `BAAI/bge-reranker-v2-m3` reranking, top passages returned.
   - BM25 artifact: `api/app/models/artifacts/bm25_index.pkl`.
   - Dense vectors live in Qdrant, configured in `api/app/config.py`.

8. Response composition and streaming
   - Implemented in `api/app/orchestrator.py`.
   - Uses Lightning `gpt-oss-120b`.
   - The prompt includes detected language, detected emotion, intent guidance,
     optional RAG notes, and recent message history.
   - Streams reply chunks through `/chat` or `/chat/ui`.

9. Text to Speech
   - Optional output step after the assistant text exists.
   - Implemented in `api/app/tts.py` and exposed by `POST /tts`.
   - Uses Groq Orpheus; Arabic uses the Arabic model/voice, other languages use
     the English model/voice.

10. Message/session memory write
   - After the assistant response finishes, the user turn, assistant turn, and
     prior language are stored.
   - Implemented in `api/app/memory.py`, called from `api/app/main.py`.

## Adjacent Features

### Scribble

- Separate visual-reflection feature, not part of the normal chat pipeline.
- Implemented in `api/app/scribble.py`, exposed by `POST /scribble/reflect`.
- Uses Gemini image understanding to reflect on an uploaded canvas image.

### Letter Forward

- Separate webhook feature for future-self letters and crisis trusted-person
  contact.
- The backend crisis path posts trusted-person help requests from `api/app/main.py`.
- The webhook URL is configured in `api/app/config.py`.
- The normal letter-writing UI posts directly to the same n8n webhook from the
  client side; it is not routed through the backend AI pipeline.

### Soundscape

- Relaxation audio feature, not part of backend AI inference.
- Uses static audio assets under `frontend/public/sounds/`.
- It does not affect language detection, emotion, intent, RAG, or generation.

### Database / Storage

- Conversation memory is handled by Redis or an in-process fallback in
  `api/app/memory.py`.
- Name and email settings are stored on the client device, not in a backend
  database table in the current implementation.
- RAG vector storage is Qdrant.




# Detailed Explaination for each module

## 1. Speech to Text

- Speech to Text is used only when the user sends voice instead of typed text.
- The backend receives the uploaded audio through `POST /stt`.
- Implemented in `api/app/stt.py`.
- The model is configured in `api/app/config.py`:
  `groq_stt_model = "whisper-large-v3-turbo"`.
- This means we use Groq-hosted Whisper Large v3 Turbo.
- Whisper is not running locally in our backend; the backend calls Groq through an
  OpenAI-compatible client.
- The audio file is sent as bytes, and the service returns plain text.
- We set `temperature=0.0` for deterministic transcription.
- We do not force the spoken language in the STT request. Whisper auto-detects
  the language.
- After transcription, the returned text enters the same normal Sakina text
  pipeline: crisis gate, language detection, emotion, intent, optional RAG, then
  response generation.

## 2. Crisis Management Gate

- Crisis Management is the first safety step in the chat pipeline.
- It runs before language detection, emotion classification, intent
  classification, RAG, and LLM response generation.
- Implemented in `api/app/safety.py`.
- It is model-free. It does not call an LLM or classifier.
- It uses regex patterns for high-risk self-harm and suicide language.
- The supported crisis matching languages are English and Arabic.
- Arabic text is normalized before matching:
  diacritics/tatweel are removed, alef/yaa/teh variants are unified, and text is
  lowercased.
- The design is recall-first: false positives are acceptable, false negatives
  are not.
- If no crisis pattern is found, the message continues into the normal AI
  pipeline.
- If a crisis pattern is found, the normal AI pipeline is stopped immediately:
  no language detector, no emotion model, no intent model, no RAG, and no LLM
  generation are called for that turn.
- The backend streams a fixed supportive crisis response instead.
- The crisis response uses `emotion = "sadness"`, `intent = None`, no sources,
  and `kind = "crisis"` in the streamed metadata.
- If the user has saved a trusted person email, the backend sends an asynchronous
  POST request to the configured n8n webhook.
- The trusted-person webhook payload includes:
  `intent = "help"`, the trusted person's `email`, and optionally the user's
  `name`.
- The webhook URL is configured in `api/app/config.py` as
  `crisis_help_webhook_url`.
- Phone-call automation is not implemented in the backend code. The implemented
  automation is the n8n email/help webhook.
- Known limitation from the code: crisis matching is only English and Arabic.
  The app supports 20 languages generally, but this specific crisis regex gate
  does not detect crisis phrases in the other 18 languages.

## 3. Language Detection

- Language Detection runs after the crisis gate and before emotion, intent, RAG,
  and response generation.
- Its job is to decide the user's language so Sakina can:
  - reply in the detected language,
  - pass the correct source language to the emotion translator,
  - store the prior language for the next turn,
  - handle short follow-up messages more safely.
- Implemented in `api/app/models/language_id.py`.
- Called from `api/app/orchestrator.py` inside `analyze()`.
- The exported artifact is `api/app/models/artifacts/lang_id.joblib`.
- The runtime model is a scikit-learn pipeline:
  `TfidfVectorizer(analyzer="char_wb", ngram_range=(1, 4))`
  plus calibrated `LinearSVC`.
- Supported languages:
  arabic (ar), bulgarian (bg), german (de), modern greek (el), english (en), spanish (es), french (fr), hindi (hi), italian (it), japanese (ja), dutch (nl), polish (pl), portuguese (pt), russian (ru), swahili (sw), thai (th), turkish (tr), urdu (ur), vietnamese (vi), and chinese (zh)
- The detector returns:
  `lang`, `confidence`, and `source`.
- Preprocessing matches training:
  strip URLs, apply Unicode NFKC normalization, and lowercase text.
- The detector is warmed once at FastAPI startup through
  `orchestrator.warmup()`, not loaded per request.

### Language Detection Runtime Guard

- The raw classifier performs very well on clean sentence-length text, but chat
  messages can be very short or contain emojis/digits.
- Because of this, the exported classifier is wrapped with a robustness guard.
- No-signal text, such as emojis or numbers, returns the session's prior language
  if available, otherwise English.
- Non-Latin scripts are detected by Unicode script and restricted to matching
  language candidates:
  Arabic script -> `ar` or `ur`, Cyrillic -> `bg` or `ru`, Greek -> `el`,
  Thai -> `th`, Devanagari -> `hi`, Han/Japanese scripts -> `zh` or `ja`.
- Short Latin input below 7 letters does not trust TF-IDF directly.
  It uses this order:
  prior session language, then Lingua if confidence >= 0.55, then English.
- Normal-length text trusts TF-IDF when confidence >= 0.6.
  If confidence is lower, Lingua is used as a fallback.
- The prior language comes from `api/app/memory.py`.

### Language Detection Notebook Journey

- Notebook: `notebooks/01_language_detection.ipynb`.
- Dataset: `papluca/language-identification`.
- Dataset shape:
  70,000 train rows, 10,000 validation rows, 10,000 test rows.
- The dataset is balanced:
  20 languages, each with 3,500 train, 500 validation, and 500 test samples.
- Requirement in the notebook:
  traditional NLP only, no transformer model for this module.
- Shared features for all tested models:
  character TF-IDF with `char_wb` n-grams from 1 to 4,
  `max_features = 30000`, `min_df = 2`, and `sublinear_tf = True`.
- Models tested:
  Logistic Regression, Multinomial Naive Bayes, and calibrated LinearSVC.
- Selection rule:
  among models with macro-F1 >= 0.97 and median latency < 5 ms, choose the
  highest macro-F1; latency is the tiebreaker.
- Results on the 10,000-row test set:
  Logistic Regression accuracy 0.9953, macro-F1 0.9953, median latency 2.577 ms.
  Naive Bayes accuracy 0.9950, macro-F1 0.9950, median latency 2.707 ms.
  LinearSVC accuracy 0.9959, macro-F1 0.9959, median latency 3.530 ms.
- LinearSVC won because it had the best macro-F1.
- The weakest language for all three models was Swahili (`sw`).
  For the winning LinearSVC model, Swahili F1 was 0.9708.
- Main dataset issue:
  the papluca test split is clean sentence-length text, but real chat input can
  be very short, mixed, or contain only emojis/numbers.
- Example problem found:
  the bare classifier could confidently misclassify short English tokens such as
  `hi` as Swahili.
- Solution:
  add the runtime robustness guard described above.
- Reproduced chat-style check from the exported artifact:
  bare classifier 13/20 = 0.650,
  guard without prior language 18/20 = 0.900,
  guard with session prior language 20/20 = 1.000.

## 4. Emotion Classifier

- Emotion Classification runs after language detection.
- In `api/app/orchestrator.py`, emotion classification runs concurrently with
  intent classification after the language has been detected.
- Implemented in `api/app/models/emotion.py`.
- Configuration is stored in `api/app/models/artifacts/emotion_config.json`.
- The runtime approach is:
  translate non-English text to English, then classify English text into one of
  the six DAIR emotion labels.
- English text is classified directly without translation.
- Non-English text uses NLLB to translate into English first.
- The result returned to the orchestrator includes:
  `emotion`, `confidence`, and `translated_text`.
- `translated_text` is reused later as the English query for RAG.
- The classifier is warmed once at FastAPI startup through
  `orchestrator.warmup()`, not loaded per request.

### NLLB in Emotion Classification

- NLLB means No Language Left Behind.
- The deployed translator is `facebook/nllb-200-distilled-1.3B`.
- It is a multilingual sequence-to-sequence translation model from Meta's NLLB
  family.
- We use it to translate from the detected user language into English.
- The current implementation runs on CPU.
- NLLB is also reused by `orchestrator.build_text()` to translate the assistant's
  non-English reply back into English for the bilingual text dictionary. That english version is used in the translation feature of each message sent by the assistant in the UI.

### DistilBERT in Emotion Classification

- The deployed emotion model is
  `bhadresh-savani/distilbert-base-uncased-emotion`.
- DistilBERT is a smaller, faster distilled version of BERT.
- `uncased` means the model lowercases/collapses casing rather than treating
  uppercase and lowercase as separate signals.
- This specific checkpoint is already fine-tuned for emotion classification.
- The six labels are:
  `sadness`, `joy`, `love`, `anger`, `fear`, `surprise`.
ء
### Emotion Notebook Journey

- Notebook: `notebooks/02_emotion.ipynb`.
- Requirement:
  build a multi-class classifier using RNNs or Transformers.
- Final approach:
  transformer-based translate-then-classify.
- Dataset used in the notebook:
  `dair-ai/emotion`.
- DAIR dataset shape:
  16,000 train rows, 2,000 validation rows, 2,000 test rows.
- The notebook uses the test split for evaluation because the selected classifier
  is pretrained; there is no training step in the notebook.
- DAIR labels:
  `sadness`, `joy`, `love`, `anger`, `fear`, `surprise`.
- Dataset issue:
  DAIR is English-only, while Sakina supports 20 languages.
- Dataset issue:
  DAIR is imbalanced. In the train split:
  `joy` has 5,362 examples, `sadness` 4,666, `anger` 2,159, `fear` 1,937,
  `love` 1,304, and `surprise` only 572.
- The train imbalance ratio is about 9.4x between the largest and smallest class.
- Because of this imbalance, macro-F1 is more important than accuracy.
  Accuracy can hide weak performance on small classes such as `surprise`.
- Solution for multilingual support:
  translate every non-English message to English with NLLB, then use the English
  emotion classifier.


### Emotion Metrics and Configurations Tried

- English DAIR test evaluation:
  2,000 rows, accuracy 0.9270, macro-F1 0.8825, weighted-F1 0.9269.
- Per-class English F1:
  sadness 0.9672, joy 0.9458, love 0.8257, anger 0.9234, fear 0.8952,
  surprise 0.7377.
- The main weakness is `surprise`, which is also the smallest DAIR class.
- Authoritative multilingual evaluation in `emotion_config.json`:
  stratified 60-row DAIR slice per language, 10 rows per emotion, across all 20
  languages, total 1,200 rows.
- Pooled multilingual metrics:
  macro-F1 0.8975, accuracy 0.8958.
- Translator/configuration comparison by pooled macro-F1:
  NLLB-200 distilled 1.3B = 0.8975.
  NLLB-200 distilled 600M = 0.8806.
  LLM `gpt-oss-120b` as translator = 0.8759.
  LLM `gpt-oss-20b` as translator = 0.7983.
  LLM `gpt-oss-20b` direct classification without translation = 0.4919.
- We chose NLLB-200 distilled 1.3B because it had the best pooled macro-F1,
  avoided API calls, and was better than LLM-as-translator in this evaluation.
- Knowledge distillation was considered but not used because it would reopen
  training/fine-tuning work and still depend on NLLB-quality supervision.
- Known limitation:
  translation can distort emotional tone, and weaker per-language results show
  that not all languages survive translation equally.

## 5. Intent Classifier / Router

- Intent Classification runs after language detection.
- In `api/app/orchestrator.py`, intent classification runs concurrently with
  emotion classification after the language has been detected.
- Implemented in `api/app/models/intent.py`.
- The exported prompt artifact is
  `api/app/models/artifacts/intent_few_shot.json`.
- This module is not a locally trained model at runtime. It is a few-shot LLM
  classifier that calls the Lightning AI OpenAI-compatible API.
- The configured model is `lightning-ai/gpt-oss-120b`.
- The classifier produces exactly one of five fixed intents:
  `greeting`, `goodbye`, `gratitude`, `asking_mental_health_question`, or
  `out_of_scope`.
- The intent result is used as the routing decision for the rest of the turn.
- Only `asking_mental_health_question` is routed to RAG.
- All other intents skip RAG and go directly to response composition with
  intent-specific guidance.
- The classifier is warmed once at FastAPI startup through
  `orchestrator.warmup()`, not constructed per request.

### Intent Labels

- `greeting` means the user is opening the conversation with hello,
  salutations, or a check-in.
- `goodbye` means the user is closing the conversation or leaving.
- `gratitude` means the user is thanking Sakina or expressing appreciation.
- `asking_mental_health_question` means the user is asking for support or
  sharing something related to feelings, mental state, stress, anxiety,
  depression, sleep, relationships, or another topic Sakina can help with.
- `out_of_scope` means the user is asking for something outside Sakina's
  mental-health support role, such as coding, weather, sports, math, current
  events, or general factual questions.

### Few-Shot Prompt

- We use a hand-written few-shot prompt instead of training a separate intent
  classifier.
- The prompt contains the task instruction, the five allowed labels, a short
  description for each label, and examples for each intent.
- The prompt explicitly tells the model that messages may arrive in any
  language.
- The model is instructed to reply with only the intent label and nothing else.
- The examples include English and Arabic messages so the model sees both the
  main project languages in the demonstration bank.
- The user message is inserted using the template:
  `Message: {message}\nIntent:`.
- We set `temperature=0.0` for stable classification.
- `max_tokens=512` is used because smaller limits can truncate responses from
  reasoning-style models, even when the desired final answer is short.

### Intent Runtime Parsing

- After the LLM responds, `api/app/models/intent.py` lowercases the output.
- It searches for the allowed intent labels in the response.
- If more than one label appears, the label that appears last wins.
- This makes the parser tolerant of occasional reasoning prose, even though the
  prompt asks for only the label.
- If no valid label is found, or if the API call fails, the classifier returns
  `out_of_scope`.
- This fallback prevents an intent failure from crashing the chat request.

### Intent Router Role

- The module is called "Classifier / Router" because its output changes the
  path through the pipeline.
- For `asking_mental_health_question`, the orchestrator retrieves relevant
  counselor notes using RAG before composing the answer.
- For `greeting`, `goodbye`, `gratitude`, and `out_of_scope`, the orchestrator
  skips retrieval and uses direct response guidance from `_INTENT_GUIDANCE`.
- This keeps retrieval focused on genuine mental-health support questions and
  avoids unnecessary RAG calls for small conversational turns or unrelated
  requests.

### Intent Notebook / Prompt Journey

- Notebook: `notebooks/03_intent.ipynb`.
- The notebook does not train a deployed model. It designs, evaluates, and
  exports the few-shot prompt used by the API.
- The labeled development data contains English and Arabic examples across the
  five intent labels.
- The split is stratified by intent so train, dev, and test each contain all
  five classes.
- Few-shot demonstrations are selected from the train split only, so the held-out
  test examples do not leak into the prompt.
- The exported artifact is `intent_few_shot.json`, which stores the model name,
  intent list, intent descriptions, system prompt, user template, parsing rule,
  and evaluation metadata.
- DSPy/MIPROv2 was tried but removed because it scored lower than the simpler
  prompt while adding compile time and a runtime dependency.
- Reported held-out test accuracy is 100.0% on 24 examples.
- Generated test cases along with their labels and tried different prompts then chose the best performing few-shot-prompt.
- The main probe weakness is `greeting`, mostly because some synthetic greetings
  are compound messages that also contain off-topic content.

## 6. Q&A RAG

- Q&A RAG runs after intent classification, but only when the intent is
  `asking_mental_health_question`.
- Implemented in `api/app/models/rag.py`.
- Called from `api/app/orchestrator.py` inside `analyze()`.
- Its job is to retrieve relevant counseling passages before the final assistant
  reply is composed.
- It does not generate the final answer by itself. It only returns grounding
  notes that the response-composition LLM can use.
- The corpus is English mental-health counseling Q&A data, so retrieval uses the
  English query produced by the emotion module translation path.
- For English user messages, the query is already English.
- For non-English user messages, NLLB translates the message to English during
  emotion classification, and that translated text is reused as the RAG query.

### RAG Routing

- RAG is intentionally not used for every message.
- If the intent is `greeting`, `goodbye`, `gratitude`, or `out_of_scope`, the
  orchestrator skips retrieval.
- If the intent is `asking_mental_health_question`, the orchestrator retrieves
  top counseling passages and passes them into the response prompt.
- This keeps the system faster and avoids grounding simple conversational turns
  on irrelevant documents.
- It also protects the assistant from trying to answer out-of-scope questions
  using a mental-health corpus.

### RAG Corpus and Storage

- Notebook: `notebooks/04_rag.ipynb`.
- Dataset used:
  `Amod/mental_health_counseling_conversations`.
- The dataset contains roughly 3.5k mental-health counseling question/answer
  pairs.
- The notebook prepares the counseling answers as retrievable chunks.
- The final BM25 sparse index is exported to:
  `api/app/models/artifacts/bm25_index.pkl`.
- The dense vector index lives in Qdrant.
- The Qdrant collection is configured in `api/app/config.py`.
- The runtime code connects to Qdrant through `qdrant_client`.

### Hybrid Retrieval Flow

- The retriever uses a hybrid search strategy:
  BM25 sparse search plus dense semantic search.
- BM25 is useful for exact lexical matches, such as words like "sleep",
  "panic", "stress", or "relationship".
- Dense retrieval is useful when the user phrase is semantically similar to the
  counseling text but does not use the exact same words.
- Dense embeddings use:
  `BAAI/bge-m3`.
- The notebook stores `bge-m3` vectors in Qdrant for the counseling chunks.
- At runtime, the user query is embedded with the same `BAAI/bge-m3` model.
- The retriever asks BM25 for the top 10 results and Qdrant dense search for the
  top 10 results.

### RRF Fusion

- The two ranked lists are merged with Reciprocal Rank Fusion, or RRF.
- RRF combines rankings instead of trying to compare BM25 scores and dense scores
  directly.
- In our implementation, `RRF_K = 60`.
- A passage receives more fusion score when it appears near the top of either
  retriever's list.
- The fused list gives us candidates that benefit from both keyword matching and
  semantic similarity.

### Cross-Encoder Reranking

- After RRF fusion, the top fused candidates are reranked with a cross-encoder.
- The reranker model is:
  `BAAI/bge-reranker-v2-m3`.
- The reranker reads the query and each candidate passage together, then scores
  how relevant the passage is to the query.
- This is more expensive than embedding search, so it is applied only after the
  candidate set has been narrowed down.
- The final runtime output is the top 3 reranked passages.
- Each returned passage contains:
  `text`, `context`, and `score`.

### RAG Runtime Details

- `RAGRetriever` loads the BM25 artifact from disk.
- It loads `BAAI/bge-m3` for query embeddings.
- It loads `BAAI/bge-reranker-v2-m3` for cross-encoder reranking.
- Both models run on CPU in the current implementation.
- The retriever is a lazy singleton created by `get_retriever()`.
- `orchestrator.warmup()` initializes it once at FastAPI startup.
- The runtime comment notes that the RAG models take roughly 4.6 GB because both
  the embedder and reranker are loaded.
- Repeated RAG queries are cached through `api/app/memory.py`.
- The cache key is based on the normalized English query:
  `rag:{english_query}`.
- The cache stores retrieved source passages, not the generated assistant reply.
- This means repeated questions can skip retrieval, while the final response can
  still be generated fresh.

### RAG in Response Composition

- Retrieved passages are passed into `orchestrator._compose_messages()`.
- They are inserted into the system prompt as counselor notes.
- The prompt tells the LLM to ground supportive suggestions only in those notes
  and not invent specifics.
- The final response is still produced by the Lightning `gpt-oss-120b` generation
  call.
- RAG therefore acts as grounding context, not as a replacement for the response
  generator.

### RAG Notebook Journey

- Notebook: `notebooks/04_rag.ipynb`.
- The notebook builds the dense index, exports the BM25 index, defines the hybrid
  retrieval flow, tests sample queries, and evaluates retrieval quality.
- Dense embeddings use `BAAI/bge-m3`, with 1024-dimensional vectors.
- Qdrant stores the dense vectors in the `sakina_counseling` collection.
- BM25 uses `rank-bm25` with lowercase `\w+` tokenization.
- The hybrid flow is:
  BM25 top 10 + dense top 10 -> RRF fusion -> cross-encoder rerank -> top 3.
- Retrieval evaluation uses a small hand-crafted probe set with Hit@5 and MRR@5.
- Reported retrieval smoke-test metrics:
  Hit@5 = 0.800 and MRR@5 = 0.750.
- Generation-quality evaluation uses a Lightning LLM judge as a dependency-free
  replacement for RAGAS.
- The judge scores faithfulness and answer relevancy from 0.0 to 1.0.
- Reported judge metrics:
  faithfulness = 1.000 and answer relevancy = 1.000.
- These metrics are useful as smoke tests, but they are not a large held-out
  clinical benchmark.
- Small hand-crafted probe set: A small set of manually prepared questions used to quickly test the system.
- Hit@5 = 0.800: The correct evidence appeared within the top 5 retrieved results in 80% of the test cases.
- MRR@5 = 0.750: The correct evidence usually appeared near the top of the retrieved results, not just somewhere in the top 5.
- Generation-quality evaluation: Tests whether the final generated answer is accurate, relevant, and supported by the retrieved context.
- Lightning LLM judge: A lightweight language-model evaluator used instead of RAGAS to score the generated answers.
- Faithfulness = 1.000: The answers were fully supported by the retrieved evidence and did not add unsupported information.
- Answer relevancy = 1.000: The answers directly addressed the user's questions without going off-topic.

## 7. Response Composition and Streaming

- Response composition is the final generation step after language detection,
  emotion classification, intent routing, and optional RAG.
- Implemented in `api/app/orchestrator.py`, with streaming handled by
  `api/app/main.py`.
- The orchestrator builds a prompt containing the detected language, emotion,
  intent guidance, recent conversation history, and RAG counselor notes if they
  exist.
- The reply is generated with Lightning `gpt-oss-120b` using `temperature=0.6`,
  so it is more conversational than the deterministic intent classifier.
- Sakina replies in the detected user language, keeps the answer brief and
  empathetic, and avoids diagnosis, prescriptions, or medical claims.
- If RAG sources are present, the prompt tells the model to ground supportive
  suggestions only in those notes.
- The frontend uses this metadata and final text dictionary to show emotion,
  language, optional RAG sources, crisis state, widgets, and the English reveal
  feature.
- After the turn finishes, the backend stores the user message, assistant reply,
  and prior language in memory.

## 8. Message / Session Memory

- Message/session memory is handled by `api/app/memory.py` and called from
  `api/app/main.py`.
- It stores recent conversation turns so Sakina can include short history in the
  next response.
- It also stores the prior detected language, which helps language detection with
  short or ambiguous follow-up messages.
- Redis is used when configured.
- If Redis is missing or unavailable, the system falls back to an in-process
  memory store.
- Memory failures are treated as safe misses or no-op writes, so they do not
  break the chat pipeline.
- The same memory layer also supports short-lived cache entries, such as cached
  RAG retrieval results.

## Adjacent Feature Summaries

### Scribble

- Scribble is a separate visual-reflection feature, not part of the normal chat
  pipeline.
- Implemented in `api/app/scribble.py` and exposed by `POST /scribble/reflect`.
- The user uploads a canvas image as a base64 data URL.
- Gemini image understanding reflects gently on the drawing and returns both a
  short reflection and one DAIR-style emotion label.
- The prompt is intentionally tentative: it must not diagnose or claim certainty.

### Letter Forward

- Letter Forward is a separate webhook-based feature for future-self letters and
  trusted-person crisis contact.
- The normal future-letter UI sends the letter, email, delivery timing, and
  `intent = "letter"` directly from the frontend to the n8n webhook.
- The backend crisis path can also call the same n8n webhook with
  `intent = "help"` when a trusted-person email is available.
- User name, user email, and trusted-person email are stored on the client device
  through local storage, not in a backend database table.
- This feature does not pass through language detection, emotion, intent, RAG, or
  response generation.

### Soundscape

- Soundscape is a frontend relaxation feature, not backend AI inference.
- Implemented in the side menu using static audio files under
  `frontend/public/sounds/`.
- Current sound options include rain, ocean, cafe, and forest.
- The selected sound loops in the browser until the user pauses or stops it.
- It does not affect language detection, emotion classification, intent routing,
  RAG, memory, or generation.
