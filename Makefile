IMPORT_PATH:= github.com/kubeapps/kubeapps
GO = /usr/bin/env go
GOFMT = /usr/bin/env gofmt
VERSION ?= dev-$(shell date +%FT%H-%M-%S-%Z)

BINARY ?= kubeapps
GO_PACKAGES = ./...
GO_FILES := $(shell find $(shell $(GO) list -f '{{.Dir}}' $(GO_PACKAGES)) -name \*.go)
GO_FLAGS = -ldflags="-s -w -X github.com/kubeapps/kubeapps/cmd/kubeapps.VERSION=${VERSION}"
EMBEDDED_STATIC = generated/statik/statik.go

default: kubeapps

all: kubeapps kubeapps/dashboard kubeapps/chartsvc kubeapps/chart-repo kubeapps/apprepository-controller

static/kubeapps-objs.yaml:
	KUBEAPPS_VERSION=$${VERSION:-latest} ;\
	KUBECFG_JPATH=./manifests/lib:./manifests/vendor/kubecfg/lib:./manifests/vendor/ksonnet-lib \
	kubecfg show -V VERSION=$$KUBEAPPS_VERSION manifests/kubeapps.jsonnet > static/kubeapps-objs.yaml

$(EMBEDDED_STATIC): static/kubeapps-objs.yaml
	# force compilation on current OS
	GOOS= $(GO) build -o statik ./vendor/github.com/rakyll/statik/statik.go
	$(GO) generate

# Deprecated, will be removed in future releases
kubeapps: $(EMBEDDED_STATIC)
	$(GO) build -o $(BINARY) $(GO_FLAGS) $(IMPORT_PATH)

# TODO(miguel) Create Makefiles per component
kubeapps/%:
	docker build -t kubeapps/$*:$(VERSION) -f cmd/$*/Dockerfile .

kubeapps/dashboard:
	docker build -t kubeapps/dashboard:$(VERSION) -f dashboard/Dockerfile dashboard/

kubeapps/tiller-proxy:
	CGO_ENABLED=0 GOOS=linux go build -installsuffix cgo -o ./cmd/tiller-proxy/proxy-static ./cmd/tiller-proxy
	docker build -t kubeapps/tiller-proxy:$(VERSION) -f cmd/tiller-proxy/Dockerfile cmd/tiller-proxy

test: $(EMBEDDED_STATIC)
	$(GO) test $(GO_PACKAGES)

test-all: test-kubeapps test-chartsvc test-chart-repo test-apprepository-controller test-dashboard

# Deprecated
test-kubeapps:
	$(GO) test -v $(IMPORT_PATH)

test-dashboard:
	yarn --cwd dashboard/ install --frozen-lockfile
	yarn --cwd=dashboard run lint
	CI=true yarn --cwd dashboard/ run test

test-%:
	$(GO) test -v $(IMPORT_PATH)/cmd/$*

fmt:
	$(GOFMT) -s -w $(GO_FILES)

vet:
	$(GO) vet $(GO_PACKAGES)

clean:
	$(RM) ./kubeapps ./statik $(EMBEDDED_STATIC) static/kubeapps-objs.yaml

.PHONY: default all test-all test test-dashboard fmt vet clean build-prep chart-repo kubeapps $(EMBEDDED_STATIC) static/kubeapps-objs.yaml
