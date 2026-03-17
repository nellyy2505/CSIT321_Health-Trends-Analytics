# SAM build: install deps with long pip timeout to avoid "Read timed out".
# On Windows: use Git Bash or "sam build --use-container" (Docker).

build-ApiFunction:
	cp -r app $(ARTIFACTS_DIR)/
	cp lambda_handler.py requirements.txt $(ARTIFACTS_DIR)/
	python -m pip install -r requirements.txt -t $(ARTIFACTS_DIR) --timeout 600 --retries 10
	rm -rf $(ARTIFACTS_DIR)/bin
