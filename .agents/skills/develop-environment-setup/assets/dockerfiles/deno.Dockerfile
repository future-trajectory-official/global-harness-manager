FROM denoland/deno:alpine-2.1.4

# Git やビルドツールが必要な場合に備えて追加
RUN apk add --no-cache git openssh-client

WORKDIR /app

# エントリポイントはデフォルトでシェル
CMD ["/bin/sh"]
