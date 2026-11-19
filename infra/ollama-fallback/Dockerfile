FROM ollama/ollama:latest

ENV OLLAMA_HOST=0.0.0.0:11434 \
    OLLAMA_MODELS=/data/models \
    OLLAMA_CONTEXT_LENGTH=512 \
    OLLAMA_NUM_PARALLEL=1 \
    OLLAMA_MAX_LOADED_MODELS=1 \
    OLLAMA_KEEP_ALIVE=30s

COPY entrypoint.sh /usr/local/bin/ollama-entrypoint.sh
RUN chmod 755 /usr/local/bin/ollama-entrypoint.sh

EXPOSE 11434

ENTRYPOINT ["/usr/local/bin/ollama-entrypoint.sh"]
