BINARY := croc
WEB_BINARY := croc-web
UPDATE_BINARY := croc-update
AIR_VERSION := v1.65.1
BUILD_FLAGS := -buildvcs=false -trimpath -tags netgo,osusergo
LDFLAGS := -s -w -buildid=
CROC_PKG := github.com/schollz/croc/v11/src
# Self-hosted defaults, for example:
#   make build RELAY_POOL=relay.example.com:9009 WEB_URL=https://transfer.example.com
RELAY_POOL ?=
WEB_URL ?=
comma := ,
ifneq ($(strip $(RELAY_POOL)),)
FIRST_RELAY := $(firstword $(subst $(comma), ,$(RELAY_POOL)))
LDFLAGS += -X $(CROC_PKG)/publicrelay.Pool=$(RELAY_POOL) -X $(CROC_PKG)/models.DEFAULT_RELAY=$(FIRST_RELAY) -X $(CROC_PKG)/models.DEFAULT_RELAY6=$(FIRST_RELAY)
endif
ifneq ($(strip $(WEB_URL)),)
LDFLAGS += -X $(CROC_PKG)/models.DEFAULT_WEB_URL=$(WEB_URL)
endif
STORE_DIR ?= ./tmp/store
STORE_DOWNLOADS ?= 100

.PHONY: build web-assets build-web serve

build:
	CGO_ENABLED=0 go build $(BUILD_FLAGS) -ldflags="$(LDFLAGS)" -o $(BINARY) .
	CGO_ENABLED=0 go build $(BUILD_FLAGS) -ldflags="$(LDFLAGS)" -o $(UPDATE_BINARY) ./cmd/croc-update

web-assets:
	cd web && if [ ! -d node_modules ]; then npm install; fi && npm run embed

build-web: web-assets
	CGO_ENABLED=0 go build $(BUILD_FLAGS) -ldflags="$(LDFLAGS)" -o $(WEB_BINARY) ./cmd/croc-web

serve:
	go run github.com/air-verse/air@$(AIR_VERSION) -c .air.toml -- --bind 0.0.0.0:9014 --store-dir "$(STORE_DIR)" --store-downloads "$(STORE_DOWNLOADS)"
