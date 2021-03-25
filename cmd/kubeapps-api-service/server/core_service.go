/*
Copyright © 2021 VMware

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package server

import (
	"context"

	core "github.com/kubeapps/kubeapps/cmd/kubeapps-api-service/kubeappsapis/core/v1"
	"google.golang.org/grpc/metadata"
	log "k8s.io/klog/v2"
)

// coreServer implements the API defined in cmd/kubeapps-api-service/core/core.proto
type coreServer struct {
	core.UnimplementedCoreServiceServer
}

func (s *coreServer) PluginsAvailable(ctx context.Context, in *core.PluginsAvailableRequest) (*core.PluginsAvailableResponse, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	log.Infof("md: %+v, ok: %+v", md, ok)

	return &core.PluginsAvailableResponse{
		Plugins: []string{"foobar.package.v1"},
	}, nil
}